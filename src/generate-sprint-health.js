#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const BOARD_ID = 149;
const PROJECT_KEY = 'VER10';
const DEFAULT_SPRINT_NAME = 'NH Sprint 38';

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

async function discoverStoryPointsFieldId(client) {
  try {
    const response = await client.get('/rest/api/3/field');
    const fields = response.data || [];
    const storyPointsField = fields.find(field =>
      field.name && field.name.toLowerCase().includes('story point')
    );
    return storyPointsField?.id || 'customfield_10003';
  } catch (error) {
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
    startAt += data.maxResults || 0;
    isLast = data.isLast || !(data.values || []).length;
  }

  return results;
}

async function getSprintByName(client, boardId, sprintName) {
  const sprints = await fetchAllSprints(client, boardId);
  return sprints.find(sprint => sprint.name === sprintName) || null;
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

function getStoryPoints(value) {
  return value && value > 0 ? value : 0;
}

function buildBar(segments, length = 30) {
  const total = segments.reduce((sum, segment) => sum + segment.percent, 0) || 1;
  const normalized = segments.map(segment => ({
    label: segment.label,
    char: segment.char,
    size: Math.round((segment.percent / total) * length)
  }));

  const bar = normalized.map(segment => segment.char.repeat(segment.size)).join('');
  return bar.padEnd(length, '.');
}

function ensureReportsDir() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

function drawHealthBar(doc, x, y, width, height, segments) {
  let offset = x;
  doc.save();
  segments.forEach(segment => {
    const segWidth = (segment.percent / 100) * width;
    if (segWidth <= 0) return;
    doc.fillColor(segment.color).rect(offset, y, segWidth, height).fill();
    const label = `${segment.percent}%`;
    if (segWidth >= 36) {
      doc.fillColor('#ffffff').fontSize(8).text(label, offset + 4, y + 4, { width: segWidth - 8, align: 'center' });
    }
    offset += segWidth;
  });
  doc.strokeColor('#CCCCCC').lineWidth(0.5).rect(x, y, width, height).stroke();
  doc.restore();
}

function drawTimeBar(doc, x, y, width, height, elapsedPercent) {
  const elapsedWidth = (elapsedPercent / 100) * width;
  const remainingWidth = width - elapsedWidth;
  doc.save();
  doc.fillColor('#555555').rect(x, y, elapsedWidth, height).fill();
  doc.fillColor('#DDDDDD').rect(x + elapsedWidth, y, remainingWidth, height).fill();
  doc.strokeColor('#CCCCCC').lineWidth(0.5).rect(x, y, width, height).stroke();
  const elapsedLabel = `${elapsedPercent}% elapsed`;
  const remainingLabel = `${Math.max(0, (100 - elapsedPercent)).toFixed(1)}% to go`;
  if (elapsedWidth >= 60) {
    doc.fillColor('#ffffff').fontSize(8).text(elapsedLabel, x + 4, y + 4, { width: elapsedWidth - 8, align: 'center' });
  }
  if (remainingWidth >= 60) {
    doc.fillColor('#333333').fontSize(8).text(remainingLabel, x + elapsedWidth + 4, y + 4, { width: remainingWidth - 8, align: 'center' });
  }
  doc.restore();
}

function renderPdf(report, filepath) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  doc.fontSize(18).text('Sprint Health', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Project: ${report.project}`);
  doc.text(`Sprint: ${report.sprint.name}`);
  if (report.sprint.startDate && report.sprint.endDate) {
    doc.text(`Sprint Window: ${report.sprint.startDate.split('T')[0]} → ${report.sprint.endDate.split('T')[0]}`);
  }
  doc.moveDown(1);

  const barX = 50;
  const barY = doc.y + 76;
  const barWidth = 520;
  const barHeight = 24;

  const segments = [
    { label: 'Done', percent: report.totals.donePercent, color: '#2E7D32' },
    { label: 'In Progress', percent: report.totals.inProgressPercent, color: '#81C784' },
    { label: 'To Do', percent: report.totals.toDoPercent, color: '#C62828' }
  ];

  const timeBarY = barY;
  const healthBarY = barY + 62;

  doc.fontSize(12).text('Time Elapsed vs Remaining', barX, timeBarY - 20);
  if (report.totals.timeElapsedPercent !== null) {
    drawTimeBar(doc, barX, timeBarY, barWidth, barHeight, report.totals.timeElapsedPercent);
  }

  doc.fontSize(12).text('Work Distribution (Story Points)', barX, healthBarY - 22);
  drawHealthBar(doc, barX, healthBarY, barWidth, barHeight, segments);
  doc.moveDown(4);

  const cardX = 50;
  const cardY = doc.y + 6;
  const cardWidth = 155;
  const cardHeight = 48;
  const gap = 10;

  const cards = [
    { label: 'Done SP', value: `${report.totals.doneStoryPoints} (${report.totals.donePercent}%)` },
    { label: 'In Progress SP', value: `${report.totals.inProgressStoryPoints} (${report.totals.inProgressPercent}%)` },
    { label: 'To Do SP', value: `${report.totals.toDoStoryPoints} (${report.totals.toDoPercent}%)` }
  ];

  cards.forEach((card, index) => {
    const x = cardX + index * (cardWidth + gap);
    doc.save();
    doc.fillColor('#F5F5F5').rect(x, cardY, cardWidth, cardHeight).fill();
    doc.restore();
    doc.fillColor('#555555').fontSize(8).text(card.label, x + 8, cardY + 6, { width: cardWidth - 16 });
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(card.value, x + 8, cardY + 20, { width: cardWidth - 16 });
  });

  const footerY = cardY + cardHeight + 18;
  doc.fontSize(10).font('Helvetica').fillColor('#333333');
  doc.text(`Total Story Points: ${report.totals.totalStoryPoints}`, cardX, footerY);
  if (report.totals.timeElapsedPercent !== null) {
    doc.text(`Time Elapsed: ${report.totals.timeElapsedPercent}%`, cardX, footerY + 14);
  }
  doc.text('Legend: Done (green), In Progress (amber), To Do (red)', cardX, footerY + 28);
  doc.end();
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);
  const sprintName = process.argv[2] || DEFAULT_SPRINT_NAME;

  const sprint = await getSprintByName(client, BOARD_ID, sprintName);
  if (!sprint) {
    console.error(`Error: Sprint "${sprintName}" not found on board ${BOARD_ID}`);
    process.exit(1);
  }

  const jqlBase = [
    `project = ${PROJECT_KEY}`,
    `sprint = ${sprint.id}`,
    'issuetype = Story'
  ].join(' AND ');

  const [doneIssues, inProgressIssues, toDoIssues] = await Promise.all([
    fetchIssuesByJql(client, `${jqlBase} AND statusCategory = "Done"`, ['issuetype', storyPointsFieldId]),
    fetchIssuesByJql(client, `${jqlBase} AND statusCategory = "In Progress"`, ['issuetype', storyPointsFieldId]),
    fetchIssuesByJql(client, `${jqlBase} AND statusCategory = "To Do"`, ['issuetype', storyPointsFieldId])
  ]);

  const calcTotal = issues => issues.reduce((sum, issue) => {
    const points = getStoryPoints(issue.fields?.[storyPointsFieldId]);
    return sum + points;
  }, 0);

  const doneSp = Number(calcTotal(doneIssues).toFixed(2));
  const inProgressSp = Number(calcTotal(inProgressIssues).toFixed(2));
  const toDoSp = Number(calcTotal(toDoIssues).toFixed(2));
  const totalSp = Number((doneSp + inProgressSp + toDoSp).toFixed(2));

  const donePct = totalSp > 0 ? Number(((doneSp / totalSp) * 100).toFixed(1)) : 0;
  const inProgressPct = totalSp > 0 ? Number(((inProgressSp / totalSp) * 100).toFixed(1)) : 0;
  const toDoPct = totalSp > 0 ? Number(((toDoSp / totalSp) * 100).toFixed(1)) : 0;

  const startDate = sprint.startDate ? new Date(sprint.startDate) : null;
  const endDate = sprint.endDate ? new Date(sprint.endDate) : null;
  const now = new Date();
  let timeElapsedPct = null;

  if (startDate && endDate && endDate > startDate) {
    const elapsed = Math.min(Math.max(now - startDate, 0), endDate - startDate);
    timeElapsedPct = Number(((elapsed / (endDate - startDate)) * 100).toFixed(1));
  }

  const bar = buildBar([
    { label: 'Done', percent: donePct, char: 'D' },
    { label: 'In Progress', percent: inProgressPct, char: 'I' },
    { label: 'To Do', percent: toDoPct, char: 'T' }
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null
    },
    storyPointsFieldId,
    assumptions: {
      issueTypes: ['Story'],
      defaultStoryPoints: 0
    },
    totals: {
      totalStoryPoints: totalSp,
      doneStoryPoints: doneSp,
      inProgressStoryPoints: inProgressSp,
      toDoStoryPoints: toDoSp,
      donePercent: donePct,
      inProgressPercent: inProgressPct,
      toDoPercent: toDoPct,
      timeElapsedPercent: timeElapsedPct
    },
    bar
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `sprint-health-${sprint.name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `sprint-health-${sprint.name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.md`);
  const pdfPath = path.join(reportsDir, `sprint-health-${sprint.name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.pdf`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Sprint Health');
  mdLines.push('');
  mdLines.push(`Project: ${PROJECT_KEY}`);
  mdLines.push(`Sprint: ${sprint.name}`);
  if (sprint.startDate && sprint.endDate) {
    mdLines.push(`Sprint Window: ${sprint.startDate.split('T')[0]} → ${sprint.endDate.split('T')[0]}`);
  }
  mdLines.push('');
  mdLines.push('## Progress');
  mdLines.push('');
  mdLines.push(`Total SP: ${totalSp}`);
  mdLines.push(`Done SP: ${doneSp} (${donePct}%)`);
  mdLines.push(`In Progress SP: ${inProgressSp} (${inProgressPct}%)`);
  mdLines.push(`To Do SP: ${toDoSp} (${toDoPct}%)`);
  if (timeElapsedPct !== null) {
    mdLines.push(`Time Elapsed: ${timeElapsedPct}%`);
  }
  mdLines.push('');
  mdLines.push('## Bar');
  mdLines.push('');
  mdLines.push(`\`${bar}\``);
  mdLines.push('');
  mdLines.push('Legend: D=Done, I=In Progress, T=To Do');

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  renderPdf(report, pdfPath);

  console.log('\n📈 Sprint Health');
  console.log('='.repeat(60));
  console.log(`Sprint: ${sprint.name}`);
  console.log(`Total SP: ${totalSp}`);
  console.log(`Done: ${doneSp} (${donePct}%)`);
  console.log(`In Progress: ${inProgressSp} (${inProgressPct}%)`);
  console.log(`To Do: ${toDoSp} (${toDoPct}%)`);
  if (timeElapsedPct !== null) {
    console.log(`Time Elapsed: ${timeElapsedPct}%`);
  }
  console.log(`Bar: ${bar}`);
  console.log(`✅ JSON saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
  console.log(`✅ PDF saved: ${pdfPath}`);
}

main().catch(error => {
  console.error('Failed to generate sprint health report');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
