require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// IFT Epics to analyze
const IFT_EPICS = [
  'VER10-8678',
  'VER10-8680',
  'VER10-8682',
  'VER10-8858',
  'VER10-8679',
  'VER10-8921',
  'VER10-9049',
  'VER10-9128'
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

// Fetch all issues with pagination
async function fetchAllIssues(client, jql, fields = ['key', 'summary', 'status', 'issuetype', 'customfield_10003']) {
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
      fields: fields
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

// Fetch a single issue
async function fetchIssue(client, issueKey) {
  try {
    const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: {
        fields: 'key,summary,status,issuetype,customfield_10003'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`   ⚠️ Could not fetch ${issueKey}: ${error.response?.status || error.message}`);
    return null;
  }
}

// Calculate points with 2pt assumption for unestimated
function calculatePoints(issues) {
  let estimated = 0;
  let assumed = 0;
  let estimatedCount = 0;
  let unestimatedCount = 0;
  
  issues.forEach(issue => {
    const rawPoints = issue.fields.customfield_10003;
    const hasEstimate = rawPoints !== null && rawPoints !== undefined;
    if (hasEstimate) {
      estimated += rawPoints;
      estimatedCount++;
    } else {
      assumed += 2;
      unestimatedCount++;
    }
  });
  
  return { 
    estimated, 
    assumed, 
    total: estimated + assumed,
    estimatedCount,
    unestimatedCount
  };
}

// Count issues by status category
function countByStatusCategory(issues) {
  let done = 0;
  let inProgress = 0;
  let todo = 0;
  
  issues.forEach(issue => {
    const category = issue.fields.status?.statusCategory?.name || 'To Do';
    if (category === 'Done') {
      done++;
    } else if (category === 'In Progress') {
      inProgress++;
    } else {
      todo++;
    }
  });
  
  return { done, inProgress, todo };
}

async function generateIFTEstimate() {
  validateConfig();
  const client = createJiraClient();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        IFT EPIC ESTIMATE REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const epicData = [];
  let grandTotalIssues = 0;
  let grandTotalEstimated = 0;
  let grandTotalAssumed = 0;
  let grandTotalDone = 0;
  let grandTotalInProgress = 0;
  let grandTotalTodo = 0;
  
  console.log('🔍 Fetching epic data...');
  console.log('');
  
  for (const epicKey of IFT_EPICS) {
    // Fetch the epic itself
    const epic = await fetchIssue(client, epicKey);
    
    if (!epic) {
      epicData.push({
        key: epicKey,
        summary: '(Could not fetch)',
        childCount: 0,
        points: { estimated: 0, assumed: 0, total: 0 },
        status: { done: 0, inProgress: 0, todo: 0 }
      });
      continue;
    }
    
    const epicSummary = epic.fields.summary || '(No summary)';
    
    // Fetch child issues (stories/bugs in this epic)
    const jql = `"Parent Link" = ${epicKey} OR "Epic Link" = ${epicKey}`;
    const children = await fetchAllIssues(client, jql, ['key', 'summary', 'status', 'issuetype', 'customfield_10003']);
    
    const points = calculatePoints(children);
    const statusCounts = countByStatusCategory(children);
    
    epicData.push({
      key: epicKey,
      summary: epicSummary,
      childCount: children.length,
      points: points,
      status: statusCounts
    });
    
    grandTotalIssues += children.length;
    grandTotalEstimated += points.estimated;
    grandTotalAssumed += points.assumed;
    grandTotalDone += statusCounts.done;
    grandTotalInProgress += statusCounts.inProgress;
    grandTotalTodo += statusCounts.todo;
    
    console.log(`   ✓ ${epicKey}: ${children.length} issues (${points.total} pts) - "${epicSummary.substring(0, 50)}${epicSummary.length > 50 ? '...' : ''}"`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 EPIC BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Print detailed table
  console.log('| Epic | Summary | Issues | Est Pts | Asmd Pts | Total Pts | Done | In Prog | To Do |');
  console.log('|------|---------|-------:|--------:|---------:|----------:|-----:|--------:|------:|');
  
  epicData.forEach(epic => {
    const shortSummary = epic.summary.substring(0, 30) + (epic.summary.length > 30 ? '...' : '');
    console.log(`| ${epic.key} | ${shortSummary.padEnd(33)} | ${epic.childCount.toString().padStart(6)} | ${epic.points.estimated.toString().padStart(7)} | ${epic.points.assumed.toString().padStart(8)} | ${epic.points.total.toString().padStart(9)} | ${epic.status.done.toString().padStart(4)} | ${epic.status.inProgress.toString().padStart(7)} | ${epic.status.todo.toString().padStart(5)} |`);
  });
  
  console.log(`| **TOTAL** | | **${grandTotalIssues}** | **${grandTotalEstimated}** | **${grandTotalAssumed}** | **${grandTotalEstimated + grandTotalAssumed}** | **${grandTotalDone}** | **${grandTotalInProgress}** | **${grandTotalTodo}** |`);
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`   Total Epics:           ${IFT_EPICS.length}`);
  console.log(`   Total Child Issues:    ${grandTotalIssues}`);
  console.log('');
  console.log('   STORY POINTS:');
  console.log(`   - Estimated:           ${grandTotalEstimated} pts`);
  console.log(`   - Assumed (2pt/issue): ${grandTotalAssumed} pts`);
  console.log(`   - TOTAL:               ${grandTotalEstimated + grandTotalAssumed} pts`);
  console.log('');
  console.log('   STATUS BREAKDOWN:');
  console.log(`   - Done:                ${grandTotalDone} issues (${((grandTotalDone / grandTotalIssues) * 100).toFixed(1)}%)`);
  console.log(`   - In Progress:         ${grandTotalInProgress} issues (${((grandTotalInProgress / grandTotalIssues) * 100).toFixed(1)}%)`);
  console.log(`   - To Do:               ${grandTotalTodo} issues (${((grandTotalTodo / grandTotalIssues) * 100).toFixed(1)}%)`);
  console.log('');
  
  // Calculate remaining work
  const remainingIssues = grandTotalInProgress + grandTotalTodo;
  const completionPercent = ((grandTotalDone / grandTotalIssues) * 100).toFixed(1);
  
  console.log('   REMAINING WORK:');
  console.log(`   - Issues remaining:    ${remainingIssues} of ${grandTotalIssues}`);
  console.log(`   - Completion:          ${completionPercent}%`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run the report
generateIFTEstimate().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});








