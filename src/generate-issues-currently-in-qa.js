const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31'; // Update this for each sprint
const QA_STATUS = 'In QA';

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

// Fetch all issues currently in QA for the sprint
async function fetchIssuesInQA(client, fieldIds) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND status = "${QA_STATUS}" AND issuetype in (Story, Bug)`;
  
  console.log(`\n🔎 Querying Issues in QA...`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   JQL: ${jql}`);
  
  try {
    // Step 1: Get all issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} issues in QA`);
    
    if (issueRefs.length === 0) {
      return {
        issues: [],
        totalIssues: 0,
        totalPoints: 0,
        breakdown: {}
      };
    }
    
    // Step 2: Fetch each issue individually with details
    const issues = [];
    const typeBreakdown = {};
    let totalPoints = 0;
    
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,assignee,priority,${fieldIds.storyPoints}`
          }
        });
        
        const issue = issueResponse.data;
        const actualKey = issue.key; // Get the full key like "VER10-1234"
        const fields = issue.fields || {};
        let storyPoints = fields[fieldIds.storyPoints] || 0;
        const issueType = fields.issuetype?.name || 'Unknown';
        const summary = fields.summary || '';
        const priority = fields.priority?.name || 'None';
        const assignee = fields.assignee ? fields.assignee.displayName : 'Unassigned';
        
        // Default to 2 points for Stories or Bugs without points
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
        }
        
        // Track breakdown by issue type
        if (!typeBreakdown[issueType]) {
          typeBreakdown[issueType] = {
            count: 0,
            points: 0
          };
        }
        typeBreakdown[issueType].count++;
        typeBreakdown[issueType].points += storyPoints;
        totalPoints += storyPoints;
        
        issues.push({
          key: actualKey,
          summary: summary,
          issueType: issueType,
          storyPoints: storyPoints,
          priority: priority,
          assignee: assignee
        });
        
        console.log(`   ✓ ${actualKey}: ${issueType} - ${storyPoints} pts - ${assignee}`);
        
      } catch (err) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${err.message}`);
      }
    }
    
    // Sort by story points descending
    issues.sort((a, b) => b.storyPoints - a.storyPoints);
    
    return {
      issues,
      totalIssues: issues.length,
      totalPoints,
      breakdown: typeBreakdown
    };
    
  } catch (error) {
    console.error(`   ❌ Error fetching issues: ${error.message}`);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('\n📊 Generating Issues Currently in QA Report');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprint: ${CURRENT_SPRINT}`);
    console.log(`   Status: ${QA_STATUS}`);
    
    validateConfig();
    
    const client = createJiraClient();
    
    console.log('\n🔍 Discovering custom fields...');
    const fieldIds = await getCustomFieldIds(client);
    console.log(`   ✓ Story Points field: ${fieldIds.storyPoints}`);
    
    // Fetch issues in QA
    const qaData = await fetchIssuesInQA(client, fieldIds);
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY - Issues Currently in QA:');
    console.log(`   Total Issues: ${qaData.totalIssues}`);
    console.log(`   Total Story Points: ${qaData.totalPoints}`);
    
    if (Object.keys(qaData.breakdown).length > 0) {
      console.log('\n   Breakdown by Type:');
      Object.entries(qaData.breakdown).forEach(([type, data]) => {
        console.log(`   - ${type}: ${data.count} issues, ${data.points} points`);
      });
    }
    
    // Group by assignee
    const assigneeMap = {};
    qaData.issues.forEach(issue => {
      if (!assigneeMap[issue.assignee]) {
        assigneeMap[issue.assignee] = {
          count: 0,
          points: 0,
          issues: []
        };
      }
      assigneeMap[issue.assignee].count++;
      assigneeMap[issue.assignee].points += issue.storyPoints;
      assigneeMap[issue.assignee].issues.push(issue);
    });
    
    if (Object.keys(assigneeMap).length > 0) {
      console.log('\n   By Assignee:');
      const sortedAssignees = Object.entries(assigneeMap).sort((a, b) => b[1].points - a[1].points);
      sortedAssignees.forEach(([assignee, data]) => {
        console.log(`   - ${assignee}: ${data.count} issues (${data.points} pts)`);
      });
    }
    
    // Save to JSON
    const today = new Date().toISOString().split('T')[0];
    const outputDir = path.join(__dirname, '..', 'reports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const sprintNumber = CURRENT_SPRINT.match(/\d+/)?.[0] || 'unknown';
    const outputFile = path.join(outputDir, `issues-in-qa-sprint-${sprintNumber}.json`);
    
    const output = {
      generatedAt: new Date().toISOString(),
      date: today,
      project: PROJECT_KEY,
      sprint: CURRENT_SPRINT,
      status: QA_STATUS,
      summary: {
        totalIssues: qaData.totalIssues,
        totalStoryPoints: qaData.totalPoints,
        breakdown: qaData.breakdown
      },
      byAssignee: assigneeMap,
      issues: qaData.issues
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    
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

