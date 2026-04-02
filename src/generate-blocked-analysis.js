#!/usr/bin/env node

/**
 * Blocked Analysis – NH Sprint 37
 *
 * 1. List of blocked tickets with: how long blocked, Team, Assignee
 * 2. For ALL tickets in sprint: time in current status
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const SPRINT_NAME = 'NH Sprint 37';
const TEAM_FIELD_ID = 'customfield_12700';

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

/**
 * Get status change history from changelog.
 * Returns { lastStatusChangeAt } - when status last changed (entered current status).
 * When current status is Blocked, lastStatusChangeAt = when they entered Blocked.
 */
function parseChangelogForStatus(issue) {
  const histories = issue.changelog?.histories || [];
  let lastStatusChangeAt = null;

  for (const h of histories) {
    for (const item of h.items || []) {
      if (item.field === 'status') {
        const at = new Date(h.created);
        if (!lastStatusChangeAt || at > lastStatusChangeAt) {
          lastStatusChangeAt = at;
        }
      }
    }
  }

  return { lastStatusChangeAt };
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  const jql = `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  const fields = ['key', 'summary', 'status', 'issuetype', 'assignee', TEAM_FIELD_ID];

  console.log('\n📊 Blocked Analysis – NH Sprint 37');
  console.log('='.repeat(60));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log('');

  console.log('🔎 Fetching sprint issues...');
  const issues = await fetchIssuesByJql(client, jql, fields);
  console.log(`   Found ${issues.length} issues`);

  console.log('🔎 Fetching changelog for each issue...');
  const now = new Date();
  const allWithStatusTime = [];
  const blockedList = [];

  for (let i = 0; i < issues.length; i++) {
    const ref = issues[i];
    const key = ref.key || ref.id;
    process.stdout.write(`   ${i + 1}/${issues.length} ${key}...\r`);

    try {
      const full = await client.get(`/rest/api/3/issue/${key}`, {
        params: { fields: fields.join(','), expand: 'changelog' }
      });
      const issue = full.data;
      const status = issue.fields?.status?.name || 'Unknown';
      const isBlocked = status.toLowerCase() === 'blocked';

      const { lastStatusChangeAt } = parseChangelogForStatus(issue);

      const timeInCurrentStatusMs = lastStatusChangeAt ? now - lastStatusChangeAt : null;
      const timeInCurrentStatusStr = timeInCurrentStatusMs != null ? formatDuration(timeInCurrentStatusMs) : 'Unknown';

      const blockedDurationMs = isBlocked ? timeInCurrentStatusMs : null;
      const blockedDurationStr = isBlocked ? timeInCurrentStatusStr : null;

      const team = getTeamName(issue);
      const assignee = getAssigneeName(issue);

      const record = {
        key,
        summary: (issue.fields?.summary || '').slice(0, 60),
        status,
        issuetype: issue.fields?.issuetype?.name || 'Unknown',
        team,
        assignee,
        timeInCurrentStatus: timeInCurrentStatusStr,
        timeInCurrentStatusMs
      };

      allWithStatusTime.push(record);

      if (isBlocked) {
        blockedList.push({
          ...record,
          blockedDuration: blockedDurationStr,
          blockedSince: lastStatusChangeAt ? lastStatusChangeAt.toISOString().split('T')[0] : null
        });
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${key}: ${err.message}`);
    }
  }

  console.log('\n');

  // Sort: blocked by blocked duration desc, all by time in status desc
  blockedList.sort((a, b) => (b.timeInCurrentStatusMs || 0) - (a.timeInCurrentStatusMs || 0));
  allWithStatusTime.sort((a, b) => (b.timeInCurrentStatusMs || 0) - (a.timeInCurrentStatusMs || 0));

  const inDev = allWithStatusTime.filter((r) => /in dev/i.test(r.status));
  const inReview = allWithStatusTime.filter((r) => /in review|ready for review/i.test(r.status));
  const inQa = allWithStatusTime.filter((r) => /in qa|ready for qa/i.test(r.status));

  function printStatusSection(title, items) {
    console.log('='.repeat(70));
    console.log(title);
    console.log('='.repeat(70));
    if (items.length === 0) {
      console.log('\n   None.\n');
      return;
    }
    console.log('');
    items.forEach((r) => {
      console.log(`   ${r.key} – ${r.summary}${r.summary.length >= 60 ? '...' : ''}`);
      console.log(`      Status: ${r.status} | Time in status: ${r.timeInCurrentStatus} | Team: ${r.team} | Assignee: ${r.assignee}`);
      console.log('');
    });
    console.log(`   Total: ${items.length}`);
    console.log('');
  }

  // Output
  console.log('='.repeat(70));
  console.log('🚫 BLOCKED TICKETS');
  console.log('='.repeat(70));
  if (blockedList.length === 0) {
    console.log('\n   No blocked tickets in this sprint.\n');
  } else {
    console.log('');
    blockedList.forEach((b) => {
      console.log(`   ${b.key} – ${b.summary}${b.summary.length >= 60 ? '...' : ''}`);
      console.log(`      Status: ${b.status} | Blocked for: ${b.blockedDuration} | Team: ${b.team} | Assignee: ${b.assignee}`);
      console.log('');
    });
    console.log(`   Total blocked: ${blockedList.length}`);
    console.log('');
  }

  printStatusSection('💻 IN DEV – Time in status', inDev);
  printStatusSection('👀 IN REVIEW / READY FOR REVIEW – Time in status', inReview);
  printStatusSection('🧪 IN QA / READY FOR QA – Time in status', inQa);

  console.log('='.repeat(70));
  console.log('📋 ALL TICKETS – TIME IN CURRENT STATUS');
  console.log('='.repeat(70));
  console.log('');
  console.log('   Key         | Status              | Time in Status | Team       | Assignee');
  console.log('   ' + '-'.repeat(90));
  allWithStatusTime.forEach((r) => {
    const key = (r.key || '').padEnd(12);
    const status = (r.status || '').slice(0, 18).padEnd(18);
    const time = (r.timeInCurrentStatus || 'Unknown').padEnd(14);
    const team = (r.team || 'Unassigned').slice(0, 10).padEnd(10);
    const assignee = (r.assignee || 'Unassigned').slice(0, 20);
    console.log(`   ${key} | ${status} | ${time} | ${team} | ${assignee}`);
  });
  console.log('');

  const report = {
    generatedAt: now.toISOString(),
    sprint: SPRINT_NAME,
    blocked: blockedList,
    inDev,
    inReview,
    inQa,
    allTickets: allWithStatusTime
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = now.toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `blocked-analysis-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `blocked-analysis-${dateStr}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Blocked Analysis – NH Sprint 37');
  mdLines.push('');
  mdLines.push(`**Generated:** ${now.toISOString().split('T')[0]}`);
  mdLines.push(`**Sprint:** ${SPRINT_NAME}`);
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 🚫 Blocked Tickets');
  mdLines.push('');
  if (blockedList.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Blocked for | Team | Assignee |');
    mdLines.push('|-----|---------|-------------|------|----------|');
    blockedList.forEach((b) => {
      const sum = (b.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${b.key} | ${sum} | ${b.blockedDuration} | ${b.team} | ${b.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${blockedList.length}`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 💻 In Dev – Time in status');
  mdLines.push('');
  if (inDev.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Time in status | Team | Assignee |');
    mdLines.push('|-----|---------|----------------|------|----------|');
    inDev.forEach((r) => {
      const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${r.key} | ${sum} | ${r.timeInCurrentStatus} | ${r.team} | ${r.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${inDev.length}`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 👀 In Review / Ready for Review – Time in status');
  mdLines.push('');
  if (inReview.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Time in status | Team | Assignee |');
    mdLines.push('|-----|---------|----------------|------|----------|');
    inReview.forEach((r) => {
      const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${r.key} | ${sum} | ${r.timeInCurrentStatus} | ${r.team} | ${r.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${inReview.length}`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 🧪 In QA / Ready for QA – Time in status');
  mdLines.push('');
  if (inQa.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Time in status | Team | Assignee |');
    mdLines.push('|-----|---------|----------------|------|----------|');
    inQa.forEach((r) => {
      const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${r.key} | ${sum} | ${r.timeInCurrentStatus} | ${r.team} | ${r.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${inQa.length}`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## 📋 All Tickets – Time in Current Status');
  mdLines.push('');
  mdLines.push('| Key | Status | Time in Status | Team | Assignee |');
  mdLines.push('|-----|--------|----------------|------|----------|');
  allWithStatusTime.forEach((r) => {
    mdLines.push(`| ${r.key} | ${r.status} | ${r.timeInCurrentStatus} | ${r.team} | ${r.assignee} |`);
  });
  mdLines.push('');
  mdLines.push(`**Total:** ${allWithStatusTime.length}`);

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
