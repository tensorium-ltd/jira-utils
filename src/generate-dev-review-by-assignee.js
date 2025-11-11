const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 31'; // Update this for each sprint
const TARGET_STATUSES = ['In Dev', 'In Review', 'Ready for Review', 'READY FOR REVIEW'];

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
  // Disable SSL verification for development
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
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
      field.name && field.name.toLowerCase().includes('story points')
    );
    
    return {
      storyPoints: storyPointsField ? storyPointsField.id : 'customfield_10003'
    };
  } catch (error) {
    console.error('Error fetching custom fields:', error.message);
    return {
      storyPoints: 'customfield_10003' // Default
    };
  }
}

// Fetch issues in Dev/Review for current sprint
async function fetchDevReviewIssues(client, fieldIds) {
  try {
    const statusList = TARGET_STATUSES.map(s => `"${s}"`).join(', ');
    const jql = `project = ${PROJECT_KEY} AND sprint = "${CURRENT_SPRINT}" AND issuetype in (Story, Bug) AND status in (${statusList})`;
    
    console.log(`   JQL: ${jql}\n`);
    
    // Step 1: Get all issue keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const issueRefs = response.data.issues || [];
    console.log(`   ✓ Found ${issueRefs.length} issues in Dev/Review\n`);
    
    if (issueRefs.length === 0) {
      return [];
    }
    
    // Step 2: Fetch each issue with full details
    const issues = [];
    for (const issueRef of issueRefs) {
      const issueKey = issueRef.key || issueRef.id || (issueRef.fields && issueRef.fields.key);
      
      if (!issueKey) {
        console.log(`   ⚠️  Skipping issue with no key. Available keys:`, Object.keys(issueRef));
        continue;
      }
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
          params: {
            fields: `summary,status,issuetype,assignee,${fieldIds.storyPoints}`
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields;
        
        const issueType = fields.issuetype?.name || 'Unknown';
        const status = fields.status?.name || 'Unknown';
        const assignee = fields.assignee?.displayName || 'Unassigned';
        const assigneeEmail = fields.assignee?.emailAddress || null;
        const assigneeAccountId = fields.assignee?.accountId || null;
        
        let storyPoints = fields[fieldIds.storyPoints] || 0;
        
        // Default to 2 points for Stories/Bugs without points
        let defaulted = false;
        if ((issueType === 'Story' || issueType === 'Bug') && storyPoints === 0) {
          storyPoints = 2;
          defaulted = true;
        }
        
        issues.push({
          key: issue.key,
          summary: fields.summary,
          issueType,
          status,
          assignee,
          assigneeEmail,
          assigneeAccountId,
          storyPoints,
          defaulted
        });
        
        const pointsStr = defaulted ? `${storyPoints} pts (defaulted)` : `${storyPoints} pts`;
        console.log(`   ✓ ${issue.key}: ${issueType} - ${pointsStr} - ${status} - ${assignee}`);
        
      } catch (error) {
        console.error(`   ⚠️  Error fetching ${issueKey}: ${error.message}`);
      }
    }
    
    return issues;
  } catch (error) {
    console.error('Error fetching issues:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Group issues by assignee
function groupByAssignee(issues) {
  const assigneeMap = {};
  
  for (const issue of issues) {
    const assignee = issue.assignee;
    
    if (!assigneeMap[assignee]) {
      assigneeMap[assignee] = {
        name: assignee,
        email: issue.assigneeEmail,
        accountId: issue.assigneeAccountId,
        issues: [],
        totalPoints: 0,
        inDev: { count: 0, points: 0, issues: [] },
        inReview: { count: 0, points: 0, issues: [] }
      };
    }
    
    assigneeMap[assignee].issues.push(issue);
    assigneeMap[assignee].totalPoints += issue.storyPoints;
    
    // Categorize by status
    const statusLower = issue.status.toLowerCase();
    if (statusLower === 'in dev') {
      assigneeMap[assignee].inDev.count++;
      assigneeMap[assignee].inDev.points += issue.storyPoints;
      assigneeMap[assignee].inDev.issues.push(issue);
    } else if (statusLower === 'in review' || statusLower === 'ready for review') {
      assigneeMap[assignee].inReview.count++;
      assigneeMap[assignee].inReview.points += issue.storyPoints;
      assigneeMap[assignee].inReview.issues.push(issue);
    }
  }
  
  // Convert to array and sort by total points descending
  const assignees = Object.values(assigneeMap).sort((a, b) => b.totalPoints - a.totalPoints);
  
  return assignees;
}

// Main function
async function main() {
  console.log('📊 Current Sprint Dev/Review Report by Assignee\n');
  console.log('============================================================');
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Statuses: ${TARGET_STATUSES.join(', ')}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}\n`);
  
  // Validate config
  validateConfig();
  
  // Create JIRA client
  const client = createJiraClient();
  
  // Get custom field IDs
  console.log('🔍 Discovering custom fields...');
  const fieldIds = await getCustomFieldIds(client);
  console.log(`   ✓ Story Points field: ${fieldIds.storyPoints}\n`);
  
  // Fetch issues
  console.log('🔎 Fetching issues in Dev/Review...');
  const issues = await fetchDevReviewIssues(client, fieldIds);
  
  // Group by assignee
  const assignees = groupByAssignee(issues);
  
  // Print summary
  console.log('\n============================================================');
  console.log('📈 SUMMARY BY STATUS:\n');
  
  const totalIssues = issues.length;
  const totalPoints = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  
  console.log(`   Total Issues in Dev/Review: ${totalIssues}`);
  console.log(`   Total Story Points: ${totalPoints}\n`);
  
  // Group by status
  const inDevIssues = issues.filter(i => i.status === 'In Dev');
  const inReviewIssues = issues.filter(i => {
    const status = i.status.toLowerCase();
    return status === 'in review' || status === 'ready for review';
  });
  
  const inDevPoints = inDevIssues.reduce((sum, i) => sum + i.storyPoints, 0);
  const inReviewPoints = inReviewIssues.reduce((sum, i) => sum + i.storyPoints, 0);
  
  // IN DEV Section
  console.log('\n' + '='.repeat(60));
  console.log('💻 IN DEV');
  console.log('='.repeat(60));
  console.log(`   Total: ${inDevIssues.length} issues, ${inDevPoints} points\n`);
  
  // Group In Dev by assignee
  const inDevByAssignee = {};
  for (const issue of inDevIssues) {
    if (!inDevByAssignee[issue.assignee]) {
      inDevByAssignee[issue.assignee] = [];
    }
    inDevByAssignee[issue.assignee].push(issue);
  }
  
  // Sort assignees by points
  const inDevAssignees = Object.entries(inDevByAssignee).map(([name, issues]) => ({
    name,
    issues,
    points: issues.reduce((sum, i) => sum + i.storyPoints, 0)
  })).sort((a, b) => b.points - a.points);
  
  for (const assignee of inDevAssignees) {
    console.log(`👤 ${assignee.name} - ${assignee.issues.length} issues (${assignee.points} pts)`);
    for (const issue of assignee.issues) {
      const pointsStr = issue.defaulted ? `${issue.storyPoints} pts*` : `${issue.storyPoints} pts`;
      console.log(`   - ${issue.key}: ${issue.summary.substring(0, 70)}... (${pointsStr})`);
    }
    console.log();
  }
  
  // IN REVIEW Section
  console.log('\n' + '='.repeat(60));
  console.log('🔍 IN REVIEW / READY FOR REVIEW');
  console.log('='.repeat(60));
  console.log(`   Total: ${inReviewIssues.length} issues, ${inReviewPoints} points\n`);
  
  // Group In Review by assignee
  const inReviewByAssignee = {};
  for (const issue of inReviewIssues) {
    if (!inReviewByAssignee[issue.assignee]) {
      inReviewByAssignee[issue.assignee] = [];
    }
    inReviewByAssignee[issue.assignee].push(issue);
  }
  
  // Sort assignees by points
  const inReviewAssignees = Object.entries(inReviewByAssignee).map(([name, issues]) => ({
    name,
    issues,
    points: issues.reduce((sum, i) => sum + i.storyPoints, 0)
  })).sort((a, b) => b.points - a.points);
  
  for (const assignee of inReviewAssignees) {
    console.log(`👤 ${assignee.name} - ${assignee.issues.length} issues (${assignee.points} pts)`);
    for (const issue of assignee.issues) {
      const pointsStr = issue.defaulted ? `${issue.storyPoints} pts*` : `${issue.storyPoints} pts`;
      console.log(`   - ${issue.key}: ${issue.summary.substring(0, 70)}... (${pointsStr})`);
    }
    console.log();
  }
  
  // Save to JSON
  const reportData = {
    sprint: CURRENT_SPRINT,
    project: PROJECT_KEY,
    generatedAt: new Date().toISOString(),
    statuses: TARGET_STATUSES,
    summary: {
      totalIssues,
      totalPoints,
      assigneeCount: assignees.length,
      inDev: {
        issues: inDevIssues.length,
        points: inDevPoints
      },
      inReview: {
        issues: inReviewIssues.length,
        points: inReviewPoints
      }
    },
    byStatus: {
      inDev: inDevAssignees,
      inReview: inReviewAssignees
    },
    byAssignee: assignees
  };
  
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputFile = path.join(reportsDir, 'dev-review-by-assignee.json');
  fs.writeFileSync(outputFile, JSON.stringify(reportData, null, 2));
  
  console.log(`\n✅ Report saved to: ${outputFile}`);
  console.log('\n🎉 Done!\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});

