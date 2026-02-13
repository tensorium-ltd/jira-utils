#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const SPRINT_NAME = 'NH Sprint 35';

function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  if (!JIRA_API_TOKEN) {
    console.error('Error: JIRA_API_TOKEN environment variable is not set');
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
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (nextPageToken);

  return results;
}

function buildJql() {
  return [
    `project = ${PROJECT_KEY}`,
    `sprint = "${SPRINT_NAME}"`,
    'statusCategory = "In Progress"',
    'issuetype in (Story, Bug)'
  ].join(' AND ');
}

function summarizeByType(issues) {
  const summary = {
    Story: { count: 0 },
    Bug: { count: 0 }
  };

  issues.forEach(issue => {
    const type = issue.fields?.issuetype?.name;
    if (summary[type]) {
      summary[type].count += 1;
    }
  });

  return summary;
}

function saveReport(report) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sprint-in-progress-breakdown-${dateStr}.json`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filepath;
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const jql = buildJql();

  console.log('\n📊 Sprint In-Progress Breakdown');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log(`JQL: ${jql}`);

  const issues = await fetchIssuesByJql(client, jql, ['key', 'summary', 'issuetype', 'status']);
  const summary = summarizeByType(issues);

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    sprint: SPRINT_NAME,
    statusCategory: 'In Progress',
    summary,
    totalIssues: issues.length,
    issues: issues.map(issue => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      status: issue.fields?.status?.name || 'Unknown'
    }))
  };

  console.log('\nSummary:');
  console.log(`Stories: ${summary.Story.count}`);
  console.log(`Bugs: ${summary.Bug.count}`);
  console.log(`Total: ${report.totalIssues}`);

  const filepath = saveReport(report);
  console.log(`\nReport saved: ${filepath}`);
}

main().catch(error => {
  console.error('Failed to generate in-progress breakdown');
  console.error(error.message);
  process.exit(1);
});
