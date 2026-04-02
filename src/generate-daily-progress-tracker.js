#!/usr/bin/env node

/**
 * Daily Progress Tracker – Initiative completion by epic child items
 *
 * Shows a bar chart of % completeness for each initiative. Progress = (child items
 * Ready for Release or Closed) / (total child items) across all epics in the initiative.
 *
 * Child items = Story, Bug, Sub-bug, Sub-task linked to each epic.
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
  'Ready for Release',
  'Ready for release',
  'Complete',
  'Completed',
  'Done',
  'Closed',
  'Resolved'
];

const INITIATIVES = [
  { name: 'Carbon Resource Library', epics: ['VER10-9428', 'VER10-9464'] },
  { name: 'Carbon Item Library', epics: ['VER10-9373', 'VER10-9826', 'VER10-9830', 'VER10-9834'] },
  { name: 'Import / Export', epics: ['VER10-9874', 'VER10-9885', 'VER10-9890', 'VER10-9893'] },
  { name: 'WBS Carbon & Calc', epics: ['VER10-9523', 'VER10-10103', 'VER10-10106'] },
  { name: 'EPD', epics: ['VER10-8959'] },
  { name: 'Cost to Carbon Library', epics: ['VER10-9527', 'VER10-10135', 'VER10-10139', 'VER10-10144'] },
  { name: 'IFT - Dynamic Library', epics: ['VER10-8678', 'VER10-8680', 'VER10-8682', 'VER10-8858', 'VER10-8679', 'VER10-8921', 'VER10-9049', 'VER10-9128'] },
  { name: 'IFT - Project Specific Library', epics: ['VER10-8678', 'VER10-8680', 'VER10-8682', 'VER10-8858', 'VER10-8679', 'VER10-8921', 'VER10-9049', 'VER10-9128'] },
  { name: 'LTA - Epic 1/2 - RfE + Shell (Entry Point)', epics: ['VER10-9697', 'VER10-9698', 'VER10-9699', 'VER10-9700', 'VER10-9701', 'VER10-9702'] },
  { name: 'LTA - Epic 3 - Asset Library', epics: ['VER10-9697', 'VER10-9698', 'VER10-9699', 'VER10-9700', 'VER10-9701', 'VER10-9702'] },
  { name: 'LTA - Epic 4/6 - Data Entry & WBS', epics: ['VER10-9697', 'VER10-9698', 'VER10-9699', 'VER10-9700', 'VER10-9701', 'VER10-9702'] },
  { name: 'LTA - Epic 5 Annual Profiling', epics: ['VER10-9697', 'VER10-9698', 'VER10-9699', 'VER10-9700', 'VER10-9701', 'VER10-9702'] },
  { name: 'Comparator', epics: ['VER10-8953'] },
  { name: 'Carbon Reports', epics: [] },
  { name: 'Estimate Workflow (Reviewal, Approval, Issuing)', epics: ['VER10-9028'] },
  { name: 'Portfolio/Programme Risk (Risk Profile)', epics: ['VER10-9494'] },
  { name: 'Portfolio/Programme Risk (Remaining)', epics: [] },
  { name: 'Calculators/Cost Models (Chapter 10)', epics: [] },
  { name: 'Scenario Analysis (Chapter 7)', epics: ['VER10-8958'] },
  { name: 'Star Rates', epics: [] },
  { name: 'TPE (Input Screen) (1)', epics: ['VER10-9184'] },
  { name: 'TPE (Simulation Eng + Worksheet)', epics: [] },
  { name: 'TPE (Schedule/Risk) (3)', epics: [] },
  { name: 'TPE (Inflation) (6)', epics: [] },
  { name: 'TPE (Output) (7)', epics: [] },
  { name: 'TPE (Output) (8)', epics: [] },
  { name: 'Dashboards (Power BI)', epics: [] },
  { name: 'Contractor Fee Library', epics: ['VER10-9271'] },
  { name: 'System Access', epics: ['VER10-8452'] },
  { name: 'Audit Log', epics: ['VER10-8955', 'VER10-6972'] },
  { name: 'WBS Tags and Custom Fields', epics: ['VER10-8916', 'VER10-8268'] },
  { name: 'Custom Field Filtering', epics: [] },
  { name: 'Reporting Foundation Admin', epics: ['VER10-8476'] },
  { name: 'Inflation', epics: ['VER10-8903', 'VER10-8570'] },
  { name: 'AR and O&M fixed reports', epics: ['VER10-7878', 'VER10-7879'] },
  { name: 'CCESS', epics: ['VER10-6966'] }
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

async function fetchChildItems(client, epicKey, cache) {
  if (cache.has(epicKey)) return cache.get(epicKey) || [];

  const jql = `project = ${PROJECT_KEY} AND (parent = ${epicKey} OR "Epic Link" = ${epicKey} OR parentEpic = ${epicKey}) AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  try {
    const issues = await fetchIssuesByJql(client, jql, ['key', 'status']);
    cache.set(epicKey, issues);
    return issues;
  } catch (err) {
    console.warn(`      (${epicKey} failed: ${err.message})`);
    cache.set(epicKey, []);
    return [];
  }
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

function renderHtml(report) {
  const initiatives = report.initiatives;
  const maxWidth = 400;

  const rows = initiatives.map((init) => {
    const pct = init.pctComplete;
    const barWidth = Math.round((pct / 100) * maxWidth);
    const color = pct >= 80 ? '#2e7d32' : pct >= 50 ? '#f9a825' : '#c62828';
    return `
    <tr>
      <td class="name">${init.name}</td>
      <td class="stats">${init.completed}/${init.total}</td>
      <td class="pct">${pct.toFixed(1)}%</td>
      <td class="bar-cell">
        <div class="bar-bg" style="width:${maxWidth}px">
          <div class="bar-fill" style="width:${barWidth}px;background:${color}"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Daily Progress Tracker – ${report.generatedAt.split('T')[0]}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 24px; background: #fafafa; }
    h1 { color: #333; }
    .meta { color: #666; margin-bottom: 24px; }
    table { border-collapse: collapse; width: 100%; max-width: 900px; }
    td { padding: 8px 12px; vertical-align: middle; }
    td.name { font-weight: 500; width: 35%; max-width: 280px; }
    td.stats { width: 80px; text-align: right; font-family: monospace; }
    td.pct { width: 70px; text-align: right; font-weight: 600; }
    .bar-bg { height: 20px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
  </style>
</head>
<body>
  <h1>Daily Progress Tracker</h1>
  <p class="meta">Generated: ${report.generatedAt} | Project: ${report.project}</p>
  <p class="meta">Progress = child items (Story, Bug, Sub-bug, Sub-task) Ready for Release or Closed</p>
  <table>
    <thead>
      <tr><th>Initiative</th><th>Done</th><th>%</th><th>Progress</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>`;
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  const initiativesToProcess = INITIATIVES;
  const epicCache = new Map();

  console.log('\n📊 Daily Progress Tracker');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Initiatives: ${initiativesToProcess.length}`);
  console.log('');

  const results = [];

  for (const init of initiativesToProcess) {
    process.stdout.write(`   ${init.name}... `);
    let total = 0;
    let completed = 0;

    for (const epicKey of init.epics) {
      const children = await fetchChildItems(client, epicKey, epicCache);
      total += children.length;
      completed += children.filter((c) => isCompleted(c.fields?.status?.name)).length;
      await new Promise((r) => setTimeout(r, 80));
    }

    const pctComplete = total > 0 ? (completed / total) * 100 : 0;
    results.push({
      name: init.name,
      epics: init.epics,
      total,
      completed,
      pctComplete
    });
    console.log(`${completed}/${total} (${pctComplete.toFixed(1)}%)`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    initiatives: results
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];

  const jsonPath = path.join(reportsDir, `daily-progress-tracker-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const htmlPath = path.join(reportsDir, `daily-progress-tracker-${dateStr}.html`);
  fs.writeFileSync(htmlPath, renderHtml(report));

  console.log('');
  console.log(`✅ JSON saved: ${jsonPath}`);
  console.log(`✅ HTML bar chart: ${htmlPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
