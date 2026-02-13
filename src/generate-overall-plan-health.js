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
const PLAN_START_DATE = '2026-01-19';
const PLAN_WEEKS = 10; // 5 x 2-week sprints
const TOTAL_PLAN_SP = 1700;

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

  doc.fontSize(18).text('Overall Plan Health', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Project: ${report.project}`);
  doc.text(`Plan Window: ${report.plan.startDate} → ${report.plan.endDate}`);
  doc.moveDown(1);

  const barX = 50;
  const barY = doc.y + 76;
  const barWidth = 520;
  const barHeight = 24;

  const timeBarY = barY;
  const healthBarY = barY + 62;

  doc.fontSize(12).text('Time Elapsed vs Remaining', barX, timeBarY - 20);
  drawTimeBar(doc, barX, timeBarY, barWidth, barHeight, report.totals.timeElapsedPercent);

  const segments = [
    { label: 'Done', percent: report.totals.donePercent, color: '#2E7D32' },
    { label: 'In Progress', percent: report.totals.inProgressPercent, color: '#81C784' },
    { label: 'To Do', percent: report.totals.toDoPercent, color: '#C62828' }
  ];

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
  doc.text(`Total Plan SP: ${report.totals.totalStoryPoints}`, cardX, footerY);
  doc.text(`Time Elapsed: ${report.totals.timeElapsedPercent}%`, cardX, footerY + 14);
  doc.text('Legend: Done (green), In Progress (light green), To Do (red)', cardX, footerY + 28);

  doc.end();
}

async function main() {
  validateConfig();
  const client = createJiraClient();
  const storyPointsFieldId = await discoverStoryPointsFieldId(client);

  const planStart = new Date(`${PLAN_START_DATE}T00:00:00Z`);
  const planEnd = new Date(planStart);
  planEnd.setDate(planEnd.getDate() + PLAN_WEEKS * 7);
  const now = new Date();
  const elapsed = Math.min(Math.max(now - planStart, 0), planEnd - planStart);
  const timeElapsedPercent = Number(((elapsed / (planEnd - planStart)) * 100).toFixed(1));

  const doneJql = [
    `project = ${PROJECT_KEY}`,
    'issuetype = Story',
    `status CHANGED TO ("Done","Closed","Resolved","Ready for Release","Ready for release","Completed","Complete") AFTER "${PLAN_START_DATE}"`
  ].join(' AND ');

  const [doneIssues, inProgressIssues, toDoIssues] = await Promise.all([
    fetchIssuesByJql(client, doneJql, ['issuetype', storyPointsFieldId]),
    fetchIssuesByJql(client, `project = ${PROJECT_KEY} AND issuetype = Story AND statusCategory = "In Progress"`, ['issuetype', storyPointsFieldId]),
    fetchIssuesByJql(client, `project = ${PROJECT_KEY} AND issuetype = Story AND statusCategory = "To Do"`, ['issuetype', storyPointsFieldId])
  ]);

  const calcTotal = issues => issues.reduce((sum, issue) => {
    const points = getStoryPoints(issue.fields?.[storyPointsFieldId]);
    return sum + points;
  }, 0);

  const doneSp = Number(calcTotal(doneIssues).toFixed(2));
  const inProgressSp = Number(calcTotal(inProgressIssues).toFixed(2));
  const rawToDoSp = Number(calcTotal(toDoIssues).toFixed(2));
  const toDoSp = Math.max(0, Number((TOTAL_PLAN_SP - doneSp - inProgressSp).toFixed(2)));

  const donePct = Number(((doneSp / TOTAL_PLAN_SP) * 100).toFixed(1));
  const inProgressPct = Number(((inProgressSp / TOTAL_PLAN_SP) * 100).toFixed(1));
  const toDoPct = Number(((toDoSp / TOTAL_PLAN_SP) * 100).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    project: PROJECT_KEY,
    plan: {
      startDate: PLAN_START_DATE,
      endDate: planEnd.toISOString().split('T')[0],
      sprints: 5,
      sprintLengthWeeks: 2
    },
    storyPointsFieldId,
    assumptions: {
      issueTypes: ['Story'],
      defaultStoryPoints: 0,
      totalPlanStoryPoints: TOTAL_PLAN_SP
    },
    totals: {
      totalStoryPoints: TOTAL_PLAN_SP,
      doneStoryPoints: doneSp,
      inProgressStoryPoints: inProgressSp,
      toDoStoryPoints: toDoSp,
      rawToDoStoryPoints: rawToDoSp,
      donePercent: donePct,
      inProgressPercent: inProgressPct,
      toDoPercent: toDoPct,
      timeElapsedPercent
    }
  };

  const reportsDir = ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(reportsDir, `overall-plan-health-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `overall-plan-health-${dateStr}.md`);
  const pdfPath = path.join(reportsDir, `overall-plan-health-${dateStr}.pdf`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [];
  mdLines.push('# Overall Plan Health');
  mdLines.push('');
  mdLines.push(`Project: ${PROJECT_KEY}`);
  mdLines.push(`Plan Window: ${report.plan.startDate} → ${report.plan.endDate}`);
  mdLines.push('');
  mdLines.push(`Total SP: ${TOTAL_PLAN_SP}`);
  mdLines.push(`Done SP: ${doneSp} (${donePct}%)`);
  mdLines.push(`In Progress SP: ${inProgressSp} (${inProgressPct}%)`);
  mdLines.push(`To Do SP: ${toDoSp} (${toDoPct}%)`);
  mdLines.push(`Time Elapsed: ${timeElapsedPercent}%`);

  fs.writeFileSync(mdPath, mdLines.join('\n'));
  renderPdf(report, pdfPath);

  console.log('\n📈 Overall Plan Health');
  console.log('='.repeat(60));
  console.log(`Plan Window: ${report.plan.startDate} → ${report.plan.endDate}`);
  console.log(`Total SP: ${TOTAL_PLAN_SP}`);
  console.log(`Done: ${doneSp} (${donePct}%)`);
  console.log(`In Progress: ${inProgressSp} (${inProgressPct}%)`);
  console.log(`To Do: ${toDoSp} (${toDoPct}%)`);
  console.log(`Time Elapsed: ${timeElapsedPercent}%`);
  console.log(`✅ JSON saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
  console.log(`✅ PDF saved: ${pdfPath}`);
}

main().catch(error => {
  console.error('Failed to generate overall plan health');
  console.error(error.response?.data || error.message);
  process.exit(1);
});
