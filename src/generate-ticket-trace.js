#!/usr/bin/env node

const axios = require('axios');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }

  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
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

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toISOString();
}

function printUsage() {
  console.log('Usage: node src/generate-ticket-trace.js <JIRA-ISSUE-KEY>');
  console.log('Example: node src/generate-ticket-trace.js VER10-1234');
}

async function fetchTicketTrace(client, issueKey) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      expand: 'changelog',
      fields: 'key,summary,created'
    }
  });

  return response.data;
}

function buildStatusTimeline(issue) {
  const histories = issue.changelog?.histories || [];
  const events = [];

  for (const history of histories) {
    const items = history.items || [];
    for (const item of items) {
      if (item.field === 'status') {
        events.push({
          at: history.created,
          from: item.fromString || 'Unknown',
          to: item.toString || 'Unknown'
        });
      }
    }
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

function printTimeline(issue, events) {
  const summary = issue.fields?.summary || '';
  const created = issue.fields?.created;

  console.log('\n🧭 Ticket Workflow Trace');
  console.log('='.repeat(60));
  console.log(`   Ticket: ${issue.key}`);
  console.log(`   Summary: ${summary}`);
  console.log(`   Created: ${formatDate(created)}`);
  console.log('='.repeat(60));

  if (events.length === 0) {
    console.log('\nNo status changes found in the changelog.');
    return;
  }

  console.log('\n| # | Date/Time (UTC) | From | To |');
  console.log('|---|------------------|------|----|');
  events.forEach((event, index) => {
    console.log(`| ${index + 1} | ${formatDate(event.at)} | ${event.from} | ${event.to} |`);
  });
}

async function main() {
  const issueKey = process.argv[2];
  if (!issueKey) {
    printUsage();
    process.exit(1);
  }

  try {
    validateConfig();
    const client = createJiraClient();
    const issue = await fetchTicketTrace(client, issueKey);
    const events = buildStatusTimeline(issue);
    printTimeline(issue, events);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
