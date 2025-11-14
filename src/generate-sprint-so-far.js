#!/usr/bin/env node

/**
 * Sprint Progress Report - Daily Breakdown
 * 
 * Generates a day-by-day breakdown of sprint progress showing:
 * - Total sprint scope
 * - Points completed each day
 * - Cumulative points completed
 * - Points remaining
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31';

// Disable SSL verification (for corporate proxies)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Get credentials from environment
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('❌ Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables are required');
  process.exit(1);
}

// Create axios client with auth
const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const client = axios.create({
  baseURL: JIRA_BASE_URL,
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

/**
 * Discover the Story Points custom field
 */
async function discoverStoryPointsField() {
  try {
    const response = await client.get('/rest/api/3/field');
    const storyPointsField = response.data.find(field => 
      field.name === 'Story Points' || 
      field.name === 'Story point estimate' ||
      field.key === 'customfield_10003'
    );
    
    if (!storyPointsField) {
      throw new Error('Could not find Story Points field');
    }
    
    return storyPointsField.key;
  } catch (error) {
    console.error('Error discovering Story Points field:', error.message);
    throw error;
  }
}

/**
 * Get sprint details including start and end dates
 */
async function getSprintDetails(sprintName) {
  try {
    // First, find an issue in this sprint to get sprint details
    const searchResponse = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}"`,
      maxResults: 1
    });

    if (searchResponse.data.issues.length === 0) {
      throw new Error(`No issues found in sprint: ${sprintName}`);
    }

    const issueKey = searchResponse.data.issues[0].key || searchResponse.data.issues[0].id;
    
    // Get issue details with sprint field
    const issueDetail = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'customfield_11150'
      }
    });

    const sprintField = issueDetail.data.fields.customfield_11150;
    if (!sprintField || sprintField.length === 0) {
      throw new Error('Sprint field not found on issue');
    }

    // Find the matching sprint
    const sprint = sprintField.find(s => s.name === sprintName);
    if (!sprint) {
      throw new Error(`Sprint ${sprintName} not found in issue's sprint field`);
    }

    return {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate ? sprint.startDate.split('T')[0] : null,
      endDate: sprint.endDate ? sprint.endDate.split('T')[0] : null,
      state: sprint.state
    };
  } catch (error) {
    console.error('Error fetching sprint details:', error.message);
    throw error;
  }
}

/**
 * Get all issues in the sprint
 */
async function getSprintIssues(sprintName, storyPointsField) {
  try {
    // First get list of issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND issuetype in (Story, Bug)`,
      maxResults: 1000
    });

    const allIssues = [];
    // Fetch full details for each issue including changelog
    for (const issueRef of response.data.issues || []) {
      const key = issueRef.key || issueRef.id;
      if (!key) {
        console.warn('⚠️  Issue without key or id');
        continue;
      }
      
      try {
        const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: `key,summary,status,${storyPointsField},issuetype,updated`,
            expand: 'changelog'
          }
        });
        allIssues.push(detailResponse.data);
      } catch (err) {
        console.warn(`⚠️  Could not fetch ${key}:`, err.message);
      }
    }

    return allIssues;
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    throw error;
  }
}

/**
 * Get the date when an issue was completed (moved to "Ready for Release" or "Closed")
 */
function getCompletionDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  const completedStatuses = ['READY FOR RELEASE', 'CLOSED', 'DONE', 'COMPLETED'];
  
  // Find the last transition to a completed status
  for (let i = issue.changelog.histories.length - 1; i >= 0; i--) {
    const history = issue.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' && 
          completedStatuses.some(s => s === item.toString?.toUpperCase() || s === item.to)) {
        return history.created.split('T')[0];
      }
    }
  }

  // If currently in a completed status but no transition found, use updated date
  const currentStatus = issue.fields.status.name.toUpperCase();
  if (completedStatuses.includes(currentStatus)) {
    return issue.fields.updated?.split('T')[0] || null;
  }

  return null;
}

/**
 * Generate all dates between start and end (inclusive)
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Calculate daily progress
 */
function calculateDailyProgress(issues, sprintStartDate, today, storyPointsField) {
  const dailyProgress = [];
  // Ensure today is included in range
  const endDate = today >= sprintStartDate ? today : sprintStartDate;
  const dates = getDateRange(sprintStartDate, endDate);
  
  // Calculate total sprint scope
  let totalPoints = 0;
  for (const issue of issues) {
    const points = issue.fields[storyPointsField] || 2; // Default 2 points
    totalPoints += points;
  }

  let cumulativePoints = 0;

  for (const date of dates) {
    // Find all issues completed on this date (only during or after sprint start)
    let pointsCompletedToday = 0;
    const completedIssues = [];

    for (const issue of issues) {
      const completionDate = getCompletionDate(issue);
      // Only count if completed on this date AND on or after sprint start
      if (completionDate === date && completionDate >= sprintStartDate) {
        const points = issue.fields[storyPointsField] || 2;
        pointsCompletedToday += points;
        completedIssues.push({
          key: issue.key,
          summary: issue.fields.summary,
          points: points,
          type: issue.fields.issuetype.name
        });
      }
    }

    cumulativePoints += pointsCompletedToday;
    const remainingPoints = totalPoints - cumulativePoints;

    dailyProgress.push({
      date,
      totalSprint: totalPoints,
      completedToday: pointsCompletedToday,
      cumulativeCompleted: cumulativePoints,
      remaining: remainingPoints,
      percentComplete: ((cumulativePoints / totalPoints) * 100).toFixed(1),
      completedIssues
    });
  }

  return dailyProgress;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  // Parse date in local timezone to avoid timezone shifts
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n📊 Starting Sprint Progress Report (Day by Day)...\n');
    console.log('============================================================');
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprint: ${CURRENT_SPRINT}`);
    console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
    console.log('============================================================\n');

    // Discover story points field
    console.log('🔍 Discovering Story Points field...');
    const storyPointsField = await discoverStoryPointsField();
    console.log(`   ✓ Using field: ${storyPointsField}\n`);

    // Get sprint details
    console.log('📅 Fetching sprint details...');
    const sprint = await getSprintDetails(CURRENT_SPRINT);
    console.log(`   ✓ Sprint: ${sprint.name}`);
    console.log(`   ✓ Start Date: ${sprint.startDate}`);
    console.log(`   ✓ End Date: ${sprint.endDate}`);
    console.log(`   ✓ State: ${sprint.state}\n`);

    if (!sprint.startDate) {
      throw new Error('Sprint start date not found');
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch all sprint issues
    console.log('🔎 Fetching all sprint issues...');
    const issues = await getSprintIssues(CURRENT_SPRINT, storyPointsField);
    console.log(`   ✓ Found ${issues.length} issues\n`);

    // Calculate daily progress
    console.log('📊 Calculating daily progress...\n');
    const dailyProgress = calculateDailyProgress(issues, sprint.startDate, today, storyPointsField);

    // Display results
    console.log('============================================================');
    console.log('📈 DAILY SPRINT PROGRESS');
    console.log('============================================================\n');

    console.log('DATE           | COMPLETED | CUMULATIVE | REMAINING | % DONE');
    console.log('               |   TODAY   |   TOTAL    |           |       ');
    console.log('----------------------------------------------------------------');

    for (const day of dailyProgress) {
      const dateStr = formatDate(day.date).padEnd(14);
      const completed = String(day.completedToday).padStart(9);
      const cumulative = String(day.cumulativeCompleted).padStart(10);
      const remaining = String(day.remaining).padStart(9);
      const percent = String(day.percentComplete + '%').padStart(7);
      
      console.log(`${dateStr} | ${completed} | ${cumulative} | ${remaining} | ${percent}`);
    }

    console.log('----------------------------------------------------------------');
    const lastDay = dailyProgress[dailyProgress.length - 1];
    console.log(`\nTotal Sprint: ${lastDay.totalSprint} points`);
    console.log(`Completed: ${lastDay.cumulativeCompleted} points (${lastDay.percentComplete}%)`);
    console.log(`Remaining: ${lastDay.remaining} points`);

    // Show detailed breakdown for today
    console.log('\n============================================================');
    console.log(`📋 ISSUES COMPLETED TODAY (${today})`);
    console.log('============================================================\n');

    const todayData = dailyProgress.find(d => d.date === today);
    if (todayData && todayData.completedIssues.length > 0) {
      for (const issue of todayData.completedIssues) {
        console.log(`   ✓ ${issue.key}: ${issue.points} pts - ${issue.summary.substring(0, 60)}...`);
      }
      console.log(`\n   Total: ${todayData.completedIssues.length} issues, ${todayData.completedToday} points`);
    } else {
      console.log('   No issues completed today yet.');
    }

    // Save to JSON
    const outputData = {
      date: today,
      project: PROJECT_KEY,
      sprint: sprint.name,
      sprintStartDate: sprint.startDate,
      sprintEndDate: sprint.endDate,
      totalSprintPoints: lastDay.totalSprint,
      totalCompleted: lastDay.cumulativeCompleted,
      totalRemaining: lastDay.remaining,
      percentComplete: parseFloat(lastDay.percentComplete),
      dailyProgress: dailyProgress
    };

    const outputPath = path.join(__dirname, '../reports/sprint-progress-daily.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n✅ Report saved to: ${outputPath}`);

    console.log('\n🎉 Report generation complete!\n');
  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the script
main();

