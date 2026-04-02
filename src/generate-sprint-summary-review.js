#!/usr/bin/env node

/**
 * Sprint Summary Review – Reusable for any sprint
 *
 * Generates a sprint review report with:
 * - Whole epics completed (epics where ALL child issues are in Done status)
 * - Issues completed by category (Stories, Bugs, Sub-bugs)
 * - Story point burn: SP committed vs SP completed (Story work only)
 * - Mean and median daily SP burn rate
 * - Bug report: at start, opened during, left at end (by priority)
 * - Project forecast: end date at 10%, 25%, 50% velocity uplift
 * - Story points completed by role group
 *
 * Usage:
 *   node src/generate-sprint-summary-review.js [Sprint Name]
 *   node src/generate-sprint-summary-review.js "NH Sprint 37"
 *   npm run sprint-summary-review -- "NH Sprint 38"
 *
 * Default sprint: NH Sprint 37 (or last closed sprint if not found)
 */

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
const DEFAULT_SPRINT_NAME = 'NH Sprint 37';

// Overall plan (for project forecast)
const PLAN_START_DATE = '2026-01-19';
const PLAN_WEEKS = 10;
const TOTAL_PLAN_SP = 1700;
const SPRINT_LENGTH_WEEKS = 2;

const COMPLETED_STATUSES = [
  'Ready for Release',
  'Ready for release',
  'Complete',
  'Completed',
  'Done',
  'Closed',
  'Resolved'
];
const IN_DEV_STATUSES = ['In Dev', 'In dev'];

const ROLE_MAPPING = [
  { role: 'Team Leads', names: ['Sanjeet', 'Amit Sable', 'Manish', 'Vivek', 'Laurence'] },
  { role: 'Principal Engineers', names: ['Yoong', 'David Beere'] },
  { role: 'Snr Onshore', names: ['Brandon', 'Donn'] },
  { role: 'New Onshore', names: ['Huzefa', 'Gururaj', 'Jack', 'Allan'] },
  { role: 'Engineers', names: ['Amit Kumbharkar', 'Swapnil', 'Yash', 'Mahendra', 'Vibhuti', 'Saurabh', 'Kavipiya', 'Kavipriya', 'Ajay', 'Darshit', 'Srihari', 'Kapish', 'Pravin', 'Ajit', 'Anthony'] }
];

const ORDERED_NAMES = [
  'Amit Sable', 'Amit Kumbharkar', 'David Beere',
  'Sanjeet', 'Manish', 'Vivek', 'Laurence',
  'Yoong', 'Brandon', 'Donn', 'Huzefa', 'Gururaj', 'Jack', 'Allan',
  'Swapnil', 'Yash', 'Mahendra', 'Vibhuti',
  'Saurabh', 'Kavipiya', 'Kavipriya', 'Ajay', 'Darshit', 'Srihari', 'Kapish', 'Pravin', 'Ajit', 'Anthony'
];

function validateConfig() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN must be set');
    process.exit(1);
  }
}

function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 30000
  });
}

function getDisplayName(user) {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user.displayName || user.name || null;
}

function isDoneStatus(statusName) {
  if (!statusName) return false;
  return COMPLETED_STATUSES.some((s) => String(statusName).toLowerCase() === s.toLowerCase());
}

function getRoleForAssignee(displayName) {
  if (!displayName || displayName === 'Unassigned') return 'Unassigned';
  const name = String(displayName).trim().toLowerCase();
  for (const roleName of ORDERED_NAMES) {
    if (name.includes(roleName.toLowerCase())) {
      const role = ROLE_MAPPING.find((r) => r.names.some((n) => n.toLowerCase() === roleName.toLowerCase()));
      return role ? role.role : 'Unassigned';
    }
  }
  return 'Unassigned';
}

function getPersonWhoMovedToInDev(issue) {
  if (!issue.changelog?.histories?.length) {
    return getDisplayName(issue.fields?.assignee) || 'Unassigned';
  }
  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').toLowerCase();
        if (IN_DEV_STATUSES.some((s) => toStatus === s.toLowerCase())) {
          return getDisplayName(history.author) || 'Unassigned';
        }
      }
    }
  }
  return getDisplayName(issue.fields?.assignee) || 'Unassigned';
}

/** Get date when issue was first moved to a Done status (from changelog). */
function getDateMovedToDone(issue) {
  if (!issue.changelog?.histories?.length) return null;
  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').trim();
        if (COMPLETED_STATUSES.some((s) => toStatus.toLowerCase() === s.toLowerCase())) {
          return history.created.split('T')[0];
        }
      }
    }
  }
  return null;
}

/** Count working days (Mon–Fri) between two dates, inclusive. */
function countWorkingDays(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function renderPdf(report, filepathOrStream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = typeof filepathOrStream === 'string'
    ? fs.createWriteStream(filepathOrStream)
    : filepathOrStream;
  doc.pipe(stream);

  const section = (title) => {
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
  };

  doc.fontSize(18).text('Sprint Summary Review', { align: 'left' });
  doc.fontSize(10).text(`Sprint: ${report.sprint.name}`);
  doc.text(`Dates: ${(report.sprint.startDate || '').slice(0, 10)} → ${(report.sprint.endDate || '').slice(0, 10)}`);
  doc.text(`Generated: ${report.generatedAt.slice(0, 10)}`);
  doc.moveDown(0.5);

  section('Whole Epics Completed');
  doc.text(`Epics where all child issues are Done: ${report.wholeEpicsCompleted}`);
  if (report.completedEpicKeys?.length) {
    doc.text(report.completedEpicKeys.join(', '), { width: 500 });
  }

  section('Issues Completed by Category');
  doc.text(`Stories: ${report.issuesCompletedByCategory?.Story ?? 0} | Bugs: ${report.issuesCompletedByCategory?.Bug ?? 0} | Sub-bugs: ${report.issuesCompletedByCategory?.['Sub-bug'] ?? 0}`);
  doc.text(`Total: ${(report.issuesCompletedByCategory?.Story ?? 0) + (report.issuesCompletedByCategory?.Bug ?? 0) + (report.issuesCompletedByCategory?.['Sub-bug'] ?? 0)}`);

  section('Story Point Burn (Story work only)');
  const burn = report.storyPointBurn || {};
  doc.text(`SP committed: ${burn.committed} | SP completed: ${burn.completed} | SP in QA/Ready for QA: ${burn.inQAOrReadyForQA ?? 0}`);
  doc.text(`Burn rate: ${(burn.burnRatePercent ?? 0).toFixed(1)}%`);
  doc.text(`Mean daily SP burn: ${(burn.meanDailyBurn ?? 0).toFixed(2)} (${burn.workingDays ?? 0} working days) | Median: ${(burn.medianDailyBurn ?? 0).toFixed(2)}`);

  section('Bug Report');
  const bug = report.bugReport || {};
  doc.text(`At start: ${bug.atStart ?? 0} | Opened during sprint: ${bug.openedDuring ?? 0} | Left at end: ${bug.leftAtEnd ?? 0}`);
  const leftByP = bug.leftAtEndByPriority || {};
  if (Object.keys(leftByP).length) {
    doc.text('Left at end by priority: ' + Object.entries(leftByP).map(([p, c]) => `${p}: ${c}`).join(', '));
  }

  section('Project Forecast');
  const fc = report.projectForecast || {};
  doc.text(`Remaining plan SP: ${fc.remainingPlanSp} | Velocity: ${fc.velocityPerSprint} SP/sprint`);
  doc.text(`10% uplift: ${fc.at10PercentUplift?.endDate} (~${fc.at10PercentUplift?.sprints?.toFixed(1)} sprints)`);
  doc.text(`25% uplift: ${fc.at25PercentUplift?.endDate} (~${fc.at25PercentUplift?.sprints?.toFixed(1)} sprints)`);
  doc.text(`50% uplift: ${fc.at50PercentUplift?.endDate} (~${fc.at50PercentUplift?.sprints?.toFixed(1)} sprints)`);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').text(`Uplift needed to finish in 4 sprints: ${(fc.upliftNeededFor4Sprints ?? 0).toFixed(1)}%`);
  doc.font('Helvetica');

  section('Story Points Completed by Role');
  const roles = report.storyPointsCompletedByRole || {};
  const roleOrder = ['Team Leads', 'Principal Engineers', 'Snr Onshore', 'New Onshore', 'Engineers', 'Unassigned'];
  roleOrder.forEach((r) => {
    if (roles[r]) doc.text(`${r}: ${roles[r]}`);
  });

  doc.end();
  return stream;
}

async function discoverStoryPointsFieldId(client) {
  try {
    const { data: fields } = await client.get('/rest/api/3/field');
    const sp = fields.find((f) => f.name && f.name.toLowerCase().includes('story point'));
    return sp?.id || 'customfield_10003';
  } catch {
    return 'customfield_10003';
  }
}

async function fetchAllSprints(client, boardId) {
  const results = [];
  let startAt = 0;
  let isLast = false;
  while (!isLast) {
    const response = await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
      params: { state: 'active,closed,future', startAt, maxResults: 50 }
    });
    const data = response.data || {};
    results.push(...(data.values || []));
    startAt += data.maxResults || 50;
    isLast = data.isLast || !(data.values || []).length;
  }
  return results;
}

async function getSprintByName(client, boardId, sprintName) {
  const sprints = await fetchAllSprints(client, boardId);
  return sprints.find((s) => s.name === sprintName) || null;
}

async function fetchIssuesByJql(client, jql, fields) {
  const results = [];
  let nextPageToken = null;
  do {
    const body = { jql, maxResults: 100, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;
    if (nextPageToken) await new Promise((r) => setTimeout(r, 200));
  } while (nextPageToken);
  return results;
}

function getEpicKey(issue) {
  const epicLink = issue.fields?.customfield_10014;
  if (epicLink) return typeof epicLink === 'string' ? epicLink : epicLink.key || epicLink.id;
  const parent = issue.fields?.parent;
  if (parent?.fields?.issuetype?.name === 'Epic') return parent.key;
  return null;
}

async function fetchEpicChildren(client, epicKey, storyPointsFieldId) {
  const jql = `project = ${PROJECT_KEY} AND (parent = ${epicKey} OR "Epic Link" = ${epicKey} OR parentEpic = ${epicKey}) AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  return fetchIssuesByJql(client, jql, ['key', 'status', 'issuetype', storyPointsFieldId]);
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  const sprintName = process.argv[2] || DEFAULT_SPRINT_NAME;
  const sprint = await getSprintByName(client, BOARD_ID, sprintName);

  if (!sprint) {
    console.error(`Error: Sprint "${sprintName}" not found on board ${BOARD_ID}`);
    process.exit(1);
  }

  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const sprintClause = `sprint = ${sprint.id}`;

  console.log('\n📊 Sprint Summary Review');
  console.log('='.repeat(60));
  console.log(`Sprint: ${sprint.name} (ID: ${sprint.id})`);
  console.log(`Dates: ${sprint.startDate?.slice(0, 10) || '?'} → ${sprint.endDate?.slice(0, 10) || '?'}`);
  console.log('');

  // 1. Fetch all issues in sprint (Story, Bug, Sub-bug, Sub-task)
  const issueTypesJql = `project = ${PROJECT_KEY} AND ${sprintClause} AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")`;
  const allSprintIssues = await fetchIssuesByJql(client, issueTypesJql, [
    'key', 'summary', 'status', 'issuetype', storyPointsFieldId, 'parent', 'customfield_10014', 'created', 'priority'
  ]);

  // 2. Issues completed by category (Story, Bug, Sub-bug)
  const completedByCategory = { Story: 0, Bug: 0, 'Sub-bug': 0 };
  for (const issue of allSprintIssues) {
    const type = issue.fields?.issuetype?.name;
    if (!type || !['Story', 'Bug', 'Sub-bug'].includes(type)) continue;
    if (isDoneStatus(issue.fields?.status?.name)) {
      completedByCategory[type] = (completedByCategory[type] || 0) + 1;
    }
  }

  // 3. Whole epics completed – epics where ALL children are Done
  const epicKeysInSprint = new Set();
  for (const issue of allSprintIssues) {
    const epicKey = getEpicKey(issue);
    if (epicKey) epicKeysInSprint.add(epicKey);
  }

  let wholeEpicsCompleted = 0;
  const completedEpicKeys = [];

  for (const epicKey of epicKeysInSprint) {
    const children = await fetchEpicChildren(client, epicKey, storyPointsFieldId);
    if (children.length === 0) continue; // Epic with no children – skip
    const allDone = children.every((c) => isDoneStatus(c.fields?.status?.name));
    if (allDone) {
      wholeEpicsCompleted++;
      completedEpicKeys.push(epicKey);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // 4. Story point burn (Story work only)
  const storiesInSprint = allSprintIssues.filter((i) => i.fields?.issuetype?.name === 'Story');
  const QA_STATUSES = ['In QA', 'Ready for QA'];
  const getSp = (i) => {
    const v = i.fields?.[storyPointsFieldId];
    return v != null && v !== '' ? Number(v) : 2;
  };
  const spCommitted = storiesInSprint.reduce((sum, i) => sum + getSp(i), 0);
  const spCompleted = storiesInSprint
    .filter((i) => isDoneStatus(i.fields?.status?.name))
    .reduce((sum, i) => sum + getSp(i), 0);
  const spInQAOrReadyForQA = storiesInSprint
    .filter((i) => QA_STATUSES.some((s) => (i.fields?.status?.name || '').toLowerCase() === s.toLowerCase()))
    .reduce((sum, i) => sum + getSp(i), 0);

  // 5. Story points completed by role + daily burn (from changelog)
  const completedStories = storiesInSprint.filter((i) => isDoneStatus(i.fields?.status?.name));
  const byRole = {};
  const dailyBurn = {}; // dateStr -> SP
  for (let i = 0; i < completedStories.length; i++) {
    const ref = completedStories[i];
    process.stdout.write(`   Fetching changelog ${i + 1}/${completedStories.length} ${ref.key}...\r`);
    try {
      const full = await client.get(`/rest/api/3/issue/${ref.key}`, {
        params: {
          fields: `key,summary,status,issuetype,assignee,${storyPointsFieldId}`,
          expand: 'changelog'
        }
      });
      const person = getPersonWhoMovedToInDev(full.data);
      const role = getRoleForAssignee(person);
      const sp = full.data.fields?.[storyPointsFieldId] != null
        ? Number(full.data.fields[storyPointsFieldId])
        : 2;
      byRole[role] = (byRole[role] || 0) + sp;
      const doneDate = getDateMovedToDone(full.data);
      if (doneDate) {
        dailyBurn[doneDate] = (dailyBurn[doneDate] || 0) + sp;
      }
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${ref.key}: ${err.message}`);
    }
  }
  console.log('');

  // 6. Mean and median daily SP burn
  const sprintStartStr = sprint.startDate?.slice(0, 10) || '';
  const sprintEndStr = sprint.endDate?.slice(0, 10) || '';
  const workingDays = countWorkingDays(sprintStartStr, sprintEndStr);
  const dailyBurnValues = Object.values(dailyBurn);
  const meanDailyBurn = workingDays > 0 ? spCompleted / workingDays : 0;
  const medianDailyBurn = median(dailyBurnValues);

  // 7. Bug report (Bugs + Sub-bugs in sprint)
  const bugsInSprint = allSprintIssues.filter(
    (i) => ['Bug', 'Sub-bug'].includes(i.fields?.issuetype?.name)
  );
  const bugsAtStart = bugsInSprint.filter((b) => {
    const created = (b.fields?.created || '').slice(0, 10);
    return created && created < sprintStartStr;
  });
  const bugsOpenedDuring = bugsInSprint.filter((b) => {
    const created = (b.fields?.created || '').slice(0, 10);
    return created && created >= sprintStartStr && created <= sprintEndStr;
  });
  const bugsLeftAtEnd = bugsInSprint.filter((b) => !isDoneStatus(b.fields?.status?.name));

  function countByPriority(issues) {
    const byPriority = {};
    for (const i of issues) {
      const p = i.fields?.priority?.name || 'Unprioritised';
      byPriority[p] = (byPriority[p] || 0) + 1;
    }
    return byPriority;
  }

  const bugsAtStartByPriority = countByPriority(bugsAtStart);
  const bugsOpenedDuringByPriority = countByPriority(bugsOpenedDuring);
  const bugsLeftAtEndByPriority = countByPriority(bugsLeftAtEnd);

  // 8. Project forecast (remaining SP from plan)
  const doneJql = [
    `project = ${PROJECT_KEY}`,
    'issuetype = Story',
    `status CHANGED TO ("Done","Closed","Resolved","Ready for Release","Ready for release","Completed","Complete") AFTER "${PLAN_START_DATE}"`
  ].join(' AND ');
  const [donePlanIssues, inProgressPlanIssues, toDoPlanIssues] = await Promise.all([
    fetchIssuesByJql(client, doneJql, [storyPointsFieldId]),
    fetchIssuesByJql(client, `project = ${PROJECT_KEY} AND issuetype = Story AND statusCategory = "In Progress"`, [storyPointsFieldId]),
    fetchIssuesByJql(client, `project = ${PROJECT_KEY} AND issuetype = Story AND statusCategory = "To Do"`, [storyPointsFieldId])
  ]);
  const sumSp = (issues) => issues.reduce((s, i) => s + (i.fields?.[storyPointsFieldId] || 0), 0);
  const donePlanSp = sumSp(donePlanIssues);
  const inProgressPlanSp = sumSp(inProgressPlanIssues);
  const toDoPlanSp = Math.max(0, TOTAL_PLAN_SP - donePlanSp - inProgressPlanSp);
  const remainingPlanSp = inProgressPlanSp + toDoPlanSp;

  const velocityPerSprint = spCompleted;
  const sprintsAtUplift = (upliftPct) => {
    const vel = velocityPerSprint * (1 + upliftPct / 100);
    return vel > 0 ? remainingPlanSp / vel : 0;
  };
  const forecastDate = (sprints) => {
    const d = new Date(sprintEndStr || new Date());
    d.setDate(d.getDate() + Math.ceil(sprints) * SPRINT_LENGTH_WEEKS * 7);
    return d.toISOString().split('T')[0];
  };
  const forecast10 = { uplift: 10, sprints: sprintsAtUplift(10), endDate: forecastDate(sprintsAtUplift(10)) };
  const forecast25 = { uplift: 25, sprints: sprintsAtUplift(25), endDate: forecastDate(sprintsAtUplift(25)) };
  const forecast50 = { uplift: 50, sprints: sprintsAtUplift(50), endDate: forecastDate(sprintsAtUplift(50)) };

  const TARGET_SPRINTS = 4;
  const requiredVelocity = remainingPlanSp / TARGET_SPRINTS;
  const upliftNeededFor4Sprints = velocityPerSprint > 0
    ? ((requiredVelocity - velocityPerSprint) / velocityPerSprint) * 100
    : 0;

  // Output
  console.log('='.repeat(60));
  console.log('📋 WHOLE EPICS COMPLETED');
  console.log('='.repeat(60));
  console.log(`   Epics where all child issues are Done: ${wholeEpicsCompleted}`);
  if (completedEpicKeys.length > 0) {
    console.log(`   Keys: ${completedEpicKeys.join(', ')}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 ISSUES COMPLETED BY CATEGORY');
  console.log('='.repeat(60));
  console.log(`   Stories:   ${completedByCategory.Story}`);
  console.log(`   Bugs:      ${completedByCategory.Bug}`);
  console.log(`   Sub-bugs:  ${completedByCategory['Sub-bug']}`);
  console.log(`   Total:     ${completedByCategory.Story + completedByCategory.Bug + (completedByCategory['Sub-bug'] || 0)}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 STORY POINT BURN (Story work only)');
  console.log('='.repeat(60));
  console.log(`   SP committed (Stories in sprint): ${spCommitted}`);
  console.log(`   SP completed (Stories Done):       ${spCompleted}`);
  console.log(`   SP in QA / Ready for QA:          ${spInQAOrReadyForQA}`);
  console.log(`   Burn rate:                        ${spCommitted > 0 ? ((spCompleted / spCommitted) * 100).toFixed(1) : 0}%`);
  console.log(`   Mean daily SP burn:               ${meanDailyBurn.toFixed(2)} (${workingDays} working days)`);
  console.log(`   Median daily SP burn:             ${medianDailyBurn.toFixed(2)}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 BUG REPORT (Bugs + Sub-bugs in sprint)');
  console.log('='.repeat(60));
  console.log(`   At start of sprint (created before): ${bugsAtStart.length}`);
  console.log(`   Opened during sprint:                ${bugsOpenedDuring.length}`);
  console.log(`   Left at end (not Done):              ${bugsLeftAtEnd.length}`);
  console.log('   By priority (left at end):');
  Object.entries(bugsLeftAtEndByPriority).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`      ${p}: ${c}`);
  });
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 PROJECT FORECAST (based on sprint velocity)');
  console.log('='.repeat(60));
  console.log(`   Remaining plan SP: ${remainingPlanSp}`);
  console.log(`   Current velocity:  ${velocityPerSprint} SP/sprint`);
  console.log(`   10% uplift:  ${forecast10.endDate} (~${forecast10.sprints.toFixed(1)} sprints)`);
  console.log(`   25% uplift:  ${forecast25.endDate} (~${forecast25.sprints.toFixed(1)} sprints)`);
  console.log(`   50% uplift:  ${forecast50.endDate} (~${forecast50.sprints.toFixed(1)} sprints)`);
  console.log(`   Uplift needed for 4 sprints: ${upliftNeededFor4Sprints.toFixed(1)}%`);
  console.log('');

  console.log('='.repeat(60));
  console.log('📋 STORY POINTS COMPLETED BY ROLE');
  console.log('='.repeat(60));
  const roleOrder = ['Team Leads', 'Principal Engineers', 'Snr Onshore', 'New Onshore', 'Engineers', 'Unassigned'];
  roleOrder.forEach((role) => {
    if (byRole[role]) {
      console.log(`   ${role}: ${byRole[role]}`);
    }
  });
  console.log('');

  // Save report
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];
  const slug = sprint.name.replace(/\s+/g, '-').toLowerCase();
  const report = {
    generatedAt: new Date().toISOString(),
    sprint: {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate
    },
    wholeEpicsCompleted,
    completedEpicKeys,
    issuesCompletedByCategory: completedByCategory,
    storyPointBurn: {
      committed: spCommitted,
      completed: spCompleted,
      inQAOrReadyForQA: spInQAOrReadyForQA,
      burnRatePercent: spCommitted > 0 ? (spCompleted / spCommitted) * 100 : 0,
      meanDailyBurn,
      medianDailyBurn,
      workingDays
    },
    bugReport: {
      atStart: bugsAtStart.length,
      atStartByPriority: bugsAtStartByPriority,
      openedDuring: bugsOpenedDuring.length,
      openedDuringByPriority: bugsOpenedDuringByPriority,
      leftAtEnd: bugsLeftAtEnd.length,
      leftAtEndByPriority: bugsLeftAtEndByPriority
    },
    projectForecast: {
      remainingPlanSp,
      remainingPlanSpSource: `In Progress + To Do Story SP (plan total ${TOTAL_PLAN_SP}, Done = status changed to Done after ${PLAN_START_DATE})`,
      velocityPerSprint,
      at10PercentUplift: forecast10,
      at25PercentUplift: forecast25,
      at50PercentUplift: forecast50,
      upliftNeededFor4Sprints: upliftNeededFor4Sprints
    },
    storyPointsCompletedByRole: byRole
  };

  const jsonPath = path.join(reportsDir, `sprint-summary-review-${slug}-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved: ${jsonPath}`);

  const pdfPath = path.join(reportsDir, `sprint-summary-review-${slug}-${dateStr}.pdf`);
  const pdfStream = renderPdf(report, pdfPath);
  await new Promise((resolve, reject) => {
    pdfStream.on('finish', () => { console.log(`✅ PDF saved: ${pdfPath}`); resolve(); });
    pdfStream.on('error', reject);
  });

  // Markdown
  const mdLines = [];
  mdLines.push(`# Sprint Summary Review: ${sprint.name}`);
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint dates:** ${sprint.startDate?.slice(0, 10) || '?'} → ${sprint.endDate?.slice(0, 10) || '?'}`);
  mdLines.push('');
  mdLines.push('## Whole Epics Completed');
  mdLines.push('');
  mdLines.push(`Epics where all child issues are in a Done status: **${wholeEpicsCompleted}**`);
  if (completedEpicKeys.length > 0) {
    mdLines.push(`- ${completedEpicKeys.join(', ')}`);
  }
  mdLines.push('');
  mdLines.push('## Issues Completed by Category');
  mdLines.push('');
  mdLines.push('| Category | Count |');
  mdLines.push('|----------|-------|');
  mdLines.push(`| Stories | ${completedByCategory.Story} |`);
  mdLines.push(`| Bugs | ${completedByCategory.Bug} |`);
  mdLines.push(`| Sub-bugs | ${completedByCategory['Sub-bug'] || 0} |`);
  mdLines.push(`| **Total** | **${completedByCategory.Story + completedByCategory.Bug + (completedByCategory['Sub-bug'] || 0)}** |`);
  mdLines.push('');
  mdLines.push('## Story Point Burn (Story work only)');
  mdLines.push('');
  mdLines.push('| Metric | Value |');
  mdLines.push('|--------|-------|');
  mdLines.push(`| SP committed (Stories in sprint) | ${spCommitted} |`);
  mdLines.push(`| SP completed (Stories Done) | ${spCompleted} |`);
  mdLines.push(`| SP in QA / Ready for QA | ${spInQAOrReadyForQA} |`);
  mdLines.push(`| Burn rate | ${spCommitted > 0 ? ((spCompleted / spCommitted) * 100).toFixed(1) : 0}% |`);
  mdLines.push(`| Mean daily SP burn | ${meanDailyBurn.toFixed(2)} (${workingDays} working days) |`);
  mdLines.push(`| Median daily SP burn | ${medianDailyBurn.toFixed(2)} |`);
  mdLines.push('');
  mdLines.push('## Bug Report (Bugs + Sub-bugs in sprint)');
  mdLines.push('');
  mdLines.push('| Metric | Count |');
  mdLines.push('|--------|-------|');
  mdLines.push(`| At start of sprint (created before) | ${bugsAtStart.length} |`);
  mdLines.push(`| Opened during sprint | ${bugsOpenedDuring.length} |`);
  mdLines.push(`| Left at end (not Done) | ${bugsLeftAtEnd.length} |`);
  mdLines.push('');
  mdLines.push('### By priority');
  mdLines.push('');
  const allPriorities = new Set([
    ...Object.keys(bugsAtStartByPriority),
    ...Object.keys(bugsOpenedDuringByPriority),
    ...Object.keys(bugsLeftAtEndByPriority)
  ]);
  mdLines.push('| Priority | At start | Opened during | Left at end |');
  mdLines.push('|----------|----------|----------------|--------------|');
  [...allPriorities].sort().forEach((p) => {
    const atStart = bugsAtStartByPriority[p] || 0;
    const opened = bugsOpenedDuringByPriority[p] || 0;
    const left = bugsLeftAtEndByPriority[p] || 0;
    mdLines.push(`| ${p} | ${atStart} | ${opened} | ${left} |`);
  });
  mdLines.push('');
  mdLines.push('## Project Forecast');
  mdLines.push('');
  mdLines.push(`Remaining plan SP: **${remainingPlanSp}** (In Progress + To Do Stories; plan total ${TOTAL_PLAN_SP} SP)`);
  mdLines.push(`Current velocity: **${velocityPerSprint}** SP/sprint`);
  mdLines.push('');
  mdLines.push('| Uplift | End date | Sprints |');
  mdLines.push('|--------|----------|---------|');
  mdLines.push(`| 10% | ${forecast10.endDate} | ~${forecast10.sprints.toFixed(1)} |`);
  mdLines.push(`| 25% | ${forecast25.endDate} | ~${forecast25.sprints.toFixed(1)} |`);
  mdLines.push(`| 50% | ${forecast50.endDate} | ~${forecast50.sprints.toFixed(1)} |`);
  mdLines.push('');
  mdLines.push(`**Uplift needed to finish in 4 sprints:** ${upliftNeededFor4Sprints.toFixed(1)}%`);
  mdLines.push('');
  mdLines.push('## Story Points Completed by Role');
  mdLines.push('');
  mdLines.push('| Role | Story Points |');
  mdLines.push('|------|-------------|');
  roleOrder.forEach((role) => {
    if (byRole[role]) mdLines.push(`| ${role} | ${byRole[role]} |`);
  });
  mdLines.push('');

  const mdPath = path.join(reportsDir, `sprint-summary-review-${slug}-${dateStr}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
