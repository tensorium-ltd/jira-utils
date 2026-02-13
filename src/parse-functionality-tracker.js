/**
 * Parse CCET Functionality Tracker Excel File
 * 
 * Reads the Excel file and extracts:
 * - Workstreams (Column C)
 * - Release numbers (Column G)
 * - Progress status (Column I onwards - percentage values indicate stage)
 * 
 * Outputs an interim JSON dataset for further processing
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/CCET Functionality Tracker 02.02.25.xlsx');
const OUTPUT_FILE = path.join(__dirname, '../data/functionality-tracker.json');

function getCellValue(cell) {
  let value = cell.value;
  
  if (value === null || value === undefined) {
    return null;
  } else if (typeof value === 'object') {
    if (value.result !== undefined) {
      return value.result; // Formula result
    } else if (value.text) {
      return value.text; // Rich text
    } else if (value.richText) {
      return value.richText.map(rt => rt.text).join('');
    } else {
      return JSON.stringify(value);
    }
  }
  return value;
}

function getColumnLetter(colNum) {
  let result = '';
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
}

async function parseExcel() {
  console.log('📊 Parsing CCET Functionality Tracker...\n');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(INPUT_FILE);
  
  // Focus on the Functionality Tracker sheet
  const sheet = workbook.getWorksheet('Functionality Tracker');
  
  if (!sheet) {
    throw new Error('Could not find "Functionality Tracker" sheet');
  }
  
  console.log('📑 Analyzing "Functionality Tracker" sheet');
  console.log(`   Rows: ${sheet.rowCount}, Columns: ${sheet.columnCount}`);
  console.log('═'.repeat(80));
  
  // First, map out the column structure from header rows
  console.log('\n📋 COLUMN STRUCTURE (All columns):');
  console.log('─'.repeat(80));
  
  const row4 = sheet.getRow(4);
  const row5 = sheet.getRow(5);
  const row6 = sheet.getRow(6);
  
  const columnMap = [];
  
  for (let colNum = 1; colNum <= sheet.columnCount; colNum++) {
    const col = getColumnLetter(colNum);
    const header4 = getCellValue(row4.getCell(colNum));
    const header5 = getCellValue(row5.getCell(colNum));
    const header6 = getCellValue(row6.getCell(colNum));
    
    if (header4 || header5 || header6) {
      columnMap.push({
        column: col,
        colNum: colNum,
        category: header4,
        value: header5,
        label: header6
      });
      console.log(`   ${col.padEnd(3)} | Cat: ${String(header4 || '').substring(0,20).padEnd(20)} | Val: ${String(header5 || '').substring(0,15).padEnd(15)} | Label: ${header6 || ''}`);
    }
  }
  
  // Now parse the progress stages (columns I onwards)
  console.log('\n📊 PROGRESS STAGES (Columns I onwards):');
  console.log('─'.repeat(80));
  
  const progressStages = [];
  for (let colNum = 9; colNum <= sheet.columnCount; colNum++) {
    const col = getColumnLetter(colNum);
    const category = getCellValue(row4.getCell(colNum));
    const percentage = getCellValue(row5.getCell(colNum));
    const stageName = getCellValue(row6.getCell(colNum));
    
    if (stageName) {
      progressStages.push({
        column: col,
        colNum: colNum,
        category: category,
        percentage: percentage,
        stage: stageName
      });
      console.log(`   ${col}: ${stageName} (${percentage ? (percentage * 100) + '%' : 'N/A'}) - ${category || ''}`);
    }
  }
  
  // Parse all data rows
  console.log('\n📋 PARSING DATA ROWS...');
  console.log('─'.repeat(80));
  
  const items = [];
  let currentWorkstream = null;
  
  for (let rowNum = 8; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    
    const id = getCellValue(row.getCell(2));           // Column B - ID
    const workstream = getCellValue(row.getCell(3));   // Column C - Workstream
    const name = getCellValue(row.getCell(4));         // Column D - Functionality Name
    const description = getCellValue(row.getCell(5));  // Column E - Description
    const effort = getCellValue(row.getCell(6));       // Column F - Effort
    const release = getCellValue(row.getCell(7));      // Column G - Release
    
    // Track current workstream (it may span multiple rows)
    if (workstream) {
      currentWorkstream = workstream;
    }
    
    // Skip empty rows
    if (!name && !id) continue;
    
    // Get progress status - find which stage column has a value
    let currentStage = null;
    let currentPercentage = null;
    
    for (const stage of progressStages) {
      const stageValue = getCellValue(row.getCell(stage.colNum));
      if (stageValue !== null && stageValue !== undefined && stageValue !== '') {
        currentStage = stage.stage;
        currentPercentage = stage.percentage;
      }
    }
    
    // Parse effort as number (default to 1 if not set, range 1-10)
    let effortValue = 1;
    if (effort !== null && effort !== undefined) {
      effortValue = parseInt(effort, 10);
      if (isNaN(effortValue) || effortValue < 1) effortValue = 1;
      if (effortValue > 10) effortValue = 10;
    }
    
    const item = {
      id: id,
      workstream: currentWorkstream,
      name: name,
      description: description,
      effort: effortValue,
      release: release,
      currentStage: currentStage,
      percentage: currentPercentage
    };
    
    items.push(item);
  }
  
  console.log(`   Found ${items.length} functionality items\n`);
  
  // Summary by Release
  console.log('\n📊 SUMMARY BY RELEASE:');
  console.log('═'.repeat(80));
  
  const byRelease = {};
  for (const item of items) {
    const rel = item.release || 'No Release';
    if (!byRelease[rel]) {
      byRelease[rel] = { total: 0, byStage: {} };
    }
    byRelease[rel].total++;
    
    const stage = item.currentStage || 'Unknown';
    byRelease[rel].byStage[stage] = (byRelease[rel].byStage[stage] || 0) + 1;
  }
  
  for (const [release, data] of Object.entries(byRelease).sort()) {
    console.log(`\n   ${release}: ${data.total} items`);
    for (const [stage, count] of Object.entries(data.byStage)) {
      const bar = '█'.repeat(Math.min(count, 30));
      console.log(`      ${stage.padEnd(25)} ${String(count).padStart(3)} ${bar}`);
    }
  }
  
  // Summary by Workstream
  console.log('\n\n📊 SUMMARY BY WORKSTREAM:');
  console.log('═'.repeat(80));
  
  const byWorkstream = {};
  for (const item of items) {
    const ws = item.workstream || 'No Workstream';
    if (!byWorkstream[ws]) {
      byWorkstream[ws] = { total: 0, byStage: {} };
    }
    byWorkstream[ws].total++;
    
    const stage = item.currentStage || 'Unknown';
    byWorkstream[ws].byStage[stage] = (byWorkstream[ws].byStage[stage] || 0) + 1;
  }
  
  for (const [workstream, data] of Object.entries(byWorkstream).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`\n   ${workstream}: ${data.total} items`);
    for (const [stage, count] of Object.entries(data.byStage)) {
      const bar = '█'.repeat(Math.min(count, 30));
      console.log(`      ${stage.padEnd(25)} ${String(count).padStart(3)} ${bar}`);
    }
  }
  
  // Save JSON output
  const output = {
    generatedAt: new Date().toISOString(),
    progressStages: progressStages,
    items: items,
    summaryByRelease: byRelease,
    summaryByWorkstream: byWorkstream
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n\n✅ JSON data saved to: ${OUTPUT_FILE}`);
  
  return output;
}

async function main() {
  try {
    await parseExcel();
  } catch (error) {
    console.error('❌ Error parsing Excel file:', error.message);
    console.error(error.stack);
  }
}

main();

