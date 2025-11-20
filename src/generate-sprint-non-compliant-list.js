const axios = require('axios');

// Configuration
const JIRA_DOMAIN = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const SPRINT_NAME = 'NH Sprint 32';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Disable SSL verification (if needed for corporate proxies)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create axios client
const client = axios.create({
  baseURL: JIRA_DOMAIN,
  headers: {
    'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

/**
 * Get sprint details
 */
async function getSprintDetails() {
  console.log(`\n🔍 Fetching sprint details for ${SPRINT_NAME}...`);
  
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}"`,
      maxResults: 1,
      fields: ['customfield_11150']
    });

    if (response.data.issues.length > 0) {
      const issue = response.data.issues[0];
      const sprintField = issue.fields.customfield_11150;
      
      if (sprintField && Array.isArray(sprintField)) {
        for (const sprint of sprintField) {
          if (sprint.name === SPRINT_NAME) {
            console.log(`   ✓ Sprint ID: ${sprint.id}`);
            console.log(`   ✓ Start Date: ${sprint.startDate}`);
            console.log(`   ✓ End Date: ${sprint.endDate}`);
            console.log(`   ✓ State: ${sprint.state}`);
            return {
              id: sprint.id,
              name: sprint.name,
              startDate: sprint.startDate.split('T')[0],
              endDate: sprint.endDate.split('T')[0],
              state: sprint.state
            };
          }
        }
      }
    }
    
    console.log('   ⚠️  No issues found with this sprint name.');
    console.log('   This could mean the sprint exists but has no issues yet.');
  } catch (error) {
    console.error('Error fetching sprint details:', error.message);
  }
  
  return null;
}

/**
 * Get all issues in the sprint
 */
async function getSprintIssues(sprintId) {
  console.log(`\n📥 Fetching all issues in ${SPRINT_NAME}...`);
  
  const allIssues = [];
  let startAt = 0;
  const maxResults = 100;
  
  try {
    while (true) {
      const response = await client.post('/rest/api/3/search/jql', {
        jql: `project = ${PROJECT_KEY} AND sprint = "${SPRINT_NAME}" AND issuetype in (Story, Bug, Task)`,
        startAt: startAt,
        maxResults: maxResults,
        fields: ['summary', 'issuetype', 'status', 'assignee', 'customfield_10003', 'customfield_12700']
      });

      allIssues.push(...response.data.issues);

      if (response.data.issues.length < maxResults) {
        break;
      }

      startAt += maxResults;
    }

    console.log(`   ✓ Found ${allIssues.length} Stories, Bugs, and Tasks`);
    return allIssues;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log(`   ⚠️  No issues found in sprint (empty sprint)`);
    } else {
      console.error('Error fetching sprint issues:', error.message);
    }
    return [];
  }
}

/**
 * Check issues for compliance
 */
function checkCompliance(issues) {
  const nonCompliant = {
    missingTeam: [],
    missingPoints: [],
    missingBoth: []
  };

  for (const issue of issues) {
    const key = issue.key;
    const fields = issue.fields;
    const issueType = fields.issuetype?.name || 'Unknown';
    const summary = fields.summary || 'No summary';
    const status = fields.status?.name || 'Unknown';
    const assignee = fields.assignee?.displayName || 'Unassigned';
    
    // Story points field: customfield_10003
    const storyPoints = fields.customfield_10003 || 0;
    
    // Team field: customfield_12700
    const team = fields.customfield_12700?.value || null;

    const missingTeam = !team;
    const missingPoints = storyPoints === 0 || storyPoints === null;

    if (missingTeam && missingPoints) {
      nonCompliant.missingBoth.push({
        key,
        issueType,
        summary,
        status,
        assignee,
        storyPoints,
        team: 'Unassigned'
      });
    } else if (missingTeam) {
      nonCompliant.missingTeam.push({
        key,
        issueType,
        summary,
        status,
        assignee,
        storyPoints,
        team: 'Unassigned'
      });
    } else if (missingPoints) {
      nonCompliant.missingPoints.push({
        key,
        issueType,
        summary,
        status,
        assignee,
        storyPoints: 0,
        team
      });
    }
  }

  return nonCompliant;
}

/**
 * Display non-compliant issues
 */
function displayResults(nonCompliant, totalIssues) {
  console.log('\n' + '='.repeat(100));
  console.log('🚨 SPRINT NON-COMPLIANCE REPORT');
  console.log('='.repeat(100));

  const totalNonCompliant = 
    nonCompliant.missingBoth.length + 
    nonCompliant.missingTeam.length + 
    nonCompliant.missingPoints.length;

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Issues in Sprint: ${totalIssues}`);
  console.log(`   Compliant Issues: ${totalIssues - totalNonCompliant} ✅`);
  console.log(`   Non-Compliant Issues: ${totalNonCompliant} ⚠️`);
  console.log(`   Compliance Rate: ${((totalIssues - totalNonCompliant) / totalIssues * 100).toFixed(1)}%`);

  // Missing both team and points (critical)
  if (nonCompliant.missingBoth.length > 0) {
    console.log('\n' + '─'.repeat(100));
    console.log('🔴 CRITICAL: Missing BOTH Team Assignment AND Story Points');
    console.log('─'.repeat(100));
    console.log(`   Count: ${nonCompliant.missingBoth.length} issues\n`);
    
    console.log('   KEY         | TYPE   | POINTS | TEAM       | STATUS          | ASSIGNEE            | SUMMARY');
    console.log('   ' + '─'.repeat(95));
    
    for (const issue of nonCompliant.missingBoth) {
      const keySpc = issue.key.padEnd(11);
      const typeSpc = issue.issueType.padEnd(6);
      const ptsSpc = String(issue.storyPoints || 0).padEnd(6);
      const teamSpc = (issue.team || 'Unassigned').padEnd(10);
      const statusSpc = issue.status.substring(0, 15).padEnd(15);
      const assigneeSpc = issue.assignee.substring(0, 19).padEnd(19);
      const summarySpc = issue.summary.substring(0, 50);
      
      console.log(`   ${keySpc} | ${typeSpc} | ${ptsSpc} | ${teamSpc} | ${statusSpc} | ${assigneeSpc} | ${summarySpc}`);
    }
  }

  // Missing team only
  if (nonCompliant.missingTeam.length > 0) {
    console.log('\n' + '─'.repeat(100));
    console.log('🟡 WARNING: Missing Team Assignment');
    console.log('─'.repeat(100));
    console.log(`   Count: ${nonCompliant.missingTeam.length} issues\n`);
    
    console.log('   KEY         | TYPE   | POINTS | TEAM       | STATUS          | ASSIGNEE            | SUMMARY');
    console.log('   ' + '─'.repeat(95));
    
    for (const issue of nonCompliant.missingTeam) {
      const keySpc = issue.key.padEnd(11);
      const typeSpc = issue.issueType.padEnd(6);
      const ptsSpc = String(issue.storyPoints || 0).padEnd(6);
      const teamSpc = 'Unassigned'.padEnd(10);
      const statusSpc = issue.status.substring(0, 15).padEnd(15);
      const assigneeSpc = issue.assignee.substring(0, 19).padEnd(19);
      const summarySpc = issue.summary.substring(0, 50);
      
      console.log(`   ${keySpc} | ${typeSpc} | ${ptsSpc} | ${teamSpc} | ${statusSpc} | ${assigneeSpc} | ${summarySpc}`);
    }
  }

  // Missing points only
  if (nonCompliant.missingPoints.length > 0) {
    console.log('\n' + '─'.repeat(100));
    console.log('🟡 WARNING: Missing Story Points');
    console.log('─'.repeat(100));
    console.log(`   Count: ${nonCompliant.missingPoints.length} issues\n`);
    
    console.log('   KEY         | TYPE   | POINTS | TEAM       | STATUS          | ASSIGNEE            | SUMMARY');
    console.log('   ' + '─'.repeat(95));
    
    for (const issue of nonCompliant.missingPoints) {
      const keySpc = issue.key.padEnd(11);
      const typeSpc = issue.issueType.padEnd(6);
      const ptsSpc = '0'.padEnd(6);
      const teamSpc = issue.team.substring(0, 10).padEnd(10);
      const statusSpc = issue.status.substring(0, 15).padEnd(15);
      const assigneeSpc = issue.assignee.substring(0, 19).padEnd(19);
      const summarySpc = issue.summary.substring(0, 50);
      
      console.log(`   ${keySpc} | ${typeSpc} | ${ptsSpc} | ${teamSpc} | ${statusSpc} | ${assigneeSpc} | ${summarySpc}`);
    }
  }

  if (totalNonCompliant === 0) {
    console.log('\n🎉 EXCELLENT! All issues in the sprint are compliant!');
    console.log('   ✅ All issues have team assignments');
    console.log('   ✅ All issues have story points');
  }

  console.log('\n' + '='.repeat(100));
}

/**
 * Save results to JSON
 */
function saveResults(nonCompliant, totalIssues, sprintDetails) {
  const fs = require('fs');
  const path = require('path');

  const report = {
    generatedAt: new Date().toISOString(),
    sprint: sprintDetails,
    summary: {
      totalIssues,
      compliantIssues: totalIssues - (
        nonCompliant.missingBoth.length + 
        nonCompliant.missingTeam.length + 
        nonCompliant.missingPoints.length
      ),
      nonCompliantIssues: 
        nonCompliant.missingBoth.length + 
        nonCompliant.missingTeam.length + 
        nonCompliant.missingPoints.length,
      complianceRate: ((totalIssues - (
        nonCompliant.missingBoth.length + 
        nonCompliant.missingTeam.length + 
        nonCompliant.missingPoints.length
      )) / totalIssues * 100).toFixed(1) + '%'
    },
    nonCompliantIssues: nonCompliant
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = path.join(reportsDir, `sprint-non-compliant-${sprintDetails.name.replace(/ /g, '-')}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));

  console.log(`\n✅ Report saved to: ${filename}`);
}

/**
 * Main function
 */
async function main() {
  console.log('\n🚀 Sprint Non-Compliance Check');
  console.log('='.repeat(100));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Sprint: ${SPRINT_NAME}`);
  console.log(`   JIRA Instance: ${JIRA_DOMAIN}`);

  // Get sprint details
  const sprintDetails = await getSprintDetails();
  if (!sprintDetails) {
    console.error('❌ Could not fetch sprint details. Exiting.');
    return;
  }

  // Get all issues in sprint
  const issues = await getSprintIssues(sprintDetails.id);
  if (issues.length === 0) {
    console.log('\n⚠️  No issues found in sprint.');
    return;
  }

  // Check compliance
  const nonCompliant = checkCompliance(issues);

  // Display results
  displayResults(nonCompliant, issues.length);

  // Save to JSON
  saveResults(nonCompliant, issues.length, sprintDetails);

  console.log('\n🎉 Done!\n');
}

// Run the script
main().catch(error => {
  console.error('❌ Error running script:', error.message);
  process.exit(1);
});

