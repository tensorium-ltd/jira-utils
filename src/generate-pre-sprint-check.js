#!/usr/bin/env node

/**
 * Pre-Sprint Readiness Check
 * 
 * Validates that tickets in a sprint meet quality criteria:
 * - Stories have story points
 * - Issues have Fix Version "Release 2A"
 * - Epics and Stories have FR mappings
 * 
 * Usage: node src/generate-pre-sprint-check.js [sprint-name]
 * Example: node src/generate-pre-sprint-check.js "NH Sprint 35"
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';

// Custom field IDs
const STORY_POINTS_FIELD = 'customfield_10003';
const FR_REFERENCE_FIELD = 'customfield_13542';
const SPRINT_FIELD = 'customfield_11150';

// Default sprint if not specified
const DEFAULT_SPRINT = 'NH Sprint 35';

// Fix version to check for
const REQUIRED_FIX_VERSION = 'Release 2A';

// Disable SSL verification (for corporate proxies)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Creates an authenticated Jira API client
 */
function createJiraClient() {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    console.error('❌ Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
    process.exit(1);
  }

  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

/**
 * Fetch all issues in a sprint with pagination
 */
async function fetchSprintIssues(client, sprintName) {
  console.log(`   Fetching issues for sprint: "${sprintName}"`);
  
  let allIssueKeys = [];
  let nextPageToken = null;
  
  const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND issuetype in (Epic, Story, Bug) ORDER BY issuetype ASC, key ASC`;
  
  do {
    const body = {
      jql: jql,
      maxResults: 100,
      fields: ['key']
    };
    
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    
    const response = await client.post('/rest/api/3/search/jql', body);
    const issues = response.data.issues || [];
    allIssueKeys = allIssueKeys.concat(issues.map(i => i.key));
    
    nextPageToken = response.data.nextPageToken || null;
    
    console.log(`   Fetched ${allIssueKeys.length} issue keys${nextPageToken ? ' (more pages...)' : ''}`);
    
    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);
  
  return allIssueKeys;
}

/**
 * Fetch full details for an issue
 */
async function fetchIssueDetails(client, issueKey) {
  const fields = [
    'key',
    'summary',
    'issuetype',
    'status',
    STORY_POINTS_FIELD,
    FR_REFERENCE_FIELD,
    'fixVersions'
  ].join(',');
  
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: { fields }
  });
  
  return response.data;
}

/**
 * Check if issue has story points
 */
function hasStoryPoints(issue) {
  const points = issue.fields[STORY_POINTS_FIELD];
  return points !== null && points !== undefined && points > 0;
}

/**
 * Check if issue has the required fix version
 */
function hasFixVersion(issue) {
  const fixVersions = issue.fields.fixVersions || [];
  return fixVersions.some(v => v.name === REQUIRED_FIX_VERSION);
}

/**
 * Check if issue has FR mappings
 */
function hasFRMappings(issue) {
  const frRef = issue.fields[FR_REFERENCE_FIELD];
  if (!frRef) return false;
  if (typeof frRef === 'string') return frRef.trim().length > 0;
  if (Array.isArray(frRef)) return frRef.length > 0;
  return true;
}

/**
 * Generate check mark or cross
 */
function checkMark(passed) {
  return passed ? '✓' : '✗';
}

/**
 * Main function
 */
async function main() {
  // Get sprint name from command line or use default
  const sprintName = process.argv[2] || DEFAULT_SPRINT;
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 PRE-SPRINT READINESS CHECK');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Sprint: ${sprintName}`);
  console.log(`   Checking for Fix Version: ${REQUIRED_FIX_VERSION}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = createJiraClient();

  // Fetch all issues in sprint
  console.log('🔍 Fetching sprint issues...');
  const issueKeys = await fetchSprintIssues(client, sprintName);
  
  if (issueKeys.length === 0) {
    console.log('   ⚠️  No issues found in this sprint');
    return;
  }
  
  console.log(`   ✓ Found ${issueKeys.length} issues\n`);

  // Fetch details for each issue
  console.log('📊 Analyzing issues...\n');
  
  const results = [];
  let processed = 0;
  
  for (const key of issueKeys) {
    try {
      const issue = await fetchIssueDetails(client, key);
      const type = issue.fields.issuetype?.name || 'Unknown';
      const summary = issue.fields.summary || '';
      
      // Determine which checks apply
      const isStory = type === 'Story';
      const isEpicOrStory = type === 'Epic' || type === 'Story';
      
      const result = {
        key,
        type,
        summary: summary.substring(0, 40) + (summary.length > 40 ? '...' : ''),
        storyPoints: {
          applicable: isStory,
          passed: isStory ? hasStoryPoints(issue) : null,
          value: issue.fields[STORY_POINTS_FIELD]
        },
        fixVersion: {
          applicable: true,
          passed: hasFixVersion(issue),
          value: (issue.fields.fixVersions || []).map(v => v.name).join(', ')
        },
        frMappings: {
          applicable: isEpicOrStory,
          passed: isEpicOrStory ? hasFRMappings(issue) : null,
          value: issue.fields[FR_REFERENCE_FIELD]
        }
      };
      
      results.push(result);
      processed++;
      
      // Rate limiting
      if (processed % 10 === 0) {
        process.stdout.write(`   Processed ${processed}/${issueKeys.length} issues\r`);
      }
      
      await new Promise(r => setTimeout(r, 50));
    } catch (error) {
      console.error(`   ⚠️  Error fetching ${key}: ${error.message}`);
    }
  }
  
  console.log(`   ✓ Processed ${processed} issues\n`);

  // Output results table
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('READINESS CHECK RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Issue Key    │ Type   │ Story Pts │ Fix Ver │ FR Map │ Summary');
  console.log('─────────────┼────────┼───────────┼─────────┼────────┼──────────────────────────────────────────────────');

  let totalIssues = 0;
  let storyPointsFails = 0;
  let fixVersionFails = 0;
  let frMappingsFails = 0;

  for (const r of results) {
    totalIssues++;
    
    // Story points check (only for Stories)
    let spCheck = '  N/A  ';
    if (r.storyPoints.applicable) {
      spCheck = r.storyPoints.passed ? `   ✓   ` : `   ✗   `;
      if (!r.storyPoints.passed) storyPointsFails++;
    }
    
    // Fix version check (all types)
    const fvCheck = r.fixVersion.passed ? `   ✓   ` : `   ✗   `;
    if (!r.fixVersion.passed) fixVersionFails++;
    
    // FR Mappings check (Epics and Stories)
    let frCheck = '  N/A  ';
    if (r.frMappings.applicable) {
      frCheck = r.frMappings.passed ? `   ✓   ` : `   ✗   `;
      if (!r.frMappings.passed) frMappingsFails++;
    }
    
    const typeStr = r.type.padEnd(6);
    
    console.log(`${r.key.padEnd(12)} │ ${typeStr} │${spCheck}│${fvCheck}│${frCheck}│ ${r.summary}`);
  }

  console.log('─────────────┴────────┴───────────┴─────────┴────────┴──────────────────────────────────────────────────');
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  const epics = results.filter(r => r.type === 'Epic');
  const stories = results.filter(r => r.type === 'Story');
  const bugs = results.filter(r => r.type === 'Bug');
  
  console.log(`Total Issues: ${totalIssues} (${epics.length} Epics, ${stories.length} Stories, ${bugs.length} Bugs)`);
  console.log('');
  console.log('Check Results:');
  console.log(`  Story Points (Stories only):    ${stories.length - storyPointsFails}/${stories.length} pass  ${storyPointsFails > 0 ? '⚠️  ' + storyPointsFails + ' missing' : '✓ All good'}`);
  console.log(`  Fix Version (${REQUIRED_FIX_VERSION}):     ${totalIssues - fixVersionFails}/${totalIssues} pass  ${fixVersionFails > 0 ? '⚠️  ' + fixVersionFails + ' missing' : '✓ All good'}`);
  console.log(`  FR Mappings (Epics/Stories):    ${(epics.length + stories.length) - frMappingsFails}/${epics.length + stories.length} pass  ${frMappingsFails > 0 ? '⚠️  ' + frMappingsFails + ' missing' : '✓ All good'}`);
  console.log('');

  // List issues with problems
  const problemIssues = results.filter(r => 
    (r.storyPoints.applicable && !r.storyPoints.passed) ||
    !r.fixVersion.passed ||
    (r.frMappings.applicable && !r.frMappings.passed)
  );

  if (problemIssues.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
    console.log('ISSUES REQUIRING ATTENTION');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
    console.log('');
    
    for (const issue of problemIssues) {
      const problems = [];
      if (issue.storyPoints.applicable && !issue.storyPoints.passed) {
        problems.push('Missing Story Points');
      }
      if (!issue.fixVersion.passed) {
        problems.push(`Missing Fix Version "${REQUIRED_FIX_VERSION}"`);
      }
      if (issue.frMappings.applicable && !issue.frMappings.passed) {
        problems.push('Missing FR Mappings');
      }
      
      console.log(`${issue.key} (${issue.type}):`);
      problems.forEach(p => console.log(`  ⚠️  ${p}`));
      console.log('');
    }
  } else {
    console.log('🎉 All issues pass all applicable checks!');
    console.log('');
  }

  // Overall status
  const totalProblems = storyPointsFails + fixVersionFails + frMappingsFails;
  if (totalProblems === 0) {
    console.log('✅ SPRINT READY: All quality criteria met');
  } else {
    console.log(`⚠️  SPRINT NOT READY: ${totalProblems} issues need attention`);
  }
  
  console.log('');

  // Save to markdown file
  const reportLines = [];
  reportLines.push(`# Pre-Sprint Readiness Check: ${sprintName}`);
  reportLines.push('');
  reportLines.push(`**Generated:** ${new Date().toISOString().split('T')[0]}`);
  reportLines.push(`**Fix Version Required:** ${REQUIRED_FIX_VERSION}`);
  reportLines.push('');
  reportLines.push('## Summary');
  reportLines.push('');
  reportLines.push(`| Metric | Pass | Total | Status |`);
  reportLines.push(`|--------|------|-------|--------|`);
  reportLines.push(`| Story Points (Stories) | ${stories.length - storyPointsFails} | ${stories.length} | ${storyPointsFails === 0 ? '✅' : '⚠️ ' + storyPointsFails + ' missing'} |`);
  reportLines.push(`| Fix Version | ${totalIssues - fixVersionFails} | ${totalIssues} | ${fixVersionFails === 0 ? '✅' : '⚠️ ' + fixVersionFails + ' missing'} |`);
  reportLines.push(`| FR Mappings (Epics/Stories) | ${(epics.length + stories.length) - frMappingsFails} | ${epics.length + stories.length} | ${frMappingsFails === 0 ? '✅' : '⚠️ ' + frMappingsFails + ' missing'} |`);
  reportLines.push('');
  reportLines.push('## Results Table');
  reportLines.push('');
  reportLines.push('| Issue | Type | Story Pts | Fix Ver | FR Map | Summary |');
  reportLines.push('|-------|------|-----------|---------|--------|---------|');
  
  for (const r of results) {
    const spCheck = !r.storyPoints.applicable ? 'N/A' : (r.storyPoints.passed ? '✓' : '✗');
    const fvCheck = r.fixVersion.passed ? '✓' : '✗';
    const frCheck = !r.frMappings.applicable ? 'N/A' : (r.frMappings.passed ? '✓' : '✗');
    
    reportLines.push(`| ${r.key} | ${r.type} | ${spCheck} | ${fvCheck} | ${frCheck} | ${r.summary} |`);
  }
  
  reportLines.push('');
  reportLines.push('## Issues Requiring Attention');
  reportLines.push('');
  
  if (problemIssues.length > 0) {
    for (const issue of problemIssues) {
      const problems = [];
      if (issue.storyPoints.applicable && !issue.storyPoints.passed) {
        problems.push('Missing Story Points');
      }
      if (!issue.fixVersion.passed) {
        problems.push(`Missing Fix Version "${REQUIRED_FIX_VERSION}"`);
      }
      if (issue.frMappings.applicable && !issue.frMappings.passed) {
        problems.push('Missing FR Mappings');
      }
      
      reportLines.push(`### ${issue.key} (${issue.type})`);
      problems.forEach(p => reportLines.push(`- ⚠️ ${p}`));
      reportLines.push('');
    }
  } else {
    reportLines.push('🎉 All issues pass all applicable checks!');
  }
  
  // Write report
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, 'pre-sprint-check.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log('');
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.response?.data) {
    console.error('Response:', error.response.data);
  }
  process.exit(1);
});
