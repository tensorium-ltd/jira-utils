#!/usr/bin/env node

/**
 * Story Cycle Time – NH Sprint 37
 *
 * For all completed Story tickets in the sprint, calculates how long they took
 * from when they first entered "In Dev" status until they reached a completed status.
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const SPRINT_NAME = 'NH Sprint 37';
const TEAM_FIELD_ID = 'customfield_12700';

async function discoverStoryPointsFieldId(client) {
  try {
    const { data: fields } = await client.get('/rest/api/3/field');
    const storyPointsField = fields.find(
      (f) => f.name && f.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch {
    return 'customfield_10003';
  }
}

function getStoryPoints(value) {
  return value != null && value !== '' ? Number(value) : null;
}

const IN_DEV_STATUSES = ['In Dev', 'In dev'];
const COMPLETED_STATUSES = [
  'Ready for Release',
  'Ready for release',
  'Complete',
  'Completed',
  'Done',
  'Closed',
  'Resolved'
];

function validateConfig() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN must be set');
    process.exit(1);
  }
}

function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 30000
  });
}

async function fetchIssuesByJql(client, jql, fields) {
  const results = [];
  let nextPageToken = null;
  do {
    const body = { jql, maxResults: 100, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;
    if (nextPageToken) await new Promise((r) => setTimeout(r, 200));
  } while (nextPageToken);
  return results;
}

function getTeamName(issue) {
  const val = issue.fields?.[TEAM_FIELD_ID];
  if (!val) return 'Unassigned';
  if (typeof val === 'string') return val;
  if (val.value) return val.value;
  if (val.name) return val.name;
  if (Array.isArray(val) && val[0]) return val[0].value || val[0].name || 'Unassigned';
  return 'Unassigned';
}

function getAssigneeName(issue) {
  const a = issue.fields?.assignee;
  return a?.displayName || 'Unassigned';
}

function isInDev(status) {
  return IN_DEV_STATUSES.some((s) => (status || '').toLowerCase() === s.toLowerCase());
}

function isCompleted(status) {
  return COMPLETED_STATUSES.some((s) => (status || '').toLowerCase().includes(s.toLowerCase()));
}

/**
 * Build status transitions from changelog, sorted chronologically.
 */
function buildStatusTransitions(issue) {
  const histories = issue.changelog?.histories || [];
  const events = [];

  for (const history of histories) {
    const items = history.items || [];
    for (const item of items) {
      if (item.field === 'status' && item.toString) {
        events.push({
          at: new Date(history.created),
          to: item.toString
        });
      }
    }
  }

  return events.sort((a, b) => a.at - b.at);
}

/**
 * Returns { firstInDevAt, completedAt, durationMs } or null if we can't compute.
 */
function computeCycleTime(issue) {
  const transitions = buildStatusTransitions(issue);
  let firstInDevAt = null;
  let completedAt = null;

  for (const t of transitions) {
    if (isInDev(t.to) && !firstInDevAt) {
      firstInDevAt = t.at;
    }
    if (isCompleted(t.to)) {
      completedAt = t.at;
    }
  }

  if (!firstInDevAt || !completedAt || completedAt < firstInDevAt) {
    return null;
  }

  return {
    firstInDevAt,
    completedAt,
    durationMs: completedAt - firstInDevAt
  };
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hrs > 0) return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  if (min > 0) return `${min} min`;
  return `${sec} sec`;
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  const jql = `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype = Story AND statusCategory = Done`;
  const fields = ['key', 'summary', 'status', 'issuetype', 'assignee', TEAM_FIELD_ID, storyPointsFieldId];

  console.log('\n📊 Story Cycle Time – NH Sprint 37');
  console.log('='.repeat(60));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log('Metric: Time from first "In Dev" → completed status');
  console.log('');

  console.log('🔎 Fetching completed Story tickets...');
  const issues = await fetchIssuesByJql(client, jql, fields);
  console.log(`   Found ${issues.length} completed Stories`);
  console.log('');

  if (issues.length === 0) {
    console.log('   No completed Stories in this sprint.');
    return;
  }

  console.log('🔎 Fetching changelog for each issue...');
  const results = [];

  for (let i = 0; i < issues.length; i++) {
    const ref = issues[i];
    const key = ref.key || ref.id;
    process.stdout.write(`   ${i + 1}/${issues.length} ${key}...\r`);

    try {
      const full = await client.get(`/rest/api/3/issue/${key}`, {
        params: { fields: fields.join(','), expand: 'changelog' }
      });
      const issue = full.data;
      const cycle = computeCycleTime(issue);

      const storyPoints = getStoryPoints(issue.fields?.[storyPointsFieldId]);
      if (cycle) {
        results.push({
          key,
          summary: (issue.fields?.summary || '').slice(0, 80),
          status: issue.fields?.status?.name || 'Unknown',
          storyPoints,
          team: getTeamName(issue),
          assignee: getAssigneeName(issue),
          firstInDevAt: cycle.firstInDevAt.toISOString(),
          completedAt: cycle.completedAt.toISOString(),
          durationMs: cycle.durationMs,
          durationFormatted: formatDuration(cycle.durationMs)
        });
      } else {
        results.push({
          key,
          summary: (issue.fields?.summary || '').slice(0, 80),
          status: issue.fields?.status?.name || 'Unknown',
          storyPoints,
          team: getTeamName(issue),
          assignee: getAssigneeName(issue),
          firstInDevAt: null,
          completedAt: null,
          durationMs: null,
          durationFormatted: 'N/A (no In Dev → completed path in changelog)'
        });
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${key}: ${err.message}`);
    }
  }

  console.log('\n');

  // Sort by duration desc (longest first)
  const withDuration = results.filter((r) => r.durationMs != null);
  withDuration.sort((a, b) => b.durationMs - a.durationMs);

  // Console output
  console.log('='.repeat(70));
  console.log('📋 STORY CYCLE TIME (In Dev → Completed)');
  console.log('='.repeat(70));
  console.log('');

  const tableRows = withDuration.map((r) => ({
    Key: r.key,
    SP: r.storyPoints ?? '–',
    Summary: (r.summary || '').slice(0, 40) + ((r.summary || '').length > 40 ? '...' : ''),
    Team: r.team,
    Assignee: (r.assignee || '').slice(0, 18),
    'First In Dev': r.firstInDevAt?.split('T')[0] ?? '–',
    Completed: r.completedAt?.split('T')[0] ?? '–',
    Duration: r.durationFormatted
  }));
  console.table(tableRows);
  console.log('');

  const noDuration = results.filter((r) => r.durationMs == null);
  if (noDuration.length > 0) {
    console.log('---');
    console.log('   (Could not compute cycle time – no In Dev → completed path):');
    noDuration.forEach((r) => console.log(`   - ${r.key}`));
    console.log('');
  }

  const durationsMs = withDuration.map((r) => r.durationMs);
  const avgMs = durationsMs.length > 0
    ? durationsMs.reduce((s, d) => s + d, 0) / durationsMs.length
    : 0;
  const medianMs = median(durationsMs);
  const totalDays = durationsMs.length > 0
    ? (durationsMs.reduce((s, d) => s + d, 0) / (1000 * 60 * 60 * 24)).toFixed(1)
    : 0;

  console.log(`   Total: ${withDuration.length} stories with cycle time`);
  console.log(`   Average: ${formatDuration(avgMs)} | Median: ${medianMs != null ? formatDuration(medianMs) : 'N/A'} (${totalDays} days total)`);
  console.log('');

  // Save report
  const now = new Date();
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = now.toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `story-cycle-time-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `story-cycle-time-${dateStr}.md`);

  const report = {
    generatedAt: now.toISOString(),
    sprint: SPRINT_NAME,
    metric: 'Time from first In Dev to completed status',
    totalCompleted: issues.length,
    withCycleTime: withDuration.length,
    withoutCycleTime: noDuration.length,
    averageDurationMs: avgMs,
    averageDurationFormatted: formatDuration(avgMs),
    medianDurationMs: medianMs,
    medianDurationFormatted: medianMs != null ? formatDuration(medianMs) : null,
    totalStoryPoints: results.reduce((s, r) => s + (r.storyPoints ?? 0), 0),
    stories: results
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Story Cycle Time – NH Sprint 37');
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint:** ${SPRINT_NAME}`);
  mdLines.push(`**Metric:** Time from first "In Dev" → completed status`);
  mdLines.push('');
  mdLines.push(`- Completed Stories: ${issues.length}`);
  mdLines.push(`- With cycle time: ${withDuration.length}`);
  mdLines.push(`- Total Story Points: ${report.totalStoryPoints}`);
  mdLines.push(`- Average cycle time: ${formatDuration(avgMs)}`);
  mdLines.push(`- Median cycle time: ${medianMs != null ? formatDuration(medianMs) : 'N/A'}`);
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Stories (sorted by duration, longest first)');
  mdLines.push('');
  mdLines.push('| Key | SP | Summary | Team | Assignee | First In Dev | Completed | Duration |');
  mdLines.push('|-----|----|---------|------|----------|--------------|----------|----------|');
  withDuration.forEach((r) => {
    const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 40);
    const sp = r.storyPoints != null ? r.storyPoints : '–';
    mdLines.push(`| ${r.key} | ${sp} | ${sum} | ${r.team} | ${r.assignee} | ${r.firstInDevAt?.split('T')[0]} | ${r.completedAt?.split('T')[0]} | ${r.durationFormatted} |`);
  });
  if (noDuration.length > 0) {
    mdLines.push('');
    mdLines.push('## Could not compute (no In Dev → completed path)');
    mdLines.push('');
    noDuration.forEach((r) => mdLines.push(`- ${r.key}: ${(r.summary || '').slice(0, 60)}`));
  }

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
