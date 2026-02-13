#!/usr/bin/env node

/**
 * Full Project History Report by Components
 * 
 * This script analyzes all completed work in VER10 that is NOT part of
 * Release 1B, 1C, 1D, or 2A, grouped by Components to understand
 * historical work completed before these releases.
 */

const axios = require('axios');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const EXCLUDED_FIX_VERSIONS = ['Release 1B', 'Release 1C', 'Release 1D', 'Release 2A'];
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED', 'Done'];

// Story Points field ID
const STORY_POINTS_FIELD = 'customfield_10003';

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
 * Fetch all completed issues excluding specific fix versions
 */
async function fetchHistoricalIssues(client) {
  console.log(`🔍 Fetching all completed issues in ${PROJECT_KEY}...`);
  console.log(`   Excluding Fix Versions: ${EXCLUDED_FIX_VERSIONS.join(', ')}`);
  
  // Build JQL to get all completed issues
  const statusClause = COMPLETED_STATUSES.map(s => `"${s}"`).join(', ');
  
  const jql = `project = ${PROJECT_KEY} AND status in (${statusClause})`;
  
  console.log(`   JQL: ${jql}`);
  
  let allIssues = [];
  let startAt = 0;
  const maxResults = 100;
  let total = 0;

  // Fetch all issues - the API returns all at once with maxResults parameter
  const response = await client.post('/rest/api/3/search/jql', {
    jql: jql,
    maxResults: 1000  // Fetch up to 1000 issues at once
  });

  const issueRefs = response.data.issues || [];
  total = response.data.total || issueRefs.length;
  
  console.log(`   Found ${issueRefs.length} completed issues`);
  
  // Fetch detailed information for each issue
  for (const issueRef of issueRefs) {
    const issueKey = issueRef.key || issueRef.id;
    
    try {
      const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
        params: {
          fields: `key,summary,status,issuetype,components,fixVersions,${STORY_POINTS_FIELD},created,resolutiondate`
        }
      });
      
      allIssues.push(issueResponse.data);
    } catch (error) {
      console.error(`   Error fetching ${issueKey}:`, error.message);
    }
  }
  
  console.log(`   ✓ Fetched detailed information for ${allIssues.length} issues`);

  console.log(`   ✓ Found ${allIssues.length} completed issues`);
  
  // Now filter out issues that have excluded fix versions
  const filteredIssues = allIssues.filter(issue => {
    const fixVersions = issue.fields.fixVersions || [];
    
    // If no fix versions, include it
    if (fixVersions.length === 0) {
      return true;
    }
    
    // Check if any of the fix versions are in the excluded list
    const hasExcludedVersion = fixVersions.some(v => 
      EXCLUDED_FIX_VERSIONS.includes(v.name)
    );
    
    // Include only if it doesn't have an excluded version
    return !hasExcludedVersion;
  });
  
  console.log(`   ✓ After filtering: ${filteredIssues.length} historical issues (excluded ${allIssues.length - filteredIssues.length} from recent releases)`);
  return filteredIssues;
}

/**
 * Get components from issue
 */
function getComponents(issue) {
  try {
    const components = issue.fields.components || [];
    if (components.length === 0) {
      return ['No Component'];
    }
    return components.map(c => c.name);
  } catch (error) {
    return ['No Component'];
  }
}

/**
 * Get fix versions from issue
 */
function getFixVersions(issue) {
  try {
    const fixVersions = issue.fields.fixVersions || [];
    if (fixVersions.length === 0) {
      return ['No Fix Version'];
    }
    return fixVersions.map(v => v.name);
  } catch (error) {
    return ['No Fix Version'];
  }
}

/**
 * Analyze issues and generate report
 */
function analyzeIssues(issues) {
  const byComponent = {};
  const byIssueType = {};
  const byFixVersion = {};
  let totalPoints = 0;
  let totalIssues = 0;

  for (const issue of issues) {
    const issueType = issue.fields.issuetype?.name || 'Unknown';
    const components = getComponents(issue);
    const fixVersions = getFixVersions(issue);
    const status = issue.fields.status?.name || 'Unknown';
    let points = issue.fields[STORY_POINTS_FIELD] || 0;

    // Apply default points for Stories/Bugs with no points
    if ((issueType === 'Story' || issueType === 'Bug') && points === 0) {
      points = 2;
    }

    totalPoints += points;
    totalIssues++;

    // By Component (an issue can have multiple components)
    for (const component of components) {
      if (!byComponent[component]) {
        byComponent[component] = {
          issues: [],
          points: 0,
          count: 0,
          byType: {}
        };
      }
      
      // Add issue to component (only once even if multiple components)
      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        type: issueType,
        points: points,
        status: status,
        fixVersions: fixVersions.join(', ')
      };
      
      // Check if this issue is already added to this component
      if (!byComponent[component].issues.find(i => i.key === issue.key)) {
        byComponent[component].issues.push(issueData);
        byComponent[component].points += points;
        byComponent[component].count++;
        
        // By Type within Component
        if (!byComponent[component].byType[issueType]) {
          byComponent[component].byType[issueType] = {
            count: 0,
            points: 0
          };
        }
        byComponent[component].byType[issueType].count++;
        byComponent[component].byType[issueType].points += points;
      }
    }

    // By Issue Type (overall)
    if (!byIssueType[issueType]) {
      byIssueType[issueType] = {
        count: 0,
        points: 0
      };
    }
    byIssueType[issueType].count++;
    byIssueType[issueType].points += points;

    // By Fix Version (overall)
    for (const fixVersion of fixVersions) {
      if (!byFixVersion[fixVersion]) {
        byFixVersion[fixVersion] = {
          count: 0,
          points: 0
        };
      }
      byFixVersion[fixVersion].count++;
      byFixVersion[fixVersion].points += points;
    }
  }

  return {
    totalPoints,
    totalIssues,
    byComponent,
    byIssueType,
    byFixVersion
  };
}

/**
 * Display the report
 */
function displayReport(analysis) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 HISTORICAL PROJECT WORK BY COMPONENTS`);
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Excluding: ${EXCLUDED_FIX_VERSIONS.join(', ')}`);
  console.log('='.repeat(80));

  console.log('\n📈 OVERALL TOTALS:');
  console.log('─'.repeat(80));
  console.log(`   Total Completed Issues: ${analysis.totalIssues}`);
  console.log(`   Total Story Points: ${analysis.totalPoints}`);

  console.log('\n📋 BREAKDOWN BY ISSUE TYPE:');
  console.log('─'.repeat(80));
  const sortedTypes = Object.entries(analysis.byIssueType)
    .sort((a, b) => b[1].points - a[1].points);
  
  for (const [type, data] of sortedTypes) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    console.log(`   ${type.padEnd(15)} ${data.count.toString().padStart(4)} issues, ${data.points.toString().padStart(5)} points (${percentage.padStart(5)}%)`);
  }

  console.log('\n🏷️  BREAKDOWN BY FIX VERSION:');
  console.log('─'.repeat(80));
  const sortedVersions = Object.entries(analysis.byFixVersion)
    .sort((a, b) => b[1].points - a[1].points);
  
  for (const [version, data] of sortedVersions) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    const icon = version === 'No Fix Version' ? '⚠️ ' : '  ';
    console.log(`${icon}${version.padEnd(20)} ${data.count.toString().padStart(4)} issues, ${data.points.toString().padStart(5)} points (${percentage.padStart(5)}%)`);
  }

  console.log('\n🔧 BREAKDOWN BY COMPONENT:');
  console.log('='.repeat(80));
  
  const sortedComponents = Object.entries(analysis.byComponent)
    .sort((a, b) => {
      // Sort "No Component" to the end
      if (a[0] === 'No Component') return 1;
      if (b[0] === 'No Component') return -1;
      // Otherwise sort by points (descending)
      return b[1].points - a[1].points;
    });

  for (const [component, data] of sortedComponents) {
    const percentage = ((data.points / analysis.totalPoints) * 100).toFixed(1);
    const icon = component === 'No Component' ? '⚠️ ' : '📦';
    
    console.log(`\n${icon} ${component}`);
    console.log('─'.repeat(80));
    console.log(`   Total: ${data.count} issues, ${data.points} points (${percentage}% of project)`);
    
    // Show breakdown by issue type within this component
    console.log(`   By Type:`);
    const sortedComponentTypes = Object.entries(data.byType)
      .sort((a, b) => b[1].points - a[1].points);
    
    for (const [type, typeData] of sortedComponentTypes) {
      const typePercentage = ((typeData.points / data.points) * 100).toFixed(1);
      console.log(`      ${type.padEnd(15)} ${typeData.count.toString().padStart(3)} issues, ${typeData.points.toString().padStart(4)} points (${typePercentage}%)`);
    }
    
    // Show top 5 issues
    console.log(`   Top Issues:`);
    const issuesToShow = data.issues
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
    
    for (const issue of issuesToShow) {
      const fixVersionInfo = issue.fixVersions !== 'No Fix Version' ? ` [${issue.fixVersions}]` : '';
      console.log(`      ${issue.key} | ${issue.points.toString().padStart(2)} pts | ${issue.type.padEnd(10)} | ${issue.summary.substring(0, 40)}${fixVersionInfo}`);
    }
    
    if (data.issues.length > 5) {
      console.log(`      ... and ${data.issues.length - 5} more issues`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 SUMMARY:`);
  console.log(`   Total Historical Work: ${analysis.totalIssues} issues, ${analysis.totalPoints} points`);
  console.log(`   Components: ${Object.keys(analysis.byComponent).length}`);
  console.log(`   (Excluding: ${EXCLUDED_FIX_VERSIONS.join(', ')})`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Main function
 */
async function main() {
  console.log('\n📊 Full Project History Report');
  console.log('='.repeat(60));
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}\n`);

  try {
    const client = createJiraClient();
    const issues = await fetchHistoricalIssues(client);
    
    if (issues.length === 0) {
      console.log('\n⚠️  No historical issues found matching the criteria.');
      return;
    }
    
    const analysis = analyzeIssues(issues);
    displayReport(analysis);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the script
main();

