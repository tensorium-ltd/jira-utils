#!/usr/bin/env node

/**
 * No Team Assignment Report
 * 
 * Lists all issues in the current sprint that have no team assignment,
 * showing their status and story points to help identify work that needs team ownership.
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
 * Fetch all sprint issues
 */
async function getSprintIssues(customFields) {
  try {
    console.log(`\n🔎 Fetching all issues in ${CURRENT_SPRINT}...`);
    
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Story, Bug)`,
      maxResults: 1000,
      fields: [
        'key', 
        'summary', 
        'status', 
        'issuetype', 
        'assignee',
        'priority',
        'created',
        customFields.storyPointsFieldId, 
        customFields.teamFieldId
      ]
    });

    console.log(`   ✓ Found ${response.data.issues?.length || 0} issues`);
    
    return response.data.issues || [];
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    throw error;
  }
}

/**
 * Check if issue has team assignment
 */
function hasTeamAssignment(issue, teamFieldId) {
  const teamField = issue.fields[teamFieldId];
  
  if (!teamField) {
    return false;
  }
  
  // Handle different field formats
  if (typeof teamField === 'string' && teamField.trim() !== '') {
    return true;
  }
  
  if (teamField.value && teamField.value.trim() !== '') {
    return true;
  }
  
  if (teamField.name && teamField.name.trim() !== '') {
    return true;
  }
  
  return false;
}

/**
 * Group issues by status
 */
function groupByStatus(issues, customFields) {
  const byStatus = {};
  let totalPoints = 0;
  let totalIssues = 0;

  for (const issue of issues) {
    const status = issue.fields.status?.name || 'Unknown';
    const issueType = issue.fields.issuetype?.name;
    let storyPoints = issue.fields[customFields.storyPointsFieldId] || 0;
    
    // Default 2 points for Stories/Bugs without points
    if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
      storyPoints = 2;
    }

    if (!byStatus[status]) {
      byStatus[status] = {
        issues: [],
        totalPoints: 0
      };
    }

    byStatus[status].issues.push({
      key: issue.key,
      summary: issue.fields.summary,
      status: status,
      issueType: issueType,
      priority: issue.fields.priority?.name || 'None',
      storyPoints: storyPoints,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      created: issue.fields.created?.split('T')[0]
    });

    byStatus[status].totalPoints += storyPoints;
    totalPoints += storyPoints;
    totalIssues++;
  }

  return { byStatus, totalPoints, totalIssues };
}

/**
 * Sort statuses by priority (Open -> In Dev -> In Review -> In QA -> Other)
 */
function sortStatuses(statuses) {
  const order = {
    'Open': 1,
    'In Dev': 2,
    'In Review': 3,
    'Ready for review': 4,
    'In QA': 5,
    'Ready for QA': 6,
    'Blocked': 7
  };

  return Object.keys(statuses).sort((a, b) => {
    const aOrder = order[a] || 99;
    const bOrder = order[b] || 99;
    if (aOrder === bOrder) {
      return statuses[b].totalPoints - statuses[a].totalPoints; // Sort by points if same priority
    }
    return aOrder - bOrder;
  });
}

/**
 * Generate the report
 */
async function generateReport() {
  console.log('\n📊 No Team Assignment Report');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);

  try {
    // Discover custom fields
    const customFields = await discoverCustomFields();

    // Fetch all sprint issues
    const allIssues = await getSprintIssues(customFields);

    if (allIssues.length === 0) {
      console.log('\n⚠️  No issues found in sprint');
      return;
    }

    // Filter for issues without team assignment
    const unassignedIssues = allIssues.filter(issue => 
      !hasTeamAssignment(issue, customFields.teamFieldId)
    );

    console.log(`   ✓ Found ${unassignedIssues.length} issues without team assignment`);

    if (unassignedIssues.length === 0) {
      console.log('\n✅ All issues have team assignments!');
      return;
    }

    // Group by status
    const { byStatus, totalPoints, totalIssues } = groupByStatus(unassignedIssues, customFields);

    // Display summary
    console.log('\n============================================================');
    console.log('📈 SUMMARY');
    console.log('============================================================\n');

    console.log(`   Total Issues Without Team: ${totalIssues}`);
    console.log(`   Total Story Points: ${totalPoints}`);
    console.log(`   Percentage of Sprint: ${((totalIssues / allIssues.length) * 100).toFixed(1)}% of issues`);

    // Display by status
    console.log('\n============================================================');
    console.log('📋 ISSUES BY STATUS');
    console.log('============================================================\n');

    const sortedStatuses = sortStatuses(byStatus);

    for (const status of sortedStatuses) {
      const statusData = byStatus[status];
      const statusIcon = status === 'Open' ? '📝' : 
                        status === 'In Dev' ? '💻' :
                        status === 'In Review' || status === 'Ready for review' ? '👀' :
                        status === 'In QA' || status === 'Ready for QA' ? '🧪' :
                        status === 'Blocked' ? '🚫' : '📌';

      console.log(`${statusIcon} ${status} (${statusData.issues.length} issues, ${statusData.totalPoints} points)`);
      console.log('   ' + '─'.repeat(70));

      // Sort issues by priority then points
      const sortedIssues = statusData.issues.sort((a, b) => {
        const priorityOrder = { 'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4 };
        const aPriority = priorityOrder[a.priority.split(' ')[0]] || 99;
        const bPriority = priorityOrder[b.priority.split(' ')[0]] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.storyPoints - a.storyPoints;
      });

      for (const issue of sortedIssues) {
        const points = `${issue.storyPoints} pts`.padEnd(6);
        const priority = issue.priority.split(' ')[0].padEnd(4);
        const type = issue.issueType.substring(0, 4).padEnd(5);
        console.log(`   ${issue.key}  ${points} ${priority} ${type} ${issue.summary.substring(0, 45)}`);
      }
      console.log('');
    }

    // Display top issues by story points
    console.log('============================================================');
    console.log('🎯 TOP UNASSIGNED ISSUES (by story points)');
    console.log('============================================================\n');

    const allUnassigned = [];
    for (const status of Object.keys(byStatus)) {
      allUnassigned.push(...byStatus[status].issues);
    }

    const topIssues = allUnassigned.sort((a, b) => b.storyPoints - a.storyPoints).slice(0, 10);

    for (const issue of topIssues) {
      console.log(`   ${issue.key.padEnd(13)} ${(issue.storyPoints + ' pts').padEnd(6)} ${issue.status.padEnd(20)} ${issue.summary.substring(0, 40)}`);
    }

    // Save report
    const reportData = {
      generatedAt: new Date().toISOString(),
      sprint: CURRENT_SPRINT,
      project: PROJECT_KEY,
      summary: {
        totalIssues: totalIssues,
        totalPoints: totalPoints,
        percentageOfSprint: parseFloat(((totalIssues / allIssues.length) * 100).toFixed(1))
      },
      byStatus: {}
    };

    for (const status of Object.keys(byStatus)) {
      reportData.byStatus[status] = {
        count: byStatus[status].issues.length,
        points: byStatus[status].totalPoints,
        issues: byStatus[status].issues
      };
    }

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const outputPath = path.join(reportsDir, 'no-team-assignment.json');
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

