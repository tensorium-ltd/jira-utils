const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const TARGET_STATUS = 'In QA';

// Validate environment variables
function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    console.log('\nSet it with: export JIRA_EMAIL="your-email@company.com"');
    process.exit(1);
  }
  
  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
    console.log('\nTo create a Personal Access Token:');
    console.log('1. Go to https://id.atlassian.com/manage-profile/security/api-tokens');
    console.log('2. Click "Create API token"');
    console.log('3. Copy the token and run: export JIRA_API_TOKEN="your-token"');
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

// Check if status change happened today
function changedToStatusToday(issue, targetStatus, today) {
  if (!issue.changelog || !issue.changelog.histories) {
    return false;
  }
  
  const todayStr = today.toISOString().split('T')[0];
  
  // Look through changelog histories
  for (const history of issue.changelog.histories) {
    const changeDate = history.created.split('T')[0];
    
    // Check if change happened today
    if (changeDate === todayStr) {
      // Check if this history contains a status change to our target status
      for (const item of history.items) {
        if (item.field === 'status' && 
            item.toString && 
            item.toString.toUpperCase() === targetStatus.toUpperCase()) {
          return true;
        }
      }
    }
  }
  
  return false;
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
    
    return 'customfield_10003'; // Default
  } catch (error) {
    return 'customfield_10003';
  }
}

// Fetch issues that moved to In QA today
async function fetchIssuesMovedToQA() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`\n📊 Fetching JIRA issues moved to "${TARGET_STATUS}" today...`);
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Date: ${todayStr}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
  
  const client = createJiraClient();
  
  // Get Story Points field ID
  const storyPointsFieldId = await getStoryPointsFieldId(client);
  
  // Build JQL query - find all issues currently in "In QA" or recently moved to it
  // We'll filter by changelog in the code since JQL status change date is tricky
  const jql = `project = ${PROJECT_KEY} AND status = "${TARGET_STATUS}"`;
  
  console.log(`\n🔎 Executing JQL query...`);
  console.log(`   ${jql}`);
  
  try {
    // Search for issues
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueData = response.data.issues || [];
    console.log(`   ✓ Found ${issueData.length} issues currently in "${TARGET_STATUS}"`);
    
    // Fetch details for each issue and check changelog
    console.log(`\n📋 Checking which issues moved to "${TARGET_STATUS}" today...`);
    
    const movedTodayIssues = [];
    const typeBreakdown = {};
    let totalStoryPoints = 0;
    
    for (const issueRef of issueData) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        // Fetch full issue details including changelog and story points
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
        let storyPoints = fields[storyPointsFieldId] || 0;
        
        // Default to 2 points for Stories or Bugs without points
        const defaulted = (issueType === 'Story' || issueType === 'Bug') && storyPoints === 0;
        if (defaulted) {
          storyPoints = 2;
        }
        
        // Check if this issue moved to "In QA" today
        if (changedToStatusToday(issue, TARGET_STATUS, today)) {
          movedTodayIssues.push({
            key: issue.key,
            summary: summary,
            issueType: issueType,
            priority: priority,
            storyPoints: storyPoints,
            defaulted: defaulted
          });
          
          // Track by issue type
          if (!typeBreakdown[issueType]) {
            typeBreakdown[issueType] = 0;
          }
          typeBreakdown[issueType]++;
          
          totalStoryPoints += storyPoints;
          
          console.log(`   ✓ ${issue.key}: ${issueType} - ${storyPoints} pts - ${summary.substring(0, 50)}...`);
        }
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary:');
    console.log(`   Issues moved to "${TARGET_STATUS}" today: ${movedTodayIssues.length}`);
    console.log(`   Total Story Points: ${totalStoryPoints}`);
    
    if (Object.keys(typeBreakdown).length > 0) {
      console.log('\n   Breakdown by Issue Type:');
      Object.entries(typeBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`   - ${type}: ${count}`);
        });
    }
    
    return {
      date: todayStr,
      project: PROJECT_KEY,
      targetStatus: TARGET_STATUS,
      summary: {
        totalIssues: movedTodayIssues.length,
        totalStoryPoints: totalStoryPoints,
        breakdown: typeBreakdown
      },
      issues: movedTodayIssues.sort((a, b) => a.key.localeCompare(b.key))
    };
    
  } catch (error) {
    if (error.response) {
      console.error(`\n❌ JIRA API Error: ${error.response.status} ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`   ${JSON.stringify(error.response.data, null, 2)}`);
      }
      if (error.response.status === 401) {
        console.error('\n💡 Authentication failed. Please check:');
        console.error('   - JIRA_EMAIL is correct');
        console.error('   - JIRA_API_TOKEN is valid');
        console.error('   - Token has not expired');
      }
    } else if (error.request) {
      console.error('\n❌ Network Error: Could not reach JIRA server');
      console.error(`   ${error.message}`);
    } else {
      console.error(`\n❌ Error: ${error.message}`);
    }
    throw error;
  }
}

// Save results to JSON file
function saveResults(data) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filename = `jira-moved-to-qa-${data.date}.json`;
  const filepath = path.join(reportsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Results saved to: ${filepath}`);
  return filepath;
}

// Main function
async function main() {
  try {
    // Validate configuration
    validateConfig();
    
    // Fetch data from JIRA
    const data = await fetchIssuesMovedToQA();
    
    // Save results
    saveResults(data);
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('\n❌ Failed to fetch JIRA data');
    process.exit(1);
  }
}

// Run the script
main();

