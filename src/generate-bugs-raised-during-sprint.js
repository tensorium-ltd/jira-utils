#!/usr/bin/env node

/**
 * Bugs Raised During Sprint – NH Sprint 37
 *
 * Lists all Bugs and Sub-bugs created since the sprint started.
 * Includes: assignee, team, current status.
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
const DEFAULT_SPRINT = 'NH Sprint 38';
const TEAM_FIELD_ID = 'customfield_12700';

const SPRINT_NAME = process.argv[2] || DEFAULT_SPRINT;

const DONE_STATUSES = ['Closed', 'Ready for Release', 'Ready for release', 'Complete', 'Completed', 'Done', 'Resolved'];

const PRIORITY_ORDER = { P1: 1, P2: 2, P3: 3, P4: 4 };

function getPriorityOrder(priority) {
  if (!priority) return 99;
  const m = String(priority).match(/^P(\d)/i);
  return m ? parseInt(m[1], 10) : 99;
}

function groupByPriority(records) {
  const groups = { P1: [], P2: [], P3: [], P4: [], Other: [] };
  for (const r of records) {
    const order = getPriorityOrder(r.priority);
    if (order <= 4) groups[`P${order}`].push(r);
    else groups.Other.push(r);
  }
  return groups;
}

function isDone(status) {
  if (!status) return false;
  return DONE_STATUSES.some((s) => status.toLowerCase() === s.toLowerCase());
}

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

  const sprintStartStr = sprintStart.toISOString().split('T')[0];
  const jql = `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype in (Bug, "Sub-bug") AND created >= "${sprintStartStr}"`;
  const fields = ['key', 'summary', 'status', 'issuetype', 'assignee', 'created', 'priority', TEAM_FIELD_ID];

  console.log(`\n📋 Bugs Raised During Sprint – ${SPRINT_NAME}`);
  console.log('='.repeat(60));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log(`Sprint start: ${sprintStartStr}`);
  console.log('');

  const issues = await fetchIssuesByJql(client, jql, fields);

  const bugs = issues.filter((i) => (i.fields?.issuetype?.name || '').toLowerCase() === 'bug');
  const subBugs = issues.filter((i) => (i.fields?.issuetype?.name || '').toLowerCase() === 'sub-bug');

  const records = issues.map((i) => {
    const status = i.fields?.status?.name || 'Unknown';
    const priority = i.fields?.priority?.name || '-';
    return {
      key: i.key,
      type: i.fields?.issuetype?.name || '?',
      summary: (i.fields?.summary || '').slice(0, 60),
      status,
      priority,
      isDone: isDone(status),
      team: getTeamName(i),
      assignee: getAssigneeName(i),
      created: (i.fields?.created || '').split('T')[0]
    };
  });

  records.sort((a, b) => (a.created || '').localeCompare(b.created || '') || a.key.localeCompare(b.key));

  const doneRecords = records.filter((r) => r.isDone);
  const openRecords = records.filter((r) => !r.isDone);
  const total = records.length;
  const doneCount = doneRecords.length;
  const openCount = openRecords.length;
  const donePct = total > 0 ? ((doneCount / total) * 100).toFixed(1) : '0';
  const openPct = total > 0 ? ((openCount / total) * 100).toFixed(1) : '0';

  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log('| Status              | Count | %     |');
  console.log('|---------------------|-------|-------|');
  console.log(`| Closed/Ready/Release| ${String(doneCount).padStart(5)} | ${String(donePct + '%').padStart(5)} |`);
  console.log(`| Open (To Do/In Prog)| ${String(openCount).padStart(5)} | ${String(openPct + '%').padStart(5)} |`);
  console.log(`| Total               | ${String(total).padStart(5)} | 100%  |`);
  console.log('');

  const byPriority = groupByPriority(records);
  const priorityLabels = ['P1', 'P2', 'P3', 'P4', 'Other'];

  console.log('🚫 BUGS & SUB-BUGS CREATED SINCE SPRINT START');
  console.log('='.repeat(90));
  if (records.length === 0) {
    console.log('\n   None.\n');
  } else {
    for (const label of priorityLabels) {
      const group = byPriority[label] || [];
      if (group.length === 0) continue;
      console.log(`\n   --- ${label} (${group.length}) ---\n`);
      const tableRows = group.map((r) => ({
        Key: r.key,
        Type: r.type,
        Summary: (r.summary || '').slice(0, 40) + ((r.summary || '').length > 40 ? '...' : ''),
        Status: (r.status || '').slice(0, 18),
        Team: r.team,
        Assignee: (r.assignee || '').slice(0, 18),
        Created: r.created
      }));
      console.table(tableRows);
    }
    console.log(`\n   Total: ${bugs.length} Bugs, ${subBugs.length} Sub-bugs (${records.length} total)\n`);
  }

  const now = new Date();
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = now.toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `bugs-raised-during-sprint-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `bugs-raised-during-sprint-${dateStr}.md`);

  const report = {
    generatedAt: now.toISOString(),
    sprint: SPRINT_NAME,
    sprintStart: sprintStartStr,
    summary: {
      total: records.length,
      done: doneCount,
      donePct: parseFloat(donePct),
      open: openCount,
      openPct: parseFloat(openPct),
      bugs: bugs.length,
      subBugs: subBugs.length
    },
    issues: records.map((r) => ({ ...r, isDone: undefined }))
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push(`# Bugs Raised During Sprint – ${SPRINT_NAME}`);
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint:** ${SPRINT_NAME}`);
  mdLines.push(`**Sprint start:** ${sprintStartStr}`);
  mdLines.push('');
  mdLines.push('## Summary');
  mdLines.push('');
  mdLines.push('| Status | Count | % |');
  mdLines.push('|--------|-------|---|');
  mdLines.push(`| Closed / Ready for Release | ${doneCount} | ${donePct}% |`);
  mdLines.push(`| Open (To Do / In Progress) | ${openCount} | ${openPct}% |`);
  mdLines.push(`| **Total** | ${total} | 100% |`);
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  const openByPriority = groupByPriority(openRecords);

  if (openRecords.length > 0) {
    mdLines.push('## Open Bugs (To Do / In Progress)');
    mdLines.push('');
    for (const label of priorityLabels) {
      const group = openByPriority[label] || [];
      if (group.length === 0) continue;
      mdLines.push(`### ${label} (${group.length})`);
      mdLines.push('');
      mdLines.push('| Key | Type | Summary | Status | Team | Assignee | Created |');
      mdLines.push('|-----|------|---------|--------|------|----------|---------|');
      group.forEach((r) => {
        const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 50);
        mdLines.push(`| ${r.key} | ${r.type} | ${sum} | ${r.status} | ${r.team} | ${r.assignee} | ${r.created} |`);
      });
      mdLines.push('');
    }
    mdLines.push('---');
    mdLines.push('');
  }
  mdLines.push('## All Bugs & Sub-bugs');
  mdLines.push('');
  for (const label of priorityLabels) {
    const group = byPriority[label] || [];
    if (group.length === 0) continue;
    mdLines.push(`### ${label} (${group.length})`);
    mdLines.push('');
    mdLines.push('| Key | Type | Summary | Status | Team | Assignee | Created |');
    mdLines.push('|-----|------|---------|--------|------|----------|---------|');
    group.forEach((r) => {
      const sum = (r.summary || '').replace(/\|/g, ' ').slice(0, 50);
      mdLines.push(`| ${r.key} | ${r.type} | ${sum} | ${r.status} | ${r.team} | ${r.assignee} | ${r.created} |`);
    });
    mdLines.push('');
  }

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
