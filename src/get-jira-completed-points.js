const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED'];

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Error: Start date and end date are required');
    console.log('Usage: npm run jira-points -- <start-date> <end-date>');
    console.log('Example: npm run jira-points -- 2025-01-01 2025-01-31');
    console.log('\nDates must be in YYYY-MM-DD format');
    process.exit(1);
  }
  
  const startDate = args[0];
  const endDate = args[1];
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    console.error('❌ Error: Dates must be in YYYY-MM-DD format');
    process.exit(1);
  }
  
  // Validate date logic
  if (new Date(startDate) > new Date(endDate)) {
    console.error('❌ Error: Start date must be before or equal to end date');
    process.exit(1);
  }
  
  return { startDate, endDate };
}

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

// Get the Story Points field ID
async function getStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    
    // Look for Story Points field (case-insensitive)
    const storyPointsField = fields.find(field => 
      field.name && field.name.toLowerCase().includes('story point')
    );
    
    if (storyPointsField) {
      console.log(`   ✓ Found Story Points field: ${storyPointsField.name} (${storyPointsField.id})`);
      return storyPointsField.id;
    }
    
    console.warn('⚠️  Could not find Story Points field, will try common field IDs');
    return 'customfield_10016'; // Common default
  } catch (error) {
    console.warn('⚠️  Could not fetch fields, using default Story Points field ID');
    return 'customfield_10016';
  }
}

// Parse date from changelog item
function parseChangeDate(changeItem) {
  return changeItem.created ? changeItem.created.split('T')[0] : null;
}

// Get status change date from changelog
function getStatusChangeDate(issue, targetStatuses, startDate, endDate) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Look through changelog histories in reverse (most recent first)
  for (const history of issue.changelog.histories) {
    const changeDate = new Date(history.created.split('T')[0]);
    
    // Check if change is within date range
    if (changeDate >= start && changeDate <= end) {
      // Check if this history contains a status change to our target statuses
      for (const item of history.items) {
        if (item.field === 'status' && 
            item.toString && 
            targetStatuses.some(status => item.toString.toUpperCase() === status.toUpperCase())) {
          return history.created.split('T')[0];
        }
      }
    }
  }
  
  return null;
}

// Fetch completed story points from JIRA
async function fetchCompletedStoryPoints(startDate, endDate) {
  console.log(`\n📊 Fetching completed story points from JIRA...`);
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Date Range: ${startDate} to ${endDate}`);
  console.log(`   Target Statuses: ${COMPLETED_STATUSES.join(', ')}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
  
  const client = createJiraClient();
  
  // Get Story Points field ID
  console.log('\n🔍 Discovering Story Points field...');
  const storyPointsFieldId = await getStoryPointsFieldId(client);
  
  // Build JQL query - filter for Story and Bug issue types only
  const statusList = COMPLETED_STATUSES.map(s => `"${s}"`).join(', ');
  const jql = `project = ${PROJECT_KEY} AND issuetype in (Story, Bug) AND status changed to (${statusList}) during ("${startDate}", "${endDate}")`;
  
  console.log(`\n🔎 Executing JQL query...`);
  console.log(`   ${jql}`);
  
  try {
    // Search for issues using the new JQL endpoint
    // Note: /rest/api/3/search/jql appears to only accept jql parameter
    // We'll fetch all fields and filter client-side
    const requestPayload = {
      jql: jql
    };
    
    const response = await client.post('/rest/api/3/search/jql', requestPayload);
    
    const issueData = response.data.issues || [];
    console.log(`   ✓ Found ${issueData.length} issues`);
    
    // The /search/jql endpoint doesn't return fields, so we need to fetch each issue
    console.log('\n📋 Fetching issue details...');
    
    const results = [];
    let totalStoryPoints = 0;
    let issuesWithPoints = 0;
    let issuesWithoutPoints = 0;
    
    // Breakdown by issue type
    let storyPointsFromStories = 0;
    let storyPointsFromBugs = 0;
    let storyCount = 0;
    let bugCount = 0;
    
    for (const issueRef of issueData) {
      // Try different possible structures
      const issueKey = issueRef.key || issueRef.issueKey || issueRef.id;
      
      try {
        // Fetch full issue details including issue type
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,${storyPointsFieldId}`,
            expand: 'changelog'
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields || {};
        let storyPoints = fields[storyPointsFieldId];
        const issueType = fields.issuetype?.name || 'Unknown';
        const statusChangeDate = getStatusChangeDate(issue, COMPLETED_STATUSES, startDate, endDate);
        const currentStatus = fields.status?.name || 'Unknown';
        let defaultPointsAssigned = false;
        
        // Default to 2 points if not assigned
        if (!storyPoints || storyPoints === 0) {
          storyPoints = 2;
          defaultPointsAssigned = true;
          issuesWithoutPoints++;
          console.log(`   ⚠️  ${issue.key}: No story points assigned, defaulting to 2 (${issueType} - ${currentStatus})`);
        } else {
          issuesWithPoints++;
          console.log(`   ✓ ${issue.key}: ${storyPoints} points (${issueType} - ${currentStatus})`);
        }
        
        totalStoryPoints += storyPoints;
        
        // Track breakdown by issue type
        if (issueType === 'Story') {
          storyPointsFromStories += storyPoints;
          storyCount++;
        } else if (issueType === 'Bug') {
          storyPointsFromBugs += storyPoints;
          bugCount++;
        }
        
        results.push({
          key: issue.key,
          summary: fields.summary,
          issueType: issueType,
          storyPoints: storyPoints,
          defaultPointsAssigned: defaultPointsAssigned,
          statusChangedDate: statusChangeDate,
          currentStatus: currentStatus
        });
        
      } catch (issueError) {
        console.error(`   ✗ Failed to fetch ${issueKey}: ${issueError.message}`);
        issuesWithoutPoints++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary:');
    console.log(`   Total Story Points: ${totalStoryPoints}`);
    console.log(`   Stories: ${storyPointsFromStories} points (${storyCount} issues)`);
    console.log(`   Bugs: ${storyPointsFromBugs} points (${bugCount} issues)`);
    console.log(`   Issues with Points: ${issuesWithPoints}`);
    console.log(`   Issues without Points (defaulted to 2): ${issuesWithoutPoints}`);
    console.log(`   Total Issues: ${issueData.length}`);
    
    return {
      dateRange: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalStoryPoints: totalStoryPoints,
        issueCount: issueData.length,
        issuesWithPoints: issuesWithPoints,
        issuesWithoutPoints: issuesWithoutPoints,
        project: PROJECT_KEY,
        breakdown: {
          stories: {
            points: storyPointsFromStories,
            count: storyCount
          },
          bugs: {
            points: storyPointsFromBugs,
            count: bugCount
          }
        }
      },
      issues: results.sort((a, b) => {
        if (a.statusChangedDate && b.statusChangedDate) {
          return a.statusChangedDate.localeCompare(b.statusChangedDate);
        }
        return 0;
      })
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
function saveResults(data, startDate, endDate) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filename = `jira-completed-points-${startDate}-to-${endDate}.json`;
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
    
    // Parse arguments
    const { startDate, endDate } = parseArgs();
    
    // Fetch data from JIRA
    const data = await fetchCompletedStoryPoints(startDate, endDate);
    
    // Save results
    saveResults(data, startDate, endDate);
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('\n❌ Failed to fetch JIRA data');
    process.exit(1);
  }
}

// Run the script
main();

