#!/usr/bin/env node

/**
 * Weekly Plan Generator
 * 
 * Reads the NH-2A-Working spreadsheet and summarizes items
 * due by a specified date from columns E to I (design milestones).
 * 
 * Usage: node generate-weekly-plan.js [due-date]
 * Example: node generate-weekly-plan.js 2026-01-09
 */

const XLSX = require('xlsx');
const path = require('path');

// Parse command line argument for due date
const args = process.argv.slice(2);
let targetDate;

if (args.length > 0) {
  targetDate = new Date(args[0]);
  if (isNaN(targetDate.getTime())) {
    console.error(`❌ Invalid date format: ${args[0]}`);
    console.error('   Use format: YYYY-MM-DD (e.g., 2026-01-09)');
    process.exit(1);
  }
} else {
  // Default to 7 days from now
  targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
}
targetDate.setHours(23, 59, 59, 999);

// Configuration
const SPREADSHEET_PATH = path.join(__dirname, '../data/NH-R2A-Working-Copy.xlsx');
const SHEET_NAME = 'Work Plan V2';

// Column mappings (0-indexed)
const COLUMNS = {
  B: 1,  // Workstream/Initiative name
  C: 2,  // Owner
  E: 4,  // PRD (sent to NH)
  F: 5,  // NH Sign Off
  G: 6,  // VIGO: UI/UX Design
  H: 7,  // Internal: UI/UX
  I: 8,  // SA (Technical Specification)
  J: 9   // All Design Activities Complete
};

// Column labels
const MILESTONE_LABELS = {
  E: 'PRD (sent to NH)',
  F: 'NH Sign Off',
  G: 'VIGO: UI/UX Design',
  H: 'Internal: UI/UX',
  I: 'SA (Technical Spec)',
  J: 'All Design Complete'
};

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel epoch is Jan 1, 1900 (but has a bug treating 1900 as leap year)
  const utc_days = Math.floor(serial - 25569);
  const date = new Date(utc_days * 86400 * 1000);
  return date;
}

/**
 * Format date for display
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Get cell value
 */
function getCellValue(ws, row, col) {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  return cell ? cell.v : null;
}

/**
 * Main function
 */
function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('\n📅 Weekly Plan - Due Items');
  console.log('============================================================');
  console.log(`   Today: ${formatDate(today)}`);
  console.log(`   Target due date: ${formatDate(targetDate)}`);
  console.log(`   Spreadsheet: ${path.basename(SPREADSHEET_PATH)}`);
  console.log('============================================================\n');

  // Read spreadsheet
  let wb;
  try {
    wb = XLSX.readFile(SPREADSHEET_PATH);
  } catch (err) {
    console.error(`❌ Error reading spreadsheet: ${err.message}`);
    process.exit(1);
  }

  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`❌ Sheet "${SHEET_NAME}" not found`);
    process.exit(1);
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  
  // Collect due items
  const dueItems = [];
  const overdueItems = [];
  
  // Start from row 3 (index 2) to skip headers
  for (let r = 2; r <= range.e.r; r++) {
    const workstream = getCellValue(ws, r, COLUMNS.B);
    const owner = getCellValue(ws, r, COLUMNS.C);
    
    if (!workstream) continue;
    
    // Check each milestone column (E through J)
    for (const [colLetter, colLabel] of Object.entries(MILESTONE_LABELS)) {
      const colIndex = COLUMNS[colLetter];
      const cellValue = getCellValue(ws, r, colIndex);
      
      if (!cellValue || cellValue === 'N/A' || typeof cellValue !== 'number') continue;
      
      const dueDate = excelDateToJS(cellValue);
      if (!dueDate) continue;
      
      // Check if overdue
      if (dueDate < today) {
        overdueItems.push({
          workstream,
          owner,
          milestone: colLabel,
          dueDate,
          daysOverdue: Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24))
        });
      }
      // Check if due by target date
      else if (dueDate >= today && dueDate <= targetDate) {
        const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        dueItems.push({
          workstream,
          owner,
          milestone: colLabel,
          dueDate,
          daysUntil
        });
      }
    }
  }

  // Sort by due date
  dueItems.sort((a, b) => a.dueDate - b.dueDate);
  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Display overdue items
  if (overdueItems.length > 0) {
    console.log('🚨 OVERDUE ITEMS');
    console.log('============================================================\n');
    
    for (const item of overdueItems) {
      console.log(`   ⚠️  ${item.workstream}`);
      console.log(`      Milestone: ${item.milestone}`);
      console.log(`      Due: ${formatDate(item.dueDate)} (${item.daysOverdue} days overdue)`);
      console.log(`      Owner: ${item.owner || 'Unassigned'}`);
      console.log('');
    }
    
    console.log(`   Total overdue: ${overdueItems.length} items\n`);
  }

  // Display day-by-day breakdown
  console.log(`📋 DAY-BY-DAY BREAKDOWN`);
  console.log('============================================================\n');

  // Generate all dates from today to target date
  const allDates = [];
  const currentDate = new Date(today);
  while (currentDate <= targetDate) {
    allDates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Group due items by day
  const byDay = {};
  for (const item of dueItems) {
    const dateKey = item.dueDate.toISOString().split('T')[0];
    if (!byDay[dateKey]) {
      byDay[dateKey] = [];
    }
    byDay[dateKey].push(item);
  }

  // Display each day
  for (const date of allDates) {
    const dateKey = date.toISOString().split('T')[0];
    const dayItems = byDay[dateKey] || [];
    const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    const dayLabel = daysUntil === 0 ? '(TODAY)' : 
                     daysUntil === 1 ? '(Tomorrow)' : '';
    
    console.log(`📅 ${formatDate(date)} ${dayLabel}`);
    
    if (dayItems.length === 0) {
      console.log('   • None');
    } else {
      for (const item of dayItems) {
        console.log(`   • ${item.workstream} - ${item.milestone} (${item.owner || 'Unassigned'})`);
      }
    }
    console.log('');
  }

  console.log(`Total due by ${formatDate(targetDate)}: ${dueItems.length} items\n`);

  // Summary by owner
  console.log('============================================================');
  console.log('👤 SUMMARY BY OWNER');
  console.log('============================================================\n');

  const byOwner = {};
  for (const item of [...dueItems, ...overdueItems]) {
    const owner = item.owner || 'Unassigned';
    if (!byOwner[owner]) {
      byOwner[owner] = { due: 0, overdue: 0 };
    }
    if (item.daysOverdue) {
      byOwner[owner].overdue++;
    } else {
      byOwner[owner].due++;
    }
  }

  for (const [owner, counts] of Object.entries(byOwner).sort((a, b) => 
    (b[1].due + b[1].overdue) - (a[1].due + a[1].overdue)
  )) {
    const status = counts.overdue > 0 ? `⚠️  ${counts.overdue} overdue, ` : '';
    console.log(`   ${owner}: ${status}${counts.due} due by target date`);
  }

  console.log('\n🎉 Done!\n');
}

// Run
main();

