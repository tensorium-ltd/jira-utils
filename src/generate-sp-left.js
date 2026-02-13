#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const FIX_VERSIONS = ['Release 1D', 'Release 2A'];
const PROJECT_KEY = 'VER10';

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

async function discoverStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];
    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch (error) {
    return 'customfield_10003';
  }
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

function formatVersionList(versions) {
  return versions.map(version => `"${version}"`).join(', ');
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  const jql = [
    `project = ${PROJECT_KEY}`,
    `fixVersion in (${formatVersionList(FIX_VERSIONS)})`,
    'statusCategory != Done'
  ].join(' AND ');

  console.log('\n📊 Story Points Left by Fix Version');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Fix Versions: ${FIX_VERSIONS.join(', ')}`);
  console.log(`JQL: ${jql}`);

  const issues = await fetchIssuesByJql(client, jql, ['key', 'issuetype', 'fixVersions', storyPointsFieldId]);

  const totals = {
    overall: { storyPoints: 0, issueCount: 0 },
    byFixVersion: {},
    byIssueType: {}
  };

  FIX_VERSIONS.forEach(version => {
    totals.byFixVersion[version] = { storyPoints: 0, issueCount: 0 };
  });

  for (const issue of issues) {
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    const points = issue.fields?.[storyPointsFieldId] || 0;
    const fixVersions = issue.fields?.fixVersions || [];

    totals.overall.storyPoints += points;
    totals.overall.issueCount += 1;

    if (!totals.byIssueType[issueType]) {
      totals.byIssueType[issueType] = { storyPoints: 0, issueCount: 0 };
    }
    totals.byIssueType[issueType].storyPoints += points;
    totals.byIssueType[issueType].issueCount += 1;

    fixVersions.forEach(version => {
      const name = version?.name;
      if (!name || !totals.byFixVersion[name]) return;
      totals.byFixVersion[name].storyPoints += points;
      totals.byFixVersion[name].issueCount += 1;
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    fixVersions: FIX_VERSIONS,
    statusFilter: 'statusCategory != Done',
    storyPointsFieldId,
    totals
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sp-left-${dateStr}.json`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  console.log(`\nTotal SP left: ${totals.overall.storyPoints}`);
  console.log(`Total issues: ${totals.overall.issueCount}`);
  FIX_VERSIONS.forEach(version => {
    const data = totals.byFixVersion[version];
    console.log(`- ${version}: ${data.storyPoints} SP (${data.issueCount} issues)`);
  });
  console.log(`\n✅ Report saved: ${filepath}`);
}

main().catch(error => {
  console.error('Failed to generate story points left report');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
