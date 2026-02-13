#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED'];
const TEAM_FIELDS = ['customfield_12700', 'customfield_13445', 'customfield_13462'];
const TEAMS_OF_INTEREST = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5'];

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

function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
  });
}

function extractTeam(fields) {
  for (const fieldId of TEAM_FIELDS) {
    const teamField = fields[fieldId];
    if (!teamField) continue;

    if (typeof teamField === 'string') return teamField;
    if (teamField.value) return teamField.value;
    if (teamField.name) return teamField.name;
    if (Array.isArray(teamField) && teamField.length > 0) {
      return teamField[0].value || teamField[0].name || teamField[0];
    }
  }
  return 'Unassigned';
}

function sortTeams(grouped) {
  const teams = Array.from(grouped.keys());
  return [
    ...TEAMS_OF_INTEREST.filter(team => teams.includes(team)),
    ...teams.filter(team => !TEAMS_OF_INTEREST.includes(team)).sort((a, b) => a.localeCompare(b))
  ];
}

async function getFieldIds(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];

    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );
    const sprintField = fields.find(field =>
      field.name && field.name.toLowerCase() === 'sprint'
    );

    return {
      storyPointsFieldId: storyPointsField ? storyPointsField.id : 'customfield_10003',
      sprintFieldId: sprintField ? sprintField.id : 'customfield_11150'
    };
  } catch (error) {
    return {
      storyPointsFieldId: 'customfield_10003',
      sprintFieldId: 'customfield_11150'
    };
  }
}

function movedToCompletedToday(issue, todayStr) {
  const histories = issue.changelog?.histories || [];
  for (const history of histories) {
    const changeDate = history.created.split('T')[0];
    if (changeDate !== todayStr) continue;

    for (const item of history.items || []) {
      if (item.field === 'status' && item.toString) {
        const toStatus = item.toString.toUpperCase();
        if (COMPLETED_STATUSES.includes(toStatus)) {
          return item.toString;
        }
      }
    }
  }

  return null;
}

function extractSprintName(fields, sprintFieldId) {
  const sprintData = fields[sprintFieldId];
  if (!sprintData) return 'None';

  if (Array.isArray(sprintData) && sprintData.length > 0) {
    const names = sprintData
      .map(sprint => sprint.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : 'None';
  }

  return 'None';
}

async function fetchClosedToday(client, fieldIds, todayStr) {
  const statusList = COMPLETED_STATUSES.map(status => `"${status}"`).join(', ');
  const jql = `project = ${PROJECT_KEY} AND status in (${statusList}) AND updated >= "${todayStr}"`;

  console.log('\n🔎 Querying tickets updated today...');
  console.log(`   JQL: ${jql}`);

  const response = await client.post('/rest/api/3/search/jql', {
    jql,
    maxResults: 1000
  });

  const issueRefs = response.data.issues || [];
  console.log(`   ✓ Found ${issueRefs.length} candidate issues`);

  const closedToday = [];
  for (const issueRef of issueRefs) {
    const issueKey = issueRef.key || issueRef.id;
    try {
      const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
        params: {
          fields: `summary,issuetype,status,${fieldIds.storyPointsFieldId},${fieldIds.sprintFieldId},${TEAM_FIELDS.join(',')}`,
          expand: 'changelog'
        }
      });

      const issue = issueResponse.data;
      const movedTo = movedToCompletedToday(issue, todayStr);
      if (!movedTo) continue;

      const fields = issue.fields || {};
      closedToday.push({
        key: issue.key,
        summary: fields.summary || '',
        issueType: fields.issuetype?.name || 'Unknown',
        status: movedTo,
        storyPoints: fields[fieldIds.storyPointsFieldId] || 0,
        sprint: extractSprintName(fields, fieldIds.sprintFieldId),
        team: extractTeam(fields)
      });
    } catch (error) {
      console.warn(`   ⚠️  Could not fetch ${issueKey}: ${error.message}`);
    }
  }

  return closedToday.sort((a, b) => a.key.localeCompare(b.key));
}

function saveMarkdownReport(dateStr, issues) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `closed-today-${dateStr}.md`;
  const filepath = path.join(reportsDir, filename);

  const lines = [];
  lines.push(`# Tickets Closed / Ready for Release - ${dateStr}`);
  lines.push('');
  lines.push(`Project: ${PROJECT_KEY}`);
  lines.push('');
  lines.push(`Total: ${issues.length}`);
  lines.push('');
  lines.push('| Key | Team | Type | Status | Story Points | Sprint | Summary |');
  lines.push('|-----|------|--------|--------|--------------|--------|---------|');

  if (!issues.length) {
    lines.push('| _None_ |  |  |  |  |  |  |');
  } else {
    for (const issue of issues) {
      lines.push(`| ${issue.key} | ${issue.team} | ${issue.issueType} | ${issue.status} | ${issue.storyPoints} | ${issue.sprint} | ${issue.summary} |`);
    }
  }

  const grouped = new Map();
  for (const issue of issues) {
    const team = issue.team || 'Unassigned';
    if (!grouped.has(team)) grouped.set(team, []);
    grouped.get(team).push(issue);
  }

  if (grouped.size) {
    lines.push('');
    lines.push('## By Team');
    lines.push('');

    for (const team of sortTeams(grouped)) {
      const teamIssues = grouped.get(team) || [];
      lines.push(`### ${team}`);
      lines.push('');
      if (!teamIssues.length) {
        lines.push('_None_');
        lines.push('');
        continue;
      }
      lines.push('| Key | Type | Status | Story Points | Sprint | Summary |');
      lines.push('|-----|------|--------|--------------|--------|---------|');
      for (const issue of teamIssues) {
        lines.push(`| ${issue.key} | ${issue.issueType} | ${issue.status} | ${issue.storyPoints} | ${issue.sprint} | ${issue.summary} |`);
      }
      lines.push('');
    }
  }

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`✅ Markdown report saved to: ${filepath}`);
  return filepath;
}

async function main() {
  try {
    validateConfig();
    const client = createJiraClient();
    const todayStr = new Date().toISOString().split('T')[0];

    console.log('\n📊 Tickets Closed / Ready for Release Today');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Date (UTC): ${todayStr}`);

    const fieldIds = await getFieldIds(client);
    const issues = await fetchClosedToday(client, fieldIds, todayStr);

    console.log(`\n✅ Found ${issues.length} tickets moved to Completed/Ready today`);
    const teamCounts = new Map();
    issues.forEach(issue => {
      const team = issue.team || 'Unassigned';
      teamCounts.set(team, (teamCounts.get(team) || 0) + 1);
    });
    if (teamCounts.size) {
      console.log('   By Team:');
      for (const team of sortTeams(teamCounts)) {
        console.log(`   - ${team}: ${teamCounts.get(team)}`);
      }
    }
    issues.forEach(issue => {
      console.log(`   - ${issue.key} | ${issue.issueType} | ${issue.status} | SP: ${issue.storyPoints} | Sprint: ${issue.sprint}`);
    });

    saveMarkdownReport(todayStr, issues);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Failed to generate report');
    console.error(error.message);
    process.exit(1);
  }
}

main();
