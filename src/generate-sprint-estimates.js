const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

// Sprint names to query
const SPRINTS = [
  'NH Sprint 31',
  'NH Sprint 32',
  'NH Sprint 33',
  'NH Sprint 34',
  'NH Sprint 35',
  'NH Sprint 36'
];

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
    
    console.warn('⚠️  Could not find Story Points field, using default field ID');
    return 'customfield_10003'; // Default based on previous discovery
  } catch (error) {
    console.warn('⚠️  Could not fetch fields, using default Story Points field ID');
    return 'customfield_10003';
  }
}

// Fetch story points for a specific sprint
async function getSprintEstimates(client, sprintName, storyPointsFieldId) {
  try {
    // Build JQL query to find all issues in this sprint (all issue types)
    const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}"`;
    
    console.log(`\n🔎 Querying: ${sprintName}`);
    console.log(`   JQL: ${jql}`);
    
    // Search for issues - request more to avoid pagination
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueData = response.data.issues || [];
    console.log(`   ✓ Found ${issueData.length} issues`);
    
    if (issueData.length === 0) {
      return {
        sprint: sprintName,
        totalStoryPoints: 0,
        issueCount: 0,
        breakdown: {
          stories: { points: 0, count: 0 },
          bugs: { points: 0, count: 0 }
        },
        issues: []
      };
    }
    
    // Fetch details for each issue
    let totalStoryPoints = 0;
    let issuesWithPoints = 0;
    let issuesWithoutPoints = 0;
    const issues = [];
    const typeBreakdown = {};
    
    for (const issueRef of issueData) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        // Fetch full issue details
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,${storyPointsFieldId}`
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields || {};
        let storyPoints = fields[storyPointsFieldId] || 0;
        const issueType = fields.issuetype?.name || 'Unknown';
        const status = fields.status?.name || 'Unknown';
        
        // Only count Epic, Story, and Bug issue types
        if (issueType === 'Epic' || issueType === 'Story' || issueType === 'Bug') {
          // Default to 2 points if Story or Bug has no points
          let defaulted = false;
          if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
            storyPoints = 2;
            defaulted = true;
            issuesWithoutPoints++;
          } else if (storyPoints > 0) {
            issuesWithPoints++;
          } else {
            // Epic with 0 points - still count it but with 0
            issuesWithoutPoints++;
          }
          
          totalStoryPoints += storyPoints;
          
          // Track by issue type
          if (!typeBreakdown[issueType]) {
            typeBreakdown[issueType] = { count: 0, points: 0 };
          }
          typeBreakdown[issueType].count++;
          typeBreakdown[issueType].points += storyPoints;
          
          issues.push({
            key: issue.key,
            summary: fields.summary,
            issueType: issueType,
            status: status,
            storyPoints: storyPoints,
            defaulted: defaulted
          });
        }
        // Ignore all other issue types (Sub-task, Sub-Bug, Task, etc.)
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    console.log(`   Total Story Points: ${totalStoryPoints} (Epic/Story/Bug only)`);
    console.log(`   Issues counted: ${issues.length} of ${issueData.length} total`);
    console.log(`   Issues with points: ${issuesWithPoints}, defaulted to 2: ${issuesWithoutPoints}`);
    
    // Show breakdown by issue type
    const sortedTypes = Object.entries(typeBreakdown)
      .sort((a, b) => b[1].points - a[1].points);
    
    sortedTypes.forEach(([type, data]) => {
      console.log(`   - ${type}: ${data.points} pts (${data.count} issues)`);
    });
    
    return {
      sprint: sprintName,
      totalStoryPoints: totalStoryPoints,
      issueCount: issueData.length,
      issuesWithPoints: issuesWithPoints,
      issuesWithoutPoints: issuesWithoutPoints,
      breakdown: typeBreakdown,
      issues: issues
    };
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ JIRA API Error: ${error.response.status} ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`   ${JSON.stringify(error.response.data, null, 2)}`);
      }
    } else if (error.request) {
      console.error(`   ❌ Network Error: Could not reach JIRA server`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
    }
    
    // Return empty result on error
    return {
      sprint: sprintName,
      totalStoryPoints: 0,
      issueCount: 0,
      issuesWithPoints: 0,
      issuesWithoutPoints: 0,
      breakdown: {},
      issues: [],
      error: error.message
    };
  }
}

// Save results to JSON file
function saveResults(data) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `sprint-estimates-${timestamp}.json`;
  const filepath = path.join(reportsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Results saved to: ${filepath}`);
  return filepath;
}

// Main function
async function main() {
  try {
    console.log('\n📊 Fetching Sprint Estimates from JIRA...');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprints: ${SPRINTS.join(', ')}`);
    console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
    
    // Validate configuration
    validateConfig();
    
    // Create JIRA client
    const client = createJiraClient();
    
    // Get Story Points field ID
    console.log('\n🔍 Discovering Story Points field...');
    const storyPointsFieldId = await getStoryPointsFieldId(client);
    
    // Fetch estimates for each sprint
    const sprintEstimates = [];
    let grandTotal = 0;
    const grandBreakdown = {};
    
    for (const sprintName of SPRINTS) {
      const estimate = await getSprintEstimates(client, sprintName, storyPointsFieldId);
      sprintEstimates.push(estimate);
      grandTotal += estimate.totalStoryPoints;
      
      // Aggregate breakdown by issue type
      Object.entries(estimate.breakdown).forEach(([type, data]) => {
        if (!grandBreakdown[type]) {
          grandBreakdown[type] = { count: 0, points: 0 };
        }
        grandBreakdown[type].count += data.count;
        grandBreakdown[type].points += data.points;
      });
    }
    
    // Prepare final result
    const result = {
      generatedAt: new Date().toISOString(),
      project: PROJECT_KEY,
      summary: {
        totalStoryPoints: grandTotal,
        sprintCount: SPRINTS.length,
        breakdown: grandBreakdown
      },
      sprints: sprintEstimates
    };
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary (Epic/Story/Bug only):');
    console.log(`   Grand Total Story Points: ${grandTotal}`);
    
    // Show breakdown by issue type
    const topTypes = Object.entries(grandBreakdown)
      .sort((a, b) => b[1].points - a[1].points);
    
    topTypes.forEach(([type, data]) => {
      console.log(`   - ${type}: ${data.points} points (${data.count} issues)`);
    });
    
    console.log(`   Sprints Analyzed: ${SPRINTS.length}`);
    
    // Save results
    saveResults(result);
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('\n❌ Failed to fetch sprint estimates');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the script
main();

