#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const JQL = `project = ${PROJECT_KEY} AND issuetype in (Bug, "Sub-bug") AND statusCategory in ("To Do", "In Progress")`;

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

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  console.log('\n📊 Open QA Defects by Assignee');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`JQL: ${JQL}`);

  const issues = await fetchIssuesByJql(client, JQL, ['key', 'summary', 'issuetype', 'status', 'assignee']);
  const byAssignee = {};

  issues.forEach(issue => {
    const assignee = issue.fields?.assignee;
    const assigneeName = assignee?.displayName || assignee?.name || 'Unassigned';
    if (!byAssignee[assigneeName]) {
      byAssignee[assigneeName] = { count: 0, issues: [] };
    }
    byAssignee[assigneeName].count += 1;
    byAssignee[assigneeName].issues.push({
      key: issue.key,
      summary: issue.fields?.summary || '',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      status: issue.fields?.status?.name || 'Unknown'
    });
  });

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    jql: JQL,
    totalIssues: issues.length,
    byAssignee
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const outputPath = path.join(reportsDir, `open-qa-defects-by-assignee-${dateStr}.json`);
  const markdownPath = path.join(reportsDir, `open-qa-defects-by-assignee-${dateStr}.md`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\nTotal issues: ${issues.length}`);
  Object.entries(byAssignee)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, data]) => {
      console.log(`- ${name}: ${data.count}`);
    });

  const mdLines = [];
  mdLines.push('# Open QA Defects by Assignee');
  mdLines.push('');
  mdLines.push(`Project: ${PROJECT_KEY}`);
  mdLines.push(`JQL: ${JQL}`);
  mdLines.push(`Total issues: ${issues.length}`);
  mdLines.push('');
  mdLines.push('| Assignee | Count |');
  mdLines.push('|----------|-------|');
  Object.entries(byAssignee)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, data]) => {
      mdLines.push(`| ${name} | ${data.count} |`);
    });
  mdLines.push('');
  mdLines.push('## Details');
  mdLines.push('');
  Object.entries(byAssignee)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([name, data]) => {
      mdLines.push(`### ${name} (${data.count})`);
      mdLines.push('');
      data.issues.forEach(issue => {
        mdLines.push(`- ${issue.key} (${issue.issueType}) - ${issue.status} - ${issue.summary}`);
      });
      mdLines.push('');
    });

  fs.writeFileSync(markdownPath, mdLines.join('\n'));

  console.log(`\n✅ Report saved: ${outputPath}`);
  console.log(`✅ Markdown saved: ${markdownPath}`);
}

main().catch(error => {
  console.error('Failed to generate open QA defects report');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
