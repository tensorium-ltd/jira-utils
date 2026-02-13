#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const BOARD_ID = 149;
const DEFAULT_SPRINT_NAME = 'NH Sprint 35';
const SPRINT_NAME = process.argv[2] || DEFAULT_SPRINT_NAME;

const TRACKED_ISSUE_TYPES = new Set(['Story', 'Bug', 'Sub-bug', 'Task']);
const COMPLETED_STATUSES = ['Done', 'Closed', 'Ready for Release', 'Completed', 'Resolved'];
const QA_STATUSES = ['In QA', 'Ready for QA'];
const DEFAULT_STORY_POINTS = 2;
const DEFAULT_BUG_POINTS = 1;

const TEAM_ORDER = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Other/Unassigned'];
const TEAM_FIELD_FALLBACKS = ['customfield_12700', 'customfield_13445', 'customfield_13462'];

function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  if (!JIRA_API_TOKEN) {
    console.error('Error: JIRA_API_TOKEN environment variable is not set');
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

async function getCustomFieldIds(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];

    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );

    const teamField = fields.find(field =>
      field.name && field.name.toLowerCase() === 'team'
    );

    const fieldIds = {
      storyPoints: storyPointsField ? storyPointsField.id : 'customfield_10003',
      team: teamField ? teamField.id : null
    };

    return fieldIds;
  } catch (error) {
    return {
      storyPoints: 'customfield_10003',
      team: null
    };
  }
}

async function fetchAllSprints(client, boardId) {
  const results = [];
  let startAt = 0;
  let isLast = false;

  while (!isLast) {
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: {
        state: 'active,closed,future',
        startAt,
        maxResults: 50
      }
    });

    const data = response.data || {};
    results.push(...(data.values || []));
    startAt += data.maxResults || 0;
    isLast = data.isLast || (data.values || []).length === 0;
  }

  return results;
}

async function getSprintByName(client, boardId, sprintName) {
  const sprints = await fetchAllSprints(client, boardId);
  return sprints.find(sprint => sprint.name === sprintName) || null;
}

async function fetchSprintReport(client, boardId, sprintId) {
  const response = await client.get('/rest/greenhopper/1.0/rapid/charts/sprintreport', {
    params: {
      rapidViewId: boardId,
      sprintId
    }
  });
  return response.data || {};
}

function buildTeamFieldList(fieldIds) {
  const fields = [];
  if (fieldIds.team) {
    fields.push(fieldIds.team);
  }
  for (const fallback of TEAM_FIELD_FALLBACKS) {
    if (!fields.includes(fallback)) {
      fields.push(fallback);
    }
  }
  return fields;
}

function extractTeam(fields, teamFieldIds) {
  for (const fieldId of teamFieldIds) {
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

function normalizeTeam(teamName) {
  if (!teamName) return 'Other/Unassigned';
  if (TEAM_ORDER.includes(teamName)) return teamName;
  return 'Other/Unassigned';
}

function isCompletedStatus(statusName) {
  if (!statusName) return false;
  return COMPLETED_STATUSES.some(status => status.toLowerCase() === statusName.toLowerCase());
}

function isTrackedIssueType(issueType) {
  return TRACKED_ISSUE_TYPES.has(issueType);
}

function getStoryPoints(issueType, value) {
  if (value && value > 0) return value;
  if (issueType === 'Story') return DEFAULT_STORY_POINTS;
  if (issueType && issueType.toLowerCase().includes('bug')) return DEFAULT_BUG_POINTS;
  return 0;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchIssuesByKeys(client, keys, fields) {
  if (!keys.length) return [];
  const chunks = chunkArray(keys, 100);
  const results = [];

  for (const chunk of chunks) {
    const jql = `key in (${chunk.map(key => `"${key}"`).join(', ')})`;
    const response = await client.post('/rest/api/3/search/jql', {
      jql,
      maxResults: 100,
      fields
    });
    results.push(...(response.data.issues || []));
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

async function fetchIssuesByJql(client, jql, fields) {
  const results = [];
  let nextPageToken = null;

  do {
    const body = {
      jql,
      maxResults: 100,
      fields
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;

    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (nextPageToken);

  return results;
}

function createTeamBucket() {
  return {
    assignedIssues: 0,
    assignedPoints: 0,
    completedIssues: 0,
    completedPoints: 0,
    qaIssues: 0,
    qaPoints: 0,
    passedReviewIssues: 0,
    remainingPoints: 0,
    completePercent: 0,
    completedByType: {
      Story: 0,
      Bug: 0,
      'Sub-bug': 0,
      Task: 0
    },
    passedReviewPercent: 0
  };
}

function initTeamSummary() {
  const summary = {};
  for (const team of TEAM_ORDER) {
    summary[team] = createTeamBucket();
  }
  return summary;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push(`# Sprint Summary: ${report.sprint.name}`);
  lines.push('');
  lines.push(`Board: ${report.boardId}`);
  lines.push(`Sprint Close: ${report.sprint.closeDate || 'Unknown'}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Completed issues: ${report.totals.completedIssues}`);
  lines.push(`- Completed story points: ${report.totals.completedPoints}`);
  lines.push(`- Remaining story points at close: ${report.totals.remainingPoints}`);
  lines.push('');
  lines.push('## By Team');
  lines.push('');
  lines.push('| Team | Assigned SP | Completed SP | In QA/Ready for QA (SP) | Remaining SP | % Work Passed Code Review | % Work Complete (SP) |');
  lines.push('|------|-------------|--------------|------------------------|--------------|---------------------------|---------------------|');
  for (const team of TEAM_ORDER) {
    const data = report.byTeam[team];
    lines.push(`| ${team} | ${data.assignedPoints} | ${data.completedPoints} | ${data.qaPoints} | ${data.remainingPoints} | ${data.passedReviewPercent}% | ${data.completePercent}% |`);
  }
  lines.push(`| Total | ${report.totals.assignedPoints} | ${report.totals.completedPoints} | ${report.totals.qaPoints} | ${report.totals.remainingPoints} | ${report.totals.passedReviewPercent}% | ${report.totals.completePercent}% |`);
  lines.push('');
  lines.push('## Assumptions');
  lines.push('');
  lines.push(`- Tracked issue types: ${Array.from(TRACKED_ISSUE_TYPES).join(', ')}`);
  lines.push(`- Completed statuses: ${COMPLETED_STATUSES.join(', ')}`);
  lines.push(`- QA statuses: ${QA_STATUSES.join(', ')}`);
  lines.push(`- Default Story points: ${DEFAULT_STORY_POINTS}`);
  lines.push(`- Default Bug points: ${DEFAULT_BUG_POINTS}`);

  return lines.join('\n');
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  console.log('\n📊 Sprint Summary');
  console.log('='.repeat(60));
  console.log(`   Board: ${BOARD_ID}`);
  console.log(`   Sprint: ${SPRINT_NAME}`);

  const fieldIds = await getCustomFieldIds(client);
  const teamFieldIds = buildTeamFieldList(fieldIds);
  const sprint = await getSprintByName(client, BOARD_ID, SPRINT_NAME);

  if (!sprint) {
    console.error(`Error: Sprint "${SPRINT_NAME}" not found on board ${BOARD_ID}`);
    process.exit(1);
  }

  const sprintReport = await fetchSprintReport(client, BOARD_ID, sprint.id);
  const contents = sprintReport.contents || {};
  const completedIssues = contents.completedIssues || [];
  const remainingIssues = contents.issuesNotCompletedInCurrentSprint || contents.issuesNotCompleted || [];

  const completedKeys = Array.from(new Set(completedIssues.map(issue => issue.key).filter(Boolean)));
  const remainingKeys = Array.from(new Set(remainingIssues.map(issue => issue.key).filter(Boolean)));

  const fields = ['key', 'summary', 'status', 'issuetype', fieldIds.storyPoints, ...teamFieldIds];
  const allKeys = Array.from(new Set([...completedKeys, ...remainingKeys]));
  const issueDetails = await fetchIssuesByKeys(client, allKeys, fields);
  const issueMap = new Map(issueDetails.map(issue => [issue.key, issue]));

  const teamSummary = initTeamSummary();
  let totalCompletedIssues = 0;
  let totalCompletedPoints = 0;
  let totalQaIssues = 0;
  let totalQaPoints = 0;
  let totalAssignedIssues = 0;
  let totalAssignedPoints = 0;
  let totalPassedReviewIssues = 0;
  let totalRemainingPoints = 0;

  for (const key of completedKeys) {
    const issue = issueMap.get(key);
    if (!issue) continue;
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    if (!isTrackedIssueType(issueType)) continue;
    const statusName = issue.fields?.status?.name || '';
    if (!isCompletedStatus(statusName)) continue;

    const team = normalizeTeam(extractTeam(issue.fields || {}, teamFieldIds));
    const points = getStoryPoints(issueType, issue.fields?.[fieldIds.storyPoints]);

    teamSummary[team].completedIssues += 1;
    teamSummary[team].completedPoints += points;
    if (teamSummary[team].completedByType[issueType] !== undefined) {
      teamSummary[team].completedByType[issueType] += 1;
    }

    totalCompletedIssues += 1;
    totalCompletedPoints += points;
  }

  const sprintIssuesJql = `sprint = "${SPRINT_NAME}" AND issuetype in (${Array.from(TRACKED_ISSUE_TYPES).map(type => `"${type}"`).join(', ')})`;
  const sprintIssues = await fetchIssuesByJql(client, sprintIssuesJql, ['key', 'status', 'issuetype', fieldIds.storyPoints, ...teamFieldIds]);

  for (const issue of sprintIssues) {
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    if (!isTrackedIssueType(issueType)) continue;
    const team = normalizeTeam(extractTeam(issue.fields || {}, teamFieldIds));
    const points = getStoryPoints(issueType, issue.fields?.[fieldIds.storyPoints]);
    const statusName = issue.fields?.status?.name || '';

    teamSummary[team].assignedIssues += 1;
    teamSummary[team].assignedPoints += points;
    totalAssignedIssues += 1;
    totalAssignedPoints += points;

    const passedCodeReview = isCompletedStatus(statusName) ||
      QA_STATUSES.some(status => status.toLowerCase() === statusName.toLowerCase());

    if (passedCodeReview) {
      teamSummary[team].passedReviewIssues += 1;
      totalPassedReviewIssues += 1;
    }
  }

  const qaJql = `sprint = "${SPRINT_NAME}" AND status in (${QA_STATUSES.map(status => `"${status}"`).join(', ')})`;
  const qaIssues = await fetchIssuesByJql(client, qaJql, ['key', 'status', 'issuetype', fieldIds.storyPoints, ...teamFieldIds]);

  for (const issue of qaIssues) {
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    if (!isTrackedIssueType(issueType)) continue;
    const team = normalizeTeam(extractTeam(issue.fields || {}, teamFieldIds));
    const points = getStoryPoints(issueType, issue.fields?.[fieldIds.storyPoints]);
    teamSummary[team].qaIssues += 1;
    teamSummary[team].qaPoints += points;
    totalQaIssues += 1;
    totalQaPoints += points;
  }

  for (const team of TEAM_ORDER) {
    const data = teamSummary[team];
    const remaining = data.assignedPoints - data.completedPoints - data.qaPoints;
    data.remainingPoints = Number(remaining.toFixed(2));
    if (data.assignedIssues > 0) {
      data.passedReviewPercent = Number(((data.passedReviewIssues / data.assignedIssues) * 100).toFixed(1));
    } else {
      data.passedReviewPercent = 0;
    }
    if (data.assignedPoints > 0) {
      data.completePercent = Number(((data.completedPoints / data.assignedPoints) * 100).toFixed(1));
    } else {
      data.completePercent = 0;
    }
  }

  const passedReviewPercent = totalAssignedIssues > 0
    ? Number(((totalPassedReviewIssues / totalAssignedIssues) * 100).toFixed(1))
    : 0;

  totalRemainingPoints = Number((totalAssignedPoints - totalCompletedPoints - totalQaPoints).toFixed(2));
  const completePercent = totalAssignedPoints > 0
    ? Number(((totalCompletedPoints / totalAssignedPoints) * 100).toFixed(1))
    : 0;

  const closeDate = sprint.completeDate || sprint.endDate || null;
  const report = {
    generatedAt: new Date().toISOString(),
    boardId: BOARD_ID,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
      completeDate: sprint.completeDate || null,
      closeDate: closeDate ? closeDate.split('T')[0] : null
    },
    assumptions: {
      trackedIssueTypes: Array.from(TRACKED_ISSUE_TYPES),
      completedStatuses: COMPLETED_STATUSES,
      qaStatuses: QA_STATUSES,
      defaultStoryPoints: DEFAULT_STORY_POINTS,
      defaultBugPoints: DEFAULT_BUG_POINTS
    },
    totals: {
      assignedIssues: totalAssignedIssues,
      assignedPoints: totalAssignedPoints,
      completedIssues: totalCompletedIssues,
      completedPoints: totalCompletedPoints,
      qaIssues: totalQaIssues,
      qaPoints: totalQaPoints,
      passedReviewPercent: passedReviewPercent,
      remainingPoints: totalRemainingPoints,
      completePercent: completePercent
    },
    byTeam: teamSummary
  };

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const slug = slugify(sprint.name);
  const jsonPath = path.join(reportsDir, `sprint-summary-${slug}.json`);
  const mdPath = path.join(reportsDir, `sprint-summary-${slug}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, buildMarkdownReport(report));

  console.log(`\n✅ JSON report saved: ${jsonPath}`);
  console.log(`✅ Markdown report saved: ${mdPath}`);
}

main().catch(error => {
  console.error('Failed to generate sprint summary');
  if (error.response?.data) {
    console.error(JSON.stringify(error.response.data, null, 2));
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
