#!/usr/bin/env node

/**
 * Productivity by Engineer (Last 2 Months)
 *
 * Calculates total story points completed by each engineer over the last 2 months,
 * attributing work to the assignee at the time the issue first moved to "In Dev".
 *
 * Usage: node src/generate-productivity-by-engineer.js
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const STORY_POINTS_FIELD = 'customfield_10003';

// Status configuration
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED', 'DONE', 'COMPLETED'];
const IN_DEV_STATUSES = ['IN DEV', 'IN DEVELOPMENT', 'IN PROGRESS', 'DEVELOPMENT'];

// Disable SSL verification (for corporate proxies)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
 * Calculate date 2 months ago (YYYY-MM-DD)
 */
function getTwoMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return date.toISOString().split('T')[0];
}

/**
 * Fetch issues with cursor-based pagination
 */
async function fetchIssues(client, jql) {
  console.log(`   JQL: ${jql}`);

  let allIssueKeys = [];
  let nextPageToken = null;

  do {
    const body = {
      jql,
      maxResults: 100,
      fields: ['key']
    };

    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    const issues = response.data.issues || [];
    allIssueKeys = allIssueKeys.concat(issues.map(i => i.key));

    nextPageToken = response.data.nextPageToken || null;

    console.log(`   Fetched ${allIssueKeys.length} issue keys${nextPageToken ? ' (more pages...)' : ''}`);

    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return allIssueKeys;
}

/**
 * Fetch issue details with changelog
 */
async function fetchIssueDetails(client, issueKey) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: `key,summary,issuetype,assignee,status,${STORY_POINTS_FIELD}`,
      expand: 'changelog'
    }
  });
  return response.data;
}

/**
 * Get the completion date from changelog
 */
function getCompletionDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  for (let i = issue.changelog.histories.length - 1; i >= 0; i--) {
    const history = issue.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' &&
          COMPLETED_STATUSES.some(s =>
            s === item.toString?.toUpperCase() ||
            item.toString?.toUpperCase().includes(s)
          )) {
        return history.created.split('T')[0];
      }
    }
  }

  return null;
}

/**
 * Determine assignee at time of first "In Dev" transition.
 */
function getAssigneeAtInDev(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return issue.fields.assignee?.displayName || 'Unassigned';
  }

  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );

  let currentAssignee = issue.fields.assignee?.displayName || 'Unassigned';

  for (const history of histories) {
    let assigneeChange = null;
    let movedToInDev = false;

    for (const item of history.items) {
      if (item.field === 'assignee') {
        assigneeChange = item.toString || item.to || null;
      }
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').toUpperCase();
        if (IN_DEV_STATUSES.some(s => toStatus === s || toStatus.includes(s))) {
          movedToInDev = true;
        }
      }
    }

    if (assigneeChange) {
      currentAssignee = assigneeChange;
    }

    if (movedToInDev) {
      return assigneeChange || currentAssignee || 'Unassigned';
    }
  }

  return currentAssignee || 'Unassigned';
}

/**
 * Main
 */
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📈 PRODUCTIVITY BY ENGINEER (LAST 2 MONTHS)');
  console.log('═══════════════════════════════════════════════════════════════');

  const client = createJiraClient();
  const startDate = getTwoMonthsAgo();
  const endDate = new Date().toISOString().split('T')[0];

  console.log(`   Date Range: ${startDate} to ${endDate}`);
  console.log(`   Project: ${PROJECT_KEY}\n`);

  const statusList = COMPLETED_STATUSES.map(s => `"${s.charAt(0)}${s.slice(1).toLowerCase()}"`).join(', ');
  const jql = `project = ${PROJECT_KEY} AND issuetype in (Story, Bug) AND status changed to (${statusList}) after "${startDate}"`;

  console.log('🔍 Fetching issue keys...');
  const issueKeys = await fetchIssues(client, jql);

  if (issueKeys.length === 0) {
    console.log('   ⚠️  No issues found for the period');
    return;
  }

  console.log(`   ✓ Found ${issueKeys.length} issues\n`);

  const stats = {};
  let processed = 0;
  let skipped = 0;

  for (const key of issueKeys) {
    try {
      const issue = await fetchIssueDetails(client, key);
      const completionDate = getCompletionDate(issue);

      if (!completionDate || completionDate < startDate || completionDate > endDate) {
        skipped++;
        continue;
      }

      const assignee = getAssigneeAtInDev(issue);
      const points = issue.fields[STORY_POINTS_FIELD] || 0;

      if (!stats[assignee]) {
        stats[assignee] = { issues: 0, points: 0, missingPoints: 0 };
      }

      stats[assignee].issues += 1;
      stats[assignee].points += points;
      if (!issue.fields[STORY_POINTS_FIELD]) {
        stats[assignee].missingPoints += 1;
      }

      processed++;
      if (processed % 10 === 0) {
        process.stdout.write(`   Processed ${processed}/${issueKeys.length} issues\r`);
      }

      await new Promise(r => setTimeout(r, 50));
    } catch (error) {
      console.error(`   ⚠️  Error fetching ${key}: ${error.message}`);
    }
  }

  console.log(`   ✓ Processed ${processed} issues (skipped ${skipped})\n`);

  const rows = Object.entries(stats)
    .map(([name, data]) => ({
      name,
      issues: data.issues,
      points: data.points,
      missingPoints: data.missingPoints,
      avg: data.issues > 0 ? (data.points / data.issues) : 0
    }))
    .sort((a, b) => b.points - a.points);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ENGINEER PRODUCTIVITY (ASSIGNEE AT IN DEV)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Engineer                      | Issues | Points | Avg/Issue | Missing SP');
  console.log('-----------------------------+--------+--------+-----------+-----------');

  for (const row of rows) {
    const name = row.name.padEnd(29);
    const issues = String(row.issues).padStart(6);
    const points = String(row.points).padStart(6);
    const avg = row.avg.toFixed(2).padStart(9);
    const missing = String(row.missingPoints).padStart(9);
    console.log(`${name} | ${issues} | ${points} | ${avg} | ${missing}`);
  }

  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const totalIssues = rows.reduce((sum, r) => sum + r.issues, 0);
  const totalMissing = rows.reduce((sum, r) => sum + r.missingPoints, 0);

  console.log('\nTotals:');
  console.log(`  Engineers: ${rows.length}`);
  console.log(`  Issues: ${totalIssues}`);
  console.log(`  Story Points: ${totalPoints}`);
  console.log(`  Issues Missing Points: ${totalMissing}\n`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  if (error.response?.data) {
    console.error('Response:', error.response.data);
  }
  process.exit(1);
});
