require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 1D';

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

// Fetch all issues with pagination
async function fetchAllIssues(client, jql) {
  let allIssues = [];
  let lastKey = null;
  let hasMore = true;
  
  while (hasMore) {
    let query = jql;
    if (lastKey) {
      query = `${query} AND key > "${lastKey}"`;
    }
    query = `${query} ORDER BY key ASC`;
    
    const response = await client.post('/rest/api/3/search/jql', {
      jql: query,
      maxResults: 100,
      fields: ['key', 'summary', 'status', 'priority', 'customfield_10003']
    });
    
    const issues = response.data.issues || [];
    if (issues.length === 0) {
      hasMore = false;
    } else {
      allIssues = allIssues.concat(issues);
      lastKey = issues[issues.length - 1].key;
      if (issues.length < 100) hasMore = false;
    }
  }
  return allIssues;
}

// Calculate points with 2pt assumption for unestimated
function calculatePoints(issues) {
  let estimated = 0;
  let assumed = 0;
  
  issues.forEach(issue => {
    const rawPoints = issue.fields.customfield_10003;
    const hasEstimate = rawPoints !== null && rawPoints !== undefined;
    if (hasEstimate) {
      estimated += rawPoints;
    } else {
      assumed += 2;
    }
  });
  
  return { estimated, assumed, total: estimated + assumed };
}

async function generateBugStatusReport() {
  validateConfig();
  const client = createJiraClient();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`        BUG STATUS REPORT - ${FIX_VERSION}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Fetch remaining bugs for Release 1D
  console.log('🔍 Fetching bugs...');
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${FIX_VERSION}" AND issuetype = Bug AND statusCategory != "Done"`;
  const bugs = await fetchAllIssues(client, jql);
  
  console.log(`   ✓ Found ${bugs.length} remaining bugs`);
  console.log('');
  
  // Group by priority
  const byPriority = {};
  const byStatus = {};
  
  bugs.forEach(bug => {
    const priority = bug.fields.priority?.name || 'None';
    const status = bug.fields.status?.name || 'Unknown';
    
    if (!byPriority[priority]) byPriority[priority] = [];
    byPriority[priority].push(bug);
    
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(bug);
  });
  
  // Priority order (JIRA uses P1-P4 naming)
  const priorityOrder = ['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low', 'None'];
  
  console.log('📊 BY PRIORITY');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('| Priority | Issues | Estimated Pts | Assumed Pts | Total Pts |');
  console.log('|----------|-------:|--------------:|------------:|----------:|');
  
  let totalIssues = 0;
  let totalEstimated = 0;
  let totalAssumed = 0;
  
  priorityOrder.forEach(priority => {
    if (byPriority[priority]) {
      const issues = byPriority[priority];
      const pts = calculatePoints(issues);
      console.log(`| ${priority} | ${issues.length} | ${pts.estimated} | ${pts.assumed} | ${pts.total} |`);
      totalIssues += issues.length;
      totalEstimated += pts.estimated;
      totalAssumed += pts.assumed;
    }
  });
  
  console.log(`| **TOTAL** | **${totalIssues}** | **${totalEstimated}** | **${totalAssumed}** | **${totalEstimated + totalAssumed}** |`);
  console.log('');
  
  // Status breakdown
  const statusOrder = ['Open', 'Blocked', 'In Dev', 'In Review', 'Ready for review', 'In QA', 'Ready for QA'];
  
  console.log('📋 BY STATUS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('| Status | Issues | Estimated Pts | Assumed Pts | Total Pts |');
  console.log('|--------|-------:|--------------:|------------:|----------:|');
  
  statusOrder.forEach(status => {
    if (byStatus[status]) {
      const issues = byStatus[status];
      const pts = calculatePoints(issues);
      const icon = ['Open', 'Blocked'].includes(status) ? '🔴' : '💻';
      console.log(`| ${icon} ${status} | ${issues.length} | ${pts.estimated} | ${pts.assumed} | ${pts.total} |`);
    }
  });
  
  // Check for any statuses not in our order
  Object.keys(byStatus).forEach(status => {
    if (!statusOrder.includes(status)) {
      const issues = byStatus[status];
      const pts = calculatePoints(issues);
      console.log(`| ❓ ${status} | ${issues.length} | ${pts.estimated} | ${pts.assumed} | ${pts.total} |`);
    }
  });
  
  console.log(`| **TOTAL** | **${totalIssues}** | **${totalEstimated}** | **${totalAssumed}** | **${totalEstimated + totalAssumed}** |`);
  console.log('');
  
  // Priority x Status matrix
  console.log('📊 PRIORITY × STATUS MATRIX (Issue Counts)');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  
  // Build matrix
  const matrix = {};
  const allStatuses = new Set();
  
  bugs.forEach(bug => {
    const priority = bug.fields.priority?.name || 'None';
    const status = bug.fields.status?.name || 'Unknown';
    allStatuses.add(status);
    
    if (!matrix[priority]) matrix[priority] = {};
    if (!matrix[priority][status]) matrix[priority][status] = 0;
    matrix[priority][status]++;
  });
  
  // Sort statuses by workflow order
  const sortedStatuses = [...allStatuses].sort((a, b) => {
    const orderA = statusOrder.indexOf(a);
    const orderB = statusOrder.indexOf(b);
    if (orderA === -1 && orderB === -1) return a.localeCompare(b);
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
  
  // Print header
  let header = '| Priority |';
  let separator = '|----------|';
  sortedStatuses.forEach(status => {
    header += ` ${status.substring(0, 12).padEnd(12)} |`;
    separator += '-------------:|';
  });
  header += ' Total |';
  separator += '------:|';
  
  console.log(header);
  console.log(separator);
  
  // Print rows
  priorityOrder.forEach(priority => {
    if (matrix[priority]) {
      let row = `| ${priority.padEnd(8)} |`;
      let rowTotal = 0;
      sortedStatuses.forEach(status => {
        const count = matrix[priority][status] || 0;
        rowTotal += count;
        row += ` ${count.toString().padStart(12)} |`;
      });
      row += ` ${rowTotal.toString().padStart(5)} |`;
      console.log(row);
    }
  });
  
  // Print column totals
  let totalsRow = '| **Total** |';
  sortedStatuses.forEach(status => {
    const total = byStatus[status]?.length || 0;
    totalsRow += ` ${total.toString().padStart(12)} |`;
  });
  totalsRow += ` **${bugs.length}** |`;
  console.log(totalsRow);
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run the report
generateBugStatusReport().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});

