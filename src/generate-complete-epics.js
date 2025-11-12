const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const FIX_VERSION = 'Release 1D';

// Completed statuses for epics
const COMPLETED_STATUSES = ['Done', 'READY FOR RELEASE', 'CLOSED', 'Completed'];

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

// Get the Story Points field ID
async function getStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    
    const storyPointsField = fields.find(field => 
      field.name && field.name.toLowerCase() === 'story points'
    );
    
    if (!storyPointsField) {
      console.warn('⚠️  Warning: Could not find Story Points field, using default customfield_10003');
      return 'customfield_10003';
    }
    
    console.log(`✓ Found Story Points field: ${storyPointsField.id}`);
    return storyPointsField.id;
  } catch (error) {
    console.error(`❌ Error getting Story Points field: ${error.message}`);
    return 'customfield_10003'; // Default fallback
  }
}

// Fetch completed epics for the fix version
async function fetchCompletedEpics(client, storyPointsFieldId) {
  try {
    console.log(`\n🔎 Fetching completed epics for ${FIX_VERSION}...`);
    
    const statusList = COMPLETED_STATUSES.map(s => `"${s}"`).join(', ');
    const jql = `project = ${PROJECT_KEY} AND issuetype = Epic AND fixVersion = "${FIX_VERSION}" AND status in (${statusList})`;
    
    console.log(`   JQL: ${jql}`);
    
    // Fetch epics
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const epicRefs = response.data.issues || [];
    console.log(`   ✓ Found ${epicRefs.length} completed epics`);
    
    if (epicRefs.length === 0) {
      return [];
    }
    
    // Fetch full details for each epic
    console.log(`\n📥 Fetching epic details...`);
    const epics = [];
    
    for (const epicRef of epicRefs) {
      const epicKey = epicRef.key || epicRef.id;
      
      try {
        const epicResponse = await client.get(`/rest/api/3/issue/${epicKey}`, {
          params: {
            fields: `summary,status,priority,assignee,${storyPointsFieldId},created,resolutiondate`
          }
        });
        
        const epic = epicResponse.data;
        const fields = epic.fields;
        
        const storyPoints = fields[storyPointsFieldId] || 0;
        const assignee = fields.assignee?.displayName || 'Unassigned';
        const status = fields.status?.name || 'Unknown';
        const priority = fields.priority?.name || 'Unknown';
        const created = fields.created ? new Date(fields.created).toISOString().split('T')[0] : 'Unknown';
        const resolved = fields.resolutiondate ? new Date(fields.resolutiondate).toISOString().split('T')[0] : 'Unknown';
        
        epics.push({
          key: epic.key,
          summary: fields.summary,
          status: status,
          priority: priority,
          assignee: assignee,
          storyPoints: storyPoints,
          created: created,
          resolved: resolved
        });
        
        console.log(`   ✓ ${epic.key}: ${fields.summary} (${storyPoints} pts)`);
        
      } catch (epicError) {
        console.warn(`   ⚠️  Could not fetch ${epicKey}: ${epicError.message}`);
      }
    }
    
    return epics;
    
  } catch (error) {
    console.error(`   ❌ Error fetching epics: ${error.message}`);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return [];
  }
}

// Generate the report
async function generateReport() {
  console.log('\n📊 COMPLETED EPICS REPORT');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   Fix Version: ${FIX_VERSION}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
  console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);
  console.log('============================================================');
  
  validateConfig();
  
  const client = createJiraClient();
  const storyPointsFieldId = await getStoryPointsFieldId(client);
  
  const epics = await fetchCompletedEpics(client, storyPointsFieldId);
  
  if (epics.length === 0) {
    console.log('\n⚠️  No completed epics found for this fix version');
    return null;
  }
  
  // Calculate totals
  const totalStoryPoints = epics.reduce((sum, epic) => sum + epic.storyPoints, 0);
  
  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY:');
  console.log(`   Total Completed Epics: ${epics.length}`);
  console.log(`   Total Story Points: ${totalStoryPoints}`);
  console.log('='.repeat(60));
  
  // Display detailed list
  console.log('\n📋 COMPLETED EPICS:\n');
  
  // Sort by resolution date (most recent first)
  epics.sort((a, b) => {
    if (a.resolved === 'Unknown' && b.resolved === 'Unknown') return 0;
    if (a.resolved === 'Unknown') return 1;
    if (b.resolved === 'Unknown') return -1;
    return b.resolved.localeCompare(a.resolved);
  });
  
  epics.forEach((epic, index) => {
    console.log(`${index + 1}. ${epic.key} - ${epic.summary}`);
    console.log(`   Status: ${epic.status}`);
    console.log(`   Priority: ${epic.priority}`);
    console.log(`   Assignee: ${epic.assignee}`);
    console.log(`   Story Points: ${epic.storyPoints}`);
    console.log(`   Created: ${epic.created}`);
    console.log(`   Resolved: ${epic.resolved}`);
    console.log('');
  });
  
  // Prepare report data
  const reportData = {
    date: new Date().toISOString().split('T')[0],
    project: PROJECT_KEY,
    fixVersion: FIX_VERSION,
    summary: {
      totalEpics: epics.length,
      totalStoryPoints: totalStoryPoints
    },
    epics: epics.map(epic => ({
      key: epic.key,
      summary: epic.summary,
      status: epic.status,
      priority: epic.priority,
      assignee: epic.assignee,
      storyPoints: epic.storyPoints,
      created: epic.created,
      resolved: epic.resolved
    }))
  };
  
  // Save to JSON file
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputFile = path.join(reportsDir, `completed-epics-${FIX_VERSION.replace(/\s+/g, '-').toLowerCase()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(reportData, null, 2));
  
  console.log(`✅ Report saved to: ${outputFile}\n`);
  
  return reportData;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Completed Epics Report...\n');
    
    await generateReport();
    
    console.log('🎉 Report generation complete!\n');
    
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Run the script
main();

