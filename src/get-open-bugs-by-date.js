#!/usr/bin/env node

/**
 * Open Bugs by Date
 *
 * Usage:
 *   node src/get-open-bugs-by-date.js 2025-12-25 2025-12-31
 */

require('dotenv').config();
const axios = require('axios');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';

function createJiraClient() {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    console.error('❌ Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
    process.exit(1);
  }

  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function fetchOpenBugCount(client, dateStr) {
  const jql = [
    `project = ${PROJECT_KEY}`,
    'issuetype = Bug',
    `status WAS IN ("Open", "In Dev", "In QA", "In Review") ON "${dateStr}"`
  ].join(' AND ');

  const response = await client.post('/rest/api/3/search/jql', {
    jql,
    maxResults: 1
  });

  return response.data.total || 0;
}

async function main() {
  const dates = process.argv.slice(2);
  if (dates.length === 0) {
    console.error('❌ Error: Provide one or more dates in YYYY-MM-DD format');
    process.exit(1);
  }

  for (const dateStr of dates) {
    if (!isValidDate(dateStr)) {
      console.error(`❌ Error: Invalid date format "${dateStr}". Use YYYY-MM-DD.`);
      process.exit(1);
    }
  }

  const client = createJiraClient();

  console.log('Open Bug Count by Date');
  console.log('──────────────────────');

  for (const dateStr of dates) {
    const count = await fetchOpenBugCount(client, dateStr);
    console.log(`${dateStr}: ${count}`);
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.response?.data) {
    console.error('Response:', error.response.data);
  }
  process.exit(1);
});
