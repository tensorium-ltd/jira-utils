#!/usr/bin/env node

/**
 * Defects Report - Bugs and Sub-bugs created today
 * Output: JSON, Markdown, PDF with breakdown by priority and closed status
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
const REPORT_TIMEZONE = 'Europe/London';
const CLOSED_STATUSES = ['Ready for Release', 'Ready for release', 'Complete', 'Completed', 'Done', 'Closed', 'Resolved'];

function validateConfig() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error('Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
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
    const body = { jql, maxResults: 100, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;
    if (nextPageToken) await new Promise(r => setTimeout(r, 200));
  } while (nextPageToken);
  return results;
}

function formatInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function fetchDefectsCreatedToday(client, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDayStr = nextDay.toISOString().slice(0, 10);
  const jql = [
    `project = ${PROJECT_KEY}`,
    'issuetype in (Bug, "Sub-bug")',
    `created >= "${dateStr}"`,
    `created < "${nextDayStr}"`
  ].join(' AND ');
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

function buildReport(defects, dateStr) {
  const typeLower = t => (t || '').toLowerCase();
  const bugs = defects.filter(d => typeLower(d.issuetype) === 'bug');
  const subBugs = defects.filter(d => typeLower(d.issuetype).includes('sub-bug') || typeLower(d.issuetype) === 'sub-bug');
  const closed = defects.filter(d => d.isClosed);

  const byPriority = {};
  defects.forEach(d => {
    const p = d.priority || 'None';
    if (!byPriority[p]) byPriority[p] = [];
    byPriority[p].push(d);
  });

  const priorityOrder = ['P1 - Critical', 'P1 - Critical ', 'P2 - High', 'P3 - Medium', 'P4 - Low', 'None'];
  const sortedPriorities = Object.keys(byPriority).sort((a, b) => {
    const ia = priorityOrder.indexOf(a);
    const ib = priorityOrder.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });

  return {
    date: dateStr,
    generatedAt: new Date().toISOString(),
    total: defects.length,
    breakdown: {
      bugs: bugs.length,
      subBugs: subBugs.length
    },
    closedCount: closed.length,
    closed,
    byPriority: sortedPriorities.reduce((acc, p) => {
      acc[p] = byPriority[p];
      return acc;
    }, {}),
    defects
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Defects Report – Created Today');
  lines.push('');
  lines.push(`**Date:** ${report.date}`);
  lines.push(`**Total:** ${report.total} created today`);
  lines.push('');
  lines.push('## Breakdown');
  lines.push('');
  const bugKeys = report.defects.filter(d => d.issuetype === 'Bug').map(d => d.key).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  const subBugKeys = report.defects.filter(d => d.issuetype === 'Sub-bug').map(d => d.key);
  lines.push(`- **${report.breakdown.bugs} Bugs**${bugKeys.length ? ` (${bugKeys.join(', ')})` : ''}`);
  const subLabel = report.breakdown.subBugs === 1 ? 'Sub-bug' : 'Sub-bugs';
  lines.push(`- **${report.breakdown.subBugs} ${subLabel}**${subBugKeys.length ? ` (${subBugKeys.join(', ')})` : ''}`);
  lines.push('');
  lines.push('## By Priority');
  lines.push('');
  Object.entries(report.byPriority).forEach(([priority, items]) => {
    const keys = items.map(i => i.key).join(', ');
    lines.push(`- **${priority}:** ${items.length} (${keys})`);
  });
  lines.push('');
  lines.push(`## Closed: ${report.closedCount} of ${report.total}`);
  lines.push('');
  if (report.closed.length > 0) {
    report.closed.forEach(d => {
      lines.push(`- ${d.key} – ${d.priority} – ${d.status}`);
    });
  } else {
    lines.push('None closed yet.');
  }
  lines.push('');
  lines.push('## Full List');
  lines.push('');
  lines.push('| Key | Type | Priority | Status | Summary |');
  lines.push('|-----|------|----------|--------|---------|');
  report.defects.forEach(d => {
    const summary = (d.summary || '').replace(/\|/g, ' ').slice(0, 50);
    lines.push(`| ${d.key} | ${d.issuetype} | ${d.priority} | ${d.status} | ${summary} |`);
  });
  return lines.join('\n');
}

function renderPdf(report, filepath) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  doc.fontSize(18).text('Defects Report – Created Today', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Date: ${report.date}`);
  doc.text(`Total: ${report.total} created today`);
  doc.moveDown(1);

  doc.fontSize(12).text('Breakdown');
  doc.fontSize(10).text(`${report.breakdown.bugs} Bugs | ${report.breakdown.subBugs} Sub-bug(s)`);
  doc.moveDown(1);

  doc.fontSize(12).text('By Priority');
  doc.fontSize(10);
  Object.entries(report.byPriority).forEach(([priority, items]) => {
    const keys = items.map(i => i.key).join(', ');
    doc.text(`${priority}: ${items.length} (${keys})`);
  });
  doc.moveDown(1);

  doc.fontSize(12).text(`Closed: ${report.closedCount} of ${report.total}`);
  doc.fontSize(10);
  if (report.closed.length > 0) {
    report.closed.forEach(d => {
      doc.text(`• ${d.key} – ${d.priority} – ${d.status}`);
    });
  } else {
    doc.text('None closed yet.');
  }
  doc.moveDown(1);

  doc.fontSize(12).text('Full List');
  doc.moveDown(0.5);
  const colWidths = [70, 55, 85, 65, 225];
  let y = doc.y;
  doc.fontSize(8);
  doc.text('Key', 50, y);
  doc.text('Type', 120, y);
  doc.text('Priority', 175, y);
  doc.text('Status', 260, y);
  doc.text('Summary', 325, y);
  y += 14;
  report.defects.forEach(d => {
    const summary = (d.summary || '').slice(0, 45) + ((d.summary || '').length > 45 ? '...' : '');
    doc.text(d.key, 50, y);
    doc.text(d.issuetype, 120, y);
    doc.text(d.priority, 175, y);
    doc.text(d.status, 260, y);
    doc.text(summary, 325, y, { width: 220 });
    y += 14;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  });

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const now = new Date();
  const dateStr = formatInTimeZone(now, REPORT_TIMEZONE);

  console.log('\n🐛 Defects Report – Created Today');
  console.log('='.repeat(50));
  console.log(`Date: ${dateStr}`);
  console.log('');

  console.log('🔎 Fetching bugs and sub-bugs created today...');
  const defects = await fetchDefectsCreatedToday(client, dateStr);
  const report = buildReport(defects, dateStr);

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const baseName = `defects-report-${dateStr}`;
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  const mdPath = path.join(reportsDir, `${baseName}.md`);
  const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(report));
  await renderPdf(report, pdfPath);

  const subLabel = report.breakdown.subBugs === 1 ? 'Sub-bug' : 'Sub-bugs';
  console.log(`✅ Total: ${report.total} (${report.breakdown.bugs} Bugs, ${report.breakdown.subBugs} ${subLabel})`);
  console.log(`✅ Closed: ${report.closedCount}`);
  console.log(`✅ JSON: ${jsonPath}`);
  console.log(`✅ Markdown: ${mdPath}`);
  console.log(`✅ PDF: ${pdfPath}`);
}

main().catch(err => {
  console.error('Failed:', err.response?.data || err.message);
  process.exit(1);
});
