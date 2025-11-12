const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

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

// Extract progress percentage from description
function extractProgress(description) {
  if (!description) {
    return null;
  }
  
  // Handle different description formats (text or ADF - Atlassian Document Format)
  let text = '';
  
  if (typeof description === 'string') {
    text = description;
  } else if (description.content && Array.isArray(description.content)) {
    // ADF format - extract text from all content blocks
    text = extractTextFromADF(description);
  }
  
  // Look for PROGRESS: nn% pattern (case insensitive)
  const progressMatch = text.match(/PROGRESS:\s*(\d+)%/i);
  
  if (progressMatch) {
    return parseInt(progressMatch[1], 10);
  }
  
  return null;
}

// Extract text from Atlassian Document Format (ADF)
function extractTextFromADF(adf) {
  let text = '';
  
  function traverse(node) {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => traverse(child));
    }
  }
  
  traverse(adf);
  return text;
}

// Fetch design tasks
async function fetchDesignTasks(client) {
  try {
    console.log(`\n🔎 Fetching design tasks from ${PROJECT_KEY}...`);
    
    // Query for tasks with summary starting with "Design: "
    const jql = `project = ${PROJECT_KEY} AND issuetype = Task AND summary ~ "Design"`;
    
    console.log(`   JQL: ${jql}`);
    
    // Step 1: Get all task keys
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1000
    });
    
    const taskRefs = response.data.issues || [];
    console.log(`   ✓ Found ${taskRefs.length} design tasks`);
    
    if (taskRefs.length === 0) {
      return [];
    }
    
    // Step 2: Fetch full details for each task
    console.log(`\n📥 Fetching task details...`);
    const tasks = [];
    
    for (const taskRef of taskRefs) {
      const taskKey = taskRef.key || taskRef.id;
      
      try {
        const taskResponse = await client.get(`/rest/api/3/issue/${taskKey}`, {
          params: {
            fields: 'summary,description,status,assignee,priority,created,updated,fixVersions'
          }
        });
        
        const task = taskResponse.data;
        const fields = task.fields;
        
        // Filter: Only include tasks that start with "Design:"
        if (!fields.summary || !fields.summary.startsWith('Design:')) {
          continue;
        }
        
        const progress = extractProgress(fields.description);
        const assignee = fields.assignee?.displayName || 'Unassigned';
        const status = fields.status?.name || 'Unknown';
        const priority = fields.priority?.name || 'Unknown';
        const created = fields.created ? new Date(fields.created).toISOString().split('T')[0] : 'Unknown';
        const updated = fields.updated ? new Date(fields.updated).toISOString().split('T')[0] : 'Unknown';
        
        // Extract fix version
        let fixVersion = 'No Fix Version';
        if (fields.fixVersions && fields.fixVersions.length > 0) {
          fixVersion = fields.fixVersions[0].name;
        }
        
        tasks.push({
          key: task.key,
          summary: fields.summary,
          status: status,
          priority: priority,
          assignee: assignee,
          progress: progress,
          fixVersion: fixVersion,
          created: created,
          updated: updated
        });
        
        const progressStr = progress !== null ? `${progress}%` : 'Not specified';
        console.log(`   ✓ ${task.key}: ${progressStr} - ${fields.summary.substring(0, 60)}...`);
        
      } catch (taskError) {
        console.warn(`   ⚠️  Could not fetch ${taskKey}: ${taskError.message}`);
      }
    }
    
    return tasks;
    
  } catch (error) {
    console.error(`   ❌ Error fetching design tasks: ${error.message}`);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return [];
  }
}

// Calculate statistics
function calculateStats(tasks) {
  const stats = {
    total: tasks.length,
    withProgress: 0,
    withoutProgress: 0,
    averageProgress: 0,
    byStatus: {},
    byAssignee: {},
    byFixVersion: {},
    byProgressRange: {
      '0-25%': 0,
      '26-50%': 0,
      '51-75%': 0,
      '76-99%': 0,
      '100%': 0,
      'Not specified': 0
    }
  };
  
  let totalProgress = 0;
  
  for (const task of tasks) {
    // Count by status
    if (!stats.byStatus[task.status]) {
      stats.byStatus[task.status] = { count: 0, avgProgress: 0, totalProgress: 0 };
    }
    stats.byStatus[task.status].count++;
    
    // Count by assignee
    if (!stats.byAssignee[task.assignee]) {
      stats.byAssignee[task.assignee] = { count: 0, avgProgress: 0, totalProgress: 0 };
    }
    stats.byAssignee[task.assignee].count++;
    
    // Count by fix version
    if (!stats.byFixVersion[task.fixVersion]) {
      stats.byFixVersion[task.fixVersion] = { count: 0, avgProgress: 0, totalProgress: 0, tasks: [] };
    }
    stats.byFixVersion[task.fixVersion].count++;
    stats.byFixVersion[task.fixVersion].tasks.push(task);
    
    // Process progress
    if (task.progress !== null) {
      stats.withProgress++;
      totalProgress += task.progress;
      stats.byStatus[task.status].totalProgress += task.progress;
      stats.byAssignee[task.assignee].totalProgress += task.progress;
      stats.byFixVersion[task.fixVersion].totalProgress += task.progress;
      
      // Progress ranges
      if (task.progress === 0) {
        stats.byProgressRange['0-25%']++;
      } else if (task.progress <= 25) {
        stats.byProgressRange['0-25%']++;
      } else if (task.progress <= 50) {
        stats.byProgressRange['26-50%']++;
      } else if (task.progress <= 75) {
        stats.byProgressRange['51-75%']++;
      } else if (task.progress < 100) {
        stats.byProgressRange['76-99%']++;
      } else {
        stats.byProgressRange['100%']++;
      }
    } else {
      stats.withoutProgress++;
      stats.byProgressRange['Not specified']++;
    }
  }
  
  // Calculate averages
  if (stats.withProgress > 0) {
    stats.averageProgress = Math.round(totalProgress / stats.withProgress);
  }
  
  for (const status in stats.byStatus) {
    const statusData = stats.byStatus[status];
    if (statusData.count > 0) {
      statusData.avgProgress = Math.round(statusData.totalProgress / statusData.count);
    }
  }
  
  for (const assignee in stats.byAssignee) {
    const assigneeData = stats.byAssignee[assignee];
    if (assigneeData.count > 0) {
      assigneeData.avgProgress = Math.round(assigneeData.totalProgress / assigneeData.count);
    }
  }
  
  for (const fixVersion in stats.byFixVersion) {
    const fixVersionData = stats.byFixVersion[fixVersion];
    if (fixVersionData.count > 0) {
      fixVersionData.avgProgress = Math.round(fixVersionData.totalProgress / fixVersionData.count);
    }
  }
  
  return stats;
}

// Generate the report
async function generateReport() {
  console.log('\n📊 DESIGN PROGRESS REPORT');
  console.log('============================================================');
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}`);
  console.log(`   Date: ${new Date().toISOString().split('T')[0]}`);
  console.log('============================================================');
  
  validateConfig();
  
  const client = createJiraClient();
  const tasks = await fetchDesignTasks(client);
  
  if (tasks.length === 0) {
    console.log('\n⚠️  No design tasks found');
    return null;
  }
  
  const stats = calculateStats(tasks);
  
  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY:');
  console.log(`   Total Design Tasks: ${stats.total}`);
  console.log(`   Tasks with Progress: ${stats.withProgress}`);
  console.log(`   Tasks without Progress: ${stats.withoutProgress}`);
  console.log(`   Average Progress: ${stats.averageProgress}%`);
  console.log('='.repeat(60));
  
  // Display progress distribution
  console.log('\n📊 PROGRESS DISTRIBUTION:\n');
  for (const [range, count] of Object.entries(stats.byProgressRange)) {
    if (count > 0) {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      console.log(`   ${range.padEnd(20)}: ${count} tasks (${percentage}%)`);
    }
  }
  
  // Display by fix version
  console.log('\n📦 BY FIX VERSION:\n');
  const fixVersionEntries = Object.entries(stats.byFixVersion).sort((a, b) => b[1].count - a[1].count);
  for (const [fixVersion, data] of fixVersionEntries) {
    console.log(`   ${fixVersion}:`);
    console.log(`      Tasks: ${data.count}`);
    console.log(`      Avg Progress: ${data.avgProgress}%`);
    console.log('');
  }
  
  // Display by status
  console.log('\n📋 BY STATUS:\n');
  const statusEntries = Object.entries(stats.byStatus).sort((a, b) => b[1].count - a[1].count);
  for (const [status, data] of statusEntries) {
    console.log(`   ${status}:`);
    console.log(`      Tasks: ${data.count}`);
    console.log(`      Avg Progress: ${data.avgProgress}%`);
  }
  
  // Display by assignee
  console.log('\n👥 BY ASSIGNEE:\n');
  const assigneeEntries = Object.entries(stats.byAssignee).sort((a, b) => b[1].count - a[1].count);
  for (const [assignee, data] of assigneeEntries) {
    console.log(`   ${assignee}:`);
    console.log(`      Tasks: ${data.count}`);
    console.log(`      Avg Progress: ${data.avgProgress}%`);
  }
  
  // Display tasks grouped by fix version
  console.log('\n📝 TASKS BY FIX VERSION:\n');
  
  for (const [fixVersion, data] of fixVersionEntries) {
    console.log(`\n   ${fixVersion} (${data.count} tasks, avg ${data.avgProgress}% progress):`);
    console.log('   ' + '-'.repeat(80));
    
    const sortedVersionTasks = [...data.tasks].sort((a, b) => {
      if (a.progress === null && b.progress === null) return 0;
      if (a.progress === null) return 1;
      if (b.progress === null) return -1;
      return a.progress - b.progress;
    });
    
    for (const task of sortedVersionTasks) {
      const progressStr = task.progress !== null ? `${task.progress}%`.padEnd(5) : 'N/A  ';
      const shortSummary = task.summary.replace('Design: ', '');
      console.log(`      ${progressStr} | ${task.key} | ${task.status.padEnd(15)} | ${shortSummary}`);
    }
  }
  
  // Display all tasks sorted by progress
  console.log('\n\n📝 ALL DESIGN TASKS (sorted by progress):\n');
  
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.progress === null && b.progress === null) return 0;
    if (a.progress === null) return 1;
    if (b.progress === null) return -1;
    return a.progress - b.progress;
  });
  
  for (const task of sortedTasks) {
    const progressStr = task.progress !== null ? `${task.progress}%`.padEnd(5) : 'N/A  ';
    console.log(`   ${progressStr} | ${task.key} | ${task.fixVersion.padEnd(15)} | ${task.status.padEnd(15)} | ${task.summary}`);
  }
  
  // Prepare report data
  const reportData = {
    date: new Date().toISOString().split('T')[0],
    project: PROJECT_KEY,
    summary: {
      totalTasks: stats.total,
      tasksWithProgress: stats.withProgress,
      tasksWithoutProgress: stats.withoutProgress,
      averageProgress: stats.averageProgress
    },
    progressDistribution: stats.byProgressRange,
    byFixVersion: stats.byFixVersion,
    byStatus: stats.byStatus,
    byAssignee: stats.byAssignee,
    tasks: sortedTasks
  };
  
  // Save to JSON file
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const outputFile = path.join(reportsDir, 'design-progress.json');
  fs.writeFileSync(outputFile, JSON.stringify(reportData, null, 2));
  
  console.log(`\n✅ Report saved to: ${outputFile}\n`);
  
  return reportData;
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Design Progress Report...\n');
    
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

