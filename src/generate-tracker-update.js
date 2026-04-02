#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_PATH = path.join(__dirname, '..', 'data', 'NH-Tracker.xlsx');
const STAGE_SHEET = 'stage';
const STAGES_FALLBACK = 'stages';
const WORK_PLAN_SHEET = 'Work Plan V3';
const OUTPUT_SHEET = 'stage-gates';

// Work Plan V3 column indices (0-based)
const COL_WORKSTREAM = 1;   // B
const COL_F = 5;            // PRD (sent to NH for review)
const COL_G = 6;            // NH Sign Off
const COL_H = 7;            // VIGO: UI/UX Design
const COL_I = 8;            // Internal: UI/UX Design
const COL_J = 9;            // SA (Technical Solution Design)
const COL_DEV_START = 11;   // L

// stage sheet column indices
const COL_GATE = 0;
const COL_OWNER = 1;
const COL_RATIONALE = 2;
const COL_PASS_CRITERIA = 3;
const COL_SHEET_COL = 4;

function parseSprintNumber(devStart) {
  if (!devStart) return null;
  const s = String(devStart).trim();
  const match = s.match(/Sprint\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseInitiatives(workbook) {
  const sheet = workbook.Sheets[WORK_PLAN_SHEET];
  if (!sheet) {
    throw new Error(`Sheet "${WORK_PLAN_SHEET}" not found`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const initiatives = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const workstream = row[COL_WORKSTREAM];
    const devStart = row[COL_DEV_START];
    if (!workstream && !devStart) break;

    const sprintNum = parseSprintNumber(devStart);
    if (sprintNum === null && devStart) continue;
    if (!workstream) continue;

    initiatives.push({
      rowIndex: r,
      workstream: String(workstream).trim(),
      devStart: devStart ? String(devStart).trim() : null,
      sprintNum: sprintNum ?? 999,
      values: {
        F: row[COL_F],
        G: row[COL_G],
        H: row[COL_H],
        I: row[COL_I],
        J: row[COL_J]
      }
    });
  }

  initiatives.sort((a, b) => a.sprintNum - b.sprintNum);
  return initiatives;
}

function parseStageGates(workbook) {
  const sheet = workbook.Sheets[STAGE_SHEET] || workbook.Sheets[STAGES_FALLBACK];
  if (!sheet) {
    throw new Error(`Sheet "${STAGE_SHEET}" or "${STAGES_FALLBACK}" not found`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const stageGates = [];
  let emptyCount = 0;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const gate = row[COL_GATE];
    const sheetCol = row[COL_SHEET_COL];
    const sheetColStr = sheetCol ? String(sheetCol).trim().toUpperCase() : null;

    if (!gate && !sheetColStr) {
      emptyCount++;
      if (emptyCount >= 3) break;
      continue;
    }
    emptyCount = 0;

    stageGates.push({
      gate: gate ?? '',
      owner: row[COL_OWNER] ?? '',
      rationale: row[COL_RATIONALE] ?? '',
      passCriteria: row[COL_PASS_CRITERIA] ?? '',
      sheetCol: sheetColStr
    });
  }

  return stageGates;
}

function formatCellValue(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number' && val > 40000 && val < 50000) {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return val;
}

function buildStageGatesSheet(initiatives, stageGates) {
  const headerRow = ['Gate', 'Owner', 'Rationale', 'Pass Criteria', 'sheet-col'];
  const dataRows = [];

  const initiativesBySprint = new Map();
  for (const init of initiatives) {
    const key = init.devStart || `Sprint ${init.sprintNum}`;
    if (!initiativesBySprint.has(key)) {
      initiativesBySprint.set(key, []);
    }
    initiativesBySprint.get(key).push(init);
  }

  const seen = new Set();
  const orderedSprints = [];
  for (const init of initiatives) {
    const key = init.devStart || `Sprint ${init.sprintNum}`;
    if (!seen.has(key)) {
      seen.add(key);
      orderedSprints.push(key);
    }
  }

  const initiativeColumns = [];
  for (const sprintKey of orderedSprints) {
    const inits = initiativesBySprint.get(sprintKey) || [];
    for (const init of inits) {
      initiativeColumns.push({ initiative: init, isDivider: false });
    }
    initiativeColumns.push({ initiative: null, isDivider: true });
  }

  if (initiativeColumns.length > 0 && initiativeColumns[initiativeColumns.length - 1].isDivider) {
    initiativeColumns.pop();
  }

  for (const col of initiativeColumns) {
    headerRow.push(col.isDivider ? '---' : col.initiative.workstream);
  }

  for (const sg of stageGates) {
    const row = [sg.gate, sg.owner, sg.rationale, sg.passCriteria, sg.sheetCol || ''];

    for (const col of initiativeColumns) {
      if (col.isDivider) {
        row.push('');
        continue;
      }
      if (sg.sheetCol && col.initiative.values[sg.sheetCol] !== undefined) {
        const val = col.initiative.values[sg.sheetCol];
        row.push(formatCellValue(val));
      } else {
        row.push('');
      }
    }
    dataRows.push(row);
  }

  return [headerRow, ...dataRows];
}

function main() {
  console.log('\n📊 Generate Tracker Update');
  console.log('='.repeat(60));
  console.log(`Input: ${INPUT_PATH}`);

  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Error: File not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_PATH, { cellDates: false });

  const initiatives = parseInitiatives(workbook);
  console.log(`   Initiatives: ${initiatives.length}`);

  const stageGates = parseStageGates(workbook);
  console.log(`   Stage gates: ${stageGates.length}`);

  const grid = buildStageGatesSheet(initiatives, stageGates);

  const ws = XLSX.utils.aoa_to_sheet(grid);

  if (workbook.Sheets[OUTPUT_SHEET]) {
    delete workbook.Sheets[OUTPUT_SHEET];
    const idx = workbook.SheetNames.indexOf(OUTPUT_SHEET);
    if (idx >= 0) workbook.SheetNames.splice(idx, 1);
  }
  workbook.Sheets[OUTPUT_SHEET] = ws;
  workbook.SheetNames.push(OUTPUT_SHEET);

  const backupPath = path.join(
    path.dirname(INPUT_PATH),
    `NH-Tracker-backup-${new Date().toISOString().split('T')[0]}.xlsx`
  );
  fs.copyFileSync(INPUT_PATH, backupPath);
  console.log(`   Backup: ${backupPath}`);

  XLSX.writeFile(workbook, INPUT_PATH);
  console.log(`\n✅ Sheet "${OUTPUT_SHEET}" created and saved to ${INPUT_PATH}`);
}

main();
