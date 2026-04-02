#!/usr/bin/env node

/**
 * Linear Regression Analysis – Story Points Completed per Week
 *
 * Fetches total SP completed for Stories per week for the last 12 weeks,
 * runs linear regression, and forecasts the next 4 weeks.
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const COMPLETED_STATUSES = ['Done', 'Ready for Release', 'Ready for release', 'Completed', 'Closed', 'CLOSED', 'READY FOR RELEASE'];
const DEFAULT_STORY_POINTS = 2;
const WEEKS_HISTORY = 12;
const WEEKS_FORECAST = 4;

function validateConfig() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
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
    timeout: 60000
  });
}

async function discoverStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];
    const storyPointsField = fields.find(
      (f) => f.name && f.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch {
    return 'customfield_10003';
  }
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

/**
 * Get 7-day week windows for the last N weeks (most recent week first in loop, then reversed)
 * Each window: 7 days ending on (today - i*7)
 */
function getWeekWindows(weeks) {
  const windows = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    windows.push({
      start: weekStart,
      end: weekEnd,
      startStr: weekStart.toISOString().split('T')[0],
      endStr: weekEnd.toISOString().split('T')[0]
    });
  }

  return windows.reverse();
}

function getStoryPoints(value) {
  return value && value > 0 ? Number(value) : DEFAULT_STORY_POINTS;
}

function formatStatusList(statuses) {
  return statuses.map((s) => `"${s}"`).join(', ');
}

/**
 * Simple linear regression: y = mx + b
 * Returns { slope, intercept, rSquared, predict }
 */
function linearRegression(xValues, yValues) {
  const n = xValues.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, rSquared: 0, predict: () => 0 };
  }

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
  const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);

  const meanX = sumX / n;
  const meanY = sumY / n;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = meanY - slope * meanX;

  const predict = (x) => slope * x + intercept;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = predict(xValues[i]);
    ssRes += Math.pow(yValues[i] - yHat, 2);
    ssTot += Math.pow(yValues[i] - meanY, 2);
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared, predict };
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const windows = getWeekWindows(WEEKS_HISTORY);

  console.log('\n📈 Linear Regression Analysis – Story Points Completed per Week');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Issue Type: Story only`);
  console.log(`Weeks history: ${WEEKS_HISTORY}`);
  console.log(`Forecast: next ${WEEKS_FORECAST} weeks`);
  console.log('='.repeat(60));

  const weeklyData = [];
  const statusList = formatStatusList(COMPLETED_STATUSES);

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const jql = [
      `project = ${PROJECT_KEY}`,
      'issuetype = Story',
      `status CHANGED TO (${statusList}) DURING ("${w.startStr}", "${w.endStr}")`
    ].join(' AND ');

    process.stdout.write(`   Week ${i + 1} (${w.startStr} → ${w.endStr})... `);
    const issues = await fetchIssuesByJql(client, jql, [
      'issuetype',
      storyPointsFieldId
    ]);

    let totalSp = 0;
    issues.forEach((issue) => {
      const points = getStoryPoints(issue.fields?.[storyPointsFieldId]);
      totalSp += points;
    });

    weeklyData.push({
      weekIndex: i + 1,
      startDate: w.startStr,
      endDate: w.endStr,
      storyPoints: Number(totalSp.toFixed(2)),
      issueCount: issues.length
    });
    console.log(`${totalSp} SP (${issues.length} stories)`);
  }

  const xValues = weeklyData.map((d) => d.weekIndex);
  const yValues = weeklyData.map((d) => d.storyPoints);
  const lr = linearRegression(xValues, yValues);

  const forecast = [];
  for (let w = 1; w <= WEEKS_FORECAST; w++) {
    const weekNum = WEEKS_HISTORY + w;
    const predicted = lr.predict(weekNum);
    forecast.push({
      weekIndex: weekNum,
      predictedStoryPoints: Math.max(0, Number(predicted.toFixed(2)))
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    issueType: 'Story',
    weeksHistory: WEEKS_HISTORY,
    weeksForecast: WEEKS_FORECAST,
    weeklyData,
    regression: {
      slope: Number(lr.slope.toFixed(4)),
      intercept: Number(lr.intercept.toFixed(2)),
      rSquared: Number(lr.rSquared.toFixed(4)),
      trend: lr.slope > 0 ? 'increasing' : lr.slope < 0 ? 'decreasing' : 'flat'
    },
    forecast
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `linear-regression-analysis-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 TREND INFORMATION');
  console.log('='.repeat(60));
  console.log(`   Slope: ${lr.slope.toFixed(4)} SP per week`);
  console.log(`   Intercept: ${lr.intercept.toFixed(2)} SP`);
  console.log(`   R² (fit): ${(lr.rSquared * 100).toFixed(2)}%`);
  console.log(`   Trend: ${report.regression.trend.toUpperCase()}`);
  const avgSp = yValues.reduce((a, b) => a + b, 0) / yValues.length;
  console.log(`   Average SP/week (historical): ${avgSp.toFixed(2)}`);
  console.log('');
  console.log('📅 FORECAST – Next 4 Weeks');
  console.log('='.repeat(60));
  forecast.forEach((f, i) => {
    console.log(`   Week ${WEEKS_HISTORY + i + 1}: ~${f.predictedStoryPoints} SP`);
  });
  console.log('');
  console.log(`✅ Report saved: ${jsonPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
