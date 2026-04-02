#!/usr/bin/env node

/**
 * Long Cycle Time Analysis – NH Sprint 37
 *
 * For stories that took > 5 days to complete (In Dev → Done), analyzes:
 * - Time spent in each status
 * - Back-and-forth to QA / In Review
 * - Blocked periods
 * - Comments that may explain delays
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const QA_REVIEW_STATUSES = [
  'In QA',
  'Ready for QA',
  'In Review',
  'Ready for Review',
  'In Code Review'
];
const IN_DEV_STATUSES = ['In Dev', 'In dev'];
const BLOCKED_STATUS = 'Blocked';

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

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hrs > 0) return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  if (min > 0) return `${min} min`;
  return `${sec} sec`;
}

function isQaOrReview(status) {
  return QA_REVIEW_STATUSES.some((s) => (status || '').toLowerCase().includes(s.toLowerCase()));
}

function isInDev(status) {
  return IN_DEV_STATUSES.some((s) => (status || '').toLowerCase() === s.toLowerCase());
}

/**
 * Build full status timeline with from/to.
 */
function buildStatusTimeline(issue) {
  const histories = issue.changelog?.histories || [];
  const events = [];

  for (const history of histories) {
    const items = history.items || [];
    for (const item of items) {
      if (item.field === 'status' && item.toString) {
        events.push({
          at: new Date(history.created),
          from: item.fromString || null,
          to: item.toString
        });
      }
    }
  }

  return events.sort((a, b) => a.at - b.at);
}

/**
 * Calculate time spent in each status from timeline (between firstInDevAt and completedAt).
 */
function computeTimeInStatus(timeline, firstInDevAt, completedAt) {
  const buckets = {};
  let prevStatus = 'In Dev'; // We start in In Dev by definition
  let prevAt = firstInDevAt;

  for (const e of timeline) {
    if (e.at < firstInDevAt) continue;
    if (e.at > completedAt) break;

    const key = prevStatus;
    buckets[key] = (buckets[key] || 0) + (e.at - prevAt);
    prevStatus = e.to;
    prevAt = e.at;
  }
  if (prevStatus && prevAt <= completedAt) {
    buckets[prevStatus] = (buckets[prevStatus] || 0) + (completedAt - prevAt);
  }

  return buckets;
}

/**
 * Count returns to In Dev from QA/Review (back-and-forth).
 * Transition: from QA/Review → to In Dev.
 */
function countReturnsToDev(timeline) {
  let count = 0;
  for (const e of timeline) {
    if (isInDev(e.to) && isQaOrReview(e.from)) {
      count++;
    }
  }
  return count;
}

/**
 * Check if ticket was ever Blocked.
 */
function wasBlocked(timeline) {
  return timeline.some((e) => (e.to || '').toLowerCase() === 'blocked');
}

/**
 * Get time spent in Blocked.
 */
function timeInBlocked(buckets) {
  const key = Object.keys(buckets || {}).find((k) => k.toLowerCase() === 'blocked');
  return key ? buckets[key] : 0;
}

/**
 * Fetch comments for an issue.
 */
async function fetchComments(client, issueKey) {
  try {
    const res = await client.get(`/rest/api/3/issue/${issueKey}/comment`);
    return res.data?.comments || [];
  } catch {
    return [];
  }
}

/**
 * Extract plain text from Atlassian Document Format (ADF).
 */
function extractAdfText(node) {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  const content = node.content || [];
  return content.map(extractAdfText).join('');
}

/**
 * Extract comment snippets that might explain delays (review feedback, QA, blocked, etc.).
 */
function getRelevantCommentSnippets(comments, maxLen = 120) {
  const keywords = ['fix', 'review', 'qa', 'blocked', 'issue', 'fail', 'error', 'change', 'update', 'comment', 'feedback', 'revert', 'defect', 'bug'];
  const relevant = [];

  for (const c of comments) {
    const body = extractAdfText(c.body || {})
      .replace(/\s+/g, ' ')
      .trim();
    if (!body) continue;

    const lower = body.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      const snippet = body.length > maxLen ? body.slice(0, maxLen) + '...' : body;
      relevant.push({
        author: c.author?.displayName || 'Unknown',
        created: c.created,
        snippet
      });
    }
  }
  return relevant;
}

async function main() {
  validateConfig();
  const client = createJiraClient();

  const reportsDir = path.join(__dirname, '..', 'reports');
  const dateStr = new Date().toISOString().split('T')[0];
  let cycleTimePath = path.join(reportsDir, `story-cycle-time-${dateStr}.json`);
  if (!fs.existsSync(cycleTimePath)) {
    const files = fs.readdirSync(reportsDir).filter((f) => f.startsWith('story-cycle-time-') && f.endsWith('.json'));
    if (files.length === 0) {
      console.error('Story cycle time report not found. Run "npm run story-cycle-time" first.');
      process.exit(1);
    }
    files.sort().reverse();
    cycleTimePath = path.join(reportsDir, files[0]);
    console.log(`Using: ${files[0]}`);
  }

  const cycleReport = JSON.parse(fs.readFileSync(cycleTimePath, 'utf8'));
  const longStories = (cycleReport.stories || []).filter(
    (s) => s.durationMs != null && s.durationMs > FIVE_DAYS_MS
  );

  console.log('\n📊 Long Cycle Time Analysis (> 5 days)');
  console.log('='.repeat(60));
  console.log(`Found ${longStories.length} stories that took > 5 days`);
  console.log('');

  const analyses = [];

  for (let i = 0; i < longStories.length; i++) {
    const s = longStories[i];
    process.stdout.write(`   ${i + 1}/${longStories.length} ${s.key}...\r`);

    try {
      const [issueRes, comments] = await Promise.all([
        client.get(`/rest/api/3/issue/${s.key}`, {
          params: { expand: 'changelog', fields: 'key,summary,status' }
        }),
        fetchComments(client, s.key)
      ]);

      const issue = issueRes.data;
      const timeline = buildStatusTimeline(issue);
      const firstInDevAt = new Date(s.firstInDevAt);
      const completedAt = new Date(s.completedAt);

      const timeInStatus = computeTimeInStatus(timeline, firstInDevAt, completedAt);
      const returnsToDev = countReturnsToDev(timeline);
      const blocked = wasBlocked(timeline);
      const blockedMs = timeInBlocked(timeInStatus);
      const relevantComments = getRelevantCommentSnippets(comments);

      // Sort statuses by time (longest first)
      const statusBreakdown = Object.entries(timeInStatus)
        .map(([status, ms]) => ({ status, ms }))
        .sort((a, b) => b.ms - a.ms);

      analyses.push({
        key: s.key,
        summary: s.summary,
        durationFormatted: s.durationFormatted,
        team: s.team,
        assignee: s.assignee,
        storyPoints: s.storyPoints,
        firstInDevAt: s.firstInDevAt,
        completedAt: s.completedAt,
        statusBreakdown: statusBreakdown.map(({ status, ms }) => ({
          status,
          ms,
          formatted: formatDuration(ms)
        })),
        returnsToDevFromQaReview: returnsToDev,
        wasBlocked: blocked,
        blockedDurationMs: blockedMs,
        blockedDurationFormatted: formatDuration(blockedMs),
        relevantComments,
        timelineEvents: timeline
          .filter((e) => e.at >= firstInDevAt && e.at <= completedAt)
          .map((e) => ({
            at: e.at.toISOString(),
            from: e.from,
            to: e.to
          }))
      });

      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.warn(`\n   ⚠️  ${s.key}: ${err.message}`);
    }
  }

  console.log('\n');

  // Report
  const mdLines = [];
  mdLines.push('# Long Cycle Time Analysis (> 5 days)');
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint:** NH Sprint 37`);
  mdLines.push(`**Stories analyzed:** ${analyses.length}`);
  mdLines.push('');
  mdLines.push('## Executive summary');
  mdLines.push('');
  const qaBottleneck = analyses.filter((a) => {
    const top = a.statusBreakdown[0];
    return top && /qa|review/i.test(top.status) && top.ms > 2 * 24 * 60 * 60 * 1000;
  });
  const blockedStories = analyses.filter((a) => a.wasBlocked);
  const returnedToDev = analyses.filter((a) => a.returnsToDevFromQaReview > 0);
  if (qaBottleneck.length > 0) {
    mdLines.push(`- **QA/Review bottleneck:** ${qaBottleneck.length} stories spent 2+ days waiting in Ready for QA, In QA, or Ready for Review`);
  }
  if (blockedStories.length > 0) {
    mdLines.push(`- **Blocked:** ${blockedStories.length} story/stories had Blocked status`);
  }
  if (returnedToDev.length > 0) {
    mdLines.push(`- **Back to Dev from QA/Review:** ${returnedToDev.length} story/stories returned to In Dev after QA/Review (rework)`);
  }
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');

  for (const a of analyses) {
    mdLines.push(`## ${a.key} – ${(a.summary || '').slice(0, 60)}`);
    mdLines.push('');
    mdLines.push(`- **Duration:** ${a.durationFormatted} | **Team:** ${a.team} | **Assignee:** ${a.assignee}`);
    mdLines.push(`- **First In Dev:** ${a.firstInDevAt?.split('T')[0]} | **Completed:** ${a.completedAt?.split('T')[0]}`);
    mdLines.push('');

    mdLines.push('### Time in each status');
    mdLines.push('');
    mdLines.push('| Status | Time |');
    mdLines.push('|--------|------|');
    for (const { status, formatted } of a.statusBreakdown) {
      mdLines.push(`| ${status} | ${formatted} |`);
    }
    mdLines.push('');

    const insights = [];
    if (a.returnsToDevFromQaReview > 0) {
      insights.push(`**Returned to In Dev from QA/Review:** ${a.returnsToDevFromQaReview} time(s) – possible rework or QA feedback loops`);
    }
    if (a.wasBlocked) {
      insights.push(`**Was Blocked:** Yes (${a.blockedDurationFormatted} total)`);
    }
    const longestStatus = a.statusBreakdown[0];
    if (longestStatus) {
      insights.push(`**Longest in:** ${longestStatus.status} (${longestStatus.formatted})`);
    }

    if (insights.length > 0) {
      mdLines.push('### Insights');
      mdLines.push('');
      insights.forEach((i) => mdLines.push(`- ${i}`));
      mdLines.push('');
    }

    if (a.relevantComments.length > 0) {
      mdLines.push('### Relevant comments');
      mdLines.push('');
      for (const c of a.relevantComments.slice(0, 5)) {
        mdLines.push(`- **${c.author}** (${c.created?.split('T')[0]}): "${c.snippet}"`);
      }
      mdLines.push('');
    }

    mdLines.push('---');
    mdLines.push('');
  }

  const jsonPath = path.join(reportsDir, `long-cycle-time-analysis-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `long-cycle-time-analysis-${dateStr}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), analyses }, null, 2));
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('='.repeat(70));
  console.log('📋 SUMMARY');
  console.log('='.repeat(70));
  for (const a of analyses) {
    const parts = [];
    if (a.returnsToDevFromQaReview > 0) parts.push(`${a.returnsToDevFromQaReview}x QA/Review→Dev`);
    if (a.wasBlocked) parts.push(`Blocked ${a.blockedDurationFormatted}`);
    const top = a.statusBreakdown[0];
    if (top) parts.push(`Longest: ${top.status} (${top.formatted})`);
    console.log(`   ${a.key} (${a.durationFormatted}): ${parts.join(' | ')}`);
  }
  console.log('');
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main().catch((err) => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
