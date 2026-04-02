#!/usr/bin/env node

/**
 * Role Completion Tracker
 *
 * Tracks story points completed by each role. Attribution: who moved the ticket into
 * "In Dev" status (changelog author). Only counts Stories that are now Closed or
 * Ready for Release.
 *
 * Usage:
 *   npm run role-completion-tracker                    # NH Sprint 37 + 38 (default)
 *   npm run role-completion-tracker -- 2026-02-18 16:00  # Snapshot at 4pm UK
 *   npm run role-completion-tracker -- --snapshot 2026-02-20 16:00
 *   npm run role-completion-tracker -- "NH Sprint 37"   # Single sprint
 *   npm run role-completion-tracker -- "NH Sprint 37" "NH Sprint 38"  # Multiple sprints
 *
 * Roles:
 *   - Team Leads: Sanjeet, Amit Sable, Manish, Vivek, Laurence
 *   - Principal Engineers: Yoong, David Beere
 *   - Snr Onshore: Brandon, Donn
 *   - New Onshore: Huzefa, Gururaj, Jack, Allan
 *   - Engineers: Amit Kumbharkar, Swapnil, Yash, Mahendra, Vibhuti, Saurabh,
 *     Kavipiya, Ajay, Darshit, Srihari, Kapish, Pravin, Ajit, Anthony
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const BOARD_ID = 149;
const DEFAULT_SPRINTS = ['NH Sprint 38', 'NH Sprint 39'];

// Role mapping: ordered by specificity (longer names first to avoid "Amit" matching "Amit Kumbharkar" as Team Lead)
const ROLE_MAPPING = [
  { role: 'Team Leads', names: ['Sanjeet', 'Amit Sable', 'Manish', 'Vivek', 'Laurence'] },
  { role: 'Principal Engineers', names: ['Yoong', 'David Beere'] },
  { role: 'Snr Onshore', names: ['Brandon', 'Donn'] },
  { role: 'New Onshore', names: ['Huzefa', 'Gururaj', 'Jack', 'Allan'] },
  { role: 'Engineers', names: ['Amit Kumbharkar', 'Swapnil', 'Yash', 'Mahendra', 'Vibhuti', 'Saurabh', 'Kavipiya', 'Kavipriya', 'Ajay', 'Darshit', 'Srihari', 'Kapish', 'Pravin', 'Ajit', 'Anthony'] }
];

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

/**
 * Parse sprint names from CLI args. Sprint names are non-flag args that don't match
 * date or --snapshot patterns. Returns array of sprint names.
 */
function parseSprintArgs() {
  const args = process.argv.slice(2);
  const sprints = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--snapshot') {
      i++; // skip snapshot value
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(args[i])) {
      continue; // skip date
    }
    if (args[i] && /^\d{1,2}:\d{2}$/.test(args[i])) {
      continue; // skip time
    }
    if (args[i] && !args[i].startsWith('-') && args[i].includes('Sprint')) {
      sprints.push(args[i]);
    }
  }
  return sprints.length > 0 ? sprints : DEFAULT_SPRINTS;
}

/**
 * Parse snapshot date/time from CLI args.
 * Usage: node script.js [YYYY-MM-DD] [HH:mm]
 *   or:  node script.js --snapshot 2026-02-18 [16:00]
 * Default time: 16:00 UK if not specified.
 * Returns { dateStr, timeStr, snapshotLabel } or null for current/live.
 */
function parseSnapshotArgs() {
  const args = process.argv.slice(2);
  let dateStr = null;
  let timeStr = '16:00';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--snapshot' && args[i + 1]) {
      const val = args[++i];
      const parts = val.split(/[\sT]/);
      dateStr = parts[0];
      if (parts[1]) timeStr = parts[1].slice(0, 5);
      break;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(args[i])) {
      dateStr = args[i];
      if (args[i + 1] && /^\d{1,2}:\d{2}$/.test(args[i + 1])) {
        const [h, m] = args[i + 1].split(':').map(Number);
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      break;
    }
  }
  if (!dateStr) return null;
  return {
    dateStr,
    timeStr: timeStr.length === 5 ? timeStr : '16:00',
    snapshotLabel: `${dateStr} ${timeStr} UK`
  };
}

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

async function discoverStoryPointsFieldId(client) {
  try {
    const { data: fields } = await client.get('/rest/api/3/field');
    const storyPointsField = fields.find(
      (f) => f.name && f.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
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

/**
 * Get display name from a Jira user object (author, assignee, etc).
 */
function getDisplayName(user) {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user.displayName || user.name || null;
}

/**
 * Determine who moved the ticket into "In Dev" status.
 * Uses the author of the changelog entry when status first changed to In Dev
 * (the person who performed the transition), not the assignee.
 */
function getPersonWhoMovedToInDev(issue) {
  if (!issue.changelog?.histories?.length) {
    const a = issue.fields?.assignee;
    return getDisplayName(a) || 'Unassigned';
  }

  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );

  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').toLowerCase();
        if (IN_DEV_STATUSES.some((s) => toStatus === s.toLowerCase())) {
          const author = getDisplayName(history.author);
          return author || 'Unassigned';
        }
      }
    }
  }

  return getDisplayName(issue.fields?.assignee) || 'Unassigned';
}

// JIRA Sprint Report "Completed" = statuses in board's Done column (typically these two)
const JIRA_DONE_STATUSES = ['ready for release', 'closed'];

/**
 * Get date (YYYY-MM-DD) when issue was first moved to a JIRA Sprint Report Done status (from changelog).
 * Uses READY FOR RELEASE / CLOSED to align with JIRA Sprint Report "Completed work items".
 */
function getDateMovedToDone(issue) {
  if (!issue.changelog?.histories?.length) return null;
  const histories = [...issue.changelog.histories].sort(
    (a, b) => new Date(a.created) - new Date(b.created)
  );
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').trim().toLowerCase();
        if (JIRA_DONE_STATUSES.some((s) => toStatus === s)) {
          return history.created.split('T')[0];
        }
      }
    }
  }
  return null;
}

/**
 * Map assignee display name to role. Uses ordered matching (most specific first).
 * Only matches when display name contains the role name (e.g. "Amit Sable" in
 * displayName matches Team Lead, avoiding "Amit" matching wrong person).
 */
function getRoleForAssignee(displayName) {
  if (!displayName || displayName === 'Unassigned') return 'Unassigned';
  const name = String(displayName).trim().toLowerCase();

  // Check most specific names first (Snr Onshore, New Onshore before Engineers)
  const orderedNames = [
    'Amit Sable', 'Amit Kumbharkar', 'David Beere',
    'Sanjeet', 'Manish', 'Vivek', 'Laurence',
    'Yoong', 'Brandon', 'Donn', 'Huzefa', 'Gururaj', 'Jack', 'Allan',
    'Swapnil', 'Yash', 'Mahendra', 'Vibhuti',
    'Saurabh', 'Kavipiya', 'Kavipriya', 'Ajay', 'Darshit', 'Srihari', 'Kapish', 'Pravin', 'Ajit', 'Anthony'
  ];
  for (const roleName of orderedNames) {
    if (name.includes(roleName.toLowerCase())) {
      return getRoleForName(roleName);
    }
  }
  return 'Unassigned';
}

function getRoleForName(name) {
  for (const { role, names } of ROLE_MAPPING) {
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return role;
  }
  return 'Unassigned';
}

function getStoryPoints(issue, storyPointsFieldId) {
  const val = issue.fields?.[storyPointsFieldId];
  if (val != null && val !== '') return Number(val);
  return 2; // default for Stories without points
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

/**
 * Aggregate byRole/byPerson from a set of issue keys using precomputed issueMap.
 */
function aggregateFromKeys(issueKeys, issueMap) {
  const byRole = {};
  const byPerson = {};
  for (const key of issueKeys) {
    const data = issueMap[key];
    if (!data) continue;
    const { person, role, sp } = data;

    if (!byRole[role]) byRole[role] = { storyPoints: 0, storyCount: 0 };
    byRole[role].storyPoints += sp;
    byRole[role].storyCount += 1;

    if (!byPerson[person]) byPerson[person] = { storyPoints: 0, storyCount: 0, role };
    byPerson[person].storyPoints += sp;
    byPerson[person].storyCount += 1;
  }
  return { byRole, byPerson };
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const snapshot = parseSnapshotArgs();
  const sprintNames = parseSprintArgs();

  const sprints = [];
  for (const name of sprintNames) {
    const sprint = await getSprintByName(client, BOARD_ID, name);
    if (!sprint) {
      console.error(`Error: Sprint "${name}" not found on board ${BOARD_ID}`);
      process.exit(1);
    }
    sprints.push(sprint);
  }

  const sprintIds = sprints.map((s) => s.id);
  const sprintLabel = sprintNames.join(' + ');
  const sprintClause = sprintIds.length === 1
    ? `sprint = ${sprintIds[0]}`
    : `sprint in (${sprintIds.join(', ')})`;

  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const statusList = COMPLETED_STATUSES.map((s) => `"${s}"`).join(', ');

  const buildJql = (clause) => {
    if (snapshot) {
      const snapshotDateTime = `${snapshot.dateStr} ${snapshot.timeStr}`;
      return [
        `project = ${PROJECT_KEY}`,
        clause,
        'issuetype = Story',
        `status WAS IN (${statusList}) ON "${snapshotDateTime}"`
      ].join(' AND ');
    }
    return [
      `project = ${PROJECT_KEY}`,
      clause,
      'issuetype = Story',
      `status IN (${statusList})`
    ].join(' AND ');
  };

  const reportSuffix = snapshot
    ? `${snapshot.dateStr}-${snapshot.timeStr.replace(':', '')}`
    : new Date().toISOString().split('T')[0];

  const hasTwoScopes = sprintIds.length >= 2 && !snapshot;
  const currentSprintName = hasTwoScopes ? sprintNames[sprintNames.length - 1] : null;
  const currentSprintId = hasTwoScopes ? sprintIds[sprintIds.length - 1] : null;

  console.log('\n📊 Role Completion Tracker');
  console.log('='.repeat(60));
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Sprints: ${sprintLabel}`);
  if (snapshot) {
    console.log(`Snapshot: ${snapshot.snapshotLabel}`);
  } else {
    console.log('Scope: completed Stories in sprints (live)');
    if (hasTwoScopes) {
      console.log(`Scopes: Cumulative (${sprintLabel}) + Current Sprint only (${currentSprintName}, completed during sprint)`);
    }
  }
  console.log('Attribution: person who moved ticket into "In Dev"');
  console.log('');

  console.log('🔎 Fetching completed Stories (cumulative)...');
  const cumulativeJql = buildJql(sprintClause);
  let cumulativeIssues = await fetchIssuesByJql(client, cumulativeJql, ['key', 'summary', 'status', 'issuetype', 'assignee', storyPointsFieldId]);
  console.log(`   Found ${cumulativeIssues.length} completed Stories (cumulative)`);

  let currentSprintIssues = [];
  if (hasTwoScopes) {
    console.log(`🔎 Fetching completed Stories (current sprint: ${currentSprintName})...`);
    const currentJql = buildJql(`sprint = ${currentSprintId}`);
    currentSprintIssues = await fetchIssuesByJql(client, currentJql, ['key']);
    console.log(`   Found ${currentSprintIssues.length} completed Stories (current sprint only)`);
  }
  console.log('');

  const allIssueKeys = [...new Set([
    ...cumulativeIssues.map((i) => i.key || i.id),
    ...currentSprintIssues.map((i) => i.key || i.id)
  ])];

  if (allIssueKeys.length === 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      project: PROJECT_KEY,
      sprints: sprintNames,
      sprintLabel,
      snapshot: snapshot?.snapshotLabel || null,
      cumulative: { byRole: {}, byPerson: {}, stories: [], totalStoryPoints: 0, totalStories: 0 },
      currentSprintOnly: hasTwoScopes ? { byRole: {}, byPerson: {}, stories: [], totalStoryPoints: 0, totalStories: 0, sprintName: currentSprintName } : null
    };
    const reportsDir = ensureReportsDir();
    fs.writeFileSync(path.join(reportsDir, `role-completion-tracker-${reportSuffix}.json`), JSON.stringify(report, null, 2));
    console.log('   No completed Stories in these sprints.');
    return;
  }

  const cumulativeKeys = new Set(cumulativeIssues.map((i) => i.key || i.id));
  const currentSprintKeys = new Set(currentSprintIssues.map((i) => i.key || i.id));

  console.log('🔎 Fetching changelog for each issue...');
  const issueMap = {};
  const cumulativeStories = [];

  for (let i = 0; i < allIssueKeys.length; i++) {
    const key = allIssueKeys[i];
    process.stdout.write(`   ${i + 1}/${allIssueKeys.length} ${key}...\r`);

    try {
      const full = await client.get(`/rest/api/3/issue/${key}`, {
        params: {
          fields: `key,summary,status,issuetype,assignee,${storyPointsFieldId}`,
          expand: 'changelog'
        }
      });
      const issue = full.data;
      const person = getPersonWhoMovedToInDev(issue);
      const role = getRoleForAssignee(person);
      const sp = getStoryPoints(issue, storyPointsFieldId);
      const doneDate = getDateMovedToDone(issue);

      issueMap[key] = { person, role, sp, summary: (issue.fields?.summary || '').slice(0, 80), doneDate };

      if (cumulativeKeys.has(key)) {
        cumulativeStories.push({ key, summary: issueMap[key].summary, storyPoints: sp, movedToInDevBy: person, role });
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      console.warn(`\n   ⚠️  ${key}: ${err.message}`);
    }
  }

  const roleOrder = ['Team Leads', 'Principal Engineers', 'Snr Onshore', 'New Onshore', 'Engineers', 'Unassigned'];

  const cumulative = aggregateFromKeys([...cumulativeKeys], issueMap);
  cumulative.stories = cumulativeStories;
  const totalCumulativeSp = Object.values(cumulative.byRole).reduce((s, r) => s + r.storyPoints, 0);
  const totalCumulativeStories = Object.values(cumulative.byRole).reduce((s, r) => s + r.storyCount, 0);

  let currentSprintOnly = null;
  if (hasTwoScopes) {
    // JIRA Sprint Report shows "completed during sprint" - filter by date moved to Done
    const currentSprint = sprints[sprints.length - 1];
    const sprintStart = currentSprint.startDate ? currentSprint.startDate.split('T')[0] : null;
    const sprintEnd = currentSprint.endDate ? currentSprint.endDate.split('T')[0] : null;

    const completedDuringSprintKeys = [...currentSprintKeys].filter((k) => {
      const data = issueMap[k];
      if (!data || !data.doneDate) return false;
      if (!sprintStart || !sprintEnd) return true; // no dates = include all
      return data.doneDate >= sprintStart && data.doneDate <= sprintEnd;
    });

    currentSprintOnly = aggregateFromKeys(completedDuringSprintKeys, issueMap);
    currentSprintOnly.stories = completedDuringSprintKeys
      .filter((k) => issueMap[k])
      .map((k) => ({
        key: k,
        summary: issueMap[k].summary,
        storyPoints: issueMap[k].sp,
        movedToInDevBy: issueMap[k].person,
        role: issueMap[k].role
      }));
    currentSprintOnly.totalStoryPoints = Object.values(currentSprintOnly.byRole).reduce((s, r) => s + r.storyPoints, 0);
    currentSprintOnly.totalStories = Object.values(currentSprintOnly.byRole).reduce((s, r) => s + r.storyCount, 0);
    currentSprintOnly.sprintName = currentSprintName;
  }

  console.log('\n');

  // Console output – cumulative
  console.log('='.repeat(60));
  console.log(`📋 CUMULATIVE (${sprintLabel}) – Story Points by Role`);
  console.log('='.repeat(60));
  const cumulativeRoleTable = roleOrder
    .filter((r) => cumulative.byRole[r])
    .map((role) => ({
      Role: role,
      'Story Points': cumulative.byRole[role].storyPoints,
      Stories: cumulative.byRole[role].storyCount
    }));
  console.table(cumulativeRoleTable);
  console.log(`   Total: ${totalCumulativeStories} stories, ${totalCumulativeSp} story points`);
  console.log('');

  const cumulativePersonTable = Object.entries(cumulative.byPerson)
    .map(([name, data]) => ({
      Person: name,
      Role: data.role,
      'Story Points': data.storyPoints,
      Stories: data.storyCount
    }))
    .sort((a, b) => b['Story Points'] - a['Story Points']);

  if (hasTwoScopes && currentSprintOnly) {
    console.log('='.repeat(60));
    console.log(`📋 CURRENT SPRINT ONLY (${currentSprintName}) – Story Points by Role`);
    console.log('='.repeat(60));
    const currentRoleTable = roleOrder
      .filter((r) => currentSprintOnly.byRole[r])
      .map((role) => ({
        Role: role,
        'Story Points': currentSprintOnly.byRole[role].storyPoints,
        Stories: currentSprintOnly.byRole[role].storyCount
      }));
    console.table(currentRoleTable);
    console.log(`   Total: ${currentSprintOnly.totalStories} stories, ${currentSprintOnly.totalStoryPoints} story points`);
    console.log('');
  }

  // Save report
  const now = new Date();
  const reportsDir = ensureReportsDir();

  const report = {
    generatedAt: now.toISOString(),
    project: PROJECT_KEY,
    sprints: sprintNames,
    sprintLabel,
    snapshot: snapshot?.snapshotLabel || null,
    attribution: 'Person who moved ticket into In Dev',
    cumulative: {
      totalStoryPoints: totalCumulativeSp,
      totalStories: totalCumulativeStories,
      byRole: cumulative.byRole,
      byPerson: cumulative.byPerson,
      stories: cumulative.stories
    },
    currentSprintOnly: hasTwoScopes && currentSprintOnly
      ? {
          sprintName: currentSprintName,
          totalStoryPoints: currentSprintOnly.totalStoryPoints,
          totalStories: currentSprintOnly.totalStories,
          byRole: currentSprintOnly.byRole,
          byPerson: currentSprintOnly.byPerson,
          stories: currentSprintOnly.stories
        }
      : null
  };

  const jsonPath = path.join(reportsDir, `role-completion-tracker-${reportSuffix}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report saved: ${jsonPath}`);

  // Markdown
  const mdLines = [];
  mdLines.push('# Role Completion Tracker');
  mdLines.push('');
  mdLines.push(`**Project:** ${PROJECT_KEY}`);
  mdLines.push(`**Sprints:** ${sprintLabel}`);
  if (snapshot) mdLines.push(`**Snapshot:** ${snapshot.snapshotLabel}`);
  mdLines.push(`**Attribution:** Person who moved ticket into "In Dev"`);
  mdLines.push(`**Generated:** ${now.toISOString().split('T')[0]}`);
  mdLines.push('');

  mdLines.push('## Cumulative (from start of NH Sprint 37 to present)');
  mdLines.push('');
  mdLines.push(`Total: ${totalCumulativeStories} stories, ${totalCumulativeSp} story points`);
  mdLines.push('');
  mdLines.push('### By Role');
  mdLines.push('');
  mdLines.push('| Role | Story Points | Stories |');
  mdLines.push('|------|-------------|---------|');
  roleOrder.forEach((role) => {
    if (cumulative.byRole[role]) {
      mdLines.push(`| ${role} | ${cumulative.byRole[role].storyPoints} | ${cumulative.byRole[role].storyCount} |`);
    }
  });
  mdLines.push('');
  mdLines.push('### By Person');
  mdLines.push('');
  mdLines.push('| Person | Role | Story Points | Stories |');
  mdLines.push('|--------|------|-------------|---------|');
  cumulativePersonTable.forEach((row) => {
    mdLines.push(`| ${row.Person} | ${row.Role} | ${row['Story Points']} | ${row.Stories} |`);
  });

  if (hasTwoScopes && currentSprintOnly) {
    mdLines.push('');
    mdLines.push(`## Current Sprint Only (${currentSprintName}) – completed during sprint`);
    mdLines.push('');
    mdLines.push(`Total: ${currentSprintOnly.totalStories} stories, ${currentSprintOnly.totalStoryPoints} story points`);
    mdLines.push('');
    mdLines.push('### By Role');
    mdLines.push('');
    mdLines.push('| Role | Story Points | Stories |');
    mdLines.push('|------|-------------|---------|');
    roleOrder.forEach((role) => {
      if (currentSprintOnly.byRole[role]) {
        mdLines.push(`| ${role} | ${currentSprintOnly.byRole[role].storyPoints} | ${currentSprintOnly.byRole[role].storyCount} |`);
      }
    });
    mdLines.push('');
    mdLines.push('### By Person');
    mdLines.push('');
    mdLines.push('| Person | Role | Story Points | Stories |');
    mdLines.push('|--------|------|-------------|---------|');
    Object.entries(currentSprintOnly.byPerson)
      .map(([name, data]) => ({ Person: name, Role: data.role, 'Story Points': data.storyPoints, Stories: data.storyCount }))
      .sort((a, b) => b['Story Points'] - a['Story Points'])
      .forEach((row) => {
        mdLines.push(`| ${row.Person} | ${row.Role} | ${row['Story Points']} | ${row.Stories} |`);
      });
  }

  mdLines.push('');
  mdLines.push('## Stories (Cumulative)');
  mdLines.push('');
  mdLines.push('| Key | SP | Moved to In Dev by | Role | Summary |');
  mdLines.push('|-----|----|----------------------|------|---------|');
  cumulative.stories.forEach((s) => {
    const sum = (s.summary || '').replace(/\|/g, ' ').slice(0, 40);
    mdLines.push(`| ${s.key} | ${s.storyPoints} | ${s.movedToInDevBy} | ${s.role} | ${sum} |`);
  });

  const mdPath = path.join(reportsDir, `role-completion-tracker-${reportSuffix}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
