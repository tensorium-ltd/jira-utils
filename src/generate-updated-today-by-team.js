require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const DEFAULT_SPRINT = 'NH Sprint 35';

const TEAM_FIELDS = ['customfield_12700', 'customfield_13445', 'customfield_13462'];
const TEAMS_OF_INTEREST = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5'];
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED'];
const QA_REVIEW_STATUSES = ['IN QA', 'IN REVIEW', 'READY FOR QA'];
const DEV_STATUS = 'IN DEV';
const TYPE_BUCKETS = ['Story'];
const BUG_BUCKETS = [];

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
    }
  });
}

async function getStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];
    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );
    return storyPointsField ? storyPointsField.id : 'customfield_10003';
  } catch (error) {
    return 'customfield_10003';
  }
}

async function getSprintFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];
    const sprintField = fields.find(field => field.name === 'Sprint');
    return sprintField ? sprintField.id : 'customfield_11150';
  } catch (error) {
    return 'customfield_11150';
  }
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

async function fetchAllUpdatedToday(client, dateStr) {
  const fields = ['key'];
  const jql = `project = ${PROJECT_KEY} AND updated >= "${dateStr}" ORDER BY updated DESC`;

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
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return results;
}

async function fetchCreatedToday(client, dateStr, sprintName) {
  const fields = ['key', 'summary', 'issuetype', 'created', 'reporter'];
  const sprintClause = sprintName ? ` AND sprint = "${sprintName}"` : '';
  const jql = `project = ${PROJECT_KEY} AND created >= "${dateStr}" AND issuetype = "Story"${sprintClause} ORDER BY created DESC`;

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
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return results;
}

async function fetchIssueWithChangelog(client, issueKey, storyPointsFieldId) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: ['key', 'summary', 'status', 'issuetype', 'updated', storyPointsFieldId, ...TEAM_FIELDS].join(','),
      expand: 'changelog'
    }
  });
  return response.data;
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
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  return results;
}

function findStatusChangesInRange(issue, startDateStr, endDateStr) {
  const changes = [];
  const start = new Date(startDateStr);
  const end = new Date(`${endDateStr}T23:59:59.999Z`);
  const histories = issue.changelog?.histories || [];
  for (const history of histories) {
    const changeDate = new Date(history.created);
    if (changeDate < start || changeDate > end) continue;

    for (const item of history.items || []) {
      if (item.field !== 'status') continue;
      changes.push({
        from: item.fromString || '',
        to: item.toString || '',
        changedAt: history.created
      });
    }
  }
  return changes;
}

function getStoryPoints(issueType, storyPointsValue) {
  let points = storyPointsValue || 0;
  if (points === 0) {
    if (issueType === 'Story') {
      points = 2;
    }
  }
  return points;
}

function normalizeIssueType(issueType) {
  if (!issueType) return 'Other';
  const normalized = issueType.replace(/\s+/g, '').toLowerCase();
  if (normalized === 'story') return 'Story';
  return 'Other';
}

function initTypeSets() {
  return TYPE_BUCKETS.reduce((acc, type) => {
    acc[type] = new Set();
    return acc;
  }, {});
}

function initTypePoints() {
  return TYPE_BUCKETS.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});
}

function typeCountsFromSets(typeSets) {
  return TYPE_BUCKETS.reduce((acc, type) => {
    acc[type] = typeSets[type]?.size || 0;
    return acc;
  }, {});
}

function formatTypeCounts(typeCounts) {
  return TYPE_BUCKETS.map(type => `${type}: ${typeCounts[type] || 0}`).join(', ');
}

function formatTypePoints(typePoints) {
  return TYPE_BUCKETS.map(type => `${type}: ${typePoints[type] || 0}`).join(', ');
}

function initStatusMetrics() {
  return {
    completed: { keys: new Set(), points: 0 },
    qaReview: { keys: new Set(), points: 0 },
    dev: { keys: new Set(), points: 0 }
  };
}

function addToMetrics(metrics, bucket, issueKey, points) {
  if (!metrics[bucket].keys.has(issueKey)) {
    metrics[bucket].keys.add(issueKey);
    metrics[bucket].points += points;
  }
}

function buildTeamSummaryView(teamSummary) {
  const view = {
    order: teamSummary.order,
    data: new Map()
  };

  for (const teamName of teamSummary.order) {
    const data = teamSummary.data.get(teamName);
    view.data.set(teamName, {
      feature: {
        completed: {
          count: data.featureMetrics.completed.keys.size,
          points: data.featureMetrics.completed.points
        },
        qaReview: {
          count: data.featureMetrics.qaReview.keys.size,
          points: data.featureMetrics.qaReview.points
        },
        dev: {
          count: data.featureMetrics.dev.keys.size,
          points: data.featureMetrics.dev.points
        }
      }
    });
  }

  return view;
}

function appendReportSection(lines, title, summary, teamSummary, createdIssues) {
  lines.push(`## ${title}`);
  lines.push('');
  lines.push('### Overall Totals');
  lines.push('');
  lines.push(`- Completed / Ready for Release: ${summary.completedCount} tickets (${summary.completedPoints} story points)`);
  lines.push(`  - ${formatTypePoints(summary.completedTypePoints)}`);
  lines.push(`- Moved to In QA / In Review: ${summary.qaReviewCount} tickets`);
  lines.push(`  - ${formatTypePoints(summary.qaReviewTypePoints)}`);
  lines.push(`- Moved to In Dev: ${summary.devCount} tickets`);
  lines.push(`  - ${formatTypePoints(summary.devTypePoints)}`);
  lines.push('');
  lines.push('### Feature Work (Stories only)');
  lines.push('');
  lines.push('| Team | Completed (Tickets) | Completed (SP) | QA/Review (Tickets) | QA/Review (SP) | In Dev (Tickets) | In Dev (SP) |');
  lines.push('|------|---------------------|----------------|---------------------|----------------|------------------|-------------|');

  for (const teamName of teamSummary.order) {
    const data = teamSummary.data.get(teamName);
    lines.push(`| ${teamName} | ${data.feature.completed.count} | ${data.feature.completed.points} | ${data.feature.qaReview.count} | ${data.feature.qaReview.points} | ${data.feature.dev.count} | ${data.feature.dev.points} |`);
  }
  lines.push('');
  lines.push('### Issues Created');
  lines.push('');
  const createdStories = createdIssues
    .filter(issue => {
      const type = normalizeIssueType(issue.fields?.issuetype?.name || '');
      return type === 'Story';
    })
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''));

  if (!createdStories.length) {
    lines.push('_None_');
  } else {
    for (const issue of createdStories) {
      const type = issue.fields?.issuetype?.name || 'Unknown';
      const reporter = issue.fields?.reporter?.displayName || issue.fields?.reporter?.name || 'Unknown';
      lines.push(`- ${issue.key} (${type}) - ${issue.fields?.summary || ''} (Reporter: ${reporter})`);
    }
  }
  lines.push('');
}

function sortTeams(grouped) {
  const teams = Array.from(grouped.keys());
  const ordered = [
    ...TEAMS_OF_INTEREST.filter(team => teams.includes(team)),
    ...teams.filter(team => !TEAMS_OF_INTEREST.includes(team)).sort((a, b) => a.localeCompare(b))
  ];
  return ordered;
}

function saveMarkdownReport(dateStr, todayReport, sprintReport) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `status-changes-summary-by-team-${dateStr}.md`;
  const filepath = path.join(reportsDir, filename);

  const lines = [];
  lines.push(`# Status Changes Summary by Team (${dateStr})`);
  lines.push('');
  lines.push(`Project: ${PROJECT_KEY}`);
  lines.push('');
  appendReportSection(lines, 'Today', todayReport.summary, todayReport.teamSummary, todayReport.createdIssues);
  appendReportSection(lines, 'Sprint So Far', sprintReport.summary, sprintReport.teamSummary, sprintReport.createdIssues);

  fs.writeFileSync(filepath, lines.join('\n'));
  console.log(`✅ Markdown report saved to: ${filepath}`);
  return filepath;
}

async function getSprintStartDate(client, sprintName) {
  const sprintFieldId = await getSprintFieldId(client);
  const response = await client.post('/rest/api/3/search/jql', {
    jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}" ORDER BY updated DESC`,
    maxResults: 1,
    fields: [sprintFieldId]
  });

  const issue = response.data.issues?.[0];
  const sprintField = issue?.fields?.[sprintFieldId];
  if (Array.isArray(sprintField)) {
    const sprint = sprintField.find(s => s.name === sprintName) || sprintField[0];
    return sprint?.startDate ? sprint.startDate.split('T')[0] : null;
  }
  return null;
}

async function buildReportData(client, storyPointsFieldId, startDateStr, endDateStr, sprintName) {
  const issues = await fetchAllUpdatedToday(client, startDateStr);

  const summary = {
    completedKeys: new Set(),
    qaReviewKeys: new Set(),
    devKeys: new Set(),
    completedPoints: 0,
    completedFeaturePoints: 0,
    completedBugPoints: 0,
    completedTypeSets: initTypeSets(),
    qaReviewTypeSets: initTypeSets(),
    devTypeSets: initTypeSets(),
    completedTypePoints: initTypePoints(),
    qaReviewTypePoints: initTypePoints(),
    devTypePoints: initTypePoints(),
    featureMetrics: initStatusMetrics(),
    bugMetrics: initStatusMetrics()
  };

  const teamData = new Map();

  for (const issueRef of issues) {
    const issueKey = issueRef.key || issueRef.id;
    if (!issueKey) continue;

    const issue = await fetchIssueWithChangelog(client, issueKey, storyPointsFieldId);
    if (sprintName) {
      const sprintFieldId = await getSprintFieldId(client);
      const sprintField = issue.fields?.[sprintFieldId];
      const inSprint = Array.isArray(sprintField) && sprintField.some(s => s.name === sprintName);
      if (!inSprint) {
        await new Promise(r => setTimeout(r, 50));
        continue;
      }
    }

    const changes = findStatusChangesInRange(issue, startDateStr, endDateStr);
    if (!changes.length) continue;

    const fields = issue.fields || {};
    const team = extractTeam(fields);
    const issueType = fields.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') {
      await new Promise(r => setTimeout(r, 50));
      continue;
    }
    const storyPoints = getStoryPoints(issueType, fields[storyPointsFieldId]);

    if (!teamData.has(team)) {
      teamData.set(team, {
        completedKeys: new Set(),
        qaReviewKeys: new Set(),
        devKeys: new Set(),
        completedPoints: 0,
        completedTypeSets: initTypeSets(),
        qaReviewTypeSets: initTypeSets(),
        devTypeSets: initTypeSets(),
        featureMetrics: initStatusMetrics(),
        bugMetrics: initStatusMetrics()
      });
    }

    for (const change of changes) {
      const toStatus = (change.to || '').toUpperCase();
      const isFeature = bucketType === 'Story';
      const isBug = BUG_BUCKETS.includes(bucketType);

      if (COMPLETED_STATUSES.includes(toStatus)) {
        if (!summary.completedKeys.has(issue.key)) {
          summary.completedKeys.add(issue.key);
          summary.completedPoints += storyPoints;
          summary.completedTypeSets[bucketType]?.add(issue.key);
            summary.completedTypePoints[bucketType] += storyPoints;
          if (isFeature) summary.completedFeaturePoints += storyPoints;
          if (isBug) summary.completedBugPoints += storyPoints;
        }
        const teamBucket = teamData.get(team);
        if (!teamBucket.completedKeys.has(issue.key)) {
          teamBucket.completedKeys.add(issue.key);
          teamBucket.completedPoints += storyPoints;
          teamBucket.completedTypeSets[bucketType]?.add(issue.key);
        }

        if (isFeature) {
          addToMetrics(summary.featureMetrics, 'completed', issue.key, storyPoints);
          addToMetrics(teamBucket.featureMetrics, 'completed', issue.key, storyPoints);
        }
        if (isBug) {
          addToMetrics(summary.bugMetrics, 'completed', issue.key, storyPoints);
          addToMetrics(teamBucket.bugMetrics, 'completed', issue.key, storyPoints);
        }
      }

      if (QA_REVIEW_STATUSES.includes(toStatus)) {
          const hadKey = summary.qaReviewKeys.has(issue.key);
          summary.qaReviewKeys.add(issue.key);
          summary.qaReviewTypeSets[bucketType]?.add(issue.key);
          if (!hadKey) {
            summary.qaReviewTypePoints[bucketType] += storyPoints;
          }
        const teamBucket = teamData.get(team);
        teamBucket.qaReviewKeys.add(issue.key);
        teamBucket.qaReviewTypeSets[bucketType]?.add(issue.key);

        if (isFeature) {
          addToMetrics(summary.featureMetrics, 'qaReview', issue.key, storyPoints);
          addToMetrics(teamBucket.featureMetrics, 'qaReview', issue.key, storyPoints);
        }
        if (isBug) {
          addToMetrics(summary.bugMetrics, 'qaReview', issue.key, storyPoints);
          addToMetrics(teamBucket.bugMetrics, 'qaReview', issue.key, storyPoints);
        }
      }

      if (toStatus === DEV_STATUS) {
          const hadKey = summary.devKeys.has(issue.key);
          summary.devKeys.add(issue.key);
          summary.devTypeSets[bucketType]?.add(issue.key);
          if (!hadKey) {
            summary.devTypePoints[bucketType] += storyPoints;
          }
        const teamBucket = teamData.get(team);
        teamBucket.devKeys.add(issue.key);
        teamBucket.devTypeSets[bucketType]?.add(issue.key);

        if (isFeature) {
          addToMetrics(summary.featureMetrics, 'dev', issue.key, storyPoints);
          addToMetrics(teamBucket.featureMetrics, 'dev', issue.key, storyPoints);
        }
        if (isBug) {
          addToMetrics(summary.bugMetrics, 'dev', issue.key, storyPoints);
          addToMetrics(teamBucket.bugMetrics, 'dev', issue.key, storyPoints);
        }
      }
    }

    await new Promise(r => setTimeout(r, 100));
  }

  const summaryCounts = {
    completedCount: summary.completedKeys.size,
    qaReviewCount: summary.qaReviewKeys.size,
    devCount: summary.devKeys.size,
    completedPoints: summary.completedPoints,
    completedFeaturePoints: summary.completedFeaturePoints,
    completedBugPoints: summary.completedBugPoints,
    completedTypes: typeCountsFromSets(summary.completedTypeSets),
    qaReviewTypes: typeCountsFromSets(summary.qaReviewTypeSets),
    devTypes: typeCountsFromSets(summary.devTypeSets),
    completedTypePoints: summary.completedTypePoints,
    qaReviewTypePoints: summary.qaReviewTypePoints,
    devTypePoints: summary.devTypePoints
  };

  const teamSummary = {
    data: new Map(),
    order: []
  };

  for (const [teamName, data] of teamData.entries()) {
    teamSummary.data.set(teamName, {
      completedCount: data.completedKeys.size,
      qaReviewCount: data.qaReviewKeys.size,
      devCount: data.devKeys.size,
      completedPoints: data.completedPoints,
      completedTypes: typeCountsFromSets(data.completedTypeSets),
      qaReviewTypes: typeCountsFromSets(data.qaReviewTypeSets),
      devTypes: typeCountsFromSets(data.devTypeSets),
      featureMetrics: data.featureMetrics,
      bugMetrics: data.bugMetrics
    });
  }

  teamSummary.order = sortTeams(teamSummary.data);

  const createdIssues = await fetchCreatedToday(client, startDateStr, sprintName);

  return {
    summary: summaryCounts,
    teamSummary: buildTeamSummaryView(teamSummary),
    createdIssues
  };
}

function initTeamBucket(teamData, team) {
  if (!teamData.has(team)) {
    teamData.set(team, {
      completedKeys: new Set(),
      qaReviewKeys: new Set(),
      devKeys: new Set(),
      completedPoints: 0,
      completedTypeSets: initTypeSets(),
      qaReviewTypeSets: initTypeSets(),
      devTypeSets: initTypeSets(),
      featureMetrics: initStatusMetrics(),
      bugMetrics: initStatusMetrics()
    });
  }
}

function applyIssueToMetrics(summary, teamBucket, issueKey, bucketType, storyPoints, statusBucket) {
  const isFeature = bucketType === 'Story';
  const isBug = BUG_BUCKETS.includes(bucketType);

  if (statusBucket === 'completed') {
    if (!summary.completedKeys.has(issueKey)) {
      summary.completedKeys.add(issueKey);
      summary.completedPoints += storyPoints;
      summary.completedTypeSets[bucketType]?.add(issueKey);
      summary.completedTypePoints[bucketType] += storyPoints;
      if (isFeature) summary.completedFeaturePoints += storyPoints;
      if (isBug) summary.completedBugPoints += storyPoints;
    }
    if (!teamBucket.completedKeys.has(issueKey)) {
      teamBucket.completedKeys.add(issueKey);
      teamBucket.completedPoints += storyPoints;
      teamBucket.completedTypeSets[bucketType]?.add(issueKey);
    }
  }

  if (statusBucket === 'qaReview') {
    const hadKey = summary.qaReviewKeys.has(issueKey);
    summary.qaReviewKeys.add(issueKey);
    summary.qaReviewTypeSets[bucketType]?.add(issueKey);
    if (!hadKey) {
      summary.qaReviewTypePoints[bucketType] += storyPoints;
    }
    teamBucket.qaReviewKeys.add(issueKey);
    teamBucket.qaReviewTypeSets[bucketType]?.add(issueKey);
  }

  if (statusBucket === 'dev') {
    const hadKey = summary.devKeys.has(issueKey);
    summary.devKeys.add(issueKey);
    summary.devTypeSets[bucketType]?.add(issueKey);
    if (!hadKey) {
      summary.devTypePoints[bucketType] += storyPoints;
    }
    teamBucket.devKeys.add(issueKey);
    teamBucket.devTypeSets[bucketType]?.add(issueKey);
  }

  if (isFeature) {
    addToMetrics(summary.featureMetrics, statusBucket, issueKey, storyPoints);
    addToMetrics(teamBucket.featureMetrics, statusBucket, issueKey, storyPoints);
  }
  if (isBug) {
    addToMetrics(summary.bugMetrics, statusBucket, issueKey, storyPoints);
    addToMetrics(teamBucket.bugMetrics, statusBucket, issueKey, storyPoints);
  }
}

async function buildSprintReportData(client, storyPointsFieldId, sprintName, sprintStart, endDateStr) {
  const fields = ['key', 'summary', 'status', 'issuetype', 'updated', ...TEAM_FIELDS, storyPointsFieldId];
  const completedJql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND status in (${COMPLETED_STATUSES.map(s => `"${s}"`).join(', ')})`;
  const qaJql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND status in (${QA_REVIEW_STATUSES.map(s => `"${s}"`).join(', ')})`;
  const devJql = `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND status = "${DEV_STATUS}"`;

  const [completedIssues, qaIssues, devIssues] = await Promise.all([
    fetchIssuesByJql(client, completedJql, fields),
    fetchIssuesByJql(client, qaJql, fields),
    fetchIssuesByJql(client, devJql, fields)
  ]);

  const summary = {
    completedKeys: new Set(),
    qaReviewKeys: new Set(),
    devKeys: new Set(),
    completedPoints: 0,
    completedFeaturePoints: 0,
    completedBugPoints: 0,
    completedTypeSets: initTypeSets(),
    qaReviewTypeSets: initTypeSets(),
    devTypeSets: initTypeSets(),
    completedTypePoints: initTypePoints(),
    qaReviewTypePoints: initTypePoints(),
    devTypePoints: initTypePoints(),
    featureMetrics: initStatusMetrics(),
    bugMetrics: initStatusMetrics()
  };

  const teamData = new Map();

  for (const issue of completedIssues) {
    const fieldsData = issue.fields || {};
    const team = extractTeam(fieldsData);
    const issueType = fieldsData.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') continue;
    const storyPoints = getStoryPoints(issueType, fieldsData[storyPointsFieldId]);
    initTeamBucket(teamData, team);
    applyIssueToMetrics(summary, teamData.get(team), issue.key, bucketType, storyPoints, 'completed');
  }

  for (const issue of qaIssues) {
    const fieldsData = issue.fields || {};
    const team = extractTeam(fieldsData);
    const issueType = fieldsData.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') continue;
    const storyPoints = getStoryPoints(issueType, fieldsData[storyPointsFieldId]);
    initTeamBucket(teamData, team);
    applyIssueToMetrics(summary, teamData.get(team), issue.key, bucketType, storyPoints, 'qaReview');
  }

  for (const issue of devIssues) {
    const fieldsData = issue.fields || {};
    const team = extractTeam(fieldsData);
    const issueType = fieldsData.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') continue;
    const storyPoints = getStoryPoints(issueType, fieldsData[storyPointsFieldId]);
    initTeamBucket(teamData, team);
    applyIssueToMetrics(summary, teamData.get(team), issue.key, bucketType, storyPoints, 'dev');
  }

  const summaryCounts = {
    completedCount: summary.completedKeys.size,
    qaReviewCount: summary.qaReviewKeys.size,
    devCount: summary.devKeys.size,
    completedPoints: summary.completedPoints,
    completedFeaturePoints: summary.completedFeaturePoints,
    completedBugPoints: summary.completedBugPoints,
    completedTypes: typeCountsFromSets(summary.completedTypeSets),
    qaReviewTypes: typeCountsFromSets(summary.qaReviewTypeSets),
    devTypes: typeCountsFromSets(summary.devTypeSets),
    completedTypePoints: summary.completedTypePoints,
    qaReviewTypePoints: summary.qaReviewTypePoints,
    devTypePoints: summary.devTypePoints
  };

  const teamSummary = {
    data: new Map(),
    order: []
  };

  for (const [teamName, data] of teamData.entries()) {
    teamSummary.data.set(teamName, {
      completedCount: data.completedKeys.size,
      qaReviewCount: data.qaReviewKeys.size,
      devCount: data.devKeys.size,
      completedPoints: data.completedPoints,
      completedTypes: typeCountsFromSets(data.completedTypeSets),
      qaReviewTypes: typeCountsFromSets(data.qaReviewTypeSets),
      devTypes: typeCountsFromSets(data.devTypeSets),
      featureMetrics: data.featureMetrics,
      bugMetrics: data.bugMetrics
    });
  }

  teamSummary.order = sortTeams(teamSummary.data);

  const createdIssues = await fetchCreatedToday(client, sprintStart, sprintName);

  return {
    summary: summaryCounts,
    teamSummary: buildTeamSummaryView(teamSummary),
    createdIssues
  };
}

async function buildCurrentStatusReportData(client, storyPointsFieldId, sprintName) {
  const fields = ['key', 'summary', 'status', 'issuetype', 'updated', ...TEAM_FIELDS, storyPointsFieldId];
  const sprintClause = sprintName ? ` AND sprint = "${sprintName}"` : '';
  const qaJql = `project = ${PROJECT_KEY}${sprintClause} AND status in (${QA_REVIEW_STATUSES.map(s => `"${s}"`).join(', ')})`;
  const devJql = `project = ${PROJECT_KEY}${sprintClause} AND status = "${DEV_STATUS}"`;

  const [qaIssues, devIssues] = await Promise.all([
    fetchIssuesByJql(client, qaJql, fields),
    fetchIssuesByJql(client, devJql, fields)
  ]);

  const summary = {
    completedKeys: new Set(),
    qaReviewKeys: new Set(),
    devKeys: new Set(),
    completedPoints: 0,
    completedFeaturePoints: 0,
    completedBugPoints: 0,
    completedTypeSets: initTypeSets(),
    qaReviewTypeSets: initTypeSets(),
    devTypeSets: initTypeSets(),
    completedTypePoints: initTypePoints(),
    qaReviewTypePoints: initTypePoints(),
    devTypePoints: initTypePoints(),
    featureMetrics: initStatusMetrics(),
    bugMetrics: null
  };

  const teamData = new Map();

  for (const issue of qaIssues) {
    const fieldsData = issue.fields || {};
    const team = extractTeam(fieldsData);
    const issueType = fieldsData.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') continue;
    const storyPoints = getStoryPoints(issueType, fieldsData[storyPointsFieldId]);
    initTeamBucket(teamData, team);
    applyIssueToMetrics(summary, teamData.get(team), issue.key, bucketType, storyPoints, 'qaReview');
  }

  for (const issue of devIssues) {
    const fieldsData = issue.fields || {};
    const team = extractTeam(fieldsData);
    const issueType = fieldsData.issuetype?.name || 'Unknown';
    const bucketType = normalizeIssueType(issueType);
    if (bucketType !== 'Story') continue;
    const storyPoints = getStoryPoints(issueType, fieldsData[storyPointsFieldId]);
    initTeamBucket(teamData, team);
    applyIssueToMetrics(summary, teamData.get(team), issue.key, bucketType, storyPoints, 'dev');
  }

  const summaryCounts = {
    completedCount: summary.completedKeys.size,
    qaReviewCount: summary.qaReviewKeys.size,
    devCount: summary.devKeys.size,
    completedPoints: summary.completedPoints,
    completedFeaturePoints: summary.completedFeaturePoints,
    completedBugPoints: summary.completedBugPoints,
    completedTypes: typeCountsFromSets(summary.completedTypeSets),
    qaReviewTypes: typeCountsFromSets(summary.qaReviewTypeSets),
    devTypes: typeCountsFromSets(summary.devTypeSets),
    completedTypePoints: summary.completedTypePoints,
    qaReviewTypePoints: summary.qaReviewTypePoints,
    devTypePoints: summary.devTypePoints
  };

  const teamSummary = {
    data: new Map(),
    order: []
  };

  for (const [teamName, data] of teamData.entries()) {
    teamSummary.data.set(teamName, {
      completedCount: data.completedKeys.size,
      qaReviewCount: data.qaReviewKeys.size,
      devCount: data.devKeys.size,
      completedPoints: data.completedPoints,
      completedTypes: typeCountsFromSets(data.completedTypeSets),
      qaReviewTypes: typeCountsFromSets(data.qaReviewTypeSets),
      devTypes: typeCountsFromSets(data.devTypeSets),
      featureMetrics: data.featureMetrics,
      bugMetrics: null
    });
  }

  teamSummary.order = sortTeams(teamSummary.data);

  return {
    summary: summaryCounts,
    teamSummary: buildTeamSummaryView(teamSummary)
  };
}

async function main() {
  try {
    validateConfig();
    const todayStr = new Date().toISOString().split('T')[0];
    const sprintName = process.argv[2] || DEFAULT_SPRINT;

    console.log('\n📊 Status Changes Summary by Team');
    console.log('='.repeat(60));
    console.log(`   Project: ${PROJECT_KEY}`);
    console.log(`   Date (UTC): ${todayStr}`);
    console.log(`   Sprint: ${sprintName}`);

    const client = createJiraClient();
    const storyPointsFieldId = await getStoryPointsFieldId(client);
    const todayReport = await buildReportData(client, storyPointsFieldId, todayStr, todayStr, null);
    const todayCurrentStatus = await buildCurrentStatusReportData(client, storyPointsFieldId, sprintName);
    const sprintStartDate = await getSprintStartDate(client, sprintName);
    const sprintStart = sprintStartDate || todayStr;
    const sprintReport = await buildSprintReportData(client, storyPointsFieldId, sprintName, sprintStart, todayStr);

    // Override today's QA/Dev counts with current status counts
    todayReport.summary.qaReviewCount = todayCurrentStatus.summary.qaReviewCount;
    todayReport.summary.devCount = todayCurrentStatus.summary.devCount;
    todayReport.summary.qaReviewTypePoints = todayCurrentStatus.summary.qaReviewTypePoints;
    todayReport.summary.devTypePoints = todayCurrentStatus.summary.devTypePoints;

    for (const team of todayReport.teamSummary.order) {
      const currentTeam = todayCurrentStatus.teamSummary.data.get(team);
      const targetTeam = todayReport.teamSummary.data.get(team);
      if (!currentTeam || !targetTeam) continue;
      targetTeam.feature.qaReview = currentTeam.feature.qaReview;
      targetTeam.feature.dev = currentTeam.feature.dev;
    }

    console.log(`   ✓ Completed/Ready: ${todayReport.summary.completedCount} (${todayReport.summary.completedPoints} points)`);
    console.log(`   ✓ In QA/In Review: ${todayReport.summary.qaReviewCount}`);
    console.log(`   ✓ In Dev: ${todayReport.summary.devCount}`);

    for (const team of todayReport.teamSummary.order) {
      const data = todayReport.teamSummary.data.get(team);
      console.log(`   - ${team}: Completed ${data.feature.completed.count} (${data.feature.completed.points} pts), QA/Review ${data.feature.qaReview.count}, Dev ${data.feature.dev.count}`);
    }

    saveMarkdownReport(todayStr, todayReport, sprintReport);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Failed to generate report');
    console.error(error.message);
    process.exit(1);
  }
}

main();
