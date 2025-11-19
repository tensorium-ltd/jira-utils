#!/usr/bin/env node

/**
 * Team Performance Report
 * 
 * Analyzes completed vs committed story points per team for the current sprint.
 * Shows which teams are on track, ahead, or behind their commitments.
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

// Completed status categories
const COMPLETED_STATUSES = [
  'Done',
  'READY FOR RELEASE',
  'CLOSED',
  'Completed',
  'Closed'
];

/**
 * Discover custom field IDs
 */
async function discoverCustomFields() {
  try {
    console.log('🔍 Discovering custom fields...');
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;

    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );

    // Look for Team field - prefer customfield_12700
    let teamField = fields.find(field =>
      field.id === 'customfield_12700'
    );

    if (!teamField) {
      teamField = fields.find(field =>
        field.name && field.name.toLowerCase() === 'team'
      );
    }

    console.log(`   ✓ Story Points field: ${storyPointsField?.id || 'customfield_10003'}`);
    console.log(`   ✓ Team field: ${teamField?.id || 'customfield_12700'} (${teamField?.name || 'Team'})`);

    return {
      storyPointsFieldId: storyPointsField?.id || 'customfield_10003',
      teamFieldId: teamField?.id || 'customfield_12700'
    };
  } catch (error) {
    console.error('Error discovering fields:', error.message);
    // Return defaults
    return {
      storyPointsFieldId: 'customfield_10003',
      teamFieldId: 'customfield_12700'
    };
  }
}

/**
 * Fetch all sprint issues
 */
async function getSprintIssues(customFields) {
  try {
    console.log(`\n🔎 Fetching all issues in ${CURRENT_SPRINT}...`);
    
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Story, Bug)`,
      maxResults: 1000,
      fields: ['key', 'summary', 'status', 'issuetype', 'assignee', customFields.storyPointsFieldId, customFields.teamFieldId]
    });

    console.log(`   ✓ Found ${response.data.issues?.length || 0} issues`);
    
    return response.data.issues || [];
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    throw error;
  }
}

/**
 * Check if issue is completed
 */
function isCompleted(issue) {
  const status = issue.fields.status?.name;
  return COMPLETED_STATUSES.some(completedStatus => 
    completedStatus.toLowerCase() === status?.toLowerCase()
  );
}

/**
 * Extract team name from issue
 */
function getTeamName(issue, teamFieldId) {
  const teamField = issue.fields[teamFieldId];
  
  if (!teamField) {
    return 'Unassigned';
  }
  
  // Handle different field formats
  if (typeof teamField === 'string') {
    return teamField;
  }
  
  if (teamField.value) {
    return teamField.value;
  }
  
  if (teamField.name) {
    return teamField.name;
  }
  
  return 'Unassigned';
}

/**
 * Group issues by team and calculate stats
 */
function calculateTeamPerformance(issues, customFields) {
  const teams = {};
  
  for (const issue of issues) {
    const teamName = getTeamName(issue, customFields.teamFieldId);
    const storyPoints = issue.fields[customFields.storyPointsFieldId] || 0;
    const completed = isCompleted(issue);
    const issueType = issue.fields.issuetype?.name;
    
    // Default 2 points for Stories/Bugs without points
    let points = storyPoints;
    if ((issueType === 'Story' || issueType === 'Bug') && points === 0) {
      points = 2;
    }
    
    if (!teams[teamName]) {
      teams[teamName] = {
        name: teamName,
        committedPoints: 0,
        completedPoints: 0,
        committedIssues: 0,
        completedIssues: 0,
        issues: []
      };
    }
    
    teams[teamName].committedPoints += points;
    teams[teamName].committedIssues++;
    
    if (completed) {
      teams[teamName].completedPoints += points;
      teams[teamName].completedIssues++;
    }
    
    teams[teamName].issues.push({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      issueType: issueType,
      storyPoints: points,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      completed: completed
    });
  }
  
  // Calculate completion percentages
  for (const team of Object.values(teams)) {
    team.completionPercentage = team.committedPoints > 0 
      ? ((team.completedPoints / team.committedPoints) * 100).toFixed(1)
      : 0;
  }
  
  return teams;
}

/**
 * Sort teams by completion percentage
 */
function sortTeamsByPerformance(teams) {
  return Object.values(teams).sort((a, b) => {
    return parseFloat(b.completionPercentage) - parseFloat(a.completionPercentage);
  });
}

/**
 * Generate progress bar
 */
function generateProgressBar(percentage, width = 30) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  let bar = '';
  if (percentage >= 80) {
    bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
  } else if (percentage >= 50) {
    bar = '🟨'.repeat(filled) + '⬜'.repeat(empty);
  } else {
    bar = '🟥'.repeat(filled) + '⬜'.repeat(empty);
  }
  
  return bar;
}

/**
 * Generate the report
 */
async function generateReport() {
  console.log('\n📊 Team Performance Report');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);

  try {
    // Discover custom fields
    const customFields = await discoverCustomFields();

    // Fetch all sprint issues
    const issues = await getSprintIssues(customFields);

    if (issues.length === 0) {
      console.log('\n⚠️  No issues found in sprint');
      return;
    }

    // Calculate team performance
    const teams = calculateTeamPerformance(issues, customFields);
    const sortedTeams = sortTeamsByPerformance(teams);

    // Calculate overall stats
    const totalCommitted = sortedTeams.reduce((sum, team) => sum + team.committedPoints, 0);
    const totalCompleted = sortedTeams.reduce((sum, team) => sum + team.completedPoints, 0);
    const overallPercentage = totalCommitted > 0 
      ? ((totalCompleted / totalCommitted) * 100).toFixed(1)
      : 0;

    // Display summary
    console.log('\n============================================================');
    console.log('📈 OVERALL SPRINT PERFORMANCE');
    console.log('============================================================\n');

    console.log(`   Total Committed: ${totalCommitted} points (${issues.length} issues)`);
    console.log(`   Total Completed: ${totalCompleted} points`);
    console.log(`   Overall Completion: ${overallPercentage}%`);
    console.log(`   ${generateProgressBar(parseFloat(overallPercentage))}`);

    console.log('\n============================================================');
    console.log('👥 TEAM PERFORMANCE BREAKDOWN');
    console.log('============================================================\n');

    // Display each team
    for (const team of sortedTeams) {
      const status = parseFloat(team.completionPercentage) >= 80 ? '🟢' : 
                     parseFloat(team.completionPercentage) >= 50 ? '🟡' : '🔴';
      
      console.log(`${status} ${team.name}`);
      console.log('   ' + '─'.repeat(60));
      console.log(`   Committed: ${team.committedPoints} points (${team.committedIssues} issues)`);
      console.log(`   Completed: ${team.completedPoints} points (${team.completedIssues} issues)`);
      console.log(`   Remaining: ${team.committedPoints - team.completedPoints} points`);
      console.log(`   Completion: ${team.completionPercentage}%`);
      console.log(`   ${generateProgressBar(parseFloat(team.completionPercentage))}`);
      console.log('');
    }

    // Display detailed breakdown
    console.log('============================================================');
    console.log('📋 DETAILED TEAM BREAKDOWN');
    console.log('============================================================\n');

    for (const team of sortedTeams) {
      const completedIssues = team.issues.filter(i => i.completed);
      const remainingIssues = team.issues.filter(i => !i.completed);

      console.log(`${team.name} (${team.completionPercentage}% complete)`);
      console.log('   ' + '─'.repeat(60));

      if (completedIssues.length > 0) {
        console.log(`   ✅ Completed (${completedIssues.length} issues, ${team.completedPoints} points):`);
        for (const issue of completedIssues.slice(0, 5)) {
          console.log(`      ${issue.key} - ${issue.storyPoints} pts - ${issue.summary.substring(0, 50)}`);
        }
        if (completedIssues.length > 5) {
          console.log(`      ... and ${completedIssues.length - 5} more`);
        }
        console.log('');
      }

      if (remainingIssues.length > 0) {
        const remainingPoints = team.committedPoints - team.completedPoints;
        console.log(`   ⏳ Remaining (${remainingIssues.length} issues, ${remainingPoints} points):`);
        for (const issue of remainingIssues.slice(0, 5)) {
          console.log(`      ${issue.key} - ${issue.storyPoints} pts - ${issue.status} - ${issue.summary.substring(0, 40)}`);
        }
        if (remainingIssues.length > 5) {
          console.log(`      ... and ${remainingIssues.length - 5} more`);
        }
      }
      console.log('');
    }

    // Team ranking
    console.log('============================================================');
    console.log('🏆 TEAM RANKINGS (by completion %)');
    console.log('============================================================\n');

    sortedTeams.forEach((team, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      console.log(`   ${medal} ${team.name.padEnd(25)} ${team.completionPercentage}% (${team.completedPoints}/${team.committedPoints} pts)`);
    });

    // Save report
    const reportData = {
      generatedAt: new Date().toISOString(),
      sprint: CURRENT_SPRINT,
      project: PROJECT_KEY,
      overall: {
        committedPoints: totalCommitted,
        completedPoints: totalCompleted,
        completionPercentage: parseFloat(overallPercentage),
        totalIssues: issues.length
      },
      teams: sortedTeams.map(team => ({
        name: team.name,
        committedPoints: team.committedPoints,
        completedPoints: team.completedPoints,
        remainingPoints: team.committedPoints - team.completedPoints,
        committedIssues: team.committedIssues,
        completedIssues: team.completedIssues,
        completionPercentage: parseFloat(team.completionPercentage),
        issues: team.issues
      }))
    };

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const outputPath = path.join(reportsDir, 'team-performance.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));

    console.log('\n============================================================');
    console.log(`✅ Report saved to: ${outputPath}`);
    console.log('\n🎉 Done!\n');

  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    process.exit(1);
  }
}

// Run the report
generateReport();

