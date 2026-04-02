#!/usr/bin/env node

/**
 * Daily Stats by Sprint
 *
 * For NH Sprint 35, 36, 37, and so far in 38:
 * - Mean and median daily story point completion (Stories only, normal completion criteria)
 * - Defects per Story = (bugs + sub-bugs raised during sprint window) / (number of Stories in sprint)
 *
 * Usage:
 *   npm run stats-daily-by-sprint
 *   node src/generate-stats-daily-by-sprint.js
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

const SPRINT_NAMES = ['NH Sprint 35', 'NH Sprint 36', 'NH Sprint 37', 'NH Sprint 38'];

const COMPLETED_STATUSES = [
  'Ready for Release',
  'Ready for release',
  'Complete',
  'Completed',
  'Done',
  'Closed',
  'Resolved'
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

async function fetchAllSprints(client, boardId) {
  const results = [];
  let startAt = 0;
  let isLast = false;
  while (!isLast) {
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: 'active,closed,future', startAt, maxResults: 50 }
    });
    const data = response.data || {};
    results.push(...(data.values || []));
    startAt += data.maxResults || 50;
    isLast = data.isLast || !(data.values || []).length;
  }
  return results;
}

async function getSprintByName(client, boardId, sprintName) {
  const sprints = await fetchAllSprints(client, boardId);
  return sprints.find((s) => s.name === sprintName) || null;
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

async function getDateMovedToDone(client, issueKey) {
  try {
    const { data } = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: { fields: 'issuetype', expand: 'changelog' }
    });
    if (!data.changelog?.histories?.length) return null;
    const histories = [...data.changelog.histories].sort(
      (a, b) => new Date(a.created) - new Date(b.created)
    );
    for (const history of histories) {
      for (const item of history.items || []) {
        if (item.field === 'status') {
          const toStatus = (item.toString || item.to || '').trim().toLowerCase();
          if (COMPLETED_STATUSES.some((s) => toStatus === s.toLowerCase())) {
            return history.created.split('T')[0];
          }
        }
      }
    }
  } catch (_) {}
  return null;
}

/** Count working days (Mon–Fri) between two dates, inclusive. */
function countWorkingDays(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

async function processSprint(client, sprintName, storyPointsFieldId) {
  const sprint = await getSprintByName(client, BOARD_ID, sprintName);
  if (!sprint) {
    return { sprintName, error: `Sprint "${sprintName}" not found` };
  }

  const sprintStartStr = sprint.startDate?.slice(0, 10) || '';
  const sprintEndStr = sprint.endDate?.slice(0, 10) || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const isActive = sprint.state === 'active';
  const effectiveEndStr = isActive && todayStr < sprintEndStr ? todayStr : sprintEndStr;

  if (!sprintStartStr || !effectiveEndStr) {
    return { sprintName, error: 'Sprint has no valid dates' };
  }

  const workingDays = countWorkingDays(sprintStartStr, effectiveEndStr);

  // 1. Fetch completed Stories in sprint
  const statusList = COMPLETED_STATUSES.map((s) => `"${s}"`).join(', ');
  const storiesJql = `project = ${PROJECT_KEY} AND sprint = ${sprint.id} AND issuetype = Story AND status IN (${statusList})`;
  const completedStories = await fetchIssuesByJql(client, storiesJql, [
    'key', 'summary', 'status', storyPointsFieldId
  ]);

  // 2. Fetch all Stories in sprint (for defect rate denominator)
  const allStoriesJql = `project = ${PROJECT_KEY} AND sprint = ${sprint.id} AND issuetype = Story`;
  const allStories = await fetchIssuesByJql(client, allStoriesJql, ['key']);
  const storyCount = allStories.length;

  // 3. Daily SP burn from changelog
  const dailyBurn = {};
  let totalSpCompleted = 0;

  for (let i = 0; i < completedStories.length; i++) {
    const ref = completedStories[i];
    process.stdout.write(`   ${sprintName}: changelog ${i + 1}/${completedStories.length} ${ref.key}...\r`);
    const doneDate = await getDateMovedToDone(client, ref.key);
    const sp = ref.fields?.[storyPointsFieldId] != null
      ? Number(ref.fields[storyPointsFieldId])
      : 2;
    if (doneDate && doneDate >= sprintStartStr && doneDate <= effectiveEndStr) {
      dailyBurn[doneDate] = (dailyBurn[doneDate] || 0) + sp;
      totalSpCompleted += sp;
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  const dailyBurnValues = Object.values(dailyBurn);
  const meanDailySp = workingDays > 0 ? totalSpCompleted / workingDays : 0;
  const medianDailySp = median(dailyBurnValues);

  // 4. Bugs/sub-bugs raised during sprint window
  const bugsJql = `project = ${PROJECT_KEY} AND issuetype in (Bug, "Sub-bug") AND created >= "${sprintStartStr}" AND created <= "${effectiveEndStr}"`;
  const bugsRaised = await fetchIssuesByJql(client, bugsJql, ['key', 'issuetype']);
  const defectsCount = bugsRaised.length;

  const defectsPerStory = storyCount > 0 ? defectsCount / storyCount : 0;

  return {
    sprintName,
    sprintStart: sprintStartStr,
    sprintEnd: effectiveEndStr,
    isActive,
    workingDays,
    storyCount,
    completedStoriesCount: completedStories.length,
    totalSpCompleted,
    meanDailySp,
    medianDailySp,
    defectsCount,
    defectsPerStory
  };
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  console.log('\n📊 Daily Stats by Sprint');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Sprints: ${SPRINT_NAMES.join(', ')}`);
  console.log('Scope: Stories only, normal completion criteria');
  console.log('Defects per Story = (bugs + sub-bugs raised during sprint) / (Stories in sprint)');
  console.log('');

  const results = [];

  for (const sprintName of SPRINT_NAMES) {
    console.log(`\n🔎 Processing ${sprintName}...`);
    const data = await processSprint(client, sprintName, storyPointsFieldId);
    results.push(data);
  }

  console.log('\n');

  // Console output
  console.log('='.repeat(75));
  console.log('📋 MEAN & MEDIAN DAILY STORY POINT COMPLETION');
  console.log('='.repeat(75));
  console.log('');
  console.log('| Sprint       | Working Days | Stories | SP Done | Mean Daily SP | Median Daily SP |');
  console.log('|--------------|--------------|---------|---------|---------------|-----------------|');

  for (const r of results) {
    if (r.error) {
      console.log(`| ${r.sprintName.padEnd(12)} | ${r.error}`);
      continue;
    }
    const label = r.isActive ? `${r.sprintName} (so far)` : r.sprintName;
    console.log(`| ${label.padEnd(12)} | ${String(r.workingDays).padStart(12)} | ${String(r.storyCount).padStart(7)} | ${String(r.totalSpCompleted).padStart(7)} | ${r.meanDailySp.toFixed(2).padStart(13)} | ${r.medianDailySp.toFixed(2).padStart(15)} |`);
  }

  console.log('');
  console.log('='.repeat(75));
  console.log('📋 DEFECTS PER STORY');
  console.log('='.repeat(75));
  console.log('');
  console.log('| Sprint       | Stories | Bugs/Sub-bugs Raised | Defects per Story |');
  console.log('|--------------|---------|----------------------|-------------------|');

  for (const r of results) {
    if (r.error) continue;
    const label = r.isActive ? `${r.sprintName} (so far)` : r.sprintName;
    console.log(`| ${label.padEnd(12)} | ${String(r.storyCount).padStart(7)} | ${String(r.defectsCount).padStart(20)} | ${r.defectsPerStory.toFixed(2).padStart(17)} |`);
  }

  console.log('');

  // Save report
  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    sprints: results
  };

  const jsonPath = path.join(reportsDir, `stats-daily-by-sprint-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved: ${jsonPath}`);

  // Markdown
  const mdLines = [];
  mdLines.push('# Daily Stats by Sprint');
  mdLines.push('');
  mdLines.push(`**Project:** ${PROJECT_KEY}`);
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push('');
  mdLines.push('## Mean & Median Daily Story Point Completion');
  mdLines.push('');
  mdLines.push('| Sprint | Working Days | Stories | SP Done | Mean Daily SP | Median Daily SP |');
  mdLines.push('|-------|--------------|---------|---------|---------------|-----------------|');
  for (const r of results) {
    if (r.error) {
      mdLines.push(`| ${r.sprintName} | ${r.error} |`);
      continue;
    }
    const label = r.isActive ? `${r.sprintName} (so far)` : r.sprintName;
    mdLines.push(`| ${label} | ${r.workingDays} | ${r.storyCount} | ${r.totalSpCompleted} | ${r.meanDailySp.toFixed(2)} | ${r.medianDailySp.toFixed(2)} |`);
  }
  mdLines.push('');
  mdLines.push('## Defects per Story');
  mdLines.push('');
  mdLines.push('| Sprint | Stories | Bugs/Sub-bugs Raised | Defects per Story |');
  mdLines.push('|-------|---------|----------------------|-------------------|');
  for (const r of results) {
    if (r.error) continue;
    const label = r.isActive ? `${r.sprintName} (so far)` : r.sprintName;
    mdLines.push(`| ${label} | ${r.storyCount} | ${r.defectsCount} | ${r.defectsPerStory.toFixed(2)} |`);
  }

  const mdPath = path.join(reportsDir, `stats-daily-by-sprint-${dateStr}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
