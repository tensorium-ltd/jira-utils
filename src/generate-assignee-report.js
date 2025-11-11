const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31'; // Update this for each sprint

// Statuses to track (case-sensitive!)
const COMPLETED_STATUSES = ['Ready for release', 'CLOSED', 'Closed', 'Done'];
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

// Get custom field IDs
async function getCustomFieldIds(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    
    const storyPointsField = fields.find(field => 
      field.name && field.name.toLowerCase().includes('story point')
    );
    
    // Try to find the Team field - prioritize customfield_12700 which has the team names
    let teamFieldId = 'customfield_12700'; // Default to the one with Team 1, Team 2, etc.
    const teamField = fields.find(field =>
      field.name && field.name.toLowerCase() === 'team' && field.id === 'customfield_12700'
    );
    
    if (!teamField) {
      // Fallback to any field named "Team"
      const anyTeamField = fields.find(field =>
        field.name && field.name.toLowerCase() === 'team'
      );
      teamFieldId = anyTeamField ? anyTeamField.id : null;
    }
    
    return {
      storyPoints: storyPointsField ? storyPointsField.id : 'customfield_10003',
      team: teamFieldId
    };
  } catch (error) {
    return {
      storyPoints: 'customfield_10003',
      team: null
    };
  }
}

// Check if status change happened today
function changedToStatusToday(issue, targetStatuses, today) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }
  
  const todayStr = today.toISOString().split('T')[0];
  
  for (const history of issue.changelog.histories) {
    const changeDate = history.created.split('T')[0];
    
    if (changeDate === todayStr) {
      for (const item of history.items) {
        if (item.field === 'status' && item.toString) {
          const toStatusUpper = item.toString.toUpperCase();
          for (const targetStatus of targetStatuses) {
            if (toStatusUpper === targetStatus.toUpperCase()) {
              return item.toString;
            }
          }
        }
      }
    }
  }
  
  return null;
}

// Fetch total sprint allocation by team (all issues, including completed)
async function fetchTotalSprintByTeam(client, fieldIds) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Epic, Story, Bug)`;
  
  try {
    // Step 1: Fetch all issue keys (no fields to get max results)
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} total issues in sprint, fetching details...`);
    
    const teamMap = {};
    
    // Step 2: Fetch each issue individually with specific fields
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,${fieldIds.storyPoints},${fieldIds.team}`
          }
        });
        
        const fields = issueResponse.data.fields || {};
        let storyPoints = fields[fieldIds.storyPoints] || 0;
        const issueType = fields.issuetype?.name || 'Unknown';
        const status = fields.status?.name || 'Unknown';
        
        // Only count Epic, Story, and Bug
        if (issueType !== 'Epic' && issueType !== 'Story' && issueType !== 'Bug') {
          continue;
        }
        
        // Default to 2 points for Stories or Bugs without points
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
        }
        
        // Determine if issue is completed
        const isCompleted = COMPLETED_STATUSES.includes(status);
        
        // Extract team
        let team = 'Unassigned';
        if (fieldIds.team && fields[fieldIds.team]) {
          const teamField = fields[fieldIds.team];
          if (typeof teamField === 'string') {
            team = teamField;
          } else if (teamField.value) {
            team = teamField.value;
          } else if (teamField.name) {
            team = teamField.name;
          } else if (Array.isArray(teamField) && teamField.length > 0) {
            team = teamField[0].value || teamField[0].name || teamField[0];
          }
        }
        
        if (!teamMap[team]) {
          teamMap[team] = {
            name: team,
            totalIssues: 0,
            totalPoints: 0,
            completedIssues: 0,
            completedPoints: 0,
            assigneeCount: 0
          };
        }
        
        teamMap[team].totalIssues++;
        teamMap[team].totalPoints += storyPoints;
        
        if (isCompleted) {
          teamMap[team].completedIssues++;
          teamMap[team].completedPoints += storyPoints;
        }
        
      } catch (err) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${err.message}`);
      }
    }
    
    console.log(`   ✓ Processed ${issueRefs.length} issues`);
    
    return Object.values(teamMap);
    
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch total sprint data: ${error.message}`);
    return [];
  }
}

// Fetch current sprint workload for an assignee
async function fetchAssigneeSprintWorkload(client, fieldIds, assigneeAccountId) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND assignee = ${assigneeAccountId} AND issuetype in (Epic, Story, Bug) AND status NOT IN ("${COMPLETED_STATUSES.join('", "')}")`;
  
  // Build fields list to request
  const fieldsToRequest = ['summary', 'status', 'issuetype', fieldIds.storyPoints];
  if (fieldIds.team) {
    fieldsToRequest.push(fieldIds.team);
  }
  
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000,
      fields: fieldsToRequest
    });
    
    const issues = response.data.issues || [];
    const workloadIssues = [];
    let totalPoints = 0;
    
    for (const issue of issues) {
      const fields = issue.fields || {};
      const issueType = fields.issuetype?.name || 'Unknown';
      const summary = fields.summary || '';
      const status = fields.status?.name || 'Unknown';
      let storyPoints = fields[fieldIds.storyPoints] || 0;
      
      // Only count Epic, Story, and Bug
      if (issueType !== 'Epic' && issueType !== 'Story' && issueType !== 'Bug') {
        continue;
      }
      
      // Extract team - handle different field structures
      let team = 'Unassigned';
      if (fieldIds.team && fields[fieldIds.team]) {
        const teamField = fields[fieldIds.team];
        
        if (typeof teamField === 'string') {
          team = teamField;
        } else if (teamField.value) {
          team = teamField.value;
        } else if (teamField.name) {
          team = teamField.name;
        } else if (Array.isArray(teamField) && teamField.length > 0) {
          team = teamField[0].value || teamField[0].name || teamField[0];
        }
      }
      
      // Default to 2 points for Stories or Bugs without points
      const defaulted = storyPoints === 0;
      if (defaulted) {
        storyPoints = 2;
      }
      
      workloadIssues.push({
        key: issue.key,
        summary: summary,
        issueType: issueType,
        status: status,
        storyPoints: storyPoints,
        defaulted: defaulted,
        team: team
      });
      
      totalPoints += storyPoints;
    }
    
    return {
      count: workloadIssues.length,
      points: totalPoints,
      issues: workloadIssues
    };
    
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch workload for assignee: ${error.message}`);
    return {
      count: 0,
      points: 0,
      issues: []
    };
  }
}

// Fetch issues with assignee information
async function fetchIssuesByStatus(client, storyPointsFieldId, statusList, label, today) {
  const todayStr = today.toISOString().split('T')[0];
  const jql = `project = ${PROJECT_KEY} AND status in (${statusList.map(s => `"${s}"`).join(', ')}) AND updated >= "${todayStr}"`;
  
  console.log(`\n🔎 Querying ${label}...`);
  
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueData = response.data.issues || [];
    console.log(`   ✓ Found ${issueData.length} issues`);
    
    const movedTodayIssues = [];
    
    for (const issueRef of issueData) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,assignee,${storyPointsFieldId}`,
            expand: 'changelog'
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields || {};
        const issueType = fields.issuetype?.name || 'Unknown';
        const summary = fields.summary || '';
        const currentStatus = fields.status?.name || 'Unknown';
        const assignee = fields.assignee;
        let storyPoints = fields[storyPointsFieldId] || 0;
        
        // Only count Epic, Story, and Bug
        if (issueType === 'Epic' || issueType === 'Story' || issueType === 'Bug') {
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
              status: currentStatus,
              storyPoints: storyPoints,
              defaulted: defaulted,
              assignee: assignee ? {
                name: assignee.displayName || assignee.name || 'Unknown',
                email: assignee.emailAddress || '',
                accountId: assignee.accountId || ''
              } : null
            });
          }
        }
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    return movedTodayIssues;
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${label}: ${error.message}`);
    return [];
  }
}

// Generate assignee report
async function generateAssigneeReport() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`\n📊 Generating Assignee Work Report`);
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Date: ${todayStr}`);
  
  const client = createJiraClient();
  
  console.log('\n🔍 Discovering custom fields...');
  const fieldIds = await getCustomFieldIds(client);
  console.log(`   ✓ Story Points field: ${fieldIds.storyPoints}`);
  if (fieldIds.team) {
    console.log(`   ✓ Team field: ${fieldIds.team}`);
  } else {
    console.log(`   ⚠️  Team field not found`);
  }
  
  // Fetch all issues
  const completed = await fetchIssuesByStatus(
    client, 
    fieldIds.storyPoints, 
    COMPLETED_STATUSES, 
    'Completed Issues',
    today
  );
  
  const movedToQA = await fetchIssuesByStatus(
    client,
    fieldIds.storyPoints,
    [QA_STATUS],
    'Issues Moved to QA',
    today
  );
  
  const movedToDev = await fetchIssuesByStatus(
    client,
    fieldIds.storyPoints,
    [DEV_STATUS],
    'Issues Moved to Dev',
    today
  );
  
  // Combine all issues
  const allIssues = [...movedToDev, ...movedToQA, ...completed];
  
  // Group by assignee
  const assigneeMap = {};
  let unassignedCount = 0;
  let unassignedPoints = 0;
  
  allIssues.forEach(issue => {
    if (!issue.assignee) {
      unassignedCount++;
      unassignedPoints += issue.storyPoints;
      return;
    }
    
    const assigneeName = issue.assignee.name;
    
    if (!assigneeMap[assigneeName]) {
      assigneeMap[assigneeName] = {
        name: assigneeName,
        email: issue.assignee.email,
        accountId: issue.assignee.accountId,
        totalIssues: 0,
        totalStoryPoints: 0,
        inDev: { count: 0, points: 0, issues: [] },
        inQA: { count: 0, points: 0, issues: [] },
        completed: { count: 0, points: 0, issues: [] },
        byType: {}
      };
    }
    
    const assigneeData = assigneeMap[assigneeName];
    assigneeData.totalIssues++;
    assigneeData.totalStoryPoints += issue.storyPoints;
    
    // Track by type
    if (!assigneeData.byType[issue.issueType]) {
      assigneeData.byType[issue.issueType] = { count: 0, points: 0 };
    }
    assigneeData.byType[issue.issueType].count++;
    assigneeData.byType[issue.issueType].points += issue.storyPoints;
    
    // Track by status
    if (issue.status === DEV_STATUS) {
      assigneeData.inDev.count++;
      assigneeData.inDev.points += issue.storyPoints;
      assigneeData.inDev.issues.push({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        storyPoints: issue.storyPoints
      });
    } else if (issue.status === QA_STATUS) {
      assigneeData.inQA.count++;
      assigneeData.inQA.points += issue.storyPoints;
      assigneeData.inQA.issues.push({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        storyPoints: issue.storyPoints
      });
    } else {
      assigneeData.completed.count++;
      assigneeData.completed.points += issue.storyPoints;
      assigneeData.completed.issues.push({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        storyPoints: issue.storyPoints
      });
    }
  });
  
  // Convert to array and sort by total story points
  const assignees = Object.values(assigneeMap).sort((a, b) => b.totalStoryPoints - a.totalStoryPoints);
  
  // Fetch current sprint workload for each assignee
  console.log(`\n📋 Fetching current sprint workload (${CURRENT_SPRINT})...`);
  for (const assignee of assignees) {
    const workload = await fetchAssigneeSprintWorkload(client, fieldIds, assignee.accountId);
    assignee.currentSprintWorkload = workload;
    console.log(`   ✓ ${assignee.name}: ${workload.count} active issues (${workload.points} pts)`);
  }
  
  // Fetch total sprint allocation by team (including completed)
  console.log(`\n📊 Fetching total sprint allocation by team...`);
  const totalTeamAllocation = await fetchTotalSprintByTeam(client, fieldIds);
  
  // Group active workload by team
  const activeTeamMap = {};
  assignees.forEach(assignee => {
    if (assignee.currentSprintWorkload && assignee.currentSprintWorkload.issues) {
      assignee.currentSprintWorkload.issues.forEach(issue => {
        const teamName = issue.team || 'Unassigned';
        if (!activeTeamMap[teamName]) {
          activeTeamMap[teamName] = {
            name: teamName,
            activeIssues: 0,
            activePoints: 0,
            assignees: new Set()
          };
        }
        activeTeamMap[teamName].activeIssues++;
        activeTeamMap[teamName].activePoints += issue.storyPoints;
        activeTeamMap[teamName].assignees.add(assignee.name);
      });
    }
  });
  
  // Merge total, completed, and active data
  const teams = totalTeamAllocation.map(team => {
    const activeData = activeTeamMap[team.name] || { activeIssues: 0, activePoints: 0, assignees: new Set() };
    return {
      name: team.name,
      totalIssues: team.totalIssues,
      totalPoints: team.totalPoints,
      completedIssues: team.completedIssues,
      completedPoints: team.completedPoints,
      activeIssues: activeData.activeIssues,
      activePoints: activeData.activePoints,
      assigneeCount: activeData.assignees.size || team.assigneeCount
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  
  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 ASSIGNEE SUMMARY:');
  console.log(`   Total Issues: ${allIssues.length}`);
  console.log(`   Total Story Points: ${allIssues.reduce((sum, i) => sum + i.storyPoints, 0)}`);
  console.log(`   Active Assignees: ${assignees.length}`);
  if (unassignedCount > 0) {
    console.log(`   Unassigned: ${unassignedCount} issues (${unassignedPoints} points)`);
  }
  
  // Display team breakdown
  if (teams.length > 0) {
    console.log('\n📋 Sprint Allocation by Team:');
    teams.forEach(team => {
      const percentComplete = team.totalPoints > 0 ? Math.round((team.completedPoints / team.totalPoints) * 100) : 0;
      console.log(`   ${team.name}:`);
      console.log(`      Total: ${team.totalIssues} issues (${team.totalPoints} pts)`);
      console.log(`      Active: ${team.activeIssues} issues (${team.activePoints} pts)`);
      console.log(`      Completed: ${team.completedIssues} issues (${team.completedPoints} pts) - ${percentComplete}%`);
    });
  }
  
  console.log('\n📊 Top Contributors (Today):');
  assignees.slice(0, 10).forEach((assignee, index) => {
    console.log(`   ${index + 1}. ${assignee.name}: ${assignee.totalIssues} issues, ${assignee.totalStoryPoints} pts`);
    console.log(`      Today - Dev: ${assignee.inDev.count} (${assignee.inDev.points} pts) | QA: ${assignee.inQA.count} (${assignee.inQA.points} pts) | Completed: ${assignee.completed.count} (${assignee.completed.points} pts)`);
    if (assignee.currentSprintWorkload) {
      console.log(`      Sprint Workload: ${assignee.currentSprintWorkload.count} active issues (${assignee.currentSprintWorkload.points} pts)`);
    }
  });
  
  return {
    date: todayStr,
    project: PROJECT_KEY,
    currentSprint: CURRENT_SPRINT,
    summary: {
      totalIssues: allIssues.length,
      totalStoryPoints: allIssues.reduce((sum, i) => sum + i.storyPoints, 0),
      activeAssignees: assignees.length,
      unassignedIssues: unassignedCount,
      unassignedStoryPoints: unassignedPoints,
      totalSprintWorkload: assignees.reduce((sum, a) => sum + (a.currentSprintWorkload?.points || 0), 0),
      totalSprintIssues: assignees.reduce((sum, a) => sum + (a.currentSprintWorkload?.count || 0), 0)
    },
    teams: teams,
    assignees: assignees
  };
}

// Save results to JSON file
function saveResults(data) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Extract sprint number from CURRENT_SPRINT (e.g., "NH Sprint 31" -> "31")
  const sprintNumber = CURRENT_SPRINT.match(/\d+/)?.[0] || 'unknown';
  const filename = `assignee-report-sprint-${sprintNumber}.json`;
  const filepath = path.join(reportsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Results saved to: ${filepath}`);
  return filepath;
}

// Main function
async function main() {
  try {
    validateConfig();
    const data = await generateAssigneeReport();
    saveResults(data);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Failed to generate report');
    console.error(error.message);
    process.exit(1);
  }
}

main();

