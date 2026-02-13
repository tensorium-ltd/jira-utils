#!/usr/bin/env node

/**
 * Simple Completed Issues Count - Last 2 Months
 * Based on working generate-full-history.js pattern
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const STORY_POINTS_FIELD = 'customfield_10003';

/**
 * Creates an authenticated Jira API client
 */
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

/**
 * Calculate date 2 months ago
 */
function getTwoMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return date.toISOString().split('T')[0];
}

/**
 * Fetch issues with cursor-based pagination
 */
async function fetchIssues(client, jql) {
  console.log(`   JQL: ${jql}`);
  
  let allIssues = [];
  let nextPageToken = null;
  
  do {
    const body = {
      jql: jql,
      maxResults: 100,
      fields: ['key', 'issuetype', STORY_POINTS_FIELD]
    };
    
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    
    const response = await client.post('/rest/api/3/search/jql', body);
    
    const issues = response.data.issues || [];
    allIssues = allIssues.concat(issues);
    
    // Get the next page token
    nextPageToken = response.data.nextPageToken || null;
    
    console.log(`   Fetched ${allIssues.length} issues${nextPageToken ? ' (more pages...)' : ''}`);
    
    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);
  
  console.log(`   ✓ Total: ${allIssues.length} issues`);
  return allIssues;
}

/**
 * Main function
 */
async function main() {
  const twoMonthsAgo = getTwoMonthsAgo();
  const today = new Date().toISOString().split('T')[0];

  console.log('\n📊 Completed Issues - Last 2 Months');
  console.log('============================================================');
  console.log(`   Period: ${twoMonthsAgo} to ${today}`);
  console.log(`   Project: ${PROJECT_KEY}`);

  try {
    const client = createJiraClient();

    // Query for stories and bugs resolved in the last 2 months
    const jql = `project = ${PROJECT_KEY} AND issuetype in (Story, Bug) AND resolved >= "${twoMonthsAgo}"`;
    
    console.log('\n⏳ Fetching completed issues...');
    const issues = await fetchIssues(client, jql);

    // Analyze
    let stories = 0, bugs = 0;
    let storiesWithPoints = 0, bugsWithPoints = 0;
    let totalStoryPoints = 0, totalBugPoints = 0;
    let adjustedStoryPoints = 0, adjustedBugPoints = 0;

    for (const issue of issues) {
      const type = issue.fields?.issuetype?.name;
      const points = issue.fields?.[STORY_POINTS_FIELD] || 0;
      
      if (type === 'Story') {
        stories++;
        if (points > 0) {
          storiesWithPoints++;
          totalStoryPoints += points;
          adjustedStoryPoints += points;
        } else {
          // Default: 2 SP for stories without points
          adjustedStoryPoints += 2;
        }
      } else if (type === 'Bug') {
        bugs++;
        if (points > 0) {
          bugsWithPoints++;
          totalBugPoints += points;
          adjustedBugPoints += points;
        } else {
          // Default: 1 SP for bugs without points
          adjustedBugPoints += 1;
        }
      }
    }

    const total = stories + bugs;
    const totalWithPoints = storiesWithPoints + bugsWithPoints;
    const totalAdjustedPoints = adjustedStoryPoints + adjustedBugPoints;

    // Calculate working days (5-day week, excluding weekends)
    const startDate = new Date(twoMonthsAgo);
    const endDate = new Date(today);
    let workingDays = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        workingDays++;
      }
    }

    // Calculate daily averages
    const actualDailyMean = workingDays > 0 ? (totalStoryPoints + totalBugPoints) / workingDays : 0;
    const adjustedDailyMean = workingDays > 0 ? totalAdjustedPoints / workingDays : 0;
    
    // Weekly averages (based on 5-day weeks)
    const weeks = workingDays / 5;
    const actualWeeklyMean = weeks > 0 ? (totalStoryPoints + totalBugPoints) / weeks : 0;
    const adjustedWeeklyMean = weeks > 0 ? totalAdjustedPoints / weeks : 0;

    console.log('\n============================================================');
    console.log('📈 RESULTS');
    console.log('============================================================\n');
    
    console.log(`   📝 Stories completed:        ${stories}`);
    console.log(`      - With story points:      ${storiesWithPoints} (${stories > 0 ? ((storiesWithPoints/stories)*100).toFixed(1) : 0}%)`);
    console.log(`      - Actual points:          ${totalStoryPoints}`);
    console.log(`      - Adjusted points:        ${adjustedStoryPoints} (unestimated = 2 SP)`);
    console.log('');
    console.log(`   🐛 Bugs completed:           ${bugs}`);
    console.log(`      - With story points:      ${bugsWithPoints} (${bugs > 0 ? ((bugsWithPoints/bugs)*100).toFixed(1) : 0}%)`);
    console.log(`      - Actual points:          ${totalBugPoints}`);
    console.log(`      - Adjusted points:        ${adjustedBugPoints} (unestimated = 1 SP)`);
    console.log('');
    console.log('   ─────────────────────────────────────────');
    console.log(`   📊 TOTAL completed:          ${total}`);
    console.log(`      - With story points:      ${totalWithPoints} (${total > 0 ? ((totalWithPoints/total)*100).toFixed(1) : 0}%)`);
    console.log(`      - Actual points:          ${totalStoryPoints + totalBugPoints}`);
    console.log(`      - ADJUSTED TOTAL:         ${totalAdjustedPoints}`);
    
    console.log('\n============================================================');
    console.log('📅 DAILY & WEEKLY AVERAGES (5-day work week)');
    console.log('============================================================\n');
    
    console.log(`   Working days in period:      ${workingDays}`);
    console.log(`   Working weeks:               ${weeks.toFixed(1)}`);
    console.log('');
    console.log(`   📈 Actual Daily Mean:        ${actualDailyMean.toFixed(1)} SP/day`);
    console.log(`   📈 Adjusted Daily Mean:      ${adjustedDailyMean.toFixed(1)} SP/day`);
    console.log('');
    console.log(`   📊 Actual Weekly Mean:       ${actualWeeklyMean.toFixed(1)} SP/week`);
    console.log(`   📊 Adjusted Weekly Mean:     ${adjustedWeeklyMean.toFixed(1)} SP/week`);
    
    console.log('\n🎉 Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run
main();
