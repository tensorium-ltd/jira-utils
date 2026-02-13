#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 2A';

const PIPELINE_STATUSES = [
  'In Dev',
  'Ready for Review',
  'In Review',
  'In QA',
  'Ready for Release',
  'Closed'
];

const ACTIVE_STATUSES = [
  'In Dev',
  'Ready for Review',
  'In Review',
  'In QA'
];

const COMPLETED_STATUSES = [
  'Ready for Release',
  'Closed'
];

const BLOCKED_THRESHOLDS_DAYS = [3, 5, 10];
const OLDEST_ISSUES_LIMIT = 5;

function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
    process.exit(1);
  }
}

function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
  });
}

function normalizeStatus(status) {
  return status ? status.trim().toUpperCase() : '';
}

function statusMap(statuses) {
  const map = new Map();
  statuses.forEach(status => map.set(normalizeStatus(status), status));
  return map;
}

const PIPELINE_STATUS_MAP = statusMap(PIPELINE_STATUSES);
const ACTIVE_STATUS_MAP = statusMap(ACTIVE_STATUSES);
const COMPLETED_STATUS_MAP = statusMap(COMPLETED_STATUSES);

function parseDateArg() {
  const input = process.argv[2];
  if (!input) {
    return new Date().toISOString().split('T')[0];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    console.warn(`⚠️  Invalid date format "${input}". Expected YYYY-MM-DD. Using today (UTC).`);
    return new Date().toISOString().split('T')[0];
  }
  return input;
}

function daysSince(dateString) {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

async function fetchIssuesByJql(client, jql, fields) {
  const results = [];
  let nextPageToken = null;

  do {
    const body = {
      jql,
      maxResults: 100,
      fields
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;

    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return results;
}

async function fetchUpdatedTodayIssueKeys(client, dateStr) {
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${FIX_VERSION}" AND updated >= "${dateStr}" ORDER BY updated DESC`;
  const issues = await fetchIssuesByJql(client, jql, ['key']);
  return issues.map(issue => issue.key).filter(Boolean);
}

async function fetchIssueWithChangelog(client, issueKey) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: 'summary,status,statuscategorychangedate',
      expand: 'changelog'
    }
  });
  return response.data;
}

function initStageBuckets(statuses) {
  const buckets = new Map();
  statuses.forEach(status => {
    buckets.set(status, {
      keys: new Set(),
      items: []
    });
  });
  return buckets;
}

function addStageTransition(buckets, stage, issue, changedAt) {
  const bucket = buckets.get(stage);
  if (!bucket || bucket.keys.has(issue.key)) return;
  bucket.keys.add(issue.key);
  bucket.items.push({
    key: issue.key,
    summary: issue.fields?.summary || '',
    changedAt
  });
}

function collectTransitionsForDay(issue, dateStr, stageBuckets) {
  const histories = issue.changelog?.histories || [];
  histories.forEach(history => {
    const changeDate = history.created.split('T')[0];
    if (changeDate !== dateStr) return;

    (history.items || []).forEach(item => {
      if (item.field !== 'status' || !item.toString) return;
      const normalized = normalizeStatus(item.toString);
      const stage = PIPELINE_STATUS_MAP.get(normalized);
      if (!stage) return;
      addStageTransition(stageBuckets, stage, issue, history.created);
    });
  });
}

async function collectDailyTransitions(client, dateStr) {
  const issueKeys = await fetchUpdatedTodayIssueKeys(client, dateStr);
  const stageBuckets = initStageBuckets(PIPELINE_STATUSES);

  for (const issueKey of issueKeys) {
    try {
      const issue = await fetchIssueWithChangelog(client, issueKey);
      collectTransitionsForDay(issue, dateStr, stageBuckets);
    } catch (error) {
      console.warn(`   ⚠️  Could not fetch ${issueKey}: ${error.message}`);
    }
  }

  return stageBuckets;
}

async function fetchCurrentWip(client) {
  const statusList = ACTIVE_STATUSES.map(status => `"${status}"`).join(', ');
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${FIX_VERSION}" AND status in (${statusList}) ORDER BY status ASC`;
  const fields = ['key', 'summary', 'status', 'statuscategorychangedate'];
  const issues = await fetchIssuesByJql(client, jql, fields);

  const grouped = initStageBuckets(ACTIVE_STATUSES);
  issues.forEach(issue => {
    const statusName = issue.fields?.status?.name || '';
    const canonical = ACTIVE_STATUS_MAP.get(normalizeStatus(statusName));
    if (!canonical) return;
    grouped.get(canonical).items.push(issue);
  });

  return grouped;
}

function buildAgingSummary(grouped) {
  const summary = new Map();
  grouped.forEach((bucket, status) => {
    const agingCounts = BLOCKED_THRESHOLDS_DAYS.reduce((acc, threshold) => {
      acc[threshold] = 0;
      return acc;
    }, {});

    const agedIssues = bucket.items.map(issue => {
      const age = daysSince(issue.fields?.statuscategorychangedate);
      return {
        key: issue.key,
        summary: issue.fields?.summary || '',
        age
      };
    });

    agedIssues.forEach(issue => {
      if (issue.age === null) return;
      BLOCKED_THRESHOLDS_DAYS.forEach(threshold => {
        if (issue.age >= threshold) agingCounts[threshold] += 1;
      });
    });

    const oldest = agedIssues
      .filter(issue => issue.age !== null)
      .sort((a, b) => b.age - a.age)
      .slice(0, OLDEST_ISSUES_LIMIT);

    summary.set(status, {
      total: bucket.items.length,
      agingCounts,
      oldest
    });
  });

  return summary;
}

function renderTransitionsSection(lines, stageBuckets) {
  lines.push('## Flow Today (Status Transitions)');
  lines.push('');
  lines.push('| Stage Entered | Tickets |');
  lines.push('|---------------|---------|');
  PIPELINE_STATUSES.forEach(stage => {
    const count = stageBuckets.get(stage)?.keys.size || 0;
    lines.push(`| ${stage} | ${count} |`);
  });

  PIPELINE_STATUSES.forEach(stage => {
    const bucket = stageBuckets.get(stage);
    if (!bucket || bucket.items.length === 0) return;

    lines.push('');
    lines.push(`### ${stage}`);
    lines.push('');
    lines.push('| Key | Changed At (UTC) | Summary |');
    lines.push('|-----|------------------|---------|');
    bucket.items
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach(item => {
        lines.push(`| ${item.key} | ${item.changedAt} | ${item.summary} |`);
      });
  });
}

function renderWipSection(lines, agingSummary) {
  lines.push('');
  lines.push('## Current WIP Snapshot');
  lines.push('');
  lines.push('| Stage | Count | ≥3d | ≥5d | ≥10d |');
  lines.push('|-------|-------|-----|-----|------|');

  ACTIVE_STATUSES.forEach(stage => {
    const stats = agingSummary.get(stage) || { total: 0, agingCounts: {} };
    lines.push(`| ${stage} | ${stats.total} | ${stats.agingCounts[3] || 0} | ${stats.agingCounts[5] || 0} | ${stats.agingCounts[10] || 0} |`);
  });

  ACTIVE_STATUSES.forEach(stage => {
    const stats = agingSummary.get(stage);
    if (!stats || stats.oldest.length === 0) return;
    lines.push('');
    lines.push(`### ${stage} - Oldest Issues`);
    lines.push('');
    lines.push('| Key | Days Since Status Change | Summary |');
    lines.push('|-----|---------------------------|---------|');
    stats.oldest.forEach(issue => {
      lines.push(`| ${issue.key} | ${issue.age} | ${issue.summary} |`);
    });
  });
}

function renderCompletedSection(lines, stageBuckets) {
  const completed = COMPLETED_STATUSES.flatMap(status => {
    const bucket = stageBuckets.get(status);
    return bucket ? bucket.items.map(item => ({ ...item, status })) : [];
  });

  if (!completed.length) return;

  lines.push('');
  lines.push('## Completed Today');
  lines.push('');
  lines.push('| Key | Status | Changed At (UTC) | Summary |');
  lines.push('|-----|--------|------------------|---------|');
  completed
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach(item => {
      lines.push(`| ${item.key} | ${item.status} | ${item.changedAt} | ${item.summary} |`);
    });
}

function saveMarkdownReport(dateStr, stageBuckets, agingSummary) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `throughput-daily-${dateStr}.md`;
  const filepath = path.join(reportsDir, filename);
  const lines = [];

  lines.push(`# Daily Throughput Report - ${dateStr}`);
  lines.push('');
  lines.push(`Project: ${PROJECT_KEY}`);
  lines.push(`Fix Version: ${FIX_VERSION}`);
  lines.push('');
  lines.push('Timezone: UTC');
  lines.push('');
  lines.push(`Pipeline: ${ACTIVE_STATUSES.join(' → ')} → ${COMPLETED_STATUSES.join(' / ')}`);
  lines.push('');

  renderTransitionsSection(lines, stageBuckets);
  renderWipSection(lines, agingSummary);
  renderCompletedSection(lines, stageBuckets);

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`✅ Markdown report saved to: ${filepath}`);
  return filepath;
}

async function main() {
  try {
    validateConfig();
    const client = createJiraClient();
    const dateStr = parseDateArg();

    console.log('\n📈 Daily Throughput Report');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Fix Version: ${FIX_VERSION}`);
    console.log(`   Date (UTC): ${dateStr}`);
    console.log(`   Pipeline: ${PIPELINE_STATUSES.join(' → ')}`);

    console.log('\n🔎 Collecting daily transitions...');
    const stageBuckets = await collectDailyTransitions(client, dateStr);

    console.log('🔎 Collecting current WIP...');
    const wipGrouped = await fetchCurrentWip(client);
    const agingSummary = buildAgingSummary(wipGrouped);

    const completedCount = COMPLETED_STATUSES.reduce((acc, status) => {
      return acc + (stageBuckets.get(status)?.keys.size || 0);
    }, 0);

    console.log('\n✅ Summary');
    PIPELINE_STATUSES.forEach(stage => {
      const count = stageBuckets.get(stage)?.keys.size || 0;
      console.log(`   - ${stage}: ${count} moved today`);
    });
    console.log(`   - Completed Today: ${completedCount}`);

    saveMarkdownReport(dateStr, stageBuckets, agingSummary);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Failed to generate report');
    console.error(error.message);
    process.exit(1);
  }
}

main();
