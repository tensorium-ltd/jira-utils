#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const DEFAULT_WEEKS = 3;
const DEFAULT_STORY_POINTS = 2;
const DEFAULT_BUG_POINTS = 1;
const COMPLETED_STATUSES = ['Done', 'Ready for Release', 'Ready for release', 'Completed'];

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

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getWeekWindows(weeks) {
  const windows = [];
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  for (let i = 0; i < weeks; i += 1) {
    const windowEnd = new Date(end);
    windowEnd.setDate(end.getDate() - (i * 7));
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowEnd.getDate() - 6);
    windowStart.setHours(0, 0, 0, 0);
    windows.push({ start: windowStart, end: windowEnd });
  }

  return windows.reverse();
}

function getStoryPoints(issueType, value) {
  if (value && value > 0) return value;
  if (issueType === 'Story') return DEFAULT_STORY_POINTS;
  if (issueType === 'Bug') return DEFAULT_BUG_POINTS;
  return 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatStatusList(statuses) {
  return statuses.map(status => `"${status}"`).join(', ');
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const weeks = Number.parseInt(process.argv[2], 10) || DEFAULT_WEEKS;
  const windows = getWeekWindows(weeks);

  console.log('\n📊 Weekly Done Rate');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Weeks: ${weeks}`);
  console.log(`Statuses: ${COMPLETED_STATUSES.join(', ')}`);

  const weeklyTotals = [];

  for (const window of windows) {
    const startDate = formatDate(window.start);
    const endDate = formatDate(window.end);
    const statusList = formatStatusList(COMPLETED_STATUSES);
    const jql = [
      `project = ${PROJECT_KEY}`,
      'issuetype in (Story, Bug)',
      `status CHANGED TO (${statusList}) DURING ("${startDate}", "${endDate}")`
    ].join(' AND ');

    const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
    let totalPoints = 0;
    let storyCount = 0;
    let bugCount = 0;
    let defaultedStories = 0;
    let defaultedBugs = 0;

    issues.forEach(issue => {
      const issueType = issue.fields?.issuetype?.name || 'Unknown';
      if (issueType !== 'Story' && issueType !== 'Bug') return;
      const rawPoints = issue.fields?.[storyPointsFieldId] || 0;
      const points = getStoryPoints(issueType, rawPoints);
      totalPoints += points;
      if (issueType === 'Story') {
        storyCount += 1;
        if (!rawPoints) defaultedStories += 1;
      } else if (issueType === 'Bug') {
        bugCount += 1;
        if (!rawPoints) defaultedBugs += 1;
      }
    });

    weeklyTotals.push({
      startDate,
      endDate,
      storyPointsCompleted: Number(totalPoints.toFixed(2)),
      issueCounts: {
        stories: storyCount,
        bugs: bugCount
      },
      defaulted: {
        stories: defaultedStories,
        bugs: defaultedBugs
      }
    });
  }

  const totalsArray = weeklyTotals.map(week => week.storyPointsCompleted);
  const mean = Number(average(totalsArray).toFixed(2));
  const medianValue = Number(median(totalsArray).toFixed(2));

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    weeks,
    statusFilter: COMPLETED_STATUSES,
    storyPointsFieldId,
    assumptions: {
      defaultStoryPoints: DEFAULT_STORY_POINTS,
      defaultBugPoints: DEFAULT_BUG_POINTS,
      issueTypes: ['Story', 'Bug']
    },
    weeklyTotals,
    summary: {
      meanStoryPointsCompleted: mean,
      medianStoryPointsCompleted: medianValue
    }
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `done-rate-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `done-rate-${dateStr}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Weekly Done Rate');
  mdLines.push('');
  mdLines.push(`Project: ${PROJECT_KEY}`);
  mdLines.push(`Weeks: ${weeks}`);
  mdLines.push(`Statuses: ${COMPLETED_STATUSES.join(', ')}`);
  mdLines.push('');
  mdLines.push(`Mean SP completed per week: ${mean}`);
  mdLines.push(`Median SP completed per week: ${medianValue}`);
  mdLines.push('');
  mdLines.push('| Week Start | Week End | Story Points Completed | Stories | Bugs |');
  mdLines.push('|-----------|----------|-----------------------|---------|------|');
  weeklyTotals.forEach(week => {
    mdLines.push(`| ${week.startDate} | ${week.endDate} | ${week.storyPointsCompleted} | ${week.issueCounts.stories} | ${week.issueCounts.bugs} |`);
  });

  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log(`\nMean SP completed per week: ${mean}`);
  console.log(`Median SP completed per week: ${medianValue}`);
  console.log(`✅ JSON report saved: ${jsonPath}`);
  console.log(`✅ Markdown report saved: ${mdPath}`);
}

main().catch(error => {
  console.error('Failed to generate done rate report');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
