const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const SPRINTS = ['NH Sprint 28', 'NH Sprint 29', 'NH Sprint 30', 'NH Sprint 31'];

// Statuses to track (case-sensitive!)
const COMPLETED_STATUSES = ['Ready for release', 'CLOSED', 'Closed', 'Done'];

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

// Create JIRA API client
function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
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
    
    return {
      storyPoints: storyPointsField ? storyPointsField.id : 'customfield_10003'
    };
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch custom fields: ${error.message}`);
    return {
      storyPoints: 'customfield_10003'
    };
  }
}

// Fetch all assignees and their allocation for a sprint
async function fetchSprintAllocation(client, fieldIds, sprintName) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND issuetype in (Epic, Story, Bug)`;
  
  try {
    console.log(`\n🔎 Querying ${sprintName}...`);
    
    // Step 1: Get all issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} issues in sprint`);
    
    const assigneeMap = {};
    
    // Step 2: Fetch each issue individually
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `assignee,status,issuetype,${fieldIds.storyPoints}`
          }
        });
        
        const fields = issueResponse.data.fields || {};
        const assignee = fields.assignee;
        const assigneeName = assignee ? assignee.displayName : 'Unassigned';
        const assigneeAccountId = assignee ? assignee.accountId : 'unassigned';
        
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
        
        // Determine if completed
        const isCompleted = COMPLETED_STATUSES.includes(status);
        
        // Initialize assignee if not exists
        if (!assigneeMap[assigneeAccountId]) {
          assigneeMap[assigneeAccountId] = {
            name: assigneeName,
            accountId: assigneeAccountId,
            totalIssues: 0,
            totalPoints: 0,
            completedIssues: 0,
            completedPoints: 0
          };
        }
        
        // Add to totals
        assigneeMap[assigneeAccountId].totalIssues++;
        assigneeMap[assigneeAccountId].totalPoints += storyPoints;
        
        if (isCompleted) {
          assigneeMap[assigneeAccountId].completedIssues++;
          assigneeMap[assigneeAccountId].completedPoints += storyPoints;
        }
        
      } catch (err) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${err.message}`);
      }
    }
    
    // Convert to array and calculate percentages
    const assignees = Object.values(assigneeMap).map(assignee => ({
      ...assignee,
      percentComplete: assignee.totalPoints > 0 
        ? Math.round((assignee.completedPoints / assignee.totalPoints) * 100) 
        : 0
    })).sort((a, b) => b.totalPoints - a.totalPoints);
    
    console.log(`   ✓ Processed ${issueRefs.length} issues for ${assignees.length} assignees`);
    
    return assignees;
    
  } catch (error) {
    console.error(`   ❌ Error fetching sprint data: ${error.message}`);
    return [];
  }
}

// Main function
async function main() {
  try {
    console.log('\n📊 Generating Assignee Allocation Report');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprints: ${SPRINTS.join(', ')}`);
    
    validateConfig();
    
    const client = createJiraClient();
    
    console.log('\n🔍 Discovering custom fields...');
    const fieldIds = await getCustomFieldIds(client);
    console.log(`   ✓ Story Points field: ${fieldIds.storyPoints}`);
    
    // Fetch data for all sprints
    const sprintData = {};
    
    for (const sprintName of SPRINTS) {
      const assignees = await fetchSprintAllocation(client, fieldIds, sprintName);
      sprintData[sprintName] = assignees;
    }
    
    // Build comprehensive assignee list
    const allAssignees = new Set();
    Object.values(sprintData).forEach(assignees => {
      assignees.forEach(assignee => {
        allAssignees.add(assignee.accountId);
      });
    });
    
    // Build report data
    const reportData = Array.from(allAssignees).map(accountId => {
      let assigneeName = '';
      const sprintStats = {};
      let totalIssues = 0;
      let totalPoints = 0;
      let completedIssues = 0;
      let completedPoints = 0;
      
      SPRINTS.forEach(sprintName => {
        const assigneeData = sprintData[sprintName].find(a => a.accountId === accountId);
        
        if (assigneeData) {
          if (!assigneeName) assigneeName = assigneeData.name;
          
          sprintStats[sprintName] = {
            totalIssues: assigneeData.totalIssues,
            totalPoints: assigneeData.totalPoints,
            completedIssues: assigneeData.completedIssues,
            completedPoints: assigneeData.completedPoints,
            percentComplete: assigneeData.percentComplete
          };
          
          totalIssues += assigneeData.totalIssues;
          totalPoints += assigneeData.totalPoints;
          completedIssues += assigneeData.completedIssues;
          completedPoints += assigneeData.completedPoints;
        } else {
          sprintStats[sprintName] = {
            totalIssues: 0,
            totalPoints: 0,
            completedIssues: 0,
            completedPoints: 0,
            percentComplete: 0
          };
        }
      });
      
      return {
        accountId,
        name: assigneeName,
        sprintStats,
        totalIssues,
        totalPoints,
        completedIssues,
        completedPoints,
        percentComplete: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Print detailed report
    console.log('\n' + '='.repeat(120));
    console.log('📈 ASSIGNEE ALLOCATION & COMPLETION REPORT');
    console.log('='.repeat(120));
    
    reportData.forEach(assignee => {
      console.log(`\n👤 ${assignee.name}`);
      console.log('-'.repeat(120));
      
      SPRINTS.forEach(sprintName => {
        const stats = assignee.sprintStats[sprintName];
        if (stats.totalIssues > 0) {
          console.log(`  ${sprintName}: ${stats.completedIssues}/${stats.totalIssues} issues, ` +
                      `${stats.completedPoints}/${stats.totalPoints} pts (${stats.percentComplete}% complete)`);
        } else {
          console.log(`  ${sprintName}: -`);
        }
      });
      
      console.log(`  ${'─'.repeat(116)}`);
      console.log(`  TOTAL:      ${assignee.completedIssues}/${assignee.totalIssues} issues, ` +
                  `${assignee.completedPoints}/${assignee.totalPoints} pts (${assignee.percentComplete}% complete)`);
    });
    
    // Print summary table
    console.log('\n\n' + '='.repeat(120));
    console.log('📋 SUMMARY TABLE - Allocation & Completion by Assignee\n');
    
    console.log('Assignee'.padEnd(25) + 
                'Sprint 28'.padEnd(20) + 
                'Sprint 29'.padEnd(20) + 
                'Sprint 30'.padEnd(20) + 
                'Sprint 31'.padEnd(20) + 
                'Total'.padEnd(20));
    console.log('─'.repeat(125));
    
    reportData.forEach(assignee => {
      let row = assignee.name.padEnd(25);
      
      SPRINTS.forEach(sprintName => {
        const stats = assignee.sprintStats[sprintName];
        const display = stats.totalIssues > 0 
          ? `${stats.completedIssues}/${stats.totalIssues} (${stats.completedPoints}/${stats.totalPoints})`
          : '-';
        row += display.padEnd(20);
      });
      
      const totalDisplay = `${assignee.completedIssues}/${assignee.totalIssues} (${assignee.completedPoints}/${assignee.totalPoints})`;
      row += totalDisplay.padEnd(20);
      
      console.log(row);
    });
    
    console.log('\n' + '='.repeat(120));
    
    // Save to JSON
    const outputDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'assignee-allocation-report.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      generatedAt: new Date().toISOString(),
      project: PROJECT_KEY,
      sprints: SPRINTS,
      assignees: reportData
    }, null, 2));
    
    console.log(`\n✅ Results saved to: ${outputFile}`);
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the script
main();


