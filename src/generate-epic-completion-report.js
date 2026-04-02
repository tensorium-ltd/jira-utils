#!/usr/bin/env node

/**
 * Epic Completion Report – % complete of child stories per Epic
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

const COMPLETED_STATUSES = [
  'Done',
  'Ready for Release',
  'Ready for release',
  'Completed',
  'Closed',
  'CLOSED',
  'READY FOR RELEASE',
  'Resolved'
];

const EPICS = [
  { key: 'VER10-6825', name: 'Tagging and Dimensions (Admin)' },
  { key: 'VER10-6968', name: 'Carbon Rate Application' },
  { key: 'VER10-7425', name: 'Sub-Items Resource in Estimate' },
  { key: 'VER10-7504', name: 'Template Library Browser' },
  { key: 'VER10-7822', name: 'Estimate Request Revised' },
  { key: 'VER10-7936', name: 'Resource Library in WBS (FE Uplift)' },
  { key: 'VER10-8168', name: 'Advanced Quote Numbering' },
  { key: 'VER10-8452', name: 'Role Permissions for NH Reviewer and Approvals' },
  { key: 'VER10-8473', name: 'Implement Full Custom Fields (WBS)' },
  { key: 'VER10-8474', name: 'Tagging and Dimensions (WBS)' },
  { key: 'VER10-8476', name: 'Reporting Foundations (Admin)' },
  { key: 'VER10-8678', name: 'Supply Chain - Forecast Browser' },
  { key: 'VER10-8679', name: 'Supply Chain - Manage Revision' },
  { key: 'VER10-8680', name: 'Supply Chain - Supplier data entry and submission' },
  { key: 'VER10-8681', name: 'Supply Chain - Data Consolidation and Validation' },
  { key: 'VER10-8682', name: 'Supply Chain - Submit Revision for NH Review' },
  { key: 'VER10-8758', name: 'Template Library Create Estimate from Template' },
  { key: 'VER10-8767', name: 'Template Library Admin Roles and Audit' },
  { key: 'VER10-8768', name: 'Template Library CRUD Ops' },
  { key: 'VER10-8858', name: 'Supply Chain - Forecasting Admin Controls' },
  { key: 'VER10-8921', name: 'Supply Chain - Forecast initiation and distribution' },
  { key: 'VER10-9084', name: 'Template Mapping Config' }
];

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

function isCompleted(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return COMPLETED_STATUSES.some((c) => s.includes(c.toLowerCase()));
}

async function fetchChildStories(client, epicKey) {
  const allChildren = [];
  const seen = new Set();

  const jql = `project = ${PROJECT_KEY} AND (parent = ${epicKey} OR "Epic Link" = ${epicKey} OR parentEpic = ${epicKey}) AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  try {
    const issues = await fetchIssuesByJql(client, jql, [
      'key',
      'summary',
      'issuetype',
      'status'
    ]);
    for (const issue of issues) {
      if (!seen.has(issue.key)) {
        seen.add(issue.key);
        allChildren.push(issue);
      }
    }
  } catch (err) {
    console.warn(`      (query failed: ${err.message})`);
  }

  return allChildren;
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  console.log('\n📊 Epic Completion Report – Child Stories % Complete');
  console.log('='.repeat(70));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Epics: ${EPICS.length}`);
  console.log('='.repeat(60));

  const results = [];

  for (const epic of EPICS) {
    process.stdout.write(`   ${epic.key}... `);
    const children = await fetchChildStories(client, epic.key);
    const total = children.length;
    const completed = children.filter((c) =>
      isCompleted(c.fields?.status?.name)
    ).length;
    const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    results.push({
      key: epic.key,
      name: epic.name,
      total,
      completed,
      pctComplete: total > 0 ? Number(pct) : 0
    });
    console.log(`${completed}/${total} (${pct}%)`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    epics: results
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `epic-completion-report-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  results.forEach((r) => {
    console.log(`   ${r.key} – ${r.name}`);
    console.log(`      ${r.completed}/${r.total} child stories complete (${r.pctComplete}%)`);
    console.log('');
  });
  console.log(`✅ Report saved: ${jsonPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
