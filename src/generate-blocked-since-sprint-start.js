#!/usr/bin/env node

/**
 * Blocked Since Sprint Start – NH Sprint 37
 *
 * Shows only Story tickets that were put into Blocked status since the sprint started.
 * Excludes Bugs, Sub-bugs, Sub-tasks. Excludes tickets already blocked before sprint began.
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

async function fetchAllSprints(client, boardId) {
  const results = [];
  let startAt = 0;
  let isLast = false;
  while (!isLast) {
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: 'active,closed,future', startAt, maxResults: 50 }
    });
    const data = response.data || {};
    results.push(...(data.values || []));
    startAt += data.maxResults || 50;
    isLast = data.isLast || !(data.values || []).length;
  }
  return results;
}

async function getSprintByName(client, boardId, sprintName) {
  const sprints = await fetchAllSprints(client, boardId);
  return sprints.find((s) => s.name === sprintName) || null;
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
 * Find when the ticket last transitioned TO Blocked status.
 */
function getBlockedSince(issue) {
  const histories = issue.changelog?.histories || [];
  let blockedAt = null;

  for (const h of histories) {
    for (const item of h.items || []) {
      if (item.field === 'status' && (item.toString || '').toLowerCase() === 'blocked') {
        const at = new Date(h.created);
        if (!blockedAt || at > blockedAt) {
          blockedAt = at;
        }
      }
    }
  }
  return blockedAt;
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  const sprint = await getSprintByName(client, BOARD_ID, SPRINT_NAME);
  if (!sprint) {
    console.error(`Error: Sprint "${SPRINT_NAME}" not found on board ${BOARD_ID}`);
    process.exit(1);
  }

  const sprintStart = sprint.startDate ? new Date(sprint.startDate) : null;
  if (!sprintStart) {
    console.error('Error: Sprint has no start date');
    process.exit(1);
  }

  const jql = `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype = Story AND status = Blocked`;
  const fields = ['key', 'summary', 'status', 'issuetype', 'assignee', TEAM_FIELD_ID];

  console.log('\n📊 Blocked Since Sprint Start – NH Sprint 37');
  console.log('='.repeat(60));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log(`Sprint start: ${sprintStart.toISOString().split('T')[0]}`);
  console.log('');

  console.log('🔎 Fetching blocked Story tickets in sprint...');
  const issues = await fetchIssuesByJql(client, jql, fields);
  console.log(`   Found ${issues.length} blocked Stories`);
  console.log('');

  if (issues.length === 0) {
    console.log('   No blocked Stories in this sprint.');
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const dateStr = new Date().toISOString().split('T')[0];
    const jsonPath = path.join(reportsDir, `blocked-since-sprint-start-${dateStr}.json`);
    const mdPath = path.join(reportsDir, `blocked-since-sprint-start-${dateStr}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), sprint: SPRINT_NAME, sprintStart: sprintStart.toISOString(), blockedSinceSprintStart: [], blockedBeforeSprintStart: [] }, null, 2));
    fs.writeFileSync(mdPath, '# Blocked Since Sprint Start – Stories\n\nNo blocked Stories in this sprint.\n');
    console.log(`✅ Report saved: ${jsonPath}`);
    return;
  }

  console.log('🔎 Checking when each ticket entered Blocked...');
  const now = new Date();
  const blockedSinceSprintStart = [];
  const blockedBeforeSprintStart = [];

  for (let i = 0; i < issues.length; i++) {
    const ref = issues[i];
    const key = ref.key || ref.id;
    process.stdout.write(`   ${i + 1}/${issues.length} ${key}...\r`);

    try {
      const full = await client.get(`/rest/api/3/issue/${key}`, {
        params: { fields: fields.join(','), expand: 'changelog' }
      });
      const issue = full.data;
      const blockedAt = getBlockedSince(issue);

      const timeInBlockedMs = blockedAt ? now - blockedAt : 0;
      const team = getTeamName(issue);
      const assignee = getAssigneeName(issue);

      const record = {
        key,
        summary: (issue.fields?.summary || '').slice(0, 60),
        status: issue.fields?.status?.name || 'Blocked',
        issuetype: issue.fields?.issuetype?.name || 'Unknown',
        team,
        assignee,
        blockedSince: blockedAt ? blockedAt.toISOString().split('T')[0] : null,
        blockedDurationMs: timeInBlockedMs,
        blockedDuration: formatDuration(timeInBlockedMs)
      };

      if (blockedAt && blockedAt >= sprintStart) {
        blockedSinceSprintStart.push(record);
      } else {
        blockedBeforeSprintStart.push(record);
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${key}: ${err.message}`);
    }
  }

  console.log('\n');

  blockedSinceSprintStart.sort((a, b) => b.blockedDurationMs - a.blockedDurationMs);
  blockedBeforeSprintStart.sort((a, b) => b.blockedDurationMs - a.blockedDurationMs);

  console.log('='.repeat(70));
  console.log('🚫 BLOCKED DURING SPRINT (since sprint start)');
  console.log('='.repeat(70));
  if (blockedSinceSprintStart.length === 0) {
    console.log('\n   None.\n');
  } else {
    const tableDuring = blockedSinceSprintStart.map((b) => ({
      Key: b.key,
      Summary: (b.summary || '').slice(0, 45) + ((b.summary || '').length > 45 ? '...' : ''),
      'Blocked since': b.blockedSince,
      'Blocked for': b.blockedDuration,
      Team: b.team,
      Assignee: (b.assignee || '').slice(0, 20)
    }));
    console.table(tableDuring);
    console.log(`   Total: ${blockedSinceSprintStart.length}\n`);
  }

  console.log('='.repeat(70));
  console.log('🚫 BLOCKED BEFORE SPRINT START');
  console.log('='.repeat(70));
  if (blockedBeforeSprintStart.length === 0) {
    console.log('\n   None.\n');
  } else {
    const tableBefore = blockedBeforeSprintStart.map((b) => ({
      Key: b.key,
      Summary: (b.summary || '').slice(0, 45) + ((b.summary || '').length > 45 ? '...' : ''),
      'Blocked since': b.blockedSince,
      'Blocked for': b.blockedDuration,
      Team: b.team,
      Assignee: (b.assignee || '').slice(0, 20)
    }));
    console.table(tableBefore);
    console.log(`   Total: ${blockedBeforeSprintStart.length}\n`);
  }

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = now.toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `blocked-since-sprint-start-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `blocked-since-sprint-start-${dateStr}.md`);

  const report = {
    generatedAt: now.toISOString(),
    sprint: SPRINT_NAME,
    sprintStart: sprintStart.toISOString(),
    totalBlockedInSprint: issues.length,
    blockedSinceSprintStart: blockedSinceSprintStart,
    blockedBeforeSprintStart: blockedBeforeSprintStart
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Blocked Stories – NH Sprint 37');
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint:** ${SPRINT_NAME}`);
  mdLines.push(`**Sprint start:** ${sprintStart.toISOString().split('T')[0]}`);
  mdLines.push('');
  mdLines.push(`- Total blocked Stories in sprint: ${issues.length}`);
  mdLines.push(`- Blocked during sprint: ${blockedSinceSprintStart.length}`);
  mdLines.push(`- Blocked before sprint start: ${blockedBeforeSprintStart.length}`);
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Blocked during sprint');
  mdLines.push('');
  if (blockedSinceSprintStart.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Blocked since | Blocked for | Team | Assignee |');
    mdLines.push('|-----|---------|----------------|-------------|------|----------|');
    blockedSinceSprintStart.forEach((b) => {
      const sum = (b.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${b.key} | ${sum} | ${b.blockedSince} | ${b.blockedDuration} | ${b.team} | ${b.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${blockedSinceSprintStart.length}`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Blocked before sprint start');
  mdLines.push('');
  if (blockedBeforeSprintStart.length === 0) {
    mdLines.push('None.');
  } else {
    mdLines.push('| Key | Summary | Blocked since | Blocked for | Team | Assignee |');
    mdLines.push('|-----|---------|----------------|-------------|------|----------|');
    blockedBeforeSprintStart.forEach((b) => {
      const sum = (b.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${b.key} | ${sum} | ${b.blockedSince} | ${b.blockedDuration} | ${b.team} | ${b.assignee} |`);
    });
    mdLines.push('');
    mdLines.push(`**Total:** ${blockedBeforeSprintStart.length}`);
  }

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
