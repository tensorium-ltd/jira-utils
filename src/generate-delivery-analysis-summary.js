#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const INPUT_PATH = path.join(__dirname, '..', 'data', 'delivery-analysis.xlsx');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const UI_COLUMN_INDEX = 6; // Column G
const SOLUTION_COLUMN_INDEX = 8; // Column I

function resolveSheetName(workbook) {
  const sheetNames = workbook.SheetNames || [];
  const preferredName = 'Work Plan V3';
  if (sheetNames.includes(preferredName)) {
    return preferredName;
  }
  const preferred = sheetNames.find(name => /delivery/i.test(name));
  return preferred || sheetNames[0];
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    const { y, m, d } = parsed;
    if (!y || !m || !d) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
}

function formatUkDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function getIsoWeekKey(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`;
}

function buildWeekSummary(calendar) {
  const weekly = {};
  Object.entries(calendar).forEach(([date, counts]) => {
    const weekKey = getIsoWeekKey(date);
    if (!weekKey) return;
    if (!weekly[weekKey]) {
      weekly[weekKey] = { ui: 0, solution: 0, dates: [], uiItems: [], solutionItems: [] };
    }
    weekly[weekKey].ui += counts.ui.length;
    weekly[weekKey].solution += counts.solution.length;
    weekly[weekKey].dates.push(date);
    weekly[weekKey].uiItems.push(...counts.ui);
    weekly[weekKey].solutionItems.push(...counts.solution);
  });
  return weekly;
}

function extractArtifactName(row) {
  for (let i = 0; i < UI_COLUMN_INDEX; i += 1) {
    const value = row[i];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function isHeaderRow(row) {
  const uiCell = row[UI_COLUMN_INDEX];
  const solCell = row[SOLUTION_COLUMN_INDEX];
  const uiText = uiCell ? String(uiCell).toLowerCase() : '';
  const solText = solCell ? String(solCell).toLowerCase() : '';
  return uiText.includes('ui') || uiText.includes('design') || solText.includes('solution') || solText.includes('design');
}

function addToCalendar(calendar, date, item, team) {
  if (!calendar[date]) {
    calendar[date] = { ui: [], solution: [] };
  }
  calendar[date][team].push(item);
}

function buildSummary(rows) {
  const calendar = {};
  const entries = [];

  rows.forEach((row, index) => {
    if (!row || row.length === 0) return;
    if (isHeaderRow(row)) return;

    const uiDate = parseExcelDate(row[UI_COLUMN_INDEX]);
    const solDate = parseExcelDate(row[SOLUTION_COLUMN_INDEX]);
    if (!uiDate && !solDate) return;

    const artifact = extractArtifactName(row) || `Row ${index + 1}`;

    if (uiDate) {
      addToCalendar(calendar, uiDate, artifact, 'ui');
    }
    if (solDate) {
      addToCalendar(calendar, solDate, artifact, 'solution');
    }

    entries.push({
      artifact,
      uiDate,
      solutionDate: solDate
    });
  });

  return { calendar, entries };
}

function renderMarkdown({ calendar, entries }, sheetName) {
  const dates = Object.keys(calendar).sort();
  const weekly = buildWeekSummary(calendar);
  const weekKeys = Object.keys(weekly).sort();
  const lines = [];
  lines.push('# Delivery Analysis Summary');
  lines.push('');
  lines.push(`Source: ${INPUT_PATH}`);
  lines.push(`Sheet: ${sheetName}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Weekly Summary');
  lines.push('');
  lines.push('| Week | Date Range | UI Design Due | Solution Design Due |');
  lines.push('|------|------------|---------------|--------------------|');
  weekKeys.forEach(weekKey => {
    const info = weekly[weekKey];
    const weekDates = info.dates.sort();
    const range = weekDates.length
      ? `${formatUkDate(weekDates[0])} to ${formatUkDate(weekDates[weekDates.length - 1])}`
      : '';
    lines.push(`| ${weekKey} | ${range} | ${info.ui} | ${info.solution} |`);
  });
  lines.push('');

  lines.push('## Weekly Summary (Artifacts)');
  lines.push('');
  lines.push('| Week | Date Range | UI Design Artifacts | Solution Design Artifacts |');
  lines.push('|------|------------|---------------------|---------------------------|');
  weekKeys.forEach(weekKey => {
    const info = weekly[weekKey];
    const weekDates = info.dates.sort();
    const range = weekDates.length
      ? `${formatUkDate(weekDates[0])} to ${formatUkDate(weekDates[weekDates.length - 1])}`
      : '';
    const uiList = info.uiItems.length ? info.uiItems.join('; ') : 'none';
    const solutionList = info.solutionItems.length ? info.solutionItems.join('; ') : 'none';
    lines.push(`| ${weekKey} | ${range} | ${uiList} | ${solutionList} |`);
  });
  lines.push('');

  lines.push('## Calendar Summary');
  lines.push('');
  lines.push('| Date | UI Design Due | Solution Design Due |');
  lines.push('|------|---------------|--------------------|');
  dates.forEach(date => {
    const day = calendar[date];
    lines.push(`| ${date} | ${day.ui.length} | ${day.solution.length} |`);
  });
  lines.push('');

  lines.push('## UI Design Due Dates');
  lines.push('');
  dates.forEach(date => {
    const items = calendar[date]?.ui || [];
    if (!items.length) return;
    lines.push(`### ${date}`);
    items.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  });

  lines.push('## Solution Design Due Dates');
  lines.push('');
  dates.forEach(date => {
    const items = calendar[date]?.solution || [];
    if (!items.length) return;
    lines.push(`### ${date}`);
    items.forEach(item => lines.push(`- ${item}`));
    lines.push('');
  });

  lines.push('## Detailed Entries');
  lines.push('');
  lines.push('| Artifact | UI Design Due | Solution Design Due |');
  lines.push('|----------|---------------|--------------------|');
  entries.forEach(entry => {
    lines.push(`| ${entry.artifact} | ${formatUkDate(entry.uiDate)} | ${formatUkDate(entry.solutionDate)} |`);
  });

  return lines.join('\n');
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Error: file not found at ${INPUT_PATH}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(INPUT_PATH, { cellDates: false });
  const sheetName = resolveSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error('Error: no worksheet found in delivery-analysis.xlsx');
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const summary = buildSummary(rows);

  ensureReportsDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const mdPath = path.join(REPORTS_DIR, `delivery-analysis-summary-${dateStr}.md`);
  const jsonPath = path.join(REPORTS_DIR, `delivery-analysis-summary-${dateStr}.json`);

  const markdown = renderMarkdown(summary, sheetName);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: INPUT_PATH,
    sheet: sheetName,
    ...summary
  }, null, 2));

  console.log(`Summary saved: ${mdPath}`);
  console.log(`Data saved: ${jsonPath}`);
}

main();
