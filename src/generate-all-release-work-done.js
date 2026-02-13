require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 1D';

// Validate environment variables
if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
  console.error('❌ Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
  process.exit(1);
}

const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');

const client = axios.create({
  baseURL: JIRA_BASE_URL,
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(client, requestFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const waitTime = attempt * 5000; // 5s, 10s, 15s
        console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

async function fetchAllIssues(jql) {
  let allIssues = [];
  let lastKey = null;
  let hasMore = true;
  
  while (hasMore) {
    let query = jql;
    if (lastKey) {
      query = `${jql} AND key > "${lastKey}"`;
    }
    // Ensure ORDER BY key ASC for pagination
    query = query.replace(/ORDER BY.*$/i, '') + ' ORDER BY key ASC';
    
    const response = await fetchWithRetry(client, () => 
      client.post('/rest/api/3/search/jql', {
        jql: query,
        maxResults: 100,
        fields: [
          'key',
          'summary',
          'status',
          'issuetype',
          'assignee',
          'customfield_10003',
          'resolutiondate',
          'updated',
          'parent'
        ]
      })
    );
    
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

async function generateReport() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  RELEASE 1D - COMPLETED WORK REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log(`   Generated: ${new Date().toISOString()}`);
  console.log(`   Fix Version: ${FIX_VERSION}`);
  console.log('');

  // Query for completed stories and epics
  const jql = `project = ${PROJECT_KEY} AND fixVersion = "${FIX_VERSION}" AND issuetype in (Story, Epic) AND status in ("Ready for Release", "Closed", "Done") ORDER BY issuetype ASC, resolutiondate DESC`;
  
  console.log('🔍 Fetching completed Stories and Epics...');
  console.log(`   JQL: ${jql}`);
  console.log('');
  
  const issues = await fetchAllIssues(jql);
  
  // Separate by type
  const epics = issues.filter(i => i.fields.issuetype.name === 'Epic');
  const stories = issues.filter(i => i.fields.issuetype.name === 'Story');
  
  // Calculate totals
  const epicPoints = epics.reduce((sum, i) => sum + (i.fields.customfield_10003 || 0), 0);
  const storyPoints = stories.reduce((sum, i) => sum + (i.fields.customfield_10003 || 0), 0);
  const totalPoints = epicPoints + storyPoints;
  
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('');
  console.log(`   Epics Completed:   ${epics.length.toString().padStart(4)} (${epicPoints} points)`);
  console.log(`   Stories Completed: ${stories.length.toString().padStart(4)} (${storyPoints} points)`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Total:             ${issues.length.toString().padStart(4)} (${totalPoints} points)`);
  console.log('');
  
  // Group by status
  const byStatus = {};
  issues.forEach(i => {
    const status = i.fields.status.name;
    if (!byStatus[status]) byStatus[status] = { epics: [], stories: [] };
    if (i.fields.issuetype.name === 'Epic') {
      byStatus[status].epics.push(i);
    } else {
      byStatus[status].stories.push(i);
    }
  });
  
  console.log('   By Status:');
  Object.keys(byStatus).sort().forEach(status => {
    const e = byStatus[status].epics.length;
    const s = byStatus[status].stories.length;
    console.log(`   - ${status}: ${e} epics, ${s} stories`);
  });
  console.log('');
  
  // List Epics
  if (epics.length > 0) {
    console.log('───────────────────────────────────────────────────────────────────────────');
    console.log('  COMPLETED EPICS');
    console.log('───────────────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('  | Key         | Summary                                          | Status            | Points | Completed  |');
    console.log('  |-------------|--------------------------------------------------|-------------------|-------:|------------|');
    
    epics.forEach(epic => {
      const key = epic.key.padEnd(11);
      const summary = (epic.fields.summary.length > 48 
        ? epic.fields.summary.substring(0, 45) + '...' 
        : epic.fields.summary).padEnd(48);
      const status = epic.fields.status.name.padEnd(17);
      const points = (epic.fields.customfield_10003 || '-').toString().padStart(6);
      const completed = formatDate(epic.fields.resolutiondate || epic.fields.updated);
      
      console.log(`  | ${key} | ${summary} | ${status} | ${points} | ${completed} |`);
    });
    console.log('');
  }
  
  // List Stories
  if (stories.length > 0) {
    console.log('───────────────────────────────────────────────────────────────────────────');
    console.log('  COMPLETED STORIES');
    console.log('───────────────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('  | Key         | Summary                                          | Status            | Points | Completed  |');
    console.log('  |-------------|--------------------------------------------------|-------------------|-------:|------------|');
    
    stories.forEach(story => {
      const key = story.key.padEnd(11);
      const summary = (story.fields.summary.length > 48 
        ? story.fields.summary.substring(0, 45) + '...' 
        : story.fields.summary).padEnd(48);
      const status = story.fields.status.name.padEnd(17);
      const points = (story.fields.customfield_10003 || '-').toString().padStart(6);
      const completed = formatDate(story.fields.resolutiondate || story.fields.updated);
      
      console.log(`  | ${key} | ${summary} | ${status} | ${points} | ${completed} |`);
    });
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  END OF REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  return { epics, stories, totalPoints };
}

// Run the report
generateReport()
  .then(result => {
    console.log(`✅ Found ${result.epics.length} epics and ${result.stories.length} stories (${result.totalPoints} total points)`);
  })
  .catch(err => {
    console.error('❌ Error:', err.response ? err.response.data : err.message);
    process.exit(1);
  });

