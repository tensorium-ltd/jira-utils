const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31'; // Update this for each sprint

// Status categories to track
const STATUS_CATEGORIES = {
  'In Dev': ['In Dev'],
  'In Review': ['In Review', 'Ready for Review', 'READY FOR REVIEW'],
  'In QA': ['In QA'],
  'Completed': ['READY FOR RELEASE', 'CLOSED']
};

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
      field.name && field.name.toLowerCase() === 'story points'
    );
    
    if (!storyPointsField) {
      console.warn('⚠️  Warning: Could not find Story Points field, using default customfield_10003');
      return 'customfield_10003';
    }
    
    console.log(`✓ Found Story Points field: ${storyPointsField.id}`);
    return storyPointsField.id;
  } catch (error) {
    console.error(`❌ Error getting Story Points field: ${error.message}`);
    return 'customfield_10003'; // Default fallback
  }
}

// Check if an issue was completed today
function wasCompletedToday(changelog) {
  if (!changelog || !changelog.histories) {
    return false;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  for (const history of changelog.histories) {
    const changeDate = history.created.split('T')[0];
    
    if (changeDate === today) {
      for (const item of history.items) {
        if (item.field === 'status' && 
            (STATUS_CATEGORIES['Completed'].includes(item.toString) ||
             STATUS_CATEGORIES['Completed'].some(s => s.toLowerCase() === item.toString?.toLowerCase()))) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Fetch all issues in the current sprint
async function fetchSprintIssues(client, storyPointsFieldId) {
  try {
    console.log(`\n🔎 Fetching all issues in ${CURRENT_SPRINT}...`);
    
    const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Story, Bug)`;
    console.log(`   JQL: ${jql}`);
    
    // Step 1: Get all issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} issues to process`);
    
    if (issueRefs.length === 0) {
      return [];
    }
    
    // Step 2: Fetch each issue individually with full details
    const issues = [];
    console.log(`\n📥 Fetching issue details...`);
    
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,${storyPointsFieldId}`,
            expand: 'changelog'
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields;
        const status = fields.status?.name || 'Unknown';
        const issueType = fields.issuetype?.name || 'Unknown';
        let storyPoints = fields[storyPointsFieldId] || 0;
        
        // Default to 2 points for Stories/Bugs without points
        let defaulted = false;
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
          defaulted = true;
        }
        
        // Check if completed today
        const completedToday = wasCompletedToday(issue.changelog);
        
        issues.push({
          key: issue.key,
          summary: fields.summary,
          status: status,
          issueType: issueType,
          storyPoints: storyPoints,
          defaulted: defaulted,
          completedToday: completedToday
        });
        
      } catch (issueError) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${issueError.message}`);
      }
    }
    
    console.log(`   ✓ Successfully fetched ${issues.length} issues with details`);
    return issues;
    
  } catch (error) {
    console.error(`   ❌ Error fetching sprint issues: ${error.message}`);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return [];
  }
}

// Categorize status into one of our categories
function categorizeStatus(status) {
  const statusLower = status.toLowerCase();
  
  for (const [category, statuses] of Object.entries(STATUS_CATEGORIES)) {
    if (statuses.some(s => s.toLowerCase() === statusLower)) {
      return category;
    }
  }
  
  return 'Other';
}

// Generate the status snapshot report
async function generateStatusSnapshot(client, storyPointsFieldId) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 STORY POINTS BY STATUS SNAPSHOT');
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`   Note: "Completed" shows only issues completed TODAY`);
  console.log('='.repeat(60));
  
  // Fetch all issues
  const issues = await fetchSprintIssues(client, storyPointsFieldId);
  
  if (issues.length === 0) {
    console.log('\n⚠️  No issues found in the current sprint');
    return null;
  }
  
  // Group by status category
  const statusGroups = {
    'In Dev': { issues: [], points: 0, count: 0 },
    'In Review': { issues: [], points: 0, count: 0 },
    'In QA': { issues: [], points: 0, count: 0 },
    'Completed': { issues: [], points: 0, count: 0 },
    'Other': { issues: [], points: 0, count: 0 }
  };
  
  let totalPoints = 0;
  let totalIssues = 0;
  
  for (const issue of issues) {
    const category = categorizeStatus(issue.status);
    
    // Only include completed issues if they were completed today
    if (category === 'Completed' && !issue.completedToday) {
      continue;
    }
    
    statusGroups[category].issues.push(issue);
    statusGroups[category].points += issue.storyPoints;
    statusGroups[category].count += 1;
    
    totalPoints += issue.storyPoints;
    totalIssues += 1;
  }
  
  // Display summary
  console.log('\n📈 SUMMARY BY STATUS:');
  console.log('');
  
  // Sort by order of workflow
  const orderedCategories = ['In Dev', 'In Review', 'In QA', 'Completed', 'Other'];
  
  for (const category of orderedCategories) {
    const group = statusGroups[category];
    if (group.count > 0) {
      const percentage = ((group.points / totalPoints) * 100).toFixed(1);
      const categoryLabel = category === 'Completed' ? `${category} Today` : category;
      console.log(`   ${categoryLabel}:`);
      console.log(`      Issues: ${group.count}`);
      console.log(`      Story Points: ${group.points} (${percentage}%)`);
      console.log('');
    }
  }
  
  console.log('-'.repeat(60));
  console.log(`   TOTAL: ${totalIssues} issues, ${totalPoints} story points`);
  console.log('='.repeat(60));
  
  // Display detailed breakdown
  console.log('\n📋 DETAILED BREAKDOWN:\n');
  
  for (const category of orderedCategories) {
    const group = statusGroups[category];
    if (group.count > 0) {
      const categoryLabel = category === 'Completed' ? `${category} TODAY` : category;
      console.log(`\n${categoryLabel} (${group.count} issues, ${group.points} points):`);
      console.log('-'.repeat(60));
      
      // Sort issues by key
      group.issues.sort((a, b) => a.key.localeCompare(b.key));
      
      for (const issue of group.issues) {
        const defaultFlag = issue.defaulted ? ' (defaulted)' : '';
        console.log(`   ${issue.key}: ${issue.storyPoints} points${defaultFlag} - ${issue.summary.substring(0, 60)}`);
      }
    }
  }
  
  return {
    date: new Date().toISOString().split('T')[0],
    sprint: CURRENT_SPRINT,
    project: PROJECT_KEY,
    summary: {
      totalIssues: totalIssues,
      totalStoryPoints: totalPoints,
      byStatus: {
        inDev: {
          count: statusGroups['In Dev'].count,
          points: statusGroups['In Dev'].points
        },
        inReview: {
          count: statusGroups['In Review'].count,
          points: statusGroups['In Review'].points
        },
        inQA: {
          count: statusGroups['In QA'].count,
          points: statusGroups['In QA'].points
        },
        completed: {
          count: statusGroups['Completed'].count,
          points: statusGroups['Completed'].points
        },
        other: {
          count: statusGroups['Other'].count,
          points: statusGroups['Other'].points
        }
      }
    },
    details: {
      inDev: statusGroups['In Dev'].issues.map(i => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        defaulted: i.defaulted
      })),
      inReview: statusGroups['In Review'].issues.map(i => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        defaulted: i.defaulted
      })),
      inQA: statusGroups['In QA'].issues.map(i => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        defaulted: i.defaulted
      })),
      completed: statusGroups['Completed'].issues.map(i => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        defaulted: i.defaulted
      })),
      other: statusGroups['Other'].issues.map(i => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        issueType: i.issueType,
        storyPoints: i.storyPoints,
        defaulted: i.defaulted
      }))
    }
  };
}

// Main execution
async function main() {
  try {
    validateConfig();
    
    console.log('🚀 Starting Story Points by Status Report...\n');
    console.log(`JIRA Instance: ${JIRA_BASE_URL}`);
    console.log(`Project: ${PROJECT_KEY}`);
    console.log(`Sprint: ${CURRENT_SPRINT}`);
    
    const client = createJiraClient();
    const storyPointsFieldId = await getStoryPointsFieldId(client);
    
    const reportData = await generateStatusSnapshot(client, storyPointsFieldId);
    
    if (reportData) {
      // Save to JSON file
      const reportsDir = path.join(__dirname, '..', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const outputFile = path.join(reportsDir, 'points-by-status.json');
      fs.writeFileSync(outputFile, JSON.stringify(reportData, null, 2));
      
      console.log(`\n✅ Report saved to: ${outputFile}`);
    }
    
    console.log('\n✨ Report generation complete!\n');
    
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Run the script
main();

