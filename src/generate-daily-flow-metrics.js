#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const DEFAULT_SPRINT_NAME = 'NH Sprint 39';
const SPRINT_START_DATE = '2026-02-02'; // fallback if sprint not found
const DAILY_TARGET_SP = 20;

let SPRINT_JQL = null;
let effectiveSprintStartDate = SPRINT_START_DATE;
let SPRINT_NAME = DEFAULT_SPRINT_NAME;

function getSprintClause() {
  return SPRINT_JQL || `sprint = "${SPRINT_NAME}"`;
}
const TARGET_TEAMS = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Unassigned'];
const REPORT_TIMEZONE = 'Europe/London';
const STATUS_BUCKETS = [
  { label: 'Open', statuses: ['Open'] },
  { label: 'In Dev', statuses: ['In Dev'] },
  { label: 'Ready for Review', statuses: ['Ready for Review'] },
  { label: 'In Review', statuses: ['In Review'] },
  { label: 'Ready for QA', statuses: ['Ready for QA'] },
  { label: 'In QA', statuses: ['In QA'] },
  { label: 'Ready for Release/Complete', statuses: ['Ready for Release', 'Ready for release', 'Complete', 'Completed', 'Done', 'Closed', 'Resolved'] }
];
const ENTRY_STATUS_BUCKETS = [
  { label: 'In Dev', statuses: ['In Dev'] },
  { label: 'Ready for Review', statuses: ['Ready for Review'] },
  { label: 'Ready for QA', statuses: ['Ready for QA'] },
  { label: 'Ready for Release', statuses: ['Ready for Release', 'Ready for release'] }
];

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

async function discoverStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch (error) {
    return 'customfield_10003';
  }
}

async function discoverTeamFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data;
    const preferred = fields.find(field => field.id === 'customfield_12700');
    if (preferred) return preferred.id;
    const teamField = fields.find(field =>
      field.name && field.name.toLowerCase() === 'team'
    );
    return teamField?.id || 'customfield_12700';
  } catch (error) {
    return 'customfield_12700';
  }
}

async function getSprintByName(client, boardId, sprintName) {
  const results = [];
  let startAt = 0;
  let isLast = false;
  while (!isLast) {
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: 'active,closed,future', startAt, maxResults: 50 }
    });
    const data = response.data || {};
    results.push(...(data.values || []));
    startAt += data.maxResults || 0;
    isLast = data.isLast || !(data.values || []).length;
  }
  return results.find(s => s.name === sprintName) || null;
}

function toUtcDateString(date) {
  return date.toISOString().split('T')[0];
}

function toUtcDateTimeString(date) {
  const iso = date.toISOString().replace('T', ' ').slice(0, 16);
  return iso;
}

function formatInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function getTimeZoneOffsetString(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = offsetPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return '+0000';
  const hours = match[1].padStart(3, match[1].startsWith('-') ? '-' : '+');
  const minutes = match[2] || '00';
  return `${hours}${minutes}`;
}

function formatJqlDateTime(dateStr, timeStr, offset) {
  return `${dateStr} ${timeStr} ${offset}`;
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const offset = getTimeZoneOffsetString(date, timeZone);
  const match = offset.match(/([+-])(\d{2})(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 60 + minutes);
}

function toUtcDate(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const assumedUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMinutes = getTimeZoneOffsetMinutes(assumedUtc, timeZone);
  return new Date(assumedUtc.getTime() - offsetMinutes * 60 * 1000);
}

function buildStatusList(statuses) {
  return statuses.map(status => `"${status}"`).join(', ');
}

function sumStoryPoints(issues, storyPointsFieldId) {
  let total = 0;
  let defaultedCount = 0;

  issues.forEach(issue => {
    const issueType = issue.fields?.issuetype?.name;
    let points = issue.fields?.[storyPointsFieldId] || 0;
    if ((issueType === 'Story' || issueType === 'Bug') && points === 0) {
      points = 2;
      defaultedCount += 1;
    }
    total += points;
  });

  return { total, defaultedCount };
}

function sumStoryPointsNoDefault(issues, storyPointsFieldId) {
  let total = 0;
  issues.forEach(issue => {
    const points = issue.fields?.[storyPointsFieldId] || 0;
    total += points;
  });
  return total;
}

function getTeamName(issue, teamFieldId) {
  const teamField = issue.fields?.[teamFieldId];
  if (!teamField) return 'Unassigned';
  if (typeof teamField === 'string') return teamField;
  if (teamField.value) return teamField.value;
  if (teamField.name) return teamField.name;
  return 'Unassigned';
}

async function fetchStartOfDaySnapshot(client, storyPointsFieldId, dateStr) {
  const results = {};
  for (const bucket of STATUS_BUCKETS) {
    const statusList = buildStatusList(bucket.statuses);
    const jql = [
      `project = ${PROJECT_KEY}`,
      getSprintClause(),
      'issuetype in (Story, Bug)',
      `status WAS IN (${statusList}) ON "${dateStr}"`
    ].join(' AND ');
    const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
    const totals = sumStoryPoints(issues, storyPointsFieldId);
    results[bucket.label] = {
      storyPoints: totals.total,
      issueCount: issues.length,
      defaultedCount: totals.defaultedCount
    };
  }
  return results;
}

async function fetchMovedInToday(client, storyPointsFieldId, startDateTime, endDateTime) {
  const results = {};
  for (const bucket of STATUS_BUCKETS) {
    const statusList = buildStatusList(bucket.statuses);
    const jql = [
      `project = ${PROJECT_KEY}`,
      getSprintClause(),
      'issuetype in (Story, Bug)',
      `status CHANGED TO (${statusList}) AFTER "${startDateTime}" BEFORE "${endDateTime}"`
    ].join(' AND ');
    const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
    const totals = sumStoryPoints(issues, storyPointsFieldId);
    results[bucket.label] = {
      storyPoints: totals.total,
      issueCount: issues.length,
      defaultedCount: totals.defaultedCount
    };
  }
  return results;
}

function normalizeTeamName(raw) {
  if (!raw) return 'Unassigned';
  const value = String(raw).toLowerCase();
  if (value.includes('team 1')) return 'Team 1';
  if (value.includes('team 2')) return 'Team 2';
  if (value.includes('team 3')) return 'Team 3';
  if (value.includes('team 4')) return 'Team 4';
  if (value.includes('team 5')) return 'Team 5';
  return 'Unassigned';
}

async function fetchEntryStoryPointsToday(client, storyPointsFieldId, teamFieldId, startDateTime, endDateTime) {
  const results = {
    teams: {},
    totals: {}
  };
  ENTRY_STATUS_BUCKETS.forEach(bucket => {
    results.totals[bucket.label] = { storyPoints: 0, issueCount: 0 };
  });
  TARGET_TEAMS.forEach(team => {
    results.teams[team] = {};
    ENTRY_STATUS_BUCKETS.forEach(bucket => {
      results.teams[team][bucket.label] = { storyPoints: 0, issueCount: 0 };
    });
  });

  const statusList = ENTRY_STATUS_BUCKETS.flatMap(bucket => bucket.statuses);
  const statusJql = buildStatusList(statusList);
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    `status CHANGED TO (${statusJql}) AFTER -2d`
  ].join(' AND ');

  const issues = await fetchIssuesByJql(client, jql, ['key']);
  const startUtc = toUtcDate(startDateTime.split(' ')[0], startDateTime.split(' ')[1], REPORT_TIMEZONE);
  const endUtc = toUtcDate(endDateTime.split(' ')[0], endDateTime.split(' ')[1], REPORT_TIMEZONE);

  for (const issueRef of issues) {
    const issueKey = issueRef.key || issueRef.id;
    if (!issueKey) continue;
    const issueResponse = await client.get(`/rest/api/3/issue/${issueKey}`, {
      params: { fields: `issuetype,${storyPointsFieldId},${teamFieldId}`, expand: 'changelog' }
    });
    const issue = issueResponse.data;
    const points = issue.fields?.[storyPointsFieldId] || 0;
    const histories = issue.changelog?.histories || [];
    const team = normalizeTeamName(getTeamName(issue, teamFieldId));

    const matchedBuckets = new Set();
    for (const history of histories) {
      const changeTime = new Date(history.created);
      if (changeTime < startUtc || changeTime > endUtc) continue;
      for (const item of history.items || []) {
        if (item.field !== 'status') continue;
        const toStatus = item.toString || item.to;
        ENTRY_STATUS_BUCKETS.forEach(bucket => {
          if (bucket.statuses.some(status => status.toLowerCase() === String(toStatus).toLowerCase())) {
            matchedBuckets.add(bucket.label);
          }
        });
      }
    }

    matchedBuckets.forEach(bucketLabel => {
      if (!results.teams[team]) {
        results.teams[team] = {};
        ENTRY_STATUS_BUCKETS.forEach(bucket => {
          results.teams[team][bucket.label] = { storyPoints: 0, issueCount: 0 };
        });
      }
      results.teams[team][bucketLabel].storyPoints += points;
      results.teams[team][bucketLabel].issueCount += 1;
      results.totals[bucketLabel].storyPoints += points;
      results.totals[bucketLabel].issueCount += 1;
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

async function fetchMovedOutToday(client, storyPointsFieldId, startDateTime, endDateTime) {
  const results = {};
  for (const bucket of STATUS_BUCKETS) {
    if (bucket.label === 'Ready for Release/Complete') {
      continue;
    }
    const statusList = buildStatusList(bucket.statuses);
    const jql = [
      `project = ${PROJECT_KEY}`,
      getSprintClause(),
      'issuetype in (Story, Bug)',
      `status CHANGED FROM (${statusList}) AFTER "${startDateTime}" BEFORE "${endDateTime}"`
    ].join(' AND ');
    const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
    const totals = sumStoryPoints(issues, storyPointsFieldId);
    results[bucket.label] = {
      storyPoints: totals.total,
      issueCount: issues.length,
      defaultedCount: totals.defaultedCount
    };
  }
  return results;
}

async function fetchEndOfDaySnapshot(client, storyPointsFieldId) {
  const results = {};
  for (const bucket of STATUS_BUCKETS) {
    const statusList = buildStatusList(bucket.statuses);
    const jql = [
      `project = ${PROJECT_KEY}`,
      getSprintClause(),
      'issuetype in (Story, Bug)',
      `status IN (${statusList})`
    ].join(' AND ');
    const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
    const totals = sumStoryPoints(issues, storyPointsFieldId);
    results[bucket.label] = {
      storyPoints: totals.total,
      issueCount: issues.length,
      defaultedCount: totals.defaultedCount
    };
  }
  return results;
}

async function fetchStoryPointsLeft(client, storyPointsFieldId) {
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    'status in ("Open", "In Dev")'
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
  const totals = sumStoryPoints(issues, storyPointsFieldId);
  return {
    storyPoints: totals.total,
    issueCount: issues.length,
    defaultedCount: totals.defaultedCount
  };
}

async function fetchStoryPointsByStatuses(client, storyPointsFieldId, statuses) {
  const statusList = buildStatusList(statuses);
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    `status in (${statusList})`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId]);
  const totals = sumStoryPoints(issues, storyPointsFieldId);
  return {
    storyPoints: totals.total,
    issueCount: issues.length,
    defaultedCount: totals.defaultedCount
  };
}

async function fetchTeamSummaryByStatuses(client, storyPointsFieldId, teamFieldId, statuses) {
  const statusList = buildStatusList(statuses);
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    `status in (${statusList})`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId, teamFieldId]);
  const summary = {};
  TARGET_TEAMS.forEach(team => {
    summary[team] = { storyPoints: 0, issueCount: 0 };
  });
  issues.forEach(issue => {
    const teamName = getTeamName(issue, teamFieldId);
    if (!summary[teamName]) {
      summary[teamName] = { storyPoints: 0, issueCount: 0 };
    }
    const points = issue.fields?.[storyPointsFieldId] || 0;
    summary[teamName].storyPoints += points;
    summary[teamName].issueCount += 1;
  });
  return summary;
}

async function fetchTeamSummaryByStatusCategory(client, storyPointsFieldId, teamFieldId, statusCategory) {
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    `statusCategory = "${statusCategory}"`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['issuetype', storyPointsFieldId, teamFieldId]);
  const summary = {};
  TARGET_TEAMS.forEach(team => {
    summary[team] = { storyPoints: 0, issueCount: 0 };
  });
  issues.forEach(issue => {
    const teamName = getTeamName(issue, teamFieldId);
    if (!summary[teamName]) {
      summary[teamName] = { storyPoints: 0, issueCount: 0 };
    }
    const points = issue.fields?.[storyPointsFieldId] || 0;
    summary[teamName].storyPoints += points;
    summary[teamName].issueCount += 1;
  });
  return summary;
}

async function fetchTeamBugWorkCount(client, teamFieldId) {
  const statusList = buildStatusList(['In Dev']);
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype in (Bug, "Sub-bug")',
    `status CHANGED TO (${statusList}) AFTER "${effectiveSprintStartDate}"`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, [teamFieldId]);
  const summary = {};
  TARGET_TEAMS.forEach(team => {
    summary[team] = { bugCount: 0 };
  });
  issues.forEach(issue => {
    const teamName = getTeamName(issue, teamFieldId);
    if (!summary[teamName]) {
      summary[teamName] = { bugCount: 0 };
    }
    summary[teamName].bugCount += 1;
  });
  return summary;
}

async function fetchTeamReturnToDevCount(client, teamFieldId) {
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    'status CHANGED FROM ("In QA", "In Review") TO ("In Dev") AFTER "' + effectiveSprintStartDate + '"'
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, [teamFieldId]);
  const summary = {};
  TARGET_TEAMS.forEach(team => {
    summary[team] = { returnToDevCount: 0 };
  });
  issues.forEach(issue => {
    const teamName = getTeamName(issue, teamFieldId);
    if (!summary[teamName]) {
      summary[teamName] = { returnToDevCount: 0 };
    }
    summary[teamName].returnToDevCount += 1;
  });
  return summary;
}

async function fetchStoriesPassedQa(client) {
  const statusList = buildStatusList(['Ready for QA', 'In QA']);
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    'issuetype = Story',
    `status CHANGED TO (${statusList}) AFTER "${effectiveSprintStartDate}"`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['key']);
  return issues.length;
}

async function fetchRaisedCounts(client, issueType, startDateTime, endDateTime) {
  const jql = [
    `project = ${PROJECT_KEY}`,
    getSprintClause(),
    `issuetype = "${issueType}"`,
    `created >= "${startDateTime}"`,
    `created <= "${endDateTime}"`
  ].join(' AND ');
  const issues = await fetchIssuesByJql(client, jql, ['key']);
  return issues.length;
}

/**
 * Fetch all bugs and sub-bugs created today (no sprint or fix version filter).
 * Returns list with key, issuetype, priority for each.
 * Uses date-only format (midnight to midnight) to capture full calendar day.
 */
async function fetchBugsCreatedTodayAll(client, startDateTime, endDateTime) {
  const dateStr = startDateTime.split(' ')[0];
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDayStr = nextDay.toISOString().slice(0, 10);
  const jql = [
    `project = ${PROJECT_KEY}`,
    'issuetype in (Bug, "Sub-bug")',
    `created >= "${dateStr}"`,
    `created < "${nextDayStr}"`
  ].join(' AND ');
  const CLOSED_STATUSES = ['Ready for Release', 'Ready for release', 'Complete', 'Completed', 'Done', 'Closed', 'Resolved'];
  const issues = await fetchIssuesByJql(client, jql, ['key', 'issuetype', 'priority', 'summary', 'status']);
  return issues.map(issue => {
    const status = issue.fields?.status?.name || '-';
    const isClosed = CLOSED_STATUSES.some(s => status.toLowerCase().includes(s.toLowerCase()));
    return {
      key: issue.key,
      issuetype: issue.fields?.issuetype?.name || '-',
      priority: issue.fields?.priority?.name || 'None',
      summary: issue.fields?.summary || '',
      status,
      isClosed
    };
  });
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

function ragStatus(value) {
  if (value >= 18) return 'Green';
  if (value >= 12) return 'Amber';
  return 'Red';
}

function buildRagSummary(movedInToday, movedOutToday) {
  const ragByStatus = {};
  let totalIn = 0;
  Object.entries(movedInToday).forEach(([status, metrics]) => {
    const sp = metrics.storyPoints || 0;
    totalIn += sp;
    ragByStatus[status] = {
      movedIn: {
        storyPoints: sp,
        rag: ragStatus(sp)
      },
      movedOut: null
    };
  });
  Object.entries(movedOutToday).forEach(([status, metrics]) => {
    const sp = metrics.storyPoints || 0;
    if (!ragByStatus[status]) {
      ragByStatus[status] = { movedIn: null, movedOut: null };
    }
    ragByStatus[status].movedOut = {
      storyPoints: sp,
      rag: ragStatus(sp)
    };
  });
  return {
    targetDailySp: DAILY_TARGET_SP,
    totalMovedStoryPoints: totalIn,
    totalRag: ragStatus(totalIn),
    byStatus: ragByStatus
  };
}

function formatNumber(value) {
  if (value === null || value === undefined) return 'n/a';
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function ragColor(rag) {
  if (rag === 'Green') return '#2E7D32';
  if (rag === 'Amber') return '#F9A825';
  return '#C62828';
}

function drawPdfTableRow(doc, y, columns, widths, options = {}) {
  let x = options.startX || 50;
  columns.forEach((col, index) => {
    const width = widths[index];
    const { text, color } = col;
    doc.fillColor(color || '#000000')
      .fontSize(options.fontSize || 9)
      .text(text, x, y, { width, align: 'left' });
    x += width;
  });
}

function drawPdfTableGrid(doc, x, y, widths, rowHeight) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  doc.save();
  doc.strokeColor('#DDDDDD').lineWidth(0.5);
  doc.rect(x, y, totalWidth, rowHeight).stroke();
  let offset = x;
  widths.forEach(width => {
    offset += width;
    doc.moveTo(offset, y).lineTo(offset, y + rowHeight).stroke();
  });
  doc.restore();
}

function renderPdf(report, filepath) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  doc.fontSize(18).text('Daily Flow Metrics', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Project: ${report.project}`);
  if (report.sprint) {
    doc.text(`Sprint: ${report.sprint}`);
  }
  if (report.sprintWindow) {
    doc.text(`Sprint Window: ${report.sprintWindow.start} → ${report.sprintWindow.end}`);
  }
  doc.text(`Date (UK): ${report.dateUtc}`);
  doc.text(`Range (UK): ${report.rangeUtc.start} → ${report.rangeUtc.end}`);
  doc.moveDown(1);

  doc.fontSize(12).text('Entries Today (Story SP)');
  doc.fontSize(10).text('From 01:00 UK to now');
  doc.moveDown(0.5);

  const completedSp = report.storyPointsDone?.storyPoints ?? report.snapshots?.current?.['Ready for Release/Complete']?.storyPoints ?? null;
  const remainingSp = report.storyPointsLeft?.storyPoints ?? null;
  const inDevLeft = report.storyPointsLeftByStage?.inDev?.storyPoints ?? null;
  const reviewQaLeft = report.storyPointsLeftByStage?.reviewQa?.storyPoints ?? null;
  const completedBoxY = doc.y + 6;
  doc.save();
  doc.fillColor('#F0F0F0').rect(50, completedBoxY, 500, 38).fill();
  doc.restore();
  doc.fillColor('#333333').fontSize(10).text('Total Story Points Completed (Ready for Release/Complete)', 60, completedBoxY + 6, { width: 480 });
  const completedText = `${formatNumber(completedSp)} done`;
  const remainingText = remainingSp !== null ? `${formatNumber(remainingSp)} left in dev` : 'n/a left in dev';
  const qaText = reviewQaLeft !== null ? `${formatNumber(reviewQaLeft)} being QA'd` : 'n/a being QA\'d';
  doc.fillColor('#000000').fontSize(18).font('Helvetica-Bold')
    .text(`${completedText} • ${remainingText} • ${qaText}`, 60, completedBoxY + 18);
  doc.moveDown(3);

  const tableStartY = doc.y + 5;
  const colWidths = [120, 90, 90, 90, 110];
  drawPdfTableGrid(doc, 50, tableStartY - 2, colWidths, 14);
  drawPdfTableRow(doc, tableStartY, [
    { text: 'Team', color: '#000000' },
    { text: 'In Dev', color: '#000000' },
    { text: 'Ready for Review', color: '#000000' },
    { text: 'Ready for QA', color: '#000000' },
    { text: 'Ready for Release', color: '#000000' }
  ], colWidths, { startX: 50, fontSize: 8 });

  let y = tableStartY + 16;
  const entryTeams = report.entryStoryPointsToday?.teams || {};
  TARGET_TEAMS.forEach(team => {
    const teamRow = entryTeams[team] || {};
    drawPdfTableGrid(doc, 50, y - 2, colWidths, 14);
    drawPdfTableRow(doc, y, [
      { text: team },
      { text: formatNumber(teamRow['In Dev']?.storyPoints || 0) },
      { text: formatNumber(teamRow['Ready for Review']?.storyPoints || 0) },
      { text: formatNumber(teamRow['Ready for QA']?.storyPoints || 0) },
      { text: formatNumber(teamRow['Ready for Release']?.storyPoints || 0) }
    ], colWidths, { startX: 50, fontSize: 8 });
    y += 14;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  });

  const entryTotals = report.entryStoryPointsToday?.totals || {};
  drawPdfTableGrid(doc, 50, y - 2, colWidths, 14);
  drawPdfTableRow(doc, y, [
    { text: 'Total' },
    { text: formatNumber(entryTotals['In Dev']?.storyPoints || 0) },
    { text: formatNumber(entryTotals['Ready for Review']?.storyPoints || 0) },
    { text: formatNumber(entryTotals['Ready for QA']?.storyPoints || 0) },
    { text: formatNumber(entryTotals['Ready for Release']?.storyPoints || 0) }
  ], colWidths, { startX: 50, fontSize: 8 });

  if (report.teamSummary) {
    doc.moveDown(1);
    doc.fontSize(12).text('Team Summary (Stories Only)');
    const teamTableY = doc.y + 6;
    const teamColWidths = [120, 55, 55, 70, 80, 60, 60];
    drawPdfTableRow(doc, teamTableY, [
      { text: '' },
      { text: 'Story Work' }
    ], [
      teamColWidths[0],
      teamColWidths[1] + teamColWidths[2] + teamColWidths[3] + teamColWidths[4] + teamColWidths[5] + teamColWidths[6]
    ], { startX: 50, fontSize: 8 });
    const subHeaderY = teamTableY + 14;
    drawPdfTableRow(doc, subHeaderY, [
      { text: 'Team' },
      { text: 'Done SP' },
      { text: 'In Dev SP' },
      { text: 'Still To Do SP' },
      { text: 'In Code Review SP' },
      { text: 'In QA SP' },
      { text: 'Bugs Worked On' }
    ], teamColWidths, { startX: 50, fontSize: 8 });
    let teamY = subHeaderY + 16;
    const teams = Object.keys(report.teamSummary);
    teams.forEach(team => {
      const row = report.teamSummary[team] || { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 };
      drawPdfTableGrid(doc, 50, teamY - 2, teamColWidths, 14);
      drawPdfTableRow(doc, teamY, [
        { text: team, color: '#000000' },
        { text: formatNumber(row.done) },
        { text: formatNumber(row.inDev) },
        { text: formatNumber(row.stillToDo) },
        { text: formatNumber(row.inCodeReview) },
        { text: formatNumber(row.inQa) },
        { text: `${row.bugsWorked}` }
      ], teamColWidths, { startX: 50, fontSize: 8 });
      teamY += 14;
      if (teamY > 720) {
        doc.addPage();
        teamY = 50;
      }
    });
    const totals = teams.reduce((acc, team) => {
      const row = report.teamSummary[team] || { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 };
      acc.done += row.done || 0;
      acc.inDev += row.inDev || 0;
      acc.stillToDo += row.stillToDo || 0;
      acc.inCodeReview += row.inCodeReview || 0;
      acc.inQa += row.inQa || 0;
      acc.bugsWorked += row.bugsWorked || 0;
      return acc;
    }, { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 });
    drawPdfTableGrid(doc, 50, teamY - 2, teamColWidths, 14);
    drawPdfTableRow(doc, teamY, [
      { text: 'Total' },
      { text: formatNumber(totals.done) },
      { text: formatNumber(totals.inDev) },
      { text: formatNumber(totals.stillToDo) },
      { text: formatNumber(totals.inCodeReview) },
      { text: formatNumber(totals.inQa) },
      { text: `${totals.bugsWorked}` }
    ], teamColWidths, { startX: 50, fontSize: 8 });
  }

  doc.moveDown(1);
  if (report.sprintQuality) {
    doc.fontSize(12).text('Sprint Quality');
    const cardY = doc.y + 8;
    const cardWidth = 155;
    const cardHeight = 46;
    const gap = 10;
    const startX = 50;

    const cards = [
      { label: 'Stories into QA', value: report.sprintQuality.storiesPassedQa },
      { label: 'Bugs/Stories Raised', value: report.sprintQuality.bugLikeRaisedTotal },
      { label: 'Bugs per Story Rate', value: formatNumber(report.sprintQuality.bugsPerStory) }
    ];

    cards.forEach((card, index) => {
      const x = startX + index * (cardWidth + gap);
      doc.save();
      doc.fillColor('#F5F5F5').rect(x, cardY, cardWidth, cardHeight).fill();
      doc.restore();
      doc.fillColor('#555555').fontSize(8).text(card.label, x + 6, cardY + 6, { width: cardWidth - 12 });
      doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold').text(card.value, x + 6, cardY + 18, { width: cardWidth - 12 });
    });

    const bugsToday = report.sprintQuality.bugsCreatedTodayAll || [];
    doc.moveDown(1);
    doc.fontSize(12).text('Bugs/Sub-bugs Created Today (all, no sprint/fix version filter)');
    const closedCount = report.sprintQuality.bugsCreatedTodayClosedCount ?? bugsToday.filter(b => b.isClosed).length;
    doc.fontSize(10).text(`Total: ${bugsToday.length} | Closed: ${closedCount}`);
    if (bugsToday.length > 0) {
      const bugColWidths = [70, 70, 80, 50, 220];
      let bugY = doc.y + 10;
      drawPdfTableGrid(doc, 50, bugY - 2, bugColWidths, 14);
      drawPdfTableRow(doc, bugY, [
        { text: 'Key', color: '#000000' },
        { text: 'Type', color: '#000000' },
        { text: 'Priority', color: '#000000' },
        { text: 'Status', color: '#000000' },
        { text: 'Summary', color: '#000000' }
      ], bugColWidths, { startX: 50, fontSize: 8 });
      bugY += 14;
      bugsToday.forEach(b => {
        drawPdfTableGrid(doc, 50, bugY - 2, bugColWidths, 14);
        drawPdfTableRow(doc, bugY, [
          { text: b.key || '-' },
          { text: b.issuetype || '-' },
          { text: b.priority || 'None' },
          { text: b.status || '-' },
          { text: (b.summary || '').slice(0, 40) + ((b.summary || '').length > 40 ? '...' : '') }
        ], bugColWidths, { startX: 50, fontSize: 8 });
        bugY += 14;
        if (bugY > 720) {
          doc.addPage();
          bugY = 50;
        }
      });
      doc.y = bugY + 4;
    }
    doc.moveDown(2);
  }

  doc.end();
}

function renderMarkdown(report) {
  const { dateUtc, rangeUtc, snapshots, sprintQuality, sprint } = report;
  const lines = [];
  lines.push('# Daily Flow Metrics');
  lines.push('');
  lines.push(`Project: ${report.project}`);
  if (sprint) {
    lines.push(`Sprint: ${sprint}`);
  }
  if (report.sprintWindow) {
    lines.push(`Sprint Window: ${report.sprintWindow.start} → ${report.sprintWindow.end}`);
  }
  lines.push(`Date (UK): ${dateUtc}`);
  lines.push(`Range (UK): ${rangeUtc.start} → ${rangeUtc.end}`);
  lines.push('');

  lines.push('## Entries Today (Story SP)');
  lines.push('');
  lines.push('| Team | In Dev | Ready for Review | Ready for QA | Ready for Release |');
  lines.push('|------|--------|------------------|-------------|-------------------|');
  const entryTeams = report.entryStoryPointsToday?.teams || {};
  TARGET_TEAMS.forEach(team => {
    const teamRow = entryTeams[team] || {};
    lines.push(`| ${team} | ${formatNumber(teamRow['In Dev']?.storyPoints || 0)} | ${formatNumber(teamRow['Ready for Review']?.storyPoints || 0)} | ${formatNumber(teamRow['Ready for QA']?.storyPoints || 0)} | ${formatNumber(teamRow['Ready for Release']?.storyPoints || 0)} |`);
  });
  const entryTotals = report.entryStoryPointsToday?.totals || {};
  lines.push(`| Total | ${formatNumber(entryTotals['In Dev']?.storyPoints || 0)} | ${formatNumber(entryTotals['Ready for Review']?.storyPoints || 0)} | ${formatNumber(entryTotals['Ready for QA']?.storyPoints || 0)} | ${formatNumber(entryTotals['Ready for Release']?.storyPoints || 0)} |`);
  lines.push('');

  lines.push('## Start of Day Snapshot');
  lines.push('');
  lines.push('| Status | Story Points | Issues |');
  lines.push('|--------|-------------|--------|');
  Object.entries(snapshots.startOfDay).forEach(([status, info]) => {
    lines.push(`| ${status} | ${formatNumber(info.storyPoints)} | ${info.issueCount} |`);
  });
  lines.push('');

  lines.push('## Current Snapshot');
  lines.push('');
  lines.push('| Status | Story Points | Issues |');
  lines.push('|--------|-------------|--------|');
  Object.entries(snapshots.current).forEach(([status, info]) => {
    lines.push(`| ${status} | ${formatNumber(info.storyPoints)} | ${info.issueCount} |`);
  });
  lines.push('');

  if (report.teamSummary) {
    lines.push('## Team Summary (Stories Only)');
    lines.push('');
    lines.push('| Team | Done SP | In Dev SP | Still To Do SP | In Code Review SP | In QA SP | Bugs Worked On |');
    lines.push('|------|---------|-----------|----------------|-------------------|---------|----------------|');
    const teams = Object.keys(report.teamSummary);
    teams.forEach(team => {
      const row = report.teamSummary[team] || { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 };
      lines.push(`| ${team} | ${formatNumber(row.done)} | ${formatNumber(row.inDev)} | ${formatNumber(row.stillToDo)} | ${formatNumber(row.inCodeReview)} | ${formatNumber(row.inQa)} | ${row.bugsWorked} |`);
    });
    const totals = teams.reduce((acc, team) => {
      const row = report.teamSummary[team] || { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 };
      acc.done += row.done || 0;
      acc.inDev += row.inDev || 0;
      acc.stillToDo += row.stillToDo || 0;
      acc.inCodeReview += row.inCodeReview || 0;
      acc.inQa += row.inQa || 0;
      acc.bugsWorked += row.bugsWorked || 0;
      return acc;
    }, { done: 0, inDev: 0, stillToDo: 0, inCodeReview: 0, inQa: 0, bugsWorked: 0 });
    lines.push(`| Total | ${formatNumber(totals.done)} | ${formatNumber(totals.inDev)} | ${formatNumber(totals.stillToDo)} | ${formatNumber(totals.inCodeReview)} | ${formatNumber(totals.inQa)} | ${totals.bugsWorked} |`);
    lines.push('');
  }

  if (sprintQuality) {
    lines.push('## Sprint Quality');
    lines.push('');
    lines.push(`Stories Passed QA: ${sprintQuality.storiesPassedQa}`);
    lines.push(`Stories Raised: ${sprintQuality.storiesRaised}`);
    lines.push(`Bugs Raised: ${sprintQuality.bugsRaised.total} (Bug ${sprintQuality.bugsRaised.Bug}, Sub-bug ${sprintQuality.bugsRaised['Sub-bug']})`);
    lines.push(`Bug-like Raised (Bugs + Stories Raised): ${sprintQuality.bugLikeRaisedTotal}`);
    lines.push(`Bug-like per Story (based on stories passed QA): ${formatNumber(sprintQuality.bugsPerStory)}`);
    lines.push('');
    const bugsToday = sprintQuality.bugsCreatedTodayAll || [];
    const closedCount = sprintQuality.bugsCreatedTodayClosedCount ?? bugsToday.filter(b => b.isClosed).length;
    lines.push('## Bugs/Sub-bugs Created Today (all, no sprint/fix version filter)');
    lines.push('');
    lines.push(`Total: ${bugsToday.length} | Closed: ${closedCount}`);
    if (bugsToday.length > 0) {
      lines.push('');
      lines.push('| Key | Type | Priority | Status | Summary |');
      lines.push('|-----|------|----------|--------|---------|');
      bugsToday.forEach(b => {
        const summary = (b.summary || '').replace(/\|/g, ' ').slice(0, 50);
        lines.push(`| ${b.key || '-'} | ${b.issuetype || '-'} | ${b.priority || 'None'} | ${b.status || '-'} | ${summary} |`);
      });
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  SPRINT_NAME = process.argv[2] || DEFAULT_SPRINT_NAME;
  const sprint = await getSprintByName(client, BOARD_ID, SPRINT_NAME);
  SPRINT_JQL = sprint ? `sprint = ${sprint.id}` : `sprint = "${SPRINT_NAME}"`;
  const sprintStartDate = sprint?.startDate ? sprint.startDate.split('T')[0] : SPRINT_START_DATE;
  effectiveSprintStartDate = sprintStartDate;
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const teamFieldId = await discoverTeamFieldId(client);

  const now = new Date();
  const ukNow = formatInTimeZone(now, REPORT_TIMEZONE);
  const dateStr = ukNow.date;
  const offset = getTimeZoneOffsetString(now, REPORT_TIMEZONE);
  const startDateTime = formatJqlDateTime(dateStr, '01:00', offset);
  const endDateTime = formatJqlDateTime(dateStr, ukNow.time, offset);

  console.log('\n📊 Daily Flow Metrics');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Sprint: ${SPRINT_NAME}`);
  console.log(`Sprint Window: ${sprintStartDate} → ${endDateTime.split(' ')[0]}`);
  console.log(`Date (UK): ${dateStr}`);
  console.log(`Range (UK): ${startDateTime} → ${endDateTime}`);

  console.log('\n🔎 Collecting start-of-day snapshot...');
  const startSnapshot = await fetchStartOfDaySnapshot(client, storyPointsFieldId, dateStr);

  console.log('🔎 Collecting movements since start of day...');
  const movedIn = await fetchMovedInToday(client, storyPointsFieldId, startDateTime, endDateTime);
  const movedOut = await fetchMovedOutToday(client, storyPointsFieldId, startDateTime, endDateTime);
  const entryStoryPointsToday = await fetchEntryStoryPointsToday(
    client,
    storyPointsFieldId,
    teamFieldId,
    startDateTime,
    endDateTime
  );

  console.log('🔎 Collecting current snapshot...');
  const endSnapshot = await fetchEndOfDaySnapshot(client, storyPointsFieldId);

  console.log('🔎 Collecting sprint QA pass-through + bug ratio...');
  const storiesPassedQa = await fetchStoriesPassedQa(client);
  const storyRaisedCount = await fetchRaisedCounts(client, 'Story', `${sprintStartDate} 00:00`, endDateTime);
  const bugRaisedCount = await fetchRaisedCounts(client, 'Bug', `${sprintStartDate} 00:00`, endDateTime);
  const subBugRaisedCount = await fetchRaisedCounts(client, 'Sub-bug', `${sprintStartDate} 00:00`, endDateTime);
  console.log('🔎 Collecting bugs/sub-bugs created today (all, no sprint/fix version filter)...');
  const bugsStartToday = formatJqlDateTime(dateStr, '00:00', offset);
  const bugsCreatedTodayAll = await fetchBugsCreatedTodayAll(client, bugsStartToday, endDateTime);
  const totalBugsRaised = bugRaisedCount + subBugRaisedCount;
  const totalBugLikeRaised = totalBugsRaised + storyRaisedCount;
  const bugsPerStory = storiesPassedQa > 0 ? totalBugLikeRaised / storiesPassedQa : null;

  console.log('🔎 Collecting story points left (Open/In Dev)...');
  const storyPointsLeft = await fetchStoryPointsLeft(client, storyPointsFieldId);
  console.log('🔎 Collecting story points left by stage...');
  const inDevLeft = await fetchStoryPointsByStatuses(client, storyPointsFieldId, ['In Dev']);
  const reviewQaLeft = await fetchStoryPointsByStatuses(
    client,
    storyPointsFieldId,
    ['Ready for Review', 'In Review', 'Ready for QA', 'In QA']
  );
  const storyPointsDone = await fetchStoryPointsByStatuses(
    client,
    storyPointsFieldId,
    ['Ready for Release', 'Ready for release', 'Complete', 'Completed', 'Done', 'Closed', 'Resolved']
  );
  console.log('🔎 Collecting team summary...');
  const teamDone = await fetchTeamSummaryByStatusCategory(
    client,
    storyPointsFieldId,
    teamFieldId,
    'Done'
  );
  const teamInDev = await fetchTeamSummaryByStatuses(
    client,
    storyPointsFieldId,
    teamFieldId,
    ['In Dev']
  );
  const teamStillToDo = await fetchTeamSummaryByStatusCategory(
    client,
    storyPointsFieldId,
    teamFieldId,
    'To Do'
  );
  const teamInCodeReview = await fetchTeamSummaryByStatuses(
    client,
    storyPointsFieldId,
    teamFieldId,
    ['Ready for Review', 'In Review']
  );
  const teamInQa = await fetchTeamSummaryByStatuses(
    client,
    storyPointsFieldId,
    teamFieldId,
    ['Ready for QA', 'In QA']
  );
  const teamBugsWorked = await fetchTeamBugWorkCount(client, teamFieldId);
  const teamSummary = {};
  const teamNames = new Set([
    ...Object.keys(teamDone),
    ...Object.keys(teamInDev),
    ...Object.keys(teamStillToDo),
    ...Object.keys(teamInCodeReview),
    ...Object.keys(teamInQa),
    ...Object.keys(teamBugsWorked),
  ]);
  if (!teamNames.has('Unassigned')) {
    teamNames.add('Unassigned');
  }
  teamNames.forEach(team => {
    teamSummary[team] = {
      done: teamDone[team]?.storyPoints || 0,
      inDev: teamInDev[team]?.storyPoints || 0,
      stillToDo: teamStillToDo[team]?.storyPoints || 0,
      inCodeReview: teamInCodeReview[team]?.storyPoints || 0,
      inQa: teamInQa[team]?.storyPoints || 0,
      bugsWorked: teamBugsWorked[team]?.bugCount || 0
    };
  });

  const report = {
    generatedAt: now.toISOString(),
    project: PROJECT_KEY,
    sprint: SPRINT_NAME,
    sprintWindow: {
      start: sprintStartDate,
      end: endDateTime.split(' ')[0]
    },
    dateUtc: dateStr,
    rangeUtc: {
      start: startDateTime,
      end: endDateTime
    },
    statuses: STATUS_BUCKETS.map(bucket => bucket.label),
    snapshots: {
      startOfDay: startSnapshot,
      movedIn,
      movedOut,
      current: endSnapshot
    },
    storyPointsLeft,
    storyPointsLeftByStage: {
      inDev: inDevLeft,
      reviewQa: reviewQaLeft
    },
    storyPointsDone,
    entryStoryPointsToday,
    teamSummary,
    sprintQuality: {
      storiesPassedQa,
      bugsRaised: {
        Bug: bugRaisedCount,
        'Sub-bug': subBugRaisedCount,
        total: totalBugsRaised
      },
      bugsCreatedTodayAll,
      bugsCreatedTodayClosedCount: bugsCreatedTodayAll.filter(b => b.isClosed).length,
      bugLikeRaisedTotal: totalBugLikeRaised,
      storiesRaised: storyRaisedCount,
      bugsPerStory
    },
    ragSummary: buildRagSummary(movedIn, movedOut)
  };

  const reportsDir = ensureReportsDir();
  const filepath = path.join(reportsDir, `daily-flow-metrics-${dateStr}.json`);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  const markdownPath = path.join(reportsDir, `daily-flow-metrics-${dateStr}.md`);
  fs.writeFileSync(markdownPath, renderMarkdown(report));

  console.log(`\n✅ Report saved: ${filepath}`);
  console.log(`✅ Markdown saved: ${markdownPath}`);

  const pdfPath = path.join(reportsDir, `daily-flow-metrics-${dateStr}.pdf`);
  renderPdf(report, pdfPath);
  console.log(`✅ PDF saved: ${pdfPath}`);
}

main().catch(error => {
  console.error('\n❌ Failed to generate daily flow metrics');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
