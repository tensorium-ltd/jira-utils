#!/usr/bin/env node

const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const CURRENT_SPRINT = 'NH Sprint 32';

// Custom field IDs
const STORY_POINTS_FIELD = 'customfield_10003';
const TEAM_FIELD = 'customfield_12700';
const SPRINT_FIELD = 'customfield_11150';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

async function getSprintIssues(sprintName) {
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}"`,
      maxResults: 1000,
      fields: [
        'key',
        'summary',
        'status',
        'issuetype',
        'priority',
        'labels',
        'components',
        STORY_POINTS_FIELD,
        TEAM_FIELD,
        'parent',
        'customfield_10014' // Epic Link
      ]
    });
    
    return response.data.issues || [];
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    throw error;
  }
}

function getTeamName(issue) {
  const teamField = issue.fields[TEAM_FIELD];
  if (!teamField) return 'Unassigned';
  if (typeof teamField === 'string') return teamField;
  if (teamField.value) return teamField.value;
  if (teamField.name) return teamField.name;
  return 'Unassigned';
}

function getEpicKey(issue) {
  // Try Epic Link field first
  const epicLink = issue.fields.customfield_10014;
  if (epicLink) return epicLink;
  
  // Try parent field (for sub-tasks)
  const parent = issue.fields.parent;
  if (parent && parent.key) return parent.key;
  
  return null;
}

async function getEpicDetails(epicKey) {
  if (!epicKey) return null;
  
  try {
    const response = await client.get(`/rest/api/3/issue/${epicKey}`, {
      params: {
        fields: 'summary,key'
      }
    });
    
    return {
      key: response.data.key,
      summary: response.data.fields.summary
    };
  } catch (error) {
    console.error(`Error fetching epic ${epicKey}:`, error.message);
    return { key: epicKey, summary: 'Unknown Epic' };
  }
}

function analyzeIssues(issues) {
  const analysis = {
    total: issues.length,
    byType: {},
    byStatus: {},
    byTeam: {},
    byEpic: {},
    byComponent: {},
    byLabel: {},
    stories: [],
    bugs: [],
    totalPoints: 0
  };
  
  for (const issue of issues) {
    const issueType = issue.fields.issuetype.name;
    const status = issue.fields.status.name;
    const team = getTeamName(issue);
    const points = issue.fields[STORY_POINTS_FIELD] || 0;
    const labels = issue.fields.labels || [];
    const components = issue.fields.components || [];
    const epicKey = getEpicKey(issue);
    
    // By type
    analysis.byType[issueType] = (analysis.byType[issueType] || 0) + 1;
    
    // By status
    analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;
    
    // By team
    if (!analysis.byTeam[team]) {
      analysis.byTeam[team] = { count: 0, points: 0 };
    }
    analysis.byTeam[team].count++;
    analysis.byTeam[team].points += points;
    
    // By epic
    if (epicKey) {
      if (!analysis.byEpic[epicKey]) {
        analysis.byEpic[epicKey] = { count: 0, points: 0, issues: [] };
      }
      analysis.byEpic[epicKey].count++;
      analysis.byEpic[epicKey].points += points;
      analysis.byEpic[epicKey].issues.push({
        key: issue.key,
        summary: issue.fields.summary,
        type: issueType,
        status: status,
        points: points
      });
    }
    
    // By component
    for (const component of components) {
      const compName = component.name;
      if (!analysis.byComponent[compName]) {
        analysis.byComponent[compName] = { count: 0, points: 0 };
      }
      analysis.byComponent[compName].count++;
      analysis.byComponent[compName].points += points;
    }
    
    // By label
    for (const label of labels) {
      if (!analysis.byLabel[label]) {
        analysis.byLabel[label] = { count: 0, points: 0 };
      }
      analysis.byLabel[label].count++;
      analysis.byLabel[label].points += points;
    }
    
    // Collect stories and bugs for keyword analysis
    if (issueType === 'Story') {
      analysis.stories.push(issue.fields.summary);
    } else if (issueType === 'Bug') {
      analysis.bugs.push(issue.fields.summary);
    }
    
    analysis.totalPoints += points;
  }
  
  return analysis;
}

function extractKeywords(summaries) {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall',
    'as', 'from', 'by', 'about', 'into', 'through', 'during', 'before', 'after',
    'ui', 'ux', 'fix', 'update', 'add', 'remove', 'change', 'improve', 'implement'
  ]);
  
  const keywords = {};
  
  for (const summary of summaries) {
    const words = summary.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    for (const word of words) {
      keywords[word] = (keywords[word] || 0) + 1;
    }
  }
  
  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
}

async function main() {
  console.log('\n📊 Sprint Goal Analysis');
  console.log('============================================================');
  console.log(`   Sprint: ${CURRENT_SPRINT}`);
  console.log(`   Project: ${PROJECT_KEY}\n`);
  
  // Get all issues
  console.log('📥 Fetching sprint issues...');
  const issues = await getSprintIssues(CURRENT_SPRINT);
  console.log(`   ✓ Found ${issues.length} issues\n`);
  
  // Analyze issues
  const analysis = analyzeIssues(issues);
  
  // Get epic details
  console.log('📚 Fetching epic details...');
  const epicDetails = {};
  for (const epicKey of Object.keys(analysis.byEpic)) {
    const details = await getEpicDetails(epicKey);
    if (details) {
      epicDetails[epicKey] = details;
    }
  }
  console.log(`   ✓ Loaded ${Object.keys(epicDetails).length} epics\n`);
  
  // Display analysis
  console.log('============================================================');
  console.log('📊 SPRINT COMPOSITION\n');
  
  console.log(`Total Issues: ${analysis.total}`);
  console.log(`Total Story Points: ${analysis.totalPoints}\n`);
  
  console.log('By Issue Type:');
  for (const [type, count] of Object.entries(analysis.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
  
  console.log('\nBy Status:');
  for (const [status, count] of Object.entries(analysis.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${status}: ${count}`);
  }
  
  console.log('\nBy Team:');
  for (const [team, data] of Object.entries(analysis.byTeam).sort((a, b) => b[1].points - a[1].points)) {
    console.log(`   ${team}: ${data.count} issues, ${data.points} points`);
  }
  
  console.log('\n============================================================');
  console.log('🎯 EPIC BREAKDOWN (Top Themes)\n');
  
  const sortedEpics = Object.entries(analysis.byEpic)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 10);
  
  for (const [epicKey, data] of sortedEpics) {
    const epic = epicDetails[epicKey] || { key: epicKey, summary: 'Unknown' };
    console.log(`${epic.key}: ${epic.summary}`);
    console.log(`   ${data.count} issues, ${data.points} points`);
    
    // Show top 3 issues
    const topIssues = data.issues
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    
    for (const issue of topIssues) {
      console.log(`   - ${issue.key} (${issue.points} pts): ${issue.summary.substring(0, 60)}...`);
    }
    console.log('');
  }
  
  if (Object.keys(analysis.byComponent).length > 0) {
    console.log('============================================================');
    console.log('🏗️  COMPONENTS\n');
    
    for (const [component, data] of Object.entries(analysis.byComponent).sort((a, b) => b[1].points - a[1].points)) {
      console.log(`   ${component}: ${data.count} issues, ${data.points} points`);
    }
    console.log('');
  }
  
  if (Object.keys(analysis.byLabel).length > 0) {
    console.log('============================================================');
    console.log('🏷️  LABELS\n');
    
    for (const [label, data] of Object.entries(analysis.byLabel).sort((a, b) => b[1].points - a[1].points).slice(0, 10)) {
      console.log(`   ${label}: ${data.count} issues, ${data.points} points`);
    }
    console.log('');
  }
  
  console.log('============================================================');
  console.log('🔑 KEYWORD ANALYSIS\n');
  
  const allSummaries = issues.map(i => i.fields.summary);
  const keywords = extractKeywords(allSummaries);
  
  console.log('Top keywords across all summaries:');
  for (const [word, count] of keywords.slice(0, 15)) {
    console.log(`   ${word}: ${count}`);
  }
  
  console.log('\n============================================================');
  console.log('💡 SUGGESTED SPRINT GOAL\n');
  
  // Generate sprint goal suggestions based on analysis
  const topEpics = sortedEpics.slice(0, 3);
  const epicSummaries = topEpics.map(([key]) => {
    const epic = epicDetails[key];
    return epic ? epic.summary : 'Unknown';
  });
  
  console.log('Based on the top epics and themes, here are suggested sprint goals:\n');
  
  console.log('Option 1 (Epic-focused):');
  console.log(`"Complete ${topEpics.length} key initiatives: ${epicSummaries.join(', ')}"`);
  
  console.log('\nOption 2 (Outcome-focused):');
  const topKeywords = keywords.slice(0, 5).map(([word]) => word);
  console.log(`"Deliver enhancements to ${topKeywords.slice(0, 3).join(', ')} and resolve high-priority bugs"`);
  
  console.log('\nOption 3 (Balanced):');
  console.log(`"Advance ${topEpics.length} major features while maintaining system stability and addressing technical debt"`);
  
  console.log('\n============================================================\n');
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

