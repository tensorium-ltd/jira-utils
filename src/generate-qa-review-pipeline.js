#!/usr/bin/env node

/**
 * QA & Review Pipeline Report
 * 
 * Shows all issues currently in "In Review" or "In QA" status
 * to help identify bottlenecks and prioritize review/testing work.
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

    const teamField = fields.find(field =>
      field.id === 'customfield_12700' || 
      (field.name && field.name.toLowerCase() === 'team')
    );

    console.log(`   ✓ Story Points field: ${storyPointsField?.id || 'customfield_10003'}`);
    console.log(`   ✓ Team field: ${teamField?.id || 'customfield_12700'}`);

    return {
      storyPointsFieldId: storyPointsField?.id || 'customfield_10003',
      teamFieldId: teamField?.id || 'customfield_12700'
    };
  } catch (error) {
    console.error('Error discovering fields:', error.message);
    return {
      storyPointsFieldId: 'customfield_10003',
      teamFieldId: 'customfield_12700'
    };
  }
}

/**
 * Fetch issues in Review or QA
 */
async function getPipelineIssues(customFields) {
  try {
    console.log(`\n🔎 Fetching pipeline issues (In Review, Ready for review, In QA, Ready for QA)...`);
    
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND status in ("In Review", "Ready for review", "In QA", "Ready for QA") AND issuetype in (Story, Bug)`,
      maxResults: 1000,
      fields: [
        'key', 
        'summary', 
        'status', 
        'issuetype', 
        'assignee',
        'priority',
        'created',
        'updated',
        customFields.storyPointsFieldId, 
        customFields.teamFieldId
      ]
    });

    console.log(`   ✓ Found ${response.data.issues?.length || 0} issues in pipeline`);
    
    return response.data.issues || [];
  } catch (error) {
    console.error('Error fetching pipeline issues:', error.message);
    throw error;
  }
}

/**
 * Get team name from field
 */
function getTeamName(issue, teamFieldId) {
  const teamField = issue.fields[teamFieldId];
  
  if (!teamField) return 'Unassigned';
  
  if (typeof teamField === 'string') return teamField;
  if (teamField.value) return teamField.value;
  if (teamField.name) return teamField.name;
  
  return 'Unassigned';
}

/**
 * Calculate days in current status
 */
function getDaysInStatus(updatedDate) {
  const updated = new Date(updatedDate);
  const now = new Date();
  const diffTime = Math.abs(now - updated);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Group and process issues
 */
function processIssues(issues, customFields) {
  const grouped = {
    'In Review': [],
    'Ready for review': [],
    'In QA': [],
    'Ready for QA': []
  };

  let totalPoints = 0;
  let totalIssues = 0;

  for (const issue of issues) {
    const status = issue.fields.status?.name;
    const issueType = issue.fields.issuetype?.name;
    let storyPoints = issue.fields[customFields.storyPointsFieldId] || 0;
    
    // Default 2 points for Stories/Bugs without points
    if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
      storyPoints = 2;
    }

    const team = getTeamName(issue, customFields.teamFieldId);
    const daysInStatus = getDaysInStatus(issue.fields.updated);

    const processedIssue = {
      key: issue.key,
      summary: issue.fields.summary,
      status: status,
      issueType: issueType,
      priority: issue.fields.priority?.name || 'None',
      storyPoints: storyPoints,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      team: team,
      created: issue.fields.created?.split('T')[0],
      updated: issue.fields.updated?.split('T')[0],
      daysInStatus: daysInStatus
    };

    if (grouped[status]) {
      grouped[status].push(processedIssue);
    }

    totalPoints += storyPoints;
    totalIssues++;
  }

  // Sort each group by days in status (descending) then by priority
  for (const status in grouped) {
    grouped[status].sort((a, b) => {
      if (b.daysInStatus !== a.daysInStatus) {
        return b.daysInStatus - a.daysInStatus;
      }
      const priorityOrder = { 'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4 };
      const aPriority = priorityOrder[a.priority.split(' ')[0]] || 99;
      const bPriority = priorityOrder[b.priority.split(' ')[0]] || 99;
      return aPriority - bPriority;
    });
  }

  return { grouped, totalPoints, totalIssues };
}

/**
 * Display status group
 */
function displayStatusGroup(status, issues, icon) {
  if (issues.length === 0) return;

  const totalPoints = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);

  console.log(`\n${icon} ${status.toUpperCase()} (${issues.length} issues, ${totalPoints} points)`);
  console.log('═'.repeat(100));

  for (const issue of issues) {
    const days = issue.daysInStatus > 1 ? `${issue.daysInStatus} days` : `${issue.daysInStatus} day`;
    const ageIndicator = issue.daysInStatus > 3 ? '⚠️' : issue.daysInStatus > 2 ? '⏰' : '  ';
    const points = `${issue.storyPoints} pts`.padEnd(6);
    const priority = issue.priority.split(' ')[0].padEnd(4);
    const type = issue.issueType.substring(0, 4).padEnd(5);
    const team = issue.team.substring(0, 10).padEnd(11);
    const age = days.padEnd(7);
    
    console.log(`${ageIndicator} ${issue.key}  ${points} ${priority} ${type} ${team} ${age} ${issue.summary.substring(0, 35)}`);
  }
}

/**
 * Display team breakdown
 */
function displayTeamBreakdown(grouped) {
  console.log('\n═'.repeat(100));
  console.log('📊 BREAKDOWN BY TEAM');
  console.log('═'.repeat(100));

  const teamStats = {};

  // Aggregate by team
  for (const status in grouped) {
    for (const issue of grouped[status]) {
      if (!teamStats[issue.team]) {
        teamStats[issue.team] = {
          inReview: 0,
          inQA: 0,
          totalPoints: 0,
          totalIssues: 0
        };
      }

      if (status === 'In Review' || status === 'Ready for review') {
        teamStats[issue.team].inReview += issue.storyPoints;
      } else {
        teamStats[issue.team].inQA += issue.storyPoints;
      }

      teamStats[issue.team].totalPoints += issue.storyPoints;
      teamStats[issue.team].totalIssues++;
    }
  }

  // Sort teams by total points (descending)
  const sortedTeams = Object.entries(teamStats).sort((a, b) => b[1].totalPoints - a[1].totalPoints);

  console.log('\n   Team            In Review    In QA        Total     Issues');
  console.log('   ' + '─'.repeat(70));

  for (const [team, stats] of sortedTeams) {
    const teamName = team.padEnd(15);
    const inReview = `${stats.inReview} pts`.padEnd(12);
    const inQA = `${stats.inQA} pts`.padEnd(12);
    const total = `${stats.totalPoints} pts`.padEnd(10);
    const issues = stats.totalIssues;

    console.log(`   ${teamName} ${inReview} ${inQA} ${total} ${issues}`);
  }
}

/**
 * Display oldest issues
 */
function displayOldestIssues(grouped) {
  console.log('\n═'.repeat(100));
  console.log('⏰ OLDEST ISSUES IN PIPELINE (Needs Urgent Attention)');
  console.log('═'.repeat(100));

  const allIssues = [];
  for (const status in grouped) {
    allIssues.push(...grouped[status]);
  }

  const oldest = allIssues.sort((a, b) => b.daysInStatus - a.daysInStatus).slice(0, 10);

  console.log('\n   Key           Days  Points  Status           Team         Summary');
  console.log('   ' + '─'.repeat(90));

  for (const issue of oldest) {
    const key = issue.key.padEnd(13);
    const days = issue.daysInStatus.toString().padEnd(5);
    const points = issue.storyPoints.toString().padEnd(7);
    const status = issue.status.substring(0, 15).padEnd(16);
    const team = issue.team.substring(0, 10).padEnd(12);
    const indicator = issue.daysInStatus > 3 ? '⚠️ ' : '   ';

    console.log(`${indicator}${key} ${days} ${points} ${status} ${team} ${issue.summary.substring(0, 30)}`);
  }
}

/**
 * Generate the report
 */
async function generateReport() {
  console.log('\n📊 QA & Review Pipeline Report');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);

  try {
    // Discover custom fields
    const customFields = await discoverCustomFields();

    // Fetch pipeline issues
    const issues = await getPipelineIssues(customFields);

    if (issues.length === 0) {
      console.log('\n✅ No issues in pipeline - everything is clear!');
      return;
    }

    // Process and group issues
    const { grouped, totalPoints, totalIssues } = processIssues(issues, customFields);

    // Display summary
    console.log('\n============================================================');
    console.log('📈 PIPELINE SUMMARY');
    console.log('============================================================\n');

    const inReviewTotal = grouped['In Review'].length + grouped['Ready for review'].length;
    const inQATotal = grouped['In QA'].length + grouped['Ready for QA'].length;
    const inReviewPoints = grouped['In Review'].reduce((sum, i) => sum + i.storyPoints, 0) +
                           grouped['Ready for review'].reduce((sum, i) => sum + i.storyPoints, 0);
    const inQAPoints = grouped['In QA'].reduce((sum, i) => sum + i.storyPoints, 0) +
                       grouped['Ready for QA'].reduce((sum, i) => sum + i.storyPoints, 0);

    console.log(`   👀 In Review: ${inReviewTotal} issues (${inReviewPoints} points)`);
    console.log(`   🧪 In QA: ${inQATotal} issues (${inQAPoints} points)`);
    console.log(`   📊 Total Pipeline: ${totalIssues} issues (${totalPoints} points)`);

    // Display each status group
    displayStatusGroup('In Review', grouped['In Review'], '👀');
    displayStatusGroup('Ready for review', grouped['Ready for review'], '✅');
    displayStatusGroup('In QA', grouped['In QA'], '🧪');
    displayStatusGroup('Ready for QA', grouped['Ready for QA'], '📋');

    // Display team breakdown
    displayTeamBreakdown(grouped);

    // Display oldest issues
    displayOldestIssues(grouped);

    // Save report
    const reportData = {
      generatedAt: new Date().toISOString(),
      sprint: CURRENT_SPRINT,
      project: PROJECT_KEY,
      summary: {
        totalIssues: totalIssues,
        totalPoints: totalPoints,
        inReview: {
          count: inReviewTotal,
          points: inReviewPoints
        },
        inQA: {
          count: inQATotal,
          points: inQAPoints
        }
      },
      byStatus: grouped
    };

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const outputPath = path.join(reportsDir, 'qa-review-pipeline.json');
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

