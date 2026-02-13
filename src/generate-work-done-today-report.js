require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const DEFAULT_SPRINT = 'NH Sprint 35';

// Statuses to track
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED'];
const QA_STATUS = 'In QA';
const DEV_STATUS = 'In Dev';

// Validate environment variables
function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  
  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
    process.exit(1);
  }
}

// Create axios instance with authentication
function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

// Get the Story Points field ID
async function getStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    
    const storyPointsField = fields.find(field => 
      field.name && field.name.toLowerCase().includes('story point')
    );
    
    if (storyPointsField) {
      return storyPointsField.id;
    }
    
    return 'customfield_10003';
  } catch (error) {
    return 'customfield_10003';
  }
}

// Check if status change happened today
function changedToStatusToday(issue, targetStatuses, today) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }
  
  const todayStr = today.toISOString().split('T')[0];
  
  // Look through changelog histories
  for (const history of issue.changelog.histories) {
    const changeDate = history.created.split('T')[0];
    
    // Check if change happened today
    if (changeDate === todayStr) {
      // Check if this history contains a status change to one of our target statuses
      for (const item of history.items) {
        if (item.field === 'status' && item.toString) {
          const toStatusUpper = item.toString.toUpperCase();
          for (const targetStatus of targetStatuses) {
            if (toStatusUpper === targetStatus.toUpperCase()) {
              return item.toString; // Return actual status name
            }
          }
        }
      }
    }
  }
  
  return null;
}

// Fetch issues that changed to specified statuses today
async function fetchIssuesByStatus(client, storyPointsFieldId, statusList, label, today) {
  // Only fetch issues updated today to reduce API calls
  const todayStr = today.toISOString().split('T')[0];
  const jql = `project = ${PROJECT_KEY} AND status in (${statusList.map(s => `"${s}"`).join(', ')}) AND updated >= "${todayStr}"`;
  
  console.log(`\n🔎 Querying ${label}...`);
  console.log(`   JQL: ${jql}`);
  
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueData = response.data.issues || [];
    console.log(`   ✓ Found ${issueData.length} issues in these statuses`);
    
    const movedTodayIssues = [];
    const typeBreakdown = {};
    let totalStoryPoints = 0;
    
    for (const issueRef of issueData) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,priority,${storyPointsFieldId}`,
            expand: 'changelog'
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields || {};
        const issueType = fields.issuetype?.name || 'Unknown';
        const priority = fields.priority?.name || 'Unknown';
        const summary = fields.summary || '';
        const currentStatus = fields.status?.name || 'Unknown';
        let storyPoints = fields[storyPointsFieldId] || 0;
        
        // Only count Epic, Story, and Bug
        if (issueType === 'Epic' || issueType === 'Story' || issueType === 'Bug') {
          // Check if this issue moved to one of our target statuses today
          const movedToStatus = changedToStatusToday(issue, statusList, today);
          
          if (movedToStatus) {
            // Default to 2 points for Stories or Bugs without points
            const defaulted = (issueType === 'Story' || issueType === 'Bug') && storyPoints === 0;
            if (defaulted) {
              storyPoints = 2;
            }
            
            movedTodayIssues.push({
              key: issue.key,
              summary: summary,
              issueType: issueType,
              priority: priority,
              status: currentStatus,
              storyPoints: storyPoints,
              defaulted: defaulted
            });
            
            // Track by issue type
            if (!typeBreakdown[issueType]) {
              typeBreakdown[issueType] = { count: 0, points: 0 };
            }
            typeBreakdown[issueType].count++;
            typeBreakdown[issueType].points += storyPoints;
            
            totalStoryPoints += storyPoints;
            
            console.log(`   ✓ ${issue.key}: ${issueType} - ${storyPoints} pts - ${movedToStatus}`);
          }
        }
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    console.log(`   → ${movedTodayIssues.length} issues moved today (${totalStoryPoints} points)`);
    
    return {
      issues: movedTodayIssues,
      totalStoryPoints: totalStoryPoints,
      typeBreakdown: typeBreakdown
    };
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${label}: ${error.message}`);
    return {
      issues: [],
      totalStoryPoints: 0,
      typeBreakdown: {}
    };
  }
}

// Fetch sprint total completed issues (all time for the sprint)
async function fetchSprintCompletedTotals(client, storyPointsFieldId, sprintName) {
  try {
    console.log('\n🔎 Fetching Sprint Total (Completed)...');
    
    const statusList = COMPLETED_STATUSES.map(s => `"${s}"`).join(', ');
    const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND issuetype in (Story, Bug) AND status in (${statusList})`;
    
    console.log(`   JQL: ${jql}`);
    
    // Fetch all completed issues in the sprint
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} completed issues in sprint`);
    
    let totalStoryPoints = 0;
    const typeBreakdown = {};
    
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `issuetype,${storyPointsFieldId}`
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields;
        
        const issueType = fields.issuetype?.name || 'Unknown';
        let storyPoints = fields[storyPointsFieldId] || 0;
        
        // Default to 2 points for Stories/Bugs without points
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
        }
        
        totalStoryPoints += storyPoints;
        
        if (!typeBreakdown[issueType]) {
          typeBreakdown[issueType] = { count: 0, points: 0 };
        }
        typeBreakdown[issueType].count++;
        typeBreakdown[issueType].points += storyPoints;
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    console.log(`   → Total: ${issueRefs.length} issues (${totalStoryPoints} points)`);
    
    return {
      totalIssues: issueRefs.length,
      totalStoryPoints: totalStoryPoints,
      typeBreakdown: typeBreakdown
    };
    
  } catch (error) {
    console.error(`   ❌ Error fetching sprint totals: ${error.message}`);
    return {
      totalIssues: 0,
      totalStoryPoints: 0,
      typeBreakdown: {}
    };
  }
}

// Generate work done today report
async function generateWorkDoneReport(sprintName) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`\n📊 Generating Work Done Today Report`);
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Date: ${todayStr}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
  console.log(`   Sprint: ${sprintName}`);
  
  const client = createJiraClient();
  
  // Get Story Points field ID
  console.log('\n🔍 Discovering Story Points field...');
  const storyPointsFieldId = await getStoryPointsFieldId(client);
  console.log(`   ✓ Using field: ${storyPointsFieldId}`);
  
  // Fetch completed issues
  const completed = await fetchIssuesByStatus(
    client, 
    storyPointsFieldId, 
    COMPLETED_STATUSES, 
    'Completed Issues (Ready for Release / Closed)',
    today
  );
  
  // Fetch issues moved to QA
  const movedToQA = await fetchIssuesByStatus(
    client,
    storyPointsFieldId,
    [QA_STATUS],
    'Issues Moved to QA',
    today
  );
  
  // Fetch issues moved to Dev
  const movedToDev = await fetchIssuesByStatus(
    client,
    storyPointsFieldId,
    [DEV_STATUS],
    'Issues Moved to Dev',
    today
  );
  
  // Fetch sprint totals for context
  const sprintTotals = await fetchSprintCompletedTotals(client, storyPointsFieldId, sprintName);
  
  // Calculate totals for today
  const totalIssues = completed.issues.length + movedToQA.issues.length + movedToDev.issues.length;
  const totalStoryPoints = completed.totalStoryPoints + movedToQA.totalStoryPoints + movedToDev.totalStoryPoints;
  
  // Merge type breakdowns
  const allTypeBreakdown = {};
  
  Object.entries(completed.typeBreakdown).forEach(([type, data]) => {
    if (!allTypeBreakdown[type]) {
      allTypeBreakdown[type] = { count: 0, points: 0 };
    }
    allTypeBreakdown[type].count += data.count;
    allTypeBreakdown[type].points += data.points;
  });
  
  Object.entries(movedToQA.typeBreakdown).forEach(([type, data]) => {
    if (!allTypeBreakdown[type]) {
      allTypeBreakdown[type] = { count: 0, points: 0 };
    }
    allTypeBreakdown[type].count += data.count;
    allTypeBreakdown[type].points += data.points;
  });
  
  Object.entries(movedToDev.typeBreakdown).forEach(([type, data]) => {
    if (!allTypeBreakdown[type]) {
      allTypeBreakdown[type] = { count: 0, points: 0 };
    }
    allTypeBreakdown[type].count += data.count;
    allTypeBreakdown[type].points += data.points;
  });
  
  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY - Work Done Today:');
  console.log(`   Total Issues Today: ${totalIssues}`);
  console.log(`   Total Story Points Today: ${totalStoryPoints}`);
  console.log('');
  console.log(`   Completed Issues: ${completed.issues.length} (${completed.totalStoryPoints} points)`);
  console.log(`   Moved to QA: ${movedToQA.issues.length} (${movedToQA.totalStoryPoints} points)`);
  console.log(`   Moved to Dev: ${movedToDev.issues.length} (${movedToDev.totalStoryPoints} points)`);
  
  if (Object.keys(allTypeBreakdown).length > 0) {
    console.log('\n   Today\'s Breakdown by Type:');
    Object.entries(allTypeBreakdown)
      .sort((a, b) => b[1].points - a[1].points)
      .forEach(([type, data]) => {
        console.log(`   - ${type}: ${data.count} issues, ${data.points} points`);
      });
  }
  
  // Display sprint totals
  console.log('\n' + '-'.repeat(60));
  console.log(`📊 SPRINT TOTALS (${sprintName}):`);
  console.log(`   Total Completed Issues: ${sprintTotals.totalIssues}`);
  console.log(`   Total Completed Story Points: ${sprintTotals.totalStoryPoints}`);
  
  if (Object.keys(sprintTotals.typeBreakdown).length > 0) {
    console.log('\n   Sprint Breakdown by Type:');
    Object.entries(sprintTotals.typeBreakdown)
      .sort((a, b) => b[1].points - a[1].points)
      .forEach(([type, data]) => {
        console.log(`   - ${type}: ${data.count} issues, ${data.points} points`);
      });
  }
  
  return {
    date: todayStr,
    project: PROJECT_KEY,
    sprint: sprintName,
    summary: {
      today: {
        totalIssues: totalIssues,
        totalStoryPoints: totalStoryPoints,
        completedIssues: completed.issues.length,
        completedStoryPoints: completed.totalStoryPoints,
        movedToQAIssues: movedToQA.issues.length,
        movedToQAStoryPoints: movedToQA.totalStoryPoints,
        movedToDevIssues: movedToDev.issues.length,
        movedToDevStoryPoints: movedToDev.totalStoryPoints,
        breakdown: allTypeBreakdown
      },
      sprintTotal: {
        completedIssues: sprintTotals.totalIssues,
        completedStoryPoints: sprintTotals.totalStoryPoints,
        breakdown: sprintTotals.typeBreakdown
      }
    },
    completed: {
      issues: completed.issues.sort((a, b) => a.key.localeCompare(b.key)),
      typeBreakdown: completed.typeBreakdown
    },
    movedToQA: {
      issues: movedToQA.issues.sort((a, b) => a.key.localeCompare(b.key)),
      typeBreakdown: movedToQA.typeBreakdown
    },
    movedToDev: {
      issues: movedToDev.issues.sort((a, b) => a.key.localeCompare(b.key)),
      typeBreakdown: movedToDev.typeBreakdown
    }
  };
}

// Save results to JSON file
function saveResults(data) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filename = `work-done-today-${data.date}.json`;
  const filepath = path.join(reportsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Results saved to: ${filepath}`);
  return filepath;
}

// Save a markdown summary with ticket details
function saveMarkdownReport(data) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `work-done-today-${data.date}.md`;
  const filepath = path.join(reportsDir, filename);

  const lines = [];
  lines.push(`# Work Done Today - ${data.date}`);
  lines.push('');
  lines.push(`Sprint: ${data.sprint}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Issues Today: ${data.summary.today.totalIssues}`);
  lines.push(`- Total Story Points Today: ${data.summary.today.totalStoryPoints}`);
  lines.push(`- Completed Issues: ${data.summary.today.completedIssues} (${data.summary.today.completedStoryPoints} points)`);
  lines.push(`- Moved to QA: ${data.summary.today.movedToQAIssues} (${data.summary.today.movedToQAStoryPoints} points)`);
  lines.push(`- Moved to Dev: ${data.summary.today.movedToDevIssues} (${data.summary.today.movedToDevStoryPoints} points)`);
  lines.push('');

  function addSection(title, issues) {
    lines.push(`## ${title}`);
    lines.push('');
    if (!issues.length) {
      lines.push('_None_');
      lines.push('');
      return;
    }
    lines.push('| Key | Type | Status | Points | Priority | Defaulted SP | Summary |');
    lines.push('|-----|------|--------|--------|----------|--------------|---------|');
    for (const issue of issues) {
      const defaulted = issue.defaulted ? 'Yes' : 'No';
      lines.push(`| ${issue.key} | ${issue.issueType} | ${issue.status} | ${issue.storyPoints} | ${issue.priority} | ${defaulted} | ${issue.summary} |`);
    }
    lines.push('');
  }

  addSection('Completed / Ready for Release', data.completed.issues);
  addSection('Moved to In QA', data.movedToQA.issues);
  addSection('Moved to In Dev', data.movedToDev.issues);

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`✅ Markdown report saved to: ${filepath}`);
}

// Main function
async function main() {
  try {
    validateConfig();
    const sprintName = process.argv[2] || DEFAULT_SPRINT;
    const data = await generateWorkDoneReport(sprintName);
    saveResults(data);
    saveMarkdownReport(data);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Failed to generate report');
    console.error(error.message);
    process.exit(1);
  }
}

main();

