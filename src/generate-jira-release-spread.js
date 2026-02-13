/**
 * Generate JIRA Release Spread Report
 * 
 * Queries JIRA API to count tickets per Fix Version (Release)
 * and shows the percentage distribution across releases
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

// Fix Versions to track (exact names from JIRA)
const FIX_VERSIONS = [
  'Release 1A MVP',
  'Release 1B - Addition on Asset Renewals Estimates',
  'Release 1C',
  'Release 1D',
  'Release 2A',
  'Release 2B'
];

// Short display names for the report
const DISPLAY_NAMES = {
  'Release 1A MVP': 'Release 1A',
  'Release 1B - Addition on Asset Renewals Estimates': 'Release 1B',
  'Release 1C': 'Release 1C',
  'Release 1D': 'Release 1D',
  'Release 2A': 'Release 2A',
  'Release 2B': 'Release 2B'
};

// Releases where we should EXCLUDE open tickets (completed releases)
const EXCLUDE_OPEN_FOR = [
  'Release 1A MVP',
  'Release 1B - Addition on Asset Renewals Estimates',
  'Release 1C'
];

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
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

// Get issue count for a specific fix version
async function getIssueCountForVersion(client, fixVersion) {
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${fixVersion}"`;
  
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1
    });
    
    return response.data.total || 0;
  } catch (error) {
    console.error(`   ⚠️ Error fetching ${fixVersion}:`, error.message);
    return 0;
  }
}

// Get issue count for a fix version using key-based pagination
async function getIssueBreakdownForVersion(client, fixVersion, excludeOpen = false) {
  // Base JQL - optionally exclude Open status
  const statusFilter = excludeOpen ? ' AND status != "Open"' : '';
  const baseJql = `project = ${PROJECT_KEY} AND fixVersion = "${fixVersion}"${statusFilter}`;
  
  try {
    // Paginate using key-based ordering to get accurate total count
    let allIssueKeys = [];
    let lastKey = null;
    let hasMore = true;
    
    while (hasMore) {
      // Build JQL - add key filter if we have a last key
      const jql = lastKey 
        ? `${baseJql} AND key > "${lastKey}" ORDER BY key ASC`
        : `${baseJql} ORDER BY key ASC`;
      
      const response = await client.post('/rest/api/3/search/jql', {
        jql: jql,
        maxResults: 1000
      });
      
      const issues = response.data.issues || [];
      
      if (issues.length === 0) {
        hasMore = false;
      } else {
        // Extract keys
        const keys = issues.map(i => i.key || i.id);
        allIssueKeys = allIssueKeys.concat(keys);
        lastKey = keys[keys.length - 1];
        
        // If we got less than 1000, we've got all of them
        if (issues.length < 1000) {
          hasMore = false;
        }
      }
      
      // Safety limit
      if (allIssueKeys.length > 5000) {
        hasMore = false;
      }
    }
    
    const issueRefs = allIssueKeys;
    const total = allIssueKeys.length;
    
    const breakdown = {
      total: total,
      byType: {},
      byStatus: {},
      storyPoints: 0
    };
    
    if (total === 0) return breakdown;
    
    // Fetch details for a sample of issues (first 50) to get breakdown
    const sampleSize = Math.min(50, issueRefs.length);
    for (let i = 0; i < sampleSize; i++) {
      const key = issueRefs[i];
      try {
        const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: 'issuetype,status,customfield_10003'
          }
        });
        
        const issue = detailResponse.data;
        
        // By type
        const type = issue.fields?.issuetype?.name || 'Unknown';
        breakdown.byType[type] = (breakdown.byType[type] || 0) + 1;
        
        // By status
        const status = issue.fields?.status?.name || 'Unknown';
        breakdown.byStatus[status] = (breakdown.byStatus[status] || 0) + 1;
        
        // Story points
        const points = issue.fields?.customfield_10003 || 0;
        breakdown.storyPoints += points;
      } catch (detailError) {
        // Skip issues that fail to fetch
      }
    }
    
    // Scale up to estimate full totals from sample (if we only sampled a subset)
    if (total > sampleSize) {
      const scaleFactor = total / sampleSize;
      breakdown.storyPoints = Math.round(breakdown.storyPoints * scaleFactor);
      // Scale by type
      for (const type in breakdown.byType) {
        breakdown.byType[type] = Math.round(breakdown.byType[type] * scaleFactor);
      }
      // Scale by status
      for (const status in breakdown.byStatus) {
        breakdown.byStatus[status] = Math.round(breakdown.byStatus[status] * scaleFactor);
      }
    }
    
    return breakdown;
  } catch (error) {
    console.error(`   ⚠️ Error fetching breakdown for ${fixVersion}:`, error.message);
    return { total: 0, byType: {}, byStatus: {}, storyPoints: 0 };
  }
}

// Get all Fix Versions for the project
async function getAllFixVersions(client) {
  try {
    const response = await client.get(`/rest/api/3/project/${PROJECT_KEY}/versions`);
    return response.data || [];
  } catch (error) {
    console.error('   ⚠️ Error fetching fix versions:', error.message);
    return [];
  }
}

async function generateReport() {
  console.log('📊 JIRA RELEASE SPREAD REPORT');
  console.log('═'.repeat(100));
  console.log(`Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`JIRA: ${JIRA_BASE_URL}`);
  console.log('═'.repeat(100));

  validateConfig();
  const client = createJiraClient();

  // First, list all available Fix Versions
  console.log('\n📋 Available Fix Versions in JIRA:');
  const allVersions = await getAllFixVersions(client);
  const releaseVersions = allVersions.filter(v => 
    v.name && (v.name.includes('1A') || v.name.includes('1B') || v.name.includes('1C') || 
               v.name.includes('1D') || v.name.includes('2A') || v.name.includes('2B'))
  );
  
  if (releaseVersions.length > 0) {
    console.log('   Found release versions:');
    releaseVersions.forEach(v => {
      console.log(`   - "${v.name}" (${v.released ? 'Released' : 'Unreleased'})`);
    });
  } else {
    console.log('   No matching release versions found. All versions:');
    allVersions.slice(0, 20).forEach(v => console.log(`   - "${v.name}"`));
  }

  console.log('\n🔍 Fetching issue counts per Fix Version...\n');

  // Fetch counts for each fix version
  const releaseData = [];
  let totalIssues = 0;
  let totalStoryPoints = 0;

  for (const fixVersion of FIX_VERSIONS) {
    const displayName = DISPLAY_NAMES[fixVersion] || fixVersion;
    const excludeOpen = EXCLUDE_OPEN_FOR.includes(fixVersion);
    process.stdout.write(`   Fetching ${displayName}${excludeOpen ? ' (excl. Open)' : ''}...`);
    const breakdown = await getIssueBreakdownForVersion(client, fixVersion, excludeOpen);
    
    // Calculate % complete (Closed + Ready for release)
    const completedStatuses = ['Closed', 'Ready for release'];
    let completedCount = 0;
    for (const status of completedStatuses) {
      completedCount += breakdown.byStatus[status] || 0;
    }
    const pctComplete = breakdown.total > 0 ? (completedCount / breakdown.total) * 100 : 0;
    
    releaseData.push({
      release: displayName,
      fullName: fixVersion,
      count: breakdown.total,
      byType: breakdown.byType,
      byStatus: breakdown.byStatus,
      storyPoints: breakdown.storyPoints,
      completedCount: completedCount,
      pctComplete: pctComplete,
      excludedOpen: excludeOpen
    });
    
    totalIssues += breakdown.total;
    totalStoryPoints += breakdown.storyPoints;
    console.log(` ${breakdown.total} issues (${breakdown.storyPoints} pts)`);
  }

  // ============================================
  // SECTION 1: Overall Distribution
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('📦 TICKET DISTRIBUTION BY RELEASE');
  console.log('═'.repeat(100));
  console.log(`\nTotal Tickets (with Fix Version): ${totalIssues}`);
  console.log(`Total Story Points: ${totalStoryPoints}\n`);

  console.log('| Release      | Tickets | % of Total | Story Points | % Complete |');
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(9) + '|' + '─'.repeat(12) + '|' + '─'.repeat(14) + '|' + '─'.repeat(12) + '|');
  
  for (const r of releaseData) {
    const pctTickets = totalIssues > 0 ? ((r.count / totalIssues) * 100).toFixed(1) : '0.0';
    // For releases with Open excluded, show 100% (or calculate based on Closed only)
    const displayPctComplete = r.excludedOpen ? '100.0' : r.pctComplete.toFixed(1);
    console.log(`| ${r.release.padEnd(12)} | ${String(r.count).padStart(7)} | ${pctTickets.padStart(9)}% | ${String(r.storyPoints).padStart(12)} | ${displayPctComplete.padStart(9)}% |`);
  }
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(9) + '|' + '─'.repeat(12) + '|' + '─'.repeat(14) + '|' + '─'.repeat(12) + '|');
  
  // Calculate overall completion
  const totalCompleted = releaseData.reduce((sum, r) => sum + r.completedCount, 0);
  const overallPctComplete = totalIssues > 0 ? ((totalCompleted / totalIssues) * 100).toFixed(1) : '0.0';
  console.log(`| ${'TOTAL'.padEnd(12)} | ${String(totalIssues).padStart(7)} | ${'100.0'.padStart(9)}% | ${String(totalStoryPoints).padStart(12)} | ${overallPctComplete.padStart(9)}% |`);

  // Visual bar chart
  console.log('\n📊 Visual Distribution (by Tickets):\n');
  for (const r of releaseData) {
    const pct = totalIssues > 0 ? (r.count / totalIssues) * 100 : 0;
    const barWidth = Math.round(pct);
    const bar = '█'.repeat(barWidth);
    console.log(`  ${r.release.padEnd(12)} [${bar.padEnd(50)}] ${pct.toFixed(1)}% (${r.count})`);
  }

  console.log('\n📊 Visual Distribution (by Story Points):\n');
  for (const r of releaseData) {
    const pct = totalStoryPoints > 0 ? (r.storyPoints / totalStoryPoints) * 100 : 0;
    const barWidth = Math.round(pct);
    const bar = '█'.repeat(barWidth);
    console.log(`  ${r.release.padEnd(12)} [${bar.padEnd(50)}] ${pct.toFixed(1)}% (${r.storyPoints} pts)`);
  }

  // ============================================
  // SECTION 2: Detailed Breakdown Per Release
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('📋 DETAILED BREAKDOWN BY RELEASE');
  console.log('═'.repeat(100));

  for (const r of releaseData) {
    const pctTickets = totalIssues > 0 ? ((r.count / totalIssues) * 100).toFixed(1) : '0.0';
    
    console.log(`\n┌─ 📦 ${r.release} ${'─'.repeat(85)}`);
    console.log(`│  Tickets: ${r.count}  |  % of Total: ${pctTickets}%  |  Story Points: ${r.storyPoints}`);
    
    // By Issue Type
    if (Object.keys(r.byType).length > 0) {
      console.log(`│`);
      console.log(`│  By Issue Type:`);
      const sortedTypes = Object.entries(r.byType).sort((a, b) => b[1] - a[1]);
      for (const [type, count] of sortedTypes) {
        const typePct = r.count > 0 ? ((count / r.count) * 100).toFixed(0) : 0;
        const icon = type === 'Bug' ? '🐛' : type === 'Story' ? '📖' : type === 'Task' ? '✅' : type === 'Epic' ? '🎯' : type === 'Sub-task' ? '📌' : '•';
        console.log(`│    ${icon} ${type.padEnd(15)} ${String(count).padStart(4)} (${typePct}%)`);
      }
    }
    
    // By Status (summarized)
    if (Object.keys(r.byStatus).length > 0) {
      console.log(`│`);
      console.log(`│  By Status:`);
      const sortedStatuses = Object.entries(r.byStatus).sort((a, b) => b[1] - a[1]);
      for (const [status, count] of sortedStatuses.slice(0, 5)) {  // Top 5 statuses
        const statusPct = r.count > 0 ? ((count / r.count) * 100).toFixed(0) : 0;
        console.log(`│    • ${status.padEnd(20)} ${String(count).padStart(4)} (${statusPct}%)`);
      }
      if (sortedStatuses.length > 5) {
        console.log(`│    ... and ${sortedStatuses.length - 5} more statuses`);
      }
    }
    
    console.log(`└${'─'.repeat(99)}`);
  }

  // ============================================
  // SECTION 3: Executive Summary
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('📊 EXECUTIVE SUMMARY');
  console.log('═'.repeat(100));

  // Find largest and smallest releases
  const sortedByCount = [...releaseData].sort((a, b) => b.count - a.count);
  const largest = sortedByCount[0];
  const smallest = sortedByCount.filter(r => r.count > 0).pop() || sortedByCount[sortedByCount.length - 1];

  console.log(`
  TOTAL JIRA TICKETS (with Fix Version): ${totalIssues}
  TOTAL STORY POINTS: ${totalStoryPoints}
  
  DISTRIBUTION SUMMARY
  ───────────────────────────────────────────────────────────────────────`);
  
  for (const r of releaseData) {
    const pct = totalIssues > 0 ? ((r.count / totalIssues) * 100).toFixed(1) : '0.0';
    const displayPctComplete = r.excludedOpen ? '100.0' : r.pctComplete.toFixed(1);
    const completionIcon = r.excludedOpen ? '✅' : (r.pctComplete >= 80 ? '🟢' : r.pctComplete >= 50 ? '🟡' : '🔴');
    console.log(`  ${completionIcon} ${r.release.padEnd(12)}: ${r.count.toString().padStart(4)} tickets (${pct.padStart(5)}%)  |  ${r.storyPoints.toString().padStart(5)} pts  |  ${displayPctComplete.padStart(5)}% complete`);
  }

  console.log(`
  KEY INSIGHTS
  ─────────────────────────────────────────────
  📈 Largest Release:  ${largest.release} with ${largest.count} tickets (${((largest.count / totalIssues) * 100).toFixed(1)}%)
  📉 Smallest Release: ${smallest.release} with ${smallest.count} tickets (${((smallest.count / totalIssues) * 100).toFixed(1)}%)
  `);

  console.log('═'.repeat(100));
}

// Run the report
generateReport().catch(error => {
  console.error('❌ Error generating report:', error.message);
  process.exit(1);
});

