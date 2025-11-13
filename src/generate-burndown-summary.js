const axios = require('axios');
const fs = require('fs');
const path = require('path');

// JIRA Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const SPRINT_NAME = 'NH Sprint 31';
const STORY_POINTS_FIELD = 'customfield_10003';
const SPRINT_FIELD = 'customfield_11150';

// Disable SSL verification (for development)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create axios client
const client = axios.create({
  baseURL: JIRA_BASE_URL,
  auth: {
    username: JIRA_EMAIL,
    password: JIRA_API_TOKEN
  },
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

/**
 * Get sprint details from any issue in the sprint
 */
async function getSprintDetails() {
  console.log(`\n🔍 Fetching sprint details for ${SPRINT_NAME}...`);
  
  try {
    // Search for issues in the sprint
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}"`,
      maxResults: 1
    });
    
    if (response.data.issues && response.data.issues.length > 0) {
      const issueKey = response.data.issues[0].key || response.data.issues[0].id;
      
      // Get issue details with sprint field
      const issueDetail = await client.get(`/rest/api/3/issue/${issueKey}`, {
        params: {
          fields: SPRINT_FIELD
        }
      });
      
      const sprintField = issueDetail.data.fields[SPRINT_FIELD];
      if (sprintField && sprintField.length > 0) {
        // Find the matching sprint
        for (const sprint of sprintField) {
          if (sprint.name === SPRINT_NAME) {
            console.log(`   ✓ Sprint ID: ${sprint.id}`);
            console.log(`   ✓ Start Date: ${sprint.startDate}`);
            console.log(`   ✓ End Date: ${sprint.endDate}`);
            console.log(`   ✓ State: ${sprint.state}`);
            return sprint;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching sprint details:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  return null;
}

/**
 * Fetch all issues in the sprint with full history
 */
async function fetchSprintIssues(sprintStartDate) {
  console.log(`\n📥 Fetching all issues in ${SPRINT_NAME}...`);
  
  try {
    // First get all issue keys
    const searchResponse = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype in (Story, Bug)`,
      maxResults: 1000
    });
    
    console.log(`   ✓ Found ${searchResponse.data.total || 0} issues in sprint`);
    
    const issues = [];
    
    // Fetch each issue with changelog
    for (const issueRef of searchResponse.data.issues || []) {
      const key = issueRef.key || issueRef.id;
      
      try {
        const issueResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: `key,summary,issuetype,status,${STORY_POINTS_FIELD},created`,
            expand: 'changelog'
          }
        });
        
        const issue = issueResponse.data;
        const fields = issue.fields;
        
        // Analyze when issue was added to sprint
        const sprintAddedDate = analyzeSprintAddition(issue.changelog, SPRINT_FIELD, SPRINT_NAME, fields.created);
        
        // Analyze story point changes
        const storyPointHistory = analyzeStoryPointChanges(issue.changelog, STORY_POINTS_FIELD);
        
        const storyPoints = fields[STORY_POINTS_FIELD] || 0;
        const issueType = fields.issuetype?.name || 'Unknown';
        
        // Default to 2 points for Stories/Bugs without story points
        const finalStoryPoints = (issueType === 'Story' || issueType === 'Bug') && storyPoints === 0 ? 2 : storyPoints;
        
        issues.push({
          key: issue.key,
          summary: fields.summary,
          issueType: issueType,
          status: fields.status?.name || 'Unknown',
          storyPoints: finalStoryPoints,
          created: fields.created,
          addedToSprint: sprintAddedDate,
          addedAfterStart: sprintAddedDate && sprintStartDate && new Date(sprintAddedDate) > new Date(sprintStartDate),
          storyPointHistory: storyPointHistory
        });
        
      } catch (issueError) {
        console.error(`   ✗ Error fetching ${key}:`, issueError.message);
      }
    }
    
    return issues;
    
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    return [];
  }
}

/**
 * Analyze when issue was added to sprint
 */
function analyzeSprintAddition(changelog, sprintFieldId, sprintName, createdDate) {
  if (!changelog || !changelog.histories) {
    return createdDate; // If no changelog, assume added at creation
  }
  
  for (const history of changelog.histories) {
    for (const item of history.items || []) {
      if (item.field === 'Sprint' || item.fieldId === sprintFieldId) {
        // Check if this sprint was added
        const toString = item.toString || '';
        if (toString.includes(sprintName)) {
          return history.created;
        }
      }
    }
  }
  
  return createdDate; // Default to creation date if not found in changelog
}

/**
 * Analyze story point changes over time
 */
function analyzeStoryPointChanges(changelog, storyPointsFieldId) {
  const changes = [];
  
  if (!changelog || !changelog.histories) {
    return changes;
  }
  
  for (const history of changelog.histories) {
    for (const item of history.items || []) {
      if (item.field === 'Story Points' || item.fieldId === storyPointsFieldId) {
        changes.push({
          date: history.created,
          from: item.fromString || '0',
          to: item.toString || '0',
          author: history.author?.displayName || 'Unknown'
        });
      }
    }
  }
  
  return changes;
}

/**
 * Calculate scope changes and statistics
 */
function calculateScopeChanges(issues, sprintStartDate) {
  console.log('\n📊 Analyzing scope changes...');
  
  const sprintStart = new Date(sprintStartDate);
  
  const initialScope = [];
  const addedScope = [];
  const storyPointIncreases = [];
  
  for (const issue of issues) {
    const addedDate = new Date(issue.addedToSprint);
    
    if (addedDate <= sprintStart) {
      initialScope.push(issue);
    } else {
      addedScope.push(issue);
    }
    
    // Check for story point increases
    if (issue.storyPointHistory && issue.storyPointHistory.length > 0) {
      for (const change of issue.storyPointHistory) {
        const changeDate = new Date(change.date);
        if (changeDate >= sprintStart) {
          const fromPoints = parseFloat(change.from) || 0;
          const toPoints = parseFloat(change.to) || 0;
          const increase = toPoints - fromPoints;
          
          if (increase > 0) {
            storyPointIncreases.push({
              issue: issue.key,
              summary: issue.summary,
              date: change.date,
              from: fromPoints,
              to: toPoints,
              increase: increase,
              author: change.author
            });
          }
        }
      }
    }
  }
  
  // Calculate totals
  const initialPoints = initialScope.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const addedPoints = addedScope.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const increasedPoints = storyPointIncreases.reduce((sum, change) => sum + change.increase, 0);
  
  const completedIssues = issues.filter(issue => 
    issue.status === 'READY FOR RELEASE' || issue.status === 'CLOSED'
  );
  const completedPoints = completedIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  
  const remainingIssues = issues.filter(issue => 
    issue.status !== 'READY FOR RELEASE' && issue.status !== 'CLOSED'
  );
  const remainingPoints = remainingIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  
  return {
    initialScope,
    initialPoints,
    addedScope,
    addedPoints,
    storyPointIncreases,
    increasedPoints,
    totalCurrentPoints: initialPoints + addedPoints + increasedPoints,
    completedIssues,
    completedPoints,
    remainingIssues,
    remainingPoints
  };
}

/**
 * Generate report
 */
async function generateReport() {
  console.log('\n🚀 Starting Burndown & Scope Analysis...');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${SPRINT_NAME}`);
  console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);
  console.log('============================================================');
  
  // Get sprint details
  const sprint = await getSprintDetails();
  if (!sprint) {
    console.error('\n❌ Could not fetch sprint details');
    return;
  }
  
  // Fetch all issues
  const issues = await fetchSprintIssues(sprint.startDate);
  
  if (issues.length === 0) {
    console.error('\n❌ No issues found in sprint');
    return;
  }
  
  // Calculate scope changes
  const analysis = calculateScopeChanges(issues, sprint.startDate);
  
  // Display summary
  console.log('\n\n');
  console.log('='.repeat(100));
  console.log('📊 BURNDOWN & SCOPE SUMMARY');
  console.log('='.repeat(100));
  
  console.log('\n📦 INITIAL SCOPE (at sprint start):');
  console.log(`   Issues: ${analysis.initialScope.length}`);
  console.log(`   Story Points: ${analysis.initialPoints}`);
  
  console.log('\n➕ SCOPE ADDED (mid-sprint):');
  console.log(`   Issues Added: ${analysis.addedScope.length}`);
  console.log(`   Story Points Added: ${analysis.addedPoints}`);
  
  if (analysis.addedScope.length > 0) {
    console.log('\n   Detailed list of issues added mid-sprint:');
    console.log('   ' + '-'.repeat(95));
    console.log('   KEY         | PTS | DATE       | TYPE   | STATUS          | SUMMARY');
    console.log('   ' + '-'.repeat(95));
    analysis.addedScope
      .sort((a, b) => new Date(a.addedToSprint) - new Date(b.addedToSprint))
      .forEach(issue => {
        const addedDate = new Date(issue.addedToSprint).toISOString().split('T')[0];
        const key = issue.key.padEnd(11);
        const pts = String(issue.storyPoints).padStart(3);
        const type = issue.issueType.substring(0, 6).padEnd(6);
        const status = issue.status.substring(0, 15).padEnd(15);
        const summary = issue.summary.substring(0, 50);
        console.log(`   ${key} | ${pts} | ${addedDate} | ${type} | ${status} | ${summary}`);
      });
    console.log('   ' + '-'.repeat(95));
  }
  
  console.log('\n📈 STORY POINT INCREASES:');
  console.log(`   Total Increases: ${analysis.increasedPoints} points`);
  console.log(`   Number of Changes: ${analysis.storyPointIncreases.length}`);
  
  if (analysis.storyPointIncreases.length > 0) {
    console.log('\n   Story point increases:');
    analysis.storyPointIncreases
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(change => {
        const changeDate = new Date(change.date).toISOString().split('T')[0];
        console.log(`   • ${change.issue}: ${change.from} → ${change.to} pts (+${change.increase}) - ${changeDate} - ${change.author}`);
        console.log(`     ${change.summary.substring(0, 80)}...`);
      });
  }
  
  console.log('\n📊 CURRENT STATUS:');
  console.log(`   Total Sprint Scope: ${analysis.totalCurrentPoints} points`);
  console.log(`   Completed: ${analysis.completedPoints} points (${analysis.completedIssues.length} issues)`);
  console.log(`   Remaining: ${analysis.remainingPoints} points (${analysis.remainingIssues.length} issues)`);
  console.log(`   Progress: ${Math.round((analysis.completedPoints / analysis.totalCurrentPoints) * 100)}%`);
  
  console.log('\n⚠️  SCOPE CHANGE IMPACT:');
  const scopeIncrease = analysis.addedPoints + analysis.increasedPoints;
  console.log(`   Initial Sprint Scope: ${analysis.initialPoints} points`);
  console.log(`   Scope Added Mid-Sprint: ${scopeIncrease} points (+${Math.round((scopeIncrease / analysis.initialPoints) * 100)}%)`);
  console.log(`   Current Sprint Scope: ${analysis.totalCurrentPoints} points`);
  
  const expectedCompleted = Math.round(analysis.initialPoints * 0.57); // 57% through sprint
  console.log(`\n⏰ TIME-BASED ANALYSIS (57% through sprint):`);
  console.log(`   Expected Completed (if no scope change): ${expectedCompleted} points`);
  console.log(`   Actual Completed: ${analysis.completedPoints} points`);
  console.log(`   Variance: ${analysis.completedPoints - expectedCompleted} points`);
  
  // Save to JSON
  const reportData = {
    date: new Date().toISOString().split('T')[0],
    sprint: {
      name: SPRINT_NAME,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      state: sprint.state
    },
    summary: {
      initialScope: analysis.initialPoints,
      addedScope: analysis.addedPoints,
      increasedPoints: analysis.increasedPoints,
      totalScope: analysis.totalCurrentPoints,
      completed: analysis.completedPoints,
      remaining: analysis.remainingPoints,
      scopeIncreasePercentage: Math.round((scopeIncrease / analysis.initialPoints) * 100)
    },
    addedIssues: analysis.addedScope
      .sort((a, b) => new Date(a.addedToSprint) - new Date(b.addedToSprint))
      .map(issue => ({
        key: issue.key,
        summary: issue.summary,
        storyPoints: issue.storyPoints,
        addedDate: issue.addedToSprint,
        issueType: issue.issueType,
        status: issue.status,
        created: issue.created
      })),
    storyPointIncreases: analysis.storyPointIncreases,
    remainingIssues: analysis.remainingIssues.map(issue => ({
      key: issue.key,
      summary: issue.summary,
      storyPoints: issue.storyPoints,
      status: issue.status,
      issueType: issue.issueType
    }))
  };
  
  const outputPath = path.join(__dirname, '..', 'reports', 'burndown-summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  
  console.log(`\n✅ Report saved to: ${outputPath}`);
  console.log('\n🎉 Analysis complete!\n');
}

// Main execution
generateReport().catch(error => {
  console.error('\n❌ Error generating report:', error.message);
  process.exit(1);
});
