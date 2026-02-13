#!/usr/bin/env node

/**
 * Fix Version Summary Report
 * 
 * This script analyzes all completed work for a specific Fix Version
 * across all sprints, providing total story points and breakdown by sprint.
 */

const axios = require('axios');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 1D';
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED', 'Done'];

// Story Points field ID
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
 * Get sprint name from issue
 */
function getSprintName(issue) {
  try {
    const sprintField = issue.fields.customfield_11150;
    if (!sprintField || !Array.isArray(sprintField) || sprintField.length === 0) {
      return 'No Sprint';
    }
    // Get the most recent sprint
    const latestSprint = sprintField[sprintField.length - 1];
    return latestSprint.name || 'Unknown Sprint';
  } catch (error) {
    return 'No Sprint';
  }
}

/**
 * Fetch all issues for the Fix Version
 */
async function fetchCompletedIssues(client) {
  console.log(`🔍 Fetching all issues for Fix Version: ${FIX_VERSION}...`);
  
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${FIX_VERSION}"`;
  console.log(`   JQL: ${jql}`);
  
  // First, fetch just the keys
  const response = await client.post('/rest/api/3/search/jql', {
    jql: jql,
    maxResults: 1000,
    fields: ['key']
  });

  const issueRefs = response.data.issues || [];
  console.log(`   Found ${issueRefs.length} issues with Fix Version ${FIX_VERSION}`);
  console.log(`   Fetching detailed information...`);

  // Then fetch detailed information for each issue
  const allIssues = [];
  for (const issueRef of issueRefs) {
    const key = issueRef.key || issueRef.id;
    try {
      const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
        params: {
          fields: `key,summary,status,issuetype,${STORY_POINTS_FIELD},customfield_11150,created,resolutiondate`
        }
      });

      const issue = detailResponse.data;
      
      // Include all issues (not just completed)
      allIssues.push(issue);
    } catch (error) {
      console.error(`   Error fetching ${key}:`, error.message);
    }
  }

  console.log(`   ✓ Found ${allIssues.length} issues for ${FIX_VERSION}`);
  return allIssues;
}

/**
 * Analyze issues and generate report
 */
function analyzeIssues(issues) {
  const bySprint = {};
  const byIssueType = {};
  const byStatus = {};
  let totalPoints = 0;
  let totalIssues = 0;
  let completedPoints = 0;
  let completedIssues = 0;

  for (const issue of issues) {
    const issueType = issue.fields.issuetype?.name || 'Unknown';
    const sprintName = getSprintName(issue);
    const status = issue.fields.status?.name || 'Unknown';
    const isCompleted = COMPLETED_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());
    let points = issue.fields[STORY_POINTS_FIELD] || 0;

    // Apply default points for Stories/Bugs with no points
    if ((issueType === 'Story' || issueType === 'Bug') && points === 0) {
      points = 2;
    }

    totalPoints += points;
    totalIssues++;
    
    if (isCompleted) {
      completedPoints += points;
      completedIssues++;
    }

    // By Sprint
    if (!bySprint[sprintName]) {
      bySprint[sprintName] = {
        issues: [],
        points: 0,
        count: 0
      };
    }
    bySprint[sprintName].issues.push({
      key: issue.key,
      summary: issue.fields.summary,
      type: issueType,
      points: points,
      status: status
    });
    bySprint[sprintName].points += points;
    bySprint[sprintName].count++;

    // By Issue Type
    if (!byIssueType[issueType]) {
      byIssueType[issueType] = {
        count: 0,
        points: 0
      };
    }
    byIssueType[issueType].count++;
    byIssueType[issueType].points += points;

    // By Status
    if (!byStatus[status]) {
      byStatus[status] = {
        count: 0,
        points: 0
      };
    }
    byStatus[status].count++;
    byStatus[status].points += points;
  }

  return {
    totalPoints,
    totalIssues,
    completedPoints,
    completedIssues,
    bySprint,
    byIssueType,
    byStatus
  };
}

/**
 * Display the report
 */
function displayReport(analysis) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 FIX VERSION SUMMARY: ${FIX_VERSION}`);
  console.log('='.repeat(80));

  console.log('\n📈 OVERALL TOTALS:');
  console.log('─'.repeat(80));
  console.log(`   Total Issues: ${analysis.totalIssues}`);
  console.log(`   Total Story Points: ${analysis.totalPoints}`);
  console.log(`   ✅ Completed Issues: ${analysis.completedIssues} (${((analysis.completedIssues/analysis.totalIssues)*100).toFixed(1)}%)`);
  console.log(`   ✅ Completed Story Points: ${analysis.completedPoints} (${((analysis.completedPoints/analysis.totalPoints)*100).toFixed(1)}%)`);

  console.log('\n📊 BREAKDOWN BY STATUS:');
  console.log('─'.repeat(80));
  const sortedStatuses = Object.entries(analysis.byStatus)
    .sort((a, b) => b[1].points - a[1].points);
  
  for (const [status, data] of sortedStatuses) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    const isCompleted = COMPLETED_STATUSES.some(s => s.toLowerCase() === status.toLowerCase());
    const icon = isCompleted ? '✅' : '  ';
    console.log(`   ${icon} ${status.padEnd(20)} ${data.count.toString().padStart(3)} issues, ${data.points.toString().padStart(4)} points (${percentage}%)`);
  }

  console.log('\n📋 BREAKDOWN BY ISSUE TYPE:');
  console.log('─'.repeat(80));
  const sortedTypes = Object.entries(analysis.byIssueType)
    .sort((a, b) => b[1].points - a[1].points);
  
  for (const [type, data] of sortedTypes) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    console.log(`   ${type.padEnd(15)} ${data.count.toString().padStart(3)} issues, ${data.points.toString().padStart(4)} points (${percentage}%)`);
  }

  console.log('\n🏃 BREAKDOWN BY SPRINT:');
  console.log('─'.repeat(80));
  const sortedSprints = Object.entries(analysis.bySprint)
    .sort((a, b) => {
      // Sort "No Sprint" to the end
      if (a[0] === 'No Sprint') return 1;
      if (b[0] === 'No Sprint') return -1;
      // Otherwise sort by sprint name
      return a[0].localeCompare(b[0]);
    });

  for (const [sprint, data] of sortedSprints) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    const icon = sprint === 'No Sprint' ? '⚠️ ' : '  ';
    console.log(`\n${icon}${sprint}: ${data.count} issues, ${data.points} points (${percentage}%)`);
    
    // Show top 5 issues if there are many
    const issuesToShow = data.issues.slice(0, 5);
    for (const issue of issuesToShow) {
      console.log(`      ${issue.key} | ${issue.points.toString().padStart(2)} pts | ${issue.type.padEnd(10)} | ${issue.summary.substring(0, 50)}`);
    }
    if (data.issues.length > 5) {
      console.log(`      ... and ${data.issues.length - 5} more issues`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 TOTAL FOR ${FIX_VERSION}:`);
  console.log(`   All Issues: ${analysis.totalIssues} issues, ${analysis.totalPoints} points`);
  console.log(`   ✅ Completed: ${analysis.completedIssues} issues, ${analysis.completedPoints} points`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Main function
 */
async function main() {
  console.log('\n📊 Fix Version Summary Report');
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Fix Version: ${FIX_VERSION}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}\n`);

  try {
    const client = createJiraClient();
    const issues = await fetchCompletedIssues(client);
    const analysis = analyzeIssues(issues);
    displayReport(analysis);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
main();

