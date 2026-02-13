#!/usr/bin/env node

/**
 * Sub-Bug Summary Report
 * 
 * Generates a daily breakdown of sub-bug completions throughout the sprint.
 * Sub-bugs are identified as:
 * - Issues with type "Sub-task" that are children of Bug issues
 * - Or issues with "Bug" in the hierarchy that have a parent
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 32';

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
 * Get sprint details
 */
async function getSprintDetails(sprintName) {
  try {
    const searchResponse = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}"`,
      maxResults: 1
    });

    if (searchResponse.data.issues.length === 0) {
      throw new Error(`No issues found in sprint: ${sprintName}`);
    }

    const issueKey = searchResponse.data.issues[0].key || searchResponse.data.issues[0].id;
    
    const issueDetail = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'customfield_11150'
      }
    });

    const sprintField = issueDetail.data.fields.customfield_11150;
    if (!sprintField || sprintField.length === 0) {
      throw new Error('Sprint field not found on issue');
    }

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
 * Get all sub-tasks (using date range instead of sprint assignment to catch hidden work)
 */
async function getSubBugs(sprintStartDate, sprintEndDate) {
  try {
    // Get all subtasks updated during or after sprint start
    // This catches sub-bugs that were worked on but not assigned to the sprint
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND issuetype = Sub-task AND updated >= "${sprintStartDate}"`,
      maxResults: 1000
    });

    const subTasks = [];
    const parentTypeCounts = {};
    
    // Fetch each subtask with parent info and changelog
    for (const issueRef of response.data.issues || []) {
      const key = issueRef.key || issueRef.id;
      
      try {
        const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: 'key,summary,status,parent,issuetype,assignee,created',
            expand: 'changelog'
          }
        });
        
        const issue = detailResponse.data;
        const fields = issue.fields;
        
        // Check if parent is a Bug
        let parentType = null;
        let parentKey = null;
        if (fields.parent) {
          parentKey = fields.parent.key;
          parentType = fields.parent.fields?.issuetype?.name || 'Unknown';
          
          // Track parent types for debugging
          parentTypeCounts[parentType] = (parentTypeCounts[parentType] || 0) + 1;
        }
        
        // Only include subtasks where parent is a Bug
        if (parentType === 'Bug') {
          subTasks.push({
            key: issue.key,
            summary: fields.summary,
            status: fields.status?.name,
            parentKey: parentKey,
            parentType: parentType,
            assignee: fields.assignee?.displayName || 'Unassigned',
            created: fields.created?.split('T')[0],
            changelog: issue.changelog
          });
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch ${key}:`, err.message);
      }
    }
    
    // Log what we found for debugging
    const totalSubtasks = response.data.issues?.length || 0;
    if (totalSubtasks > 0) {
      console.log(`   Found ${totalSubtasks} total subtasks updated since sprint start`);
      console.log(`   Parent types: ${Object.entries(parentTypeCounts).map(([type, count]) => `${count} ${type}`).join(', ')}`);
      console.log(`   Filtering to only subtasks with Bug parents...`);
    }

    return subTasks;
  } catch (error) {
    console.error('Error fetching sub-bugs:', error.message);
    throw error;
  }
}

/**
 * Get the date when a sub-bug was completed
 */
function getCompletionDate(subBug) {
  if (!subBug.changelog || !subBug.changelog.histories) {
    return null;
  }

  const completedStatuses = ['READY FOR RELEASE', 'CLOSED', 'DONE', 'COMPLETED'];
  
  // Find the last transition to a completed status
  for (let i = subBug.changelog.histories.length - 1; i >= 0; i--) {
    const history = subBug.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' && 
          completedStatuses.some(s => s === item.toString?.toUpperCase())) {
        return history.created.split('T')[0];
      }
    }
  }

  // If currently in a completed status but no transition found
  const currentStatus = subBug.status?.toUpperCase();
  if (completedStatuses.includes(currentStatus)) {
    return subBug.created;
  }

  return null;
}

/**
 * Generate all dates between start and end
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
 * Format date for display
 */
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Calculate daily sub-bug completions (only counting completions within sprint dates)
 */
function calculateDailyCompletions(subBugs, sprintStartDate, sprintEndDate, today) {
  const dailyData = [];
  const endDate = today < sprintEndDate ? today : sprintEndDate;
  const dates = getDateRange(sprintStartDate, endDate);
  
  let cumulativeCount = 0;
  
  // Filter to only sub-bugs completed during the sprint period
  const sprintSubBugs = subBugs.filter(subBug => {
    const completionDate = getCompletionDate(subBug);
    return completionDate && completionDate >= sprintStartDate && completionDate <= endDate;
  });

  for (const date of dates) {
    const completedToday = [];

    for (const subBug of sprintSubBugs) {
      const completionDate = getCompletionDate(subBug);
      if (completionDate === date) {
        completedToday.push({
          key: subBug.key,
          summary: subBug.summary,
          parentKey: subBug.parentKey,
          assignee: subBug.assignee,
          status: subBug.status
        });
      }
    }

    cumulativeCount += completedToday.length;

    dailyData.push({
      date,
      completedToday: completedToday.length,
      cumulativeCompleted: cumulativeCount,
      subBugs: completedToday
    });
  }

  return dailyData;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n📊 Starting Sub-Bug Summary Report...\n');
    console.log('============================================================');
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprint: ${CURRENT_SPRINT}`);
    console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
    console.log('============================================================\n');

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
    
    // Fetch all sub-bugs (using date range to catch work not assigned to sprint)
    console.log('🔎 Fetching sub-bugs (subtasks of Bug issues)...');
    console.log(`   Using date range: ${sprint.startDate} onwards`);
    console.log('   (This catches sub-bugs completed during sprint even if not assigned to it)\n');
    const subBugs = await getSubBugs(sprint.startDate, sprint.endDate);
    console.log(`   ✓ Found ${subBugs.length} sub-bugs (including unassigned work)\n`);

    if (subBugs.length === 0) {
      console.log('⚠️  No sub-bugs found in this sprint');
      return;
    }

    // Calculate daily completions (filtering by date, not sprint assignment)
    console.log('📊 Calculating daily sub-bug completions...');
    console.log(`   Counting sub-bugs completed between ${sprint.startDate} and ${today}\n`);
    const dailyData = calculateDailyCompletions(subBugs, sprint.startDate, sprint.endDate, today);

    // Count completed vs remaining (only those completed in sprint period)
    const totalCompleted = dailyData[dailyData.length - 1].cumulativeCompleted;
    
    // Count how many sub-bugs are still in progress or not yet started
    const sprintSubBugs = subBugs.filter(subBug => {
      const completionDate = getCompletionDate(subBug);
      const endDate = today < sprint.endDate ? today : sprint.endDate;
      return !completionDate || completionDate < sprint.startDate || completionDate > endDate;
    });
    const totalInProgress = sprintSubBugs.length;

    // Display results
    console.log('============================================================');
    console.log('📈 DAILY SUB-BUG COMPLETIONS');
    console.log('============================================================\n');

    console.log('DATE           | COMPLETED | CUMULATIVE');
    console.log('               |   TODAY   |   TOTAL   ');
    console.log('------------------------------------------------');

    for (const day of dailyData) {
      const dateStr = formatDate(day.date).padEnd(14);
      const completed = String(day.completedToday).padStart(9);
      const cumulative = String(day.cumulativeCompleted).padStart(9);
      
      console.log(`${dateStr} | ${completed} | ${cumulative}`);
    }

    console.log('------------------------------------------------');
    console.log(`\nTotal Sub-Bugs Found: ${subBugs.length}`);
    console.log(`Completed in Sprint: ${totalCompleted}`);
    console.log(`In Progress or Not Started: ${totalInProgress}`);
    console.log(`\n(Note: Counts sub-bugs completed during sprint period,`);
    console.log(` regardless of sprint assignment)`);

    // Show most recent completions
    console.log('\n============================================================');
    console.log('📋 RECENTLY COMPLETED SUB-BUGS (Last 5)');
    console.log('============================================================\n');

    const recentCompletions = dailyData
      .filter(d => d.completedToday > 0)
      .slice(-5);

    if (recentCompletions.length > 0) {
      for (const dayData of recentCompletions) {
        console.log(`\n${formatDate(dayData.date)}: ${dayData.completedToday} sub-bug(s)`);
        for (const subBug of dayData.subBugs) {
          console.log(`   ✓ ${subBug.key} (parent: ${subBug.parentKey}) - ${subBug.assignee}`);
          console.log(`     ${subBug.summary.substring(0, 70)}...`);
        }
      }
    } else {
      console.log('   No sub-bugs completed yet.');
    }

    // Save to JSON
    const outputData = {
      date: today,
      project: PROJECT_KEY,
      sprint: sprint.name,
      sprintStartDate: sprint.startDate,
      sprintEndDate: sprint.endDate,
      note: 'Counts sub-bugs completed during sprint period, regardless of sprint assignment',
      totalSubBugsFound: subBugs.length,
      totalCompletedInSprint: totalCompleted,
      totalInProgressOrNotStarted: totalInProgress,
      dailyCompletions: dailyData,
      allSubBugs: subBugs.map(sb => ({
        key: sb.key,
        summary: sb.summary,
        status: sb.status,
        parentKey: sb.parentKey,
        assignee: sb.assignee,
        completionDate: getCompletionDate(sb),
        completedInSprintPeriod: (() => {
          const cd = getCompletionDate(sb);
          return cd && cd >= sprint.startDate && cd <= (today < sprint.endDate ? today : sprint.endDate);
        })()
      }))
    };

    const outputPath = path.join(__dirname, '../reports/sub-bug-summary.json');
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

