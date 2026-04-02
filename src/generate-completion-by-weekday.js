#!/usr/bin/env node

/**
 * Completion by Weekday – Last 8 Weeks
 *
 * Analyzes issue and story point completions over the last 8 weeks,
 * grouped by day of week (Monday, Tuesday, etc.) to show average throughput.
 *
 * Uses changelog to determine when each Story moved to "Ready for Release" or "Closed"
 * (aligned with JIRA Sprint Report "Completed").
 *
 * Usage: npm run completion-by-weekday
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const WEEKS = 8;

const JIRA_DONE_STATUSES = ['ready for release', 'closed'];

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

async function discoverStoryPointsFieldId(client) {
  try {
    const { data: fields } = await client.get('/rest/api/3/field');
    const storyPointsField = fields.find(
      (f) => f.name && f.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch {
    return 'customfield_10003';
  }
}

/**
 * Get date (YYYY-MM-DD) when issue was first moved to Done status (from changelog).
 */
function getDateMovedToDone(issue) {
  if (!issue.changelog?.histories?.length) return null;
  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').trim().toLowerCase();
        if (JIRA_DONE_STATUSES.some((s) => toStatus === s)) {
          return history.created.split('T')[0];
        }
      }
    }
  }
  return null;
}

function getStoryPoints(issue, storyPointsFieldId) {
  const val = issue.fields?.[storyPointsFieldId];
  if (val != null && val !== '') return Number(val);
  const type = (issue.fields?.issuetype?.name || '').toLowerCase();
  return type === 'story' || type === 'bug' ? 2 : 0;
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
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN must be set');
    process.exit(1);
  }

  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - WEEKS * 7);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log('\n📊 Completion by Weekday (Last 8 Weeks)');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Period: ${startStr} → ${endStr}`);
  console.log('Completion = first move to Ready for Release or Closed');
  console.log('');

  // Get sprints that overlap the last 8 weeks
  const sprintsRes = await client.get(`/rest/agile/1.0/board/${BOARD_ID}/sprint`, {
    params: { state: 'active,closed', maxResults: 100 }
  });
  const allSprints = sprintsRes.data?.values || [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const relevantSprints = allSprints.filter((s) => {
    const sprintStart = s.startDate ? new Date(s.startDate).getTime() : 0;
    const sprintEnd = s.endDate ? new Date(s.endDate).getTime() : Infinity;
    return sprintEnd >= startMs && sprintStart <= endMs;
  });
  const sprintIds = relevantSprints.map((s) => s.id);
  if (sprintIds.length === 0) {
    console.error('No sprints found in the last 8 weeks');
    process.exit(1);
  }

  const sprintClause = sprintIds.length === 1
    ? `sprint = ${sprintIds[0]}`
    : `sprint in (${sprintIds.join(', ')})`;
  const statusList = ['"Ready for Release"', '"Ready for release"', '"Closed"', '"Complete"', '"Completed"', '"Done"', '"Resolved"'].join(', ');
  const jql = `project = ${PROJECT_KEY} AND ${sprintClause} AND status in (${statusList}) AND issuetype = Story`;

  console.log('🔎 Fetching completed Stories from sprints in period...');
  const issues = await fetchIssuesByJql(client, jql, [
    'key', 'summary', 'status', 'issuetype', storyPointsFieldId
  ]);
  console.log(`   Found ${issues.length} completed Stories`);

  console.log('🔎 Fetching changelog for each to determine completion date...');
  const byDate = {};
  let processed = 0;
  for (const issue of issues) {
    processed++;
    if (processed % 25 === 0) process.stdout.write(`   ${processed}/${issues.length}\r`);
    try {
      const { data } = await client.get(`/rest/api/3/issue/${issue.key}`, {
        params: { fields: 'issuetype', expand: 'changelog' }
      });
      const doneDate = getDateMovedToDone(data);
      if (!doneDate || doneDate < startStr || doneDate > endStr) continue;

      const sp = getStoryPoints(data, storyPointsFieldId);
      if (!byDate[doneDate]) byDate[doneDate] = { issues: 0, storyPoints: 0 };
      byDate[doneDate].issues += 1;
      byDate[doneDate].storyPoints += sp;
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      // skip
    }
  }
  console.log(`   Processed ${processed} issues\n`);

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byWeekday = {};
  for (let i = 0; i < 7; i++) {
    byWeekday[i] = { dayName: DAY_NAMES[i], issues: [], storyPoints: [], count: 0 };
  }

  for (const [dateStr, data] of Object.entries(byDate)) {
    const d = new Date(dateStr + 'T12:00:00Z');
    const dayOfWeek = d.getUTCDay();
    byWeekday[dayOfWeek].issues.push(data.issues);
    byWeekday[dayOfWeek].storyPoints.push(data.storyPoints);
    byWeekday[dayOfWeek].count += 1;
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // Count occurrences of each weekday in the period
  const weekdayCounts = {};
  for (let i = 0; i < 7; i++) weekdayCounts[i] = 0;
  const d = new Date(startDate);
  while (d <= endDate) {
    weekdayCounts[d.getUTCDay()]++;
    d.setDate(d.getDate() + 1);
  }

  console.log('='.repeat(70));
  console.log('📋 AVERAGE COMPLETIONS BY DAY OF WEEK');
  console.log('='.repeat(70));
  console.log('Avg = total / number of that weekday in period (includes days with zero)\n');

  const rows = [];
  for (let i = 1; i <= 7; i++) {
    const dow = i % 7;
    const w = byWeekday[dow];
    const totalIssues = sum(w.issues);
    const totalSP = sum(w.storyPoints);
    const numDays = weekdayCounts[dow] || 1;
    const avgIssues = numDays > 0 ? totalIssues / numDays : 0;
    const avgSP = numDays > 0 ? totalSP / numDays : 0;
    rows.push({
      day: w.dayName,
      occurrences: numDays,
      daysWithData: w.count,
      avgIssues: avgIssues.toFixed(2),
      avgSP: avgSP.toFixed(2),
      totalIssues,
      totalSP
    });
  }

  console.log('| Day       | Occurrences | Avg Issues | Avg SP  | Total Issues | Total SP |');
  console.log('|-----------|-------------|------------|---------|--------------|----------|');
  for (const r of rows) {
    console.log(`| ${r.day.padEnd(9)} | ${String(r.occurrences).padStart(11)} | ${String(r.avgIssues).padStart(10)} | ${String(r.avgSP).padStart(7)} | ${String(r.totalIssues).padStart(12)} | ${String(r.totalSP).padStart(8)} |`);
  }

  const grandTotalIssues = Object.values(byDate).reduce((s, d) => s + d.issues, 0);
  const grandTotalSP = Object.values(byDate).reduce((s, d) => s + d.storyPoints, 0);
  const totalDays = Object.keys(byDate).length;
  console.log('');
  console.log(`Overall: ${grandTotalIssues} issues, ${grandTotalSP} SP completed across ${totalDays} days with completions`);

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `completion-by-weekday-${endStr}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    period: { start: startStr, end: endStr, weeks: WEEKS },
    byWeekday: rows,
    summary: { totalIssues: grandTotalIssues, totalSP: grandTotalSP, daysWithCompletions: totalDays }
  }, null, 2));
  const mdPath = path.join(reportsDir, `completion-by-weekday-${endStr}.md`);
  const mdLines = [
    '# Completion by Weekday\n',
    `Project: ${PROJECT_KEY}`,
    `Period: ${startStr} → ${endStr} (last ${WEEKS} weeks)`,
    'Completion = first move to Ready for Release or Closed\n',
    '## Averages by Day of Week\n',
    '| Day | Occurrences | Avg Issues | Avg SP | Total Issues | Total SP |',
    '|-----|-------------|------------|--------|--------------|----------|',
    ...rows.map((r) => `| ${r.day} | ${r.occurrences} | ${r.avgIssues} | ${r.avgSP} | ${r.totalIssues} | ${r.totalSP} |`),
    '',
    `**Overall:** ${grandTotalIssues} issues, ${grandTotalSP} SP across ${totalDays} days with completions`
  ];
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`\n✅ Report saved: ${outPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
