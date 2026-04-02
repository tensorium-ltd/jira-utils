#!/usr/bin/env node

/**
 * Validates New Onshore attribution: checks that tickets attributed to New Onshore
 * were not reassigned TO them after an initial In Dev assignment by someone else.
 *
 * For each ticket attributed to New Onshore (person who moved to In Dev):
 * - Who was the assignee at the moment of first In Dev transition?
 * - Was there an assignee change AFTER In Dev that reassigned TO the credited person?
 *
 * Flags tickets where: assignee at In Dev != credited person (mover), or
 * ticket was reassigned to credited person after In Dev.
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

const IN_DEV_STATUSES = ['In Dev', 'In dev'];

function getDisplayName(user) {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user.displayName || user.name || null;
}

function namesMatch(a, b) {
  if (!a || !b) return false;
  const na = String(a).toLowerCase().trim();
  const nb = String(b).toLowerCase().trim();
  return na === nb || na.includes(nb) || nb.includes(na);
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

/**
 * Parse changelog to get:
 * - inDevEntry: { author, assigneeAtThatMoment, timestamp }
 * - reassignedToCreditedAfter: boolean (was there an assignee change after In Dev that assigned to the credited person?)
 */
function parseChangelogForInDev(issue, creditedPerson) {
  const histories = issue.changelog?.histories || [];
  const sorted = [...histories].sort((a, b) => new Date(a.created) - new Date(b.created));

  let currentAssignee = getDisplayName(issue.fields?.assignee);
  // Work backwards from first assignee change if needed - actually we need forward simulation
  // At creation, assignee might be null. We need to replay the changelog.
  currentAssignee = null;

  let inDevEntry = null;
  let reassignedToCreditedAfter = false;

  for (const history of sorted) {
    const author = getDisplayName(history.author);

    // Process status first (to capture assignee state at In Dev), then assignee
    for (const item of history.items || []) {
      if (item.field === 'status') {
        const toStatus = (item.toString || item.to || '').toLowerCase();
        if (IN_DEV_STATUSES.some((s) => toStatus === s.toLowerCase())) {
          if (!inDevEntry) {
            inDevEntry = {
              author,
              assigneeAtInDev: currentAssignee,
              timestamp: history.created
            };
          }
        }
      }
    }
    for (const item of history.items || []) {
      if (item.field === 'assignee') {
        const newAssignee = item.toString || item.to || null;
        if (newAssignee) currentAssignee = newAssignee;

        if (inDevEntry && namesMatch(newAssignee, creditedPerson)) {
          reassignedToCreditedAfter = true;
        }
      }
    }
  }

  return { inDevEntry, reassignedToCreditedAfter };
}

async function main() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN must be set');
    process.exit(1);
  }

  const reportPath = path.join(__dirname, '..', 'reports', 'role-completion-tracker-2026-03-10.json');
  if (!fs.existsSync(reportPath)) {
    console.error('Run role-completion-tracker first for Sprints 36, 37, 38');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const newOnshoreStories = (report.cumulative?.stories || []).filter(
    (s) => s.role === 'New Onshore'
  );

  if (newOnshoreStories.length === 0) {
    console.log('No New Onshore stories in report.');
    return;
  }

  const client = createJiraClient();

  console.log('\n📋 New Onshore Attribution Validation');
  console.log('='.repeat(70));
  console.log('Checking: assignee at In Dev vs person who moved ticket');
  console.log('Flagging: tickets reassigned TO credited person after In Dev');
  console.log('');

  const results = [];
  for (let i = 0; i < newOnshoreStories.length; i++) {
    const s = newOnshoreStories[i];
    process.stdout.write(`   ${i + 1}/${newOnshoreStories.length} ${s.key}...\r`);
    try {
      const { data } = await client.get(`/rest/api/3/issue/${s.key}`, {
        params: { fields: 'assignee', expand: 'changelog' }
      });
      const { inDevEntry, reassignedToCreditedAfter } = parseChangelogForInDev(
        data,
        s.movedToInDevBy
      );

      const assigneeMatchesMover = inDevEntry?.assigneeAtInDev != null
        ? namesMatch(inDevEntry.assigneeAtInDev, s.movedToInDevBy)
        : null;
      const assigneeMismatch = inDevEntry?.assigneeAtInDev != null && assigneeMatchesMover === false;
      const flag = assigneeMismatch || reassignedToCreditedAfter;

      results.push({
        key: s.key,
        summary: (s.summary || '').slice(0, 50),
        credited: s.movedToInDevBy,
        sp: s.storyPoints,
        assigneeAtInDev: inDevEntry?.assigneeAtInDev ?? '?',
        assigneeMismatch,
        reassignedToCreditedAfter,
        flag
      });
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      results.push({
        key: s.key,
        error: err.message,
        flag: true
      });
    }
  }

  console.log('\n');

  const flagged = results.filter((r) => r.flag);
  const clean = results.filter((r) => !r.flag && !r.error);

  console.log('✅ CLEAN – Assignee at In Dev matches mover (or N/A):');
  console.log('-'.repeat(70));
  if (clean.length === 0) {
    console.log('   (none)');
  } else {
    clean.forEach((r) => {
      const assignee = r.assigneeAtInDev || 'Unassigned';
      console.log(`   ${r.key} | ${r.credited} | Assignee at In Dev: ${assignee} | ${r.sp} SP`);
    });
  }

  console.log('');
  console.log('⚠️  FLAGGED – Needs review:');
  console.log('-'.repeat(70));
  if (flagged.length === 0) {
    console.log('   (none)');
  } else {
    flagged.forEach((r) => {
      if (r.error) {
        console.log(`   ${r.key} | Error: ${r.error}`);
      } else {
        const reasons = [];
        if (r.assigneeMismatch)
          reasons.push(`Assignee at In Dev was "${r.assigneeAtInDev}" (not ${r.credited})`);
        if (r.reassignedToCreditedAfter)
          reasons.push('Reassigned to credited person AFTER In Dev');
        console.log(`   ${r.key} | ${r.credited} | ${r.sp} SP`);
        console.log(`      → ${reasons.join('; ')}`);
      }
    });
  }

  console.log('');
  console.log('Summary:');
  console.log(`   Total New Onshore tickets: ${results.length}`);
  console.log(`   Clean (attribution verified): ${clean.length}`);
  console.log(`   Flagged (needs review): ${flagged.length}`);
  console.log('');
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
