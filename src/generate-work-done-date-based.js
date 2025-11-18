#!/usr/bin/env node

/**
 * Date-Based Work Done Report
 * 
 * This script captures ALL work completed during the current sprint window,
 * regardless of whether the issues are formally assigned to the sprint.
 * 
 * This helps identify "hidden work" - issues developers complete that aren't
 * tracked in the sprint's official scope.
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

// Status categories that indicate completion
const COMPLETED_STATUSES = [
  'Done',
  'READY FOR RELEASE',
  'CLOSED',
  'Completed',
  'Closed'
];

/**
 * Get sprint details including start and end dates
 */
async function getSprintDetails(sprintName) {
  try {
    // First, search for any issue in the sprint
    const searchResponse = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}"`,
      maxResults: 1,
      fields: ['key']
    });

    if (!searchResponse.data.issues || searchResponse.data.issues.length === 0) {
      throw new Error(`No issues found in sprint "${sprintName}"`);
    }

    const issueKey = searchResponse.data.issues[0].key;

    // Fetch the issue to get sprint details
    const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'customfield_11150'
      }
    });

    const sprintField = issueResponse.data.fields.customfield_11150;
    if (!sprintField || !Array.isArray(sprintField)) {
      throw new Error('Sprint field not found');
    }

    // Find the matching sprint
    const sprint = sprintField.find(s => s.name === sprintName);
    if (!sprint) {
      throw new Error(`Sprint "${sprintName}" not found in issue fields`);
    }

    return {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate?.split('T')[0],
      endDate: sprint.endDate?.split('T')[0]
    };
  } catch (error) {
    console.error('Error fetching sprint details:', error.message);
    throw error;
  }
}

/**
 * Get completion date from issue changelog
 */
function getCompletionDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  // Look through changelog in reverse (most recent first)
  for (let i = issue.changelog.histories.length - 1; i >= 0; i--) {
    const history = issue.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' && 
          COMPLETED_STATUSES.some(status => 
            status.toLowerCase() === item.toString?.toLowerCase())) {
        return history.created.split('T')[0];
      }
    }
  }

  return null;
}

/**
 * Check if issue is assigned to the sprint
 */
function isAssignedToSprint(issue, sprintName) {
  try {
    const sprintField = issue.sprint;
    if (!sprintField || !Array.isArray(sprintField)) {
      return false;
    }
    return sprintField.some(s => s && s.name === sprintName);
  } catch (error) {
    return false;
  }
}

/**
 * Fetch all issues completed during the sprint window
 */
async function getCompletedIssues(sprintStartDate, sprintEndDate) {
  try {
    console.log(`\n🔎 Fetching issues completed between ${sprintStartDate} and ${sprintEndDate}...`);
    
    // Fetch all issues updated during the sprint window
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND updated >= "${sprintStartDate}" AND status in ("${COMPLETED_STATUSES.join('", "')}")`,
      maxResults: 1000,
      fields: ['key']
    });

    console.log(`   Found ${response.data.issues?.length || 0} potentially completed issues`);
    console.log(`   Fetching detailed information...`);

    const issues = [];
    const issueTypeCounts = {};

    // Fetch detailed information for each issue
    for (const issueRef of response.data.issues || []) {
      const key = issueRef.key || issueRef.id;
      try {
        const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: 'key,summary,status,issuetype,assignee,parent,customfield_10003,customfield_11150,created',
            expand: 'changelog'
          }
        });

        const issue = detailResponse.data;
        const fields = issue.fields;
        const issueType = fields.issuetype?.name;
        
        issueTypeCounts[issueType] = (issueTypeCounts[issueType] || 0) + 1;

        // Get completion date from changelog
        const completionDate = getCompletionDate(issue);
        
        // Only include if completed within sprint window
        if (completionDate && completionDate >= sprintStartDate && completionDate <= sprintEndDate) {
          let parentType = null;
          let parentKey = null;
          if (fields.parent) {
            parentKey = fields.parent.key;
            parentType = fields.parent.fields?.issuetype?.name || 'Unknown';
          }

          issues.push({
            key: issue.key,
            summary: fields.summary,
            status: fields.status?.name,
            issueType: issueType,
            parentKey: parentKey,
            parentType: parentType,
            assignee: fields.assignee?.displayName || 'Unassigned',
            storyPoints: fields.customfield_10003 || 0,
            created: fields.created?.split('T')[0],
            completionDate: completionDate,
            sprint: fields.customfield_11150 || null,
            changelog: issue.changelog
          });
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch ${key}:`, err.message);
      }
    }

    console.log(`   ✓ Found ${issues.length} issues completed during sprint window`);
    if (Object.keys(issueTypeCounts).length > 0) {
      console.log(`   Issue types: ${Object.entries(issueTypeCounts).map(([type, count]) => `${count} ${type}`).join(', ')}`);
    }

    return issues;
  } catch (error) {
    console.error('Error fetching completed issues:', error.message);
    throw error;
  }
}

/**
 * Categorize issues by type
 */
function categorizeIssues(issues, sprintName) {
  const categories = {
    stories: [],
    bugs: [],
    tasks: [],
    subTasks: [],
    subBugs: [],
    other: []
  };

  for (const issue of issues) {
    const isInSprint = isAssignedToSprint(issue, sprintName);
    const issueWithSprintFlag = { ...issue, isInSprint };

    if (issue.issueType === 'Story') {
      categories.stories.push(issueWithSprintFlag);
    } else if (issue.issueType === 'Bug' && !issue.parentKey) {
      categories.bugs.push(issueWithSprintFlag);
    } else if (issue.issueType === 'Task') {
      categories.tasks.push(issueWithSprintFlag);
    } else if (issue.issueType === 'Sub-task') {
      if (issue.parentType === 'Bug') {
        categories.subBugs.push(issueWithSprintFlag);
      } else {
        categories.subTasks.push(issueWithSprintFlag);
      }
    } else {
      categories.other.push(issueWithSprintFlag);
    }
  }

  return categories;
}

/**
 * Calculate statistics for a category
 */
function calculateStats(category) {
  const total = category.length;
  const inSprint = category.filter(i => i.isInSprint).length;
  const hidden = total - inSprint;
  const totalPoints = category.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const hiddenPoints = category.filter(i => !i.isInSprint).reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  return {
    total,
    inSprint,
    hidden,
    totalPoints,
    hiddenPoints
  };
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const [year, month, day] = dateString.split('-');
  return `${month}/${day}`;
}

/**
 * Generate the report
 */
async function generateReport() {
  console.log('\n📊 Date-Based Work Done Report');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);

  try {
    // Get sprint details
    console.log('\n🔍 Fetching sprint details...');
    const sprint = await getSprintDetails(CURRENT_SPRINT);
    console.log(`   ✓ Sprint: ${sprint.name}`);
    console.log(`   ✓ State: ${sprint.state}`);
    console.log(`   ✓ Start: ${sprint.startDate}`);
    console.log(`   ✓ End: ${sprint.endDate}`);

    // Get all completed issues during the sprint window
    const today = new Date().toISOString().split('T')[0];
    const endDate = today < sprint.endDate ? today : sprint.endDate;
    const completedIssues = await getCompletedIssues(sprint.startDate, endDate);

    // Categorize issues
    const categories = categorizeIssues(completedIssues, CURRENT_SPRINT);

    // Calculate statistics
    const stats = {
      stories: calculateStats(categories.stories),
      bugs: calculateStats(categories.bugs),
      tasks: calculateStats(categories.tasks),
      subTasks: calculateStats(categories.subTasks),
      subBugs: calculateStats(categories.subBugs),
      other: calculateStats(categories.other)
    };

    // Calculate totals
    const totalIssues = completedIssues.length;
    const totalInSprint = Object.values(stats).reduce((sum, s) => sum + s.inSprint, 0);
    const totalHidden = totalIssues - totalInSprint;
    const totalPoints = Object.values(stats).reduce((sum, s) => sum + s.totalPoints, 0);
    const totalHiddenPoints = Object.values(stats).reduce((sum, s) => sum + s.hiddenPoints, 0);

    // Display summary
    console.log('\n============================================================');
    console.log('📈 SUMMARY - Work Completed During Sprint Window');
    console.log('============================================================\n');

    console.log(`   Sprint Period: ${sprint.startDate} to ${endDate}`);
    console.log(`   Total Issues Completed: ${totalIssues}`);
    console.log(`   - Assigned to Sprint: ${totalInSprint} (${((totalInSprint/totalIssues)*100).toFixed(1)}%)`);
    console.log(`   - Hidden Work: ${totalHidden} (${((totalHidden/totalIssues)*100).toFixed(1)}%)`);
    console.log('');
    console.log(`   Total Story Points: ${totalPoints}`);
    console.log(`   - Assigned to Sprint: ${totalPoints - totalHiddenPoints}`);
    console.log(`   - Hidden Work: ${totalHiddenPoints}`);

    console.log('\n------------------------------------------------------------');
    console.log('📊 BREAKDOWN BY ISSUE TYPE:');
    console.log('------------------------------------------------------------\n');

    // Display breakdown for each category
    const displayCategory = (name, category, stats) => {
      if (stats.total === 0) {
        console.log(`   ${name}: 0 issues`);
        return;
      }

      console.log(`   ${name}:`);
      console.log(`      Total: ${stats.total} issues, ${stats.totalPoints} points`);
      console.log(`      - In Sprint: ${stats.inSprint} issues, ${stats.totalPoints - stats.hiddenPoints} points`);
      console.log(`      - Hidden: ${stats.hidden} issues, ${stats.hiddenPoints} points ${stats.hidden > 0 ? '⚠️' : ''}`);
      console.log('');
    };

    displayCategory('Stories', categories.stories, stats.stories);
    displayCategory('Bugs', categories.bugs, stats.bugs);
    displayCategory('Tasks', categories.tasks, stats.tasks);
    displayCategory('Sub-tasks', categories.subTasks, stats.subTasks);
    displayCategory('Sub-bugs', categories.subBugs, stats.subBugs);
    if (stats.other.total > 0) {
      displayCategory('Other', categories.other, stats.other);
    }

    // Display hidden work details
    if (totalHidden > 0) {
      console.log('============================================================');
      console.log('⚠️  HIDDEN WORK DETAILS (Not Assigned to Sprint)');
      console.log('============================================================\n');

      const displayHiddenIssues = (name, category) => {
        const hidden = category.filter(i => !i.isInSprint);
        if (hidden.length === 0) return;

        console.log(`   ${name} (${hidden.length} issues, ${hidden.reduce((sum, i) => sum + (i.storyPoints || 0), 0)} points):`);
        console.log('   ' + '─'.repeat(60));

        for (const issue of hidden) {
          const points = issue.storyPoints ? `${issue.storyPoints} pts` : '0 pts';
          const completed = formatDate(issue.completionDate);
          console.log(`   ${issue.key.padEnd(12)} | ${points.padEnd(6)} | ${completed.padEnd(6)} | ${issue.summary.substring(0, 40)}`);
        }
        console.log('');
      };

      displayHiddenIssues('Stories', categories.stories);
      displayHiddenIssues('Bugs', categories.bugs);
      displayHiddenIssues('Tasks', categories.tasks);
      displayHiddenIssues('Sub-tasks', categories.subTasks);
      displayHiddenIssues('Sub-bugs', categories.subBugs);
      if (stats.other.total > 0) {
        displayHiddenIssues('Other', categories.other);
      }
    }

    // Save report
    const reportData = {
      generatedAt: new Date().toISOString(),
      sprint: sprint,
      period: {
        start: sprint.startDate,
        end: endDate
      },
      summary: {
        totalIssues,
        totalInSprint,
        totalHidden,
        totalPoints,
        totalHiddenPoints,
        hiddenPercentage: ((totalHidden/totalIssues)*100).toFixed(1)
      },
      breakdown: {
        stories: { issues: categories.stories, stats: stats.stories },
        bugs: { issues: categories.bugs, stats: stats.bugs },
        tasks: { issues: categories.tasks, stats: stats.tasks },
        subTasks: { issues: categories.subTasks, stats: stats.subTasks },
        subBugs: { issues: categories.subBugs, stats: stats.subBugs },
        other: { issues: categories.other, stats: stats.other }
      }
    };

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const outputPath = path.join(reportsDir, 'work-done-date-based.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));

    console.log('============================================================');
    console.log(`✅ Report saved to: ${outputPath}`);
    console.log('\n🎉 Done!\n');

  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    process.exit(1);
  }
}

// Run the report
generateReport();

