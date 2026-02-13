#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const TARGET_FIX_VERSION = 'Release 2A';
const DEFAULT_JQL = `project = ${PROJECT_KEY} AND issuetype = Bug AND statusCategory in ("To Do", "In Progress")`;

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

async function ensureFixVersion(client, versionName) {
  const response = await client.get(`/rest/api/3/project/${PROJECT_KEY}/versions`);
  const versions = response.data || [];
  const found = versions.find(v => v.name === versionName);
  if (!found) {
    throw new Error(`Fix version "${versionName}" not found in project ${PROJECT_KEY}`);
  }
  return found;
}

async function updateIssueFixVersion(client, issueKey, versionName) {
  await client.put(`/rest/api/3/issue/${issueKey}`, {
    update: {
      fixVersions: [{ add: { name: versionName } }]
    }
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const apply = args.includes('--apply');
  const jqlIndex = args.indexOf('--jql');
  const limit = limitIndex >= 0 ? Number.parseInt(args[limitIndex + 1], 10) : null;
  const jql = jqlIndex >= 0 ? args[jqlIndex + 1] : DEFAULT_JQL;
  return { apply, limit, jql };
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const { apply, limit, jql } = parseArgs();

  console.log('\n🛠️  Update Fix Versions');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Fix Version: ${TARGET_FIX_VERSION}`);
  console.log(`JQL: ${jql}`);
  if (!apply) {
    console.log('Mode: DRY RUN (use --apply to update)');
  }

  await ensureFixVersion(client, TARGET_FIX_VERSION);
  const issues = await fetchIssuesByJql(client, jql, ['key', 'summary', 'fixVersions']);
  const selected = typeof limit === 'number' && limit > 0 ? issues.slice(0, limit) : issues;

  if (!selected.length) {
    console.log('\nNo issues found.');
    return;
  }

  console.log(`\nFound ${issues.length} issues. Processing ${selected.length}...`);

  for (const issue of selected) {
    const key = issue.key;
    const summary = issue.fields?.summary || '';
    const fixVersions = issue.fields?.fixVersions || [];
    const hasVersion = fixVersions.some(v => v.name === TARGET_FIX_VERSION);
    if (hasVersion) {
      console.log(`- ${key}: already has ${TARGET_FIX_VERSION}`);
      continue;
    }

    if (apply) {
      await updateIssueFixVersion(client, key, TARGET_FIX_VERSION);
      console.log(`- ${key}: updated (${summary.slice(0, 80)})`);
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      console.log(`- ${key}: would update (${summary.slice(0, 80)})`);
    }
  }
}

main().catch(error => {
  console.error('Failed to update fix versions');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
