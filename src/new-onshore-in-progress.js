#!/usr/bin/env node

/**
 * Breakdown of tickets currently in progress assigned to New Onshore (Huzefa, Gururaj, Jack, Allan).
 * Uses NH Sprint 38 (current sprint) and statusCategory = "In Progress".
 */

require('dotenv').config();
const axios = require('axios');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const SPRINT_NAME = 'NH Sprint 38';

const NEW_ONSHORE_NAMES = ['Huzefa', 'Gururaj', 'Jack', 'Allan'];

function isNewOnshore(displayName) {
  if (!displayName) return false;
  return NEW_ONSHORE_NAMES.some((n) => String(displayName).toLowerCase().includes(n.toLowerCase()));
}

function getDisplayName(user) {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user.displayName || user.name || null;
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

async function getSprintByName(client, boardId, sprintName) {
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
  return results.find((s) => s.name === sprintName) || null;
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

async function main() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN must be set');
    process.exit(1);
  }

  const client = createJiraClient();
  const sprint = await getSprintByName(client, BOARD_ID, SPRINT_NAME);
  if (!sprint) {
    console.error(`Sprint "${SPRINT_NAME}" not found`);
    process.exit(1);
  }

  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const jql = `project = ${PROJECT_KEY} AND sprint = ${sprint.id} AND statusCategory = "In Progress" AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  console.log('\n🔎 Fetching issues in progress in', SPRINT_NAME, '...');
  const issues = await fetchIssuesByJql(client, jql, [
    'key', 'summary', 'status', 'issuetype', 'assignee', 'priority', storyPointsFieldId
  ]);
  console.log(`   Found ${issues.length} issues in progress\n`);

  const newOnshore = issues.filter((issue) => {
    const assignee = getDisplayName(issue.fields?.assignee);
    return assignee && isNewOnshore(assignee);
  });

  // Group by assignee
  const byPerson = {};
  for (const issue of newOnshore) {
    const assignee = getDisplayName(issue.fields?.assignee);
    if (!byPerson[assignee]) {
      byPerson[assignee] = [];
    }
    const sp = issue.fields?.[storyPointsFieldId] ?? (issue.fields?.issuetype?.name === 'Story' ? 2 : 0);
    byPerson[assignee].push({
      key: issue.key,
      summary: (issue.fields?.summary || '').slice(0, 70),
      status: issue.fields?.status?.name || '?',
      issuetype: issue.fields?.issuetype?.name || '?',
      storyPoints: sp,
      priority: issue.fields?.priority?.name || '-'
    });
  }

  console.log('='.repeat(75));
  console.log('📋 TICKETS IN PROGRESS – NEW ONSHORE (Huzefa, Gururaj, Jack, Allan)');
  console.log('='.repeat(75));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log(`Total: ${newOnshore.length} ticket(s)\n`);

  if (newOnshore.length === 0) {
    console.log('   No tickets in progress are currently assigned to New Onshore.\n');
    return;
  }

  const order = ['Huzefa', 'Gururaj', 'Jack', 'Allan'];
  const sortedKeys = Object.keys(byPerson).sort((a, b) => {
    const ai = order.findIndex((n) => a.toLowerCase().includes(n.toLowerCase()));
    const bi = order.findIndex((n) => b.toLowerCase().includes(n.toLowerCase()));
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  for (const assignee of sortedKeys) {
    const tickets = byPerson[assignee];
    const totalSp = tickets.reduce((s, t) => s + (t.storyPoints || 0), 0);
    console.log(`\n--- ${assignee} (${tickets.length} ticket(s), ${totalSp} SP) ---\n`);
    tickets.forEach((t) => {
      console.log(`   ${t.key} | ${t.status} | ${t.issuetype} | ${t.storyPoints || '-'} SP | ${t.priority}`);
      console.log(`      ${t.summary}`);
      console.log('');
    });
  }

  console.log('='.repeat(75));
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
