#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 2A';
const DEFAULT_STORY_POINTS = 2;

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

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  const jql = [
    `project = ${PROJECT_KEY}`,
    'issuetype = Story',
    `fixVersion = "${FIX_VERSION}"`,
    'statusCategory = Done'
  ].join(' AND ');

  console.log('\n📊 Completed Story Points - Release 2A');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Fix Version: ${FIX_VERSION}`);
  console.log(`JQL: ${jql}`);

  const issues = await fetchIssuesByJql(client, jql, ['key', 'summary', storyPointsFieldId]);
  let totalPoints = 0;
  let defaultedCount = 0;

  issues.forEach(issue => {
    const points = issue.fields?.[storyPointsFieldId] || 0;
    if (points === 0) {
      totalPoints += DEFAULT_STORY_POINTS;
      defaultedCount += 1;
    } else {
      totalPoints += points;
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    fixVersion: FIX_VERSION,
    statusCategory: 'Done',
    storyPointsFieldId,
    defaultStoryPoints: DEFAULT_STORY_POINTS,
    totalIssues: issues.length,
    totalStoryPoints: Number(totalPoints.toFixed(2)),
    defaultedCount
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const outputPath = path.join(reportsDir, `completed-2a-${dateStr}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\nTotal stories: ${issues.length}`);
  console.log(`Total story points: ${report.totalStoryPoints}`);
  console.log(`Defaulted stories: ${defaultedCount}`);
  console.log(`\n✅ Report saved: ${outputPath}`);
}

main().catch(error => {
  console.error('Failed to generate completed 2A report');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
