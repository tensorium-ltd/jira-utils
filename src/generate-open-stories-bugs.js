#!/usr/bin/env node

/**
 * Open Stories & Bugs – NH Sprint 37
 * Lists all open (not completed) Stories and Bugs with assignees.
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

async function main() {
  validateConfig();
  const client = createJiraClient();

  const jql = `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype in (Story, Bug) AND statusCategory != Done`;
  const fields = ['key', 'summary', 'status', 'issuetype', 'assignee'];

  const issues = await fetchIssuesByJql(client, jql, fields);

  const stories = issues.filter((i) => (i.fields?.issuetype?.name || '').toLowerCase() === 'story');
  const bugs = issues.filter((i) => (i.fields?.issuetype?.name || '').toLowerCase() === 'bug');

  const getAssignee = (i) => i.fields?.assignee?.displayName || 'Unassigned';

  console.log('\n📋 Open Stories & Bugs – NH Sprint 37');
  console.log('='.repeat(60));
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log('');

  const tableRows = issues.map((i) => ({
    Key: i.key,
    Type: i.fields?.issuetype?.name || '?',
    Summary: (i.fields?.summary || '').slice(0, 50) + ((i.fields?.summary || '').length > 50 ? '...' : ''),
    Status: (i.fields?.status?.name || '').slice(0, 20),
    Assignee: getAssignee(i)
  }));
  console.table(tableRows);

  console.log(`\nTotal: ${stories.length} Stories, ${bugs.length} Bugs (${issues.length} open)`);

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const outPath = path.join(reportsDir, `open-stories-bugs-${dateStr}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sprint: SPRINT_NAME,
    stories: stories.length,
    bugs: bugs.length,
    total: issues.length,
    issues: issues.map((i) => ({
      key: i.key,
      type: i.fields?.issuetype?.name,
      summary: i.fields?.summary,
      status: i.fields?.status?.name,
      assignee: i.fields?.assignee?.displayName || 'Unassigned'
    }))
  }, null, 2));
  console.log(`\n✅ Saved: ${outPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
