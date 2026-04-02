#!/usr/bin/env node

/**
 * Check if any tickets in NH Sprint 37 have ever been assigned or worked on
 * by the New Onshore group (Huzefa, Gururaj, Jack, Allan).
 *
 * "Worked on" = person who moved ticket into In Dev (changelog author)
 * "Assigned" = person who was assignee at any point (from changelog)
 */

require('dotenv').config();
const axios = require('axios');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const SPRINT_NAME = 'NH Sprint 37';

const NEW_ONSHORE_NAMES = ['Huzefa', 'Gururaj', 'Jack', 'Allan'];
const IN_DEV_STATUSES = ['In Dev', 'In dev'];

function isNewOnshore(displayName) {
  if (!displayName) return false;
  const name = String(displayName).toLowerCase();
  return NEW_ONSHORE_NAMES.some((n) => name.includes(n.toLowerCase()));
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

  const jql = `project = ${PROJECT_KEY} AND sprint = ${sprint.id} AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  console.log('\n🔎 Fetching all issues in NH Sprint 37...');
  const issues = await fetchIssuesByJql(client, jql, ['key', 'summary', 'status', 'issuetype', 'assignee']);
  console.log(`   Found ${issues.length} issues\n`);

  const touchedByNewOnshore = [];
  let processed = 0;

  for (const ref of issues) {
    const key = ref.key || ref.id;
    processed++;
    process.stdout.write(`   ${processed}/${issues.length} ${key}...\r`);

    try {
      const full = await client.get(`/rest/api/3/issue/${key}`, {
        params: { fields: 'key,summary,status,issuetype,assignee', expand: 'changelog' }
      });
      const issue = full.data;
      const histories = issue.changelog?.histories || [];

      const assignees = new Set();
      const movedToInDevBy = [];

      for (const history of histories) {
        const author = getDisplayName(history.author);
        for (const item of history.items || []) {
          if (item.field === 'assignee') {
            const assignee = getDisplayName(item.to) || getDisplayName(item.from) || item.toString;
            if (assignee) assignees.add(assignee);
          }
          if (item.field === 'status') {
            const toStatus = (item.toString || item.to || '').toLowerCase();
            if (IN_DEV_STATUSES.some((s) => toStatus === s.toLowerCase())) {
              if (author) movedToInDevBy.push({ who: author, when: history.created });
            }
          }
        }
      }
      const currentAssignee = getDisplayName(issue.fields?.assignee);
      if (currentAssignee) assignees.add(currentAssignee);

      const newOnshoreAssignees = [...assignees].filter(isNewOnshore);
      const newOnshoreMovedToDev = movedToInDevBy.filter((e) => isNewOnshore(e.who));

      if (newOnshoreAssignees.length > 0 || newOnshoreMovedToDev.length > 0) {
        touchedByNewOnshore.push({
          key,
          summary: (issue.fields?.summary || '').slice(0, 60),
          status: issue.fields?.status?.name,
          issuetype: issue.fields?.issuetype?.name,
          assignedBy: [...new Set(newOnshoreAssignees)],
          movedToInDevBy: [...new Set(newOnshoreMovedToDev.map((e) => e.who))]
        });
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${key}: ${err.message}`);
    }
  }

  console.log('\n');
  console.log('='.repeat(70));
  console.log('📋 TICKETS IN NH SPRINT 37 TOUCHED BY NEW ONSHORE (Huzefa, Gururaj, Jack, Allan)');
  console.log('='.repeat(70));

  if (touchedByNewOnshore.length === 0) {
    console.log('\n   No tickets in this sprint have been assigned to or worked on by New Onshore.\n');
    return;
  }

  console.log(`\n   Found ${touchedByNewOnshore.length} ticket(s):\n`);
  touchedByNewOnshore.forEach((t) => {
    console.log(`   ${t.key} | ${t.status} | ${t.issuetype}`);
    console.log(`      Summary: ${t.summary}`);
    if (t.assignedBy.length) console.log(`      Assigned to: ${t.assignedBy.join(', ')}`);
    if (t.movedToInDevBy.length) console.log(`      Moved to In Dev by: ${t.movedToInDevBy.join(', ')}`);
    console.log('');
  });
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
