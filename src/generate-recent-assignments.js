#!/usr/bin/env node

/**
 * Recent Assignment Report
 *
 * Finds issues in a sprint where the assignee changed in the last N hours.
 *
 * Usage:
 *   node src/generate-recent-assignments.js ["NH Sprint 35"] [hours]
 *
 * Example:
 *   node src/generate-recent-assignments.js "NH Sprint 35" 4
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const DEFAULT_SPRINT = 'NH Sprint 35';
const DEFAULT_HOURS = 4;
const TEAM_FIELDS = ['customfield_12700', 'customfield_13445', 'customfield_13462'];
const TEAMS_OF_INTEREST = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5'];

// Disable SSL verification (for corporate proxies)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

function formatUkTime(isoString) {
  if (!isoString) return 'Unknown';
  return new Date(isoString).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    hour12: false
  });
}

function truncate(text, max = 50) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function daysSince(dateString) {
  if (!dateString) return 'Unknown';
  const ms = Date.now() - new Date(dateString).getTime();
  if (Number.isNaN(ms)) return 'Unknown';
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function extractTeam(fields) {
  if (!fields) return 'Unassigned';

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

async function fetchRecentAssignments(client, sprintName, hours) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND assignee CHANGED DURING (-${hours}h, now) ORDER BY updated DESC`;

  let nextPageToken = null;
  let issues = [];

  do {
    const body = {
      jql,
      maxResults: 100,
      fields: ['key', 'summary', 'assignee', 'updated']
    };

    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    issues = issues.concat(response.data.issues || []);
    nextPageToken = response.data.nextPageToken || null;

    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return issues;
}

async function fetchAssignedInProgress(client, sprintName) {
  const jql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND assignee is not EMPTY AND status in ("In Dev", "In QA") ORDER BY updated DESC`;

  let nextPageToken = null;
  let issues = [];

  do {
    const body = {
      jql,
      maxResults: 100,
      fields: ['key', 'summary', 'assignee', 'status', 'issuetype', 'updated', 'statuscategorychangedate', ...TEAM_FIELDS]
    };

    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    issues = issues.concat(response.data.issues || []);
    nextPageToken = response.data.nextPageToken || null;

    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return issues;
}

async function fetchIssueWithChangelog(client, issueKey) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: `key,summary,assignee,updated,${TEAM_FIELDS.join(',')}`,
      expand: 'changelog'
    }
  });

  return response.data;
}

function findLatestAssigneeChange(histories, sinceMs) {
  let latest = null;

  for (const history of histories || []) {
    const createdMs = new Date(history.created).getTime();
    if (createdMs < sinceMs) continue;

    for (const item of history.items || []) {
      if (item.field !== 'assignee') continue;

      if (!latest || createdMs > new Date(latest.created).getTime()) {
        latest = {
          created: history.created,
          from: item.fromString || '',
          to: item.toString || ''
        };
      }
    }
  }

  return latest;
}

async function main() {
  const sprintName = process.argv[2] || DEFAULT_SPRINT;
  const hoursArg = process.argv[3];
  const hours = hoursArg ? Number(hoursArg) : DEFAULT_HOURS;

  if (!hours || Number.isNaN(hours) || hours <= 0) {
    console.error('❌ Error: hours must be a positive number');
    process.exit(1);
  }

  const sinceMs = Date.now() - hours * 60 * 60 * 1000;

  const reportLines = [];
  const recentAssignmentResults = [];

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📌 RECENT ASSIGNMENTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Sprint: ${sprintName}`);
  console.log(`   Window: Last ${hours} hours`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  reportLines.push(`# Recent Assignments: ${sprintName}`);
  reportLines.push('');
  reportLines.push(`**Window:** Last ${hours} hours`);
  reportLines.push(`**Generated:** ${new Date().toISOString()}`);
  reportLines.push('');

  const client = createJiraClient();
  const issues = await fetchRecentAssignments(client, sprintName, hours);

  if (!issues.length) {
    console.log('No assignee changes found in the time window.');
    reportLines.push('## Recent Assignee Changes');
    reportLines.push('');
    reportLines.push('No assignee changes found in the time window.');
  } else {
    reportLines.push('## Recent Assignee Changes');
    reportLines.push('');
    reportLines.push('| Issue | Assigned At (UK) | From | To | Summary |');
    reportLines.push('|-------|------------------|------|----|---------|');

    const results = [];
    let processed = 0;

    for (const issue of issues) {
      const key = issue.key;

      try {
        const fullIssue = await fetchIssueWithChangelog(client, key);
        const latestChange = findLatestAssigneeChange(fullIssue.changelog?.histories, sinceMs);

        results.push({
          key,
          summary: fullIssue.fields.summary || '',
          from: latestChange?.from || '',
          to: latestChange?.to || (fullIssue.fields.assignee?.displayName || 'Unassigned'),
          assignedAt: latestChange?.created || fullIssue.fields.updated || null,
          team: extractTeam(fullIssue.fields)
        });
      } catch (error) {
        results.push({
          key,
          summary: issue.fields?.summary || '',
          from: '',
          to: issue.fields?.assignee?.displayName || 'Unassigned',
          assignedAt: issue.fields?.updated || null,
          team: extractTeam(issue.fields),
          error: error.message
        });
      }

      processed++;
      if (processed % 10 === 0) {
        process.stdout.write(`   Processed ${processed}/${issues.length} issues\r`);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    if (processed >= 10) {
      process.stdout.write('\n');
    }

    console.log('Issue Key   │ Assigned At (UK)     │ From               │ To                 │ Summary');
    console.log('────────────┼──────────────────────┼────────────────────┼────────────────────┼────────────────────────────────────────────────────');

    for (const r of results) {
      const keyStr = r.key.padEnd(10);
      const timeStr = formatUkTime(r.assignedAt).padEnd(20);
      const fromStr = truncate(r.from || 'Unassigned', 18).padEnd(18);
      const toStr = truncate(r.to || 'Unassigned', 18).padEnd(18);
      const summaryStr = truncate(r.summary, 52);

      console.log(`${keyStr} │ ${timeStr} │ ${fromStr} │ ${toStr} │ ${summaryStr}`);
      if (r.error) {
        console.log(`            │ Error: ${r.error}`);
      }

      reportLines.push(`| ${r.key} | ${formatUkTime(r.assignedAt)} | ${r.from || 'Unassigned'} | ${r.to || 'Unassigned'} | ${r.summary} |`);
    }

    recentAssignmentResults.push(...results);

    const newlyAssigned = results.filter(r => !r.from || r.from === 'Unassigned');
    console.log('\nSummary:');
    console.log(`  Total assignment changes: ${results.length}`);
    console.log(`  Newly assigned (was unassigned): ${newlyAssigned.length}`);

    reportLines.push('');
    reportLines.push(`**Total assignment changes:** ${results.length}`);
    reportLines.push(`**Newly assigned (was unassigned):** ${newlyAssigned.length}`);
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('✅ ASSIGNED & IN PROGRESS (Sprint)');
  console.log('───────────────────────────────────────────────────────────────');

  const inProgressIssues = await fetchAssignedInProgress(client, sprintName);
  const normalizedInProgress = inProgressIssues.map(issue => ({
    ...issue,
    team: extractTeam(issue.fields)
  }));
  if (!inProgressIssues.length) {
    console.log('No assigned issues in progress found.');
    reportLines.push('');
    reportLines.push('## Assigned & In Progress');
    reportLines.push('');
    reportLines.push('No assigned issues in progress found.');
  } else {
    reportLines.push('');
    reportLines.push('## Assigned & In Progress');
    reportLines.push('');
    reportLines.push('| Issue | Type | Status | Assignee | Updated (UK) | Days Since Status Change | Summary |');
    reportLines.push('|-------|------|--------|----------|--------------|--------------------------|---------|');

    console.log('Issue Key   │ Type    │ Status           │ Assignee          │ Updated (UK)         │ Days │ Summary');
    console.log('────────────┼─────────┼──────────────────┼───────────────────┼──────────────────────┼──────┼────────────────────────────────────────────────────');

    for (const issue of normalizedInProgress) {
      const keyStr = issue.key.padEnd(10);
      const typeStr = truncate(issue.fields?.issuetype?.name || 'Unknown', 7).padEnd(7);
      const statusStr = truncate(issue.fields?.status?.name || 'Unknown', 16).padEnd(16);
      const assigneeStr = truncate(issue.fields?.assignee?.displayName || 'Unassigned', 17).padEnd(17);
      const updatedStr = formatUkTime(issue.fields?.updated).padEnd(20);
      const daysStr = String(daysSince(issue.fields?.statuscategorychangedate)).padEnd(4);
      const summaryStr = truncate(issue.fields?.summary || '', 52);

      console.log(`${keyStr} │ ${typeStr} │ ${statusStr} │ ${assigneeStr} │ ${updatedStr} │ ${daysStr} │ ${summaryStr}`);
      reportLines.push(`| ${issue.key} | ${issue.fields?.issuetype?.name || 'Unknown'} | ${issue.fields?.status?.name || 'Unknown'} | ${issue.fields?.assignee?.displayName || 'Unassigned'} | ${formatUkTime(issue.fields?.updated)} | ${daysSince(issue.fields?.statuscategorychangedate)} | ${issue.fields?.summary || ''} |`);
    }

    console.log(`\nTotal assigned & in progress: ${inProgressIssues.length}`);
    reportLines.push('');
    reportLines.push(`**Total assigned & in progress:** ${inProgressIssues.length}`);
  }

  // Group by assignee for quick workload view
  const byAssignee = new Map();
  for (const issue of normalizedInProgress) {
    const assignee = issue.fields?.assignee?.displayName || 'Unassigned';
    if (!byAssignee.has(assignee)) {
      byAssignee.set(assignee, []);
    }
    byAssignee.get(assignee).push(issue);
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('👥 ASSIGNED & IN PROGRESS BY ASSIGNEE');
  console.log('───────────────────────────────────────────────────────────────');

  const assignees = Array.from(byAssignee.keys()).sort((a, b) => a.localeCompare(b));
  reportLines.push('');
  reportLines.push('## Assigned & In Progress by Assignee');

  for (const assignee of assignees) {
    const issues = byAssignee.get(assignee);
    console.log(`\n${assignee} (${issues.length})`);
    console.log('Issue Key   │ Type    │ Status           │ Updated (UK)         │ Days │ Summary');
    console.log('────────────┼─────────┼──────────────────┼──────────────────────┼──────┼────────────────────────────────────────────────────');

    reportLines.push('');
    reportLines.push(`### ${assignee} (${issues.length})`);
    reportLines.push('');
    reportLines.push('| Issue | Type | Status | Updated (UK) | Days Since Status Change | Summary |');
    reportLines.push('|-------|------|--------|--------------|--------------------------|---------|');

    for (const issue of issues) {
      const keyStr = issue.key.padEnd(10);
      const typeStr = truncate(issue.fields?.issuetype?.name || 'Unknown', 7).padEnd(7);
      const statusStr = truncate(issue.fields?.status?.name || 'Unknown', 16).padEnd(16);
      const updatedStr = formatUkTime(issue.fields?.updated).padEnd(20);
      const daysStr = String(daysSince(issue.fields?.statuscategorychangedate)).padEnd(4);
      const summaryStr = truncate(issue.fields?.summary || '', 52);

      console.log(`${keyStr} │ ${typeStr} │ ${statusStr} │ ${updatedStr} │ ${daysStr} │ ${summaryStr}`);
      reportLines.push(`| ${issue.key} | ${issue.fields?.issuetype?.name || 'Unknown'} | ${issue.fields?.status?.name || 'Unknown'} | ${formatUkTime(issue.fields?.updated)} | ${daysSince(issue.fields?.statuscategorychangedate)} | ${issue.fields?.summary || ''} |`);
    }
  }

  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, 'recent-assignments.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Team-specific reports
  for (const teamName of TEAMS_OF_INTEREST) {
    const teamLines = [];
    teamLines.push(`# Recent Assignments: ${sprintName} (${teamName})`);
    teamLines.push('');
    teamLines.push(`**Window:** Last ${hours} hours`);
    teamLines.push(`**Generated:** ${new Date().toISOString()}`);
    teamLines.push('');

    teamLines.push('## Recent Assignee Changes');
    teamLines.push('');
    const teamRecent = recentAssignmentResults.filter(r => r.team === teamName);
    if (!teamRecent.length) {
      teamLines.push('No assignee changes found in the time window.');
    } else {
      teamLines.push('| Issue | Assigned At (UK) | From | To | Summary |');
      teamLines.push('|-------|------------------|------|----|---------|');
      for (const r of teamRecent) {
        teamLines.push(`| ${r.key} | ${formatUkTime(r.assignedAt)} | ${r.from || 'Unassigned'} | ${r.to || 'Unassigned'} | ${r.summary} |`);
      }
    }

    teamLines.push('');
    teamLines.push('## Assigned & In Progress');
    teamLines.push('');
    const teamInProgress = normalizedInProgress.filter(issue => issue.team === teamName);
    if (!teamInProgress.length) {
      teamLines.push('No assigned issues in progress found.');
    } else {
        teamLines.push('| Issue | Type | Status | Assignee | Updated (UK) | Days Since Status Change | Summary |');
        teamLines.push('|-------|------|--------|----------|--------------|--------------------------|---------|');
      for (const issue of teamInProgress) {
        teamLines.push(`| ${issue.key} | ${issue.fields?.issuetype?.name || 'Unknown'} | ${issue.fields?.status?.name || 'Unknown'} | ${issue.fields?.assignee?.displayName || 'Unassigned'} | ${formatUkTime(issue.fields?.updated)} | ${daysSince(issue.fields?.statuscategorychangedate)} | ${issue.fields?.summary || ''} |`);
      }
      teamLines.push('');
      teamLines.push(`**Total assigned & in progress:** ${teamInProgress.length}`);
    }

    teamLines.push('');
    teamLines.push('## Assigned & In Progress by Assignee');
    if (!teamInProgress.length) {
      teamLines.push('');
      teamLines.push('No assigned issues in progress found.');
    } else {
      const teamByAssignee = new Map();
      for (const issue of teamInProgress) {
        const assignee = issue.fields?.assignee?.displayName || 'Unassigned';
        if (!teamByAssignee.has(assignee)) {
          teamByAssignee.set(assignee, []);
        }
        teamByAssignee.get(assignee).push(issue);
      }

      const teamAssignees = Array.from(teamByAssignee.keys()).sort((a, b) => a.localeCompare(b));
      for (const assignee of teamAssignees) {
        const issues = teamByAssignee.get(assignee);
        teamLines.push('');
        teamLines.push(`### ${assignee} (${issues.length})`);
        teamLines.push('');
        teamLines.push('| Issue | Type | Status | Updated (UK) | Days Since Status Change | Summary |');
        teamLines.push('|-------|------|--------|--------------|--------------------------|---------|');
        for (const issue of issues) {
          teamLines.push(`| ${issue.key} | ${issue.fields?.issuetype?.name || 'Unknown'} | ${issue.fields?.status?.name || 'Unknown'} | ${formatUkTime(issue.fields?.updated)} | ${daysSince(issue.fields?.statuscategorychangedate)} | ${issue.fields?.summary || ''} |`);
        }
      }
    }

    const teamSlug = teamName.toLowerCase().replace(/\s+/g, '-');
    const teamReportPath = path.join(reportsDir, `recent-assignments-${teamSlug}.md`);
    fs.writeFileSync(teamReportPath, teamLines.join('\n'));
    console.log(`📄 Team report saved to: ${teamReportPath}`);
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.response?.data) {
    console.error('Response:', error.response.data);
  }
  process.exit(1);
});
