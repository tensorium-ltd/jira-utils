const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31'; // Update this for each sprint
const STALE_THRESHOLD_HOURS = 24;

// Completed statuses to exclude
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

// Format duration in human-readable format
function formatDuration(hours) {
  if (hours < 24) {
    return `${Math.round(hours)} hours`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days} days`;
  }
  return `${days} days ${remainingHours} hours`;
}

// Get the last status change time from issue changelog
async function getLastStatusChangeTime(client, issueKey) {
  try {
    const response = await client.get(`/rest/api/3/issue/${issueKey}/changelog`);
    const changelog = response.data.values || [];
    
    // Find the most recent status change
    let lastStatusChange = null;
    
    for (const historyItem of changelog) {
      const items = historyItem.items || [];
      const statusChange = items.find(item => item.field === 'status');
      
      if (statusChange) {
        const changeDate = new Date(historyItem.created);
        if (!lastStatusChange || changeDate > lastStatusChange) {
          lastStatusChange = changeDate;
        }
      }
    }
    
    return lastStatusChange;
    
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch changelog for ${issueKey}: ${error.message}`);
    return null;
  }
}

// Fetch all active issues and their time in current status
async function fetchStaleIssues(client, fieldIds) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Story, Bug) AND status NOT IN ("${COMPLETED_STATUSES.join('", "')}")`;
  
  console.log(`\n🔎 Querying Active Issues...`);
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   JQL: ${jql}`);
  
  try {
    // Step 1: Get all issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} active issues`);
    
    if (issueRefs.length === 0) {
      return {
        issues: [],
        totalIssues: 0,
        staleIssues: 0
      };
    }
    
    console.log(`\n📊 Analyzing status change history...`);
    
    // Step 2: Fetch each issue individually with details and changelog
    const issues = [];
    const now = new Date();
    
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,assignee,priority,${fieldIds.storyPoints}`
          }
        });
        
        const issue = issueResponse.data;
        const actualKey = issue.key;
        const fields = issue.fields || {};
        let storyPoints = fields[fieldIds.storyPoints] || 0;
        const issueType = fields.issuetype?.name || 'Unknown';
        const summary = fields.summary || '';
        const status = fields.status?.name || 'Unknown';
        const priority = fields.priority?.name || 'None';
        const assignee = fields.assignee ? fields.assignee.displayName : 'Unassigned';
        
        // Default to 2 points for Stories or Bugs without points
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
        }
        
        // Get last status change time
        const lastStatusChange = await getLastStatusChangeTime(client, actualKey);
        
        let hoursInStatus = null;
        let isStale = false;
        
        if (lastStatusChange) {
          hoursInStatus = (now - lastStatusChange) / (1000 * 60 * 60);
          isStale = hoursInStatus > STALE_THRESHOLD_HOURS;
        } else {
          // If no status changes found, use creation date as fallback
          isStale = true; // Assume stale if we can't determine
          hoursInStatus = null;
        }
        
        issues.push({
          key: actualKey,
          summary: summary,
          issueType: issueType,
          status: status,
          storyPoints: storyPoints,
          priority: priority,
          assignee: assignee,
          lastStatusChange: lastStatusChange,
          hoursInStatus: hoursInStatus,
          isStale: isStale
        });
        
        if (isStale) {
          const duration = hoursInStatus ? formatDuration(hoursInStatus) : 'Unknown';
          console.log(`   ⚠️  ${actualKey}: ${status} for ${duration}`);
        }
        
      } catch (err) {
        console.warn(`   ⚠️  Could not fetch ${issueKey}: ${err.message}`);
      }
    }
    
    // Filter and sort stale issues
    const staleIssues = issues
      .filter(issue => issue.isStale)
      .sort((a, b) => (b.hoursInStatus || 0) - (a.hoursInStatus || 0));
    
    console.log(`\n   ✓ Found ${staleIssues.length} stale issues (${STALE_THRESHOLD_HOURS}+ hours in status)`);
    
    return {
      issues: staleIssues,
      allIssues: issues,
      totalIssues: issues.length,
      staleIssues: staleIssues.length
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
    console.log('\n📊 Generating Time in Status Report');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Sprint: ${CURRENT_SPRINT}`);
    console.log(`   Stale Threshold: ${STALE_THRESHOLD_HOURS} hours`);
    
    validateConfig();
    
    const client = createJiraClient();
    
    console.log('\n🔍 Discovering custom fields...');
    const fieldIds = await getCustomFieldIds(client);
    console.log(`   ✓ Story Points field: ${fieldIds.storyPoints}`);
    
    // Fetch stale issues
    const data = await fetchStaleIssues(client, fieldIds);
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY - Stale Issues (24+ hours in status):');
    console.log(`   Total Active Issues: ${data.totalIssues}`);
    console.log(`   Stale Issues: ${data.staleIssues}`);
    
    if (data.staleIssues > 0) {
      console.log('\n📋 STALE ISSUES (sorted by longest time):');
      console.log('='.repeat(60));
      
      data.issues.forEach((issue, index) => {
        const duration = issue.hoursInStatus ? formatDuration(issue.hoursInStatus) : 'Unknown';
        console.log(`\n${index + 1}. ${issue.key} - ${issue.status}`);
        console.log(`   Summary: ${issue.summary}`);
        console.log(`   Time in Status: ${duration}`);
        console.log(`   Assignee: ${issue.assignee}`);
        console.log(`   Type: ${issue.issueType} | Priority: ${issue.priority} | Points: ${issue.storyPoints}`);
      });
    }
    
    // Group by status
    const statusMap = {};
    data.issues.forEach(issue => {
      if (!statusMap[issue.status]) {
        statusMap[issue.status] = {
          count: 0,
          issues: []
        };
      }
      statusMap[issue.status].count++;
      statusMap[issue.status].issues.push(issue);
    });
    
    if (Object.keys(statusMap).length > 0) {
      console.log('\n\n📊 By Status:');
      Object.entries(statusMap).sort((a, b) => b[1].count - a[1].count).forEach(([status, data]) => {
        console.log(`   ${status}: ${data.count} issues`);
      });
    }
    
    // Group by assignee
    const assigneeMap = {};
    data.issues.forEach(issue => {
      if (!assigneeMap[issue.assignee]) {
        assigneeMap[issue.assignee] = {
          count: 0,
          issues: []
        };
      }
      assigneeMap[issue.assignee].count++;
      assigneeMap[issue.assignee].issues.push(issue);
    });
    
    if (Object.keys(assigneeMap).length > 0) {
      console.log('\n📊 By Assignee:');
      Object.entries(assigneeMap).sort((a, b) => b[1].count - a[1].count).forEach(([assignee, data]) => {
        console.log(`   ${assignee}: ${data.count} issues`);
      });
    }
    
    // Save to JSON
    const today = new Date().toISOString().split('T')[0];
    const outputDir = path.join(__dirname, '..', 'reports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const sprintNumber = CURRENT_SPRINT.match(/\d+/)?.[0] || 'unknown';
    const outputFile = path.join(outputDir, `time-in-status-sprint-${sprintNumber}.json`);
    
    const output = {
      generatedAt: new Date().toISOString(),
      date: today,
      project: PROJECT_KEY,
      sprint: CURRENT_SPRINT,
      staleThresholdHours: STALE_THRESHOLD_HOURS,
      summary: {
        totalActiveIssues: data.totalIssues,
        staleIssues: data.staleIssues,
        byStatus: statusMap,
        byAssignee: assigneeMap
      },
      staleIssues: data.issues,
      allActiveIssues: data.allIssues
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


