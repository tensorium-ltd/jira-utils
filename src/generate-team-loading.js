#!/usr/bin/env node

/**
 * Team Loading Analysis
 * 
 * Analyzes team allocation from NH-2A-Working-Copy spreadsheet
 * showing week-by-week loading for each team.
 */

const XLSX = require('xlsx');
const path = require('path');

// Configuration
const SPREADSHEET_PATH = path.join(__dirname, '../data/NH-2A-Working-Copy.xlsx');
const SHEET_NAME = 'Work Plan V2';

// Column indexes (0-based)
const COL_INITIATIVE = 1;    // Column B - Initiative name
const COL_TEAM = 14;         // Column O - Allocated Team
const COL_DATES_START = 17;  // Column R - First date column

// Teams to track
const TEAMS = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Dashboard'];

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
}

/**
 * Get ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `W${weekNo}`;
}

/**
 * Format date for display
 */
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Get cell value
 */
function getCellValue(ws, row, col) {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  return cell ? cell.v : null;
}

/**
 * Normalize team name
 */
function normalizeTeam(teamValue) {
  if (!teamValue) return null;
  const str = String(teamValue).trim();
  
  for (const team of TEAMS) {
    if (str.includes(team) || str.includes(team.replace('Team ', ''))) {
      return team;
    }
  }
  return null;
}

/**
 * Main function
 */
function main() {
  console.log('\n📊 Team Loading Analysis');
  console.log('============================================================');
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

  // Find all date columns
  const dateColumns = [];
  for (let c = COL_DATES_START; c <= range.e.c; c++) {
    const cellValue = getCellValue(ws, 1, c); // Row 2 (index 1)
    if (typeof cellValue === 'number' && cellValue > 40000) {
      const date = excelDateToJS(cellValue);
      if (date) {
        dateColumns.push({ col: c, date, week: getWeekNumber(date) });
      }
    }
  }

  console.log(`   Found ${dateColumns.length} date columns`);
  console.log(`   Date range: ${formatDate(dateColumns[0]?.date)} to ${formatDate(dateColumns[dateColumns.length-1]?.date)}`);
  console.log('');

  // Initialize weekly data per team
  const weeklyData = {};
  const weeks = [...new Set(dateColumns.map(d => d.week))];
  
  for (const team of TEAMS) {
    weeklyData[team] = {};
    for (const week of weeks) {
      weeklyData[team][week] = { days: 0, initiatives: new Set() };
    }
  }

  // Collect daily data per team
  const dailyData = {};
  for (const team of TEAMS) {
    dailyData[team] = {};
  }

  // Process each row (initiative)
  for (let r = 2; r <= range.e.r; r++) {
    const initiative = getCellValue(ws, r, COL_INITIATIVE);
    const teamValue = getCellValue(ws, r, COL_TEAM);
    
    if (!initiative || !teamValue) continue;
    
    const team = normalizeTeam(teamValue);
    if (!team) continue;

    // Check each date column for X
    for (const { col, date, week } of dateColumns) {
      const cellValue = getCellValue(ws, r, col);
      if (cellValue === 'X') {
        weeklyData[team][week].days++;
        weeklyData[team][week].initiatives.add(initiative);
        
        const dateKey = date.toISOString().split('T')[0];
        if (!dailyData[team][dateKey]) {
          dailyData[team][dateKey] = 0;
        }
        dailyData[team][dateKey]++;
      }
    }
  }

  // Display weekly summary
  console.log('📅 WEEKLY TEAM LOADING (Days Allocated per Team)');
  console.log('============================================================\n');

  // Header
  const weekHeaders = weeks.slice(0, 12); // Show first 12 weeks
  console.log('   Team     | ' + weekHeaders.map(w => w.padStart(4)).join(' | ') + ' | Total');
  console.log('   ' + '-'.repeat(10 + weekHeaders.length * 7 + 8));

  // Data rows
  const teamTotals = {};
  for (const team of TEAMS) {
    const weekValues = weekHeaders.map(w => weeklyData[team][w]?.days || 0);
    const total = Object.values(weeklyData[team]).reduce((sum, w) => sum + w.days, 0);
    teamTotals[team] = total;
    
    const row = weekValues.map(v => String(v).padStart(4)).join(' | ');
    console.log(`   ${team.padEnd(9)} | ${row} | ${String(total).padStart(5)}`);
  }

  // Weekly totals
  console.log('   ' + '-'.repeat(10 + weekHeaders.length * 7 + 8));
  const weekTotals = weekHeaders.map(w => 
    TEAMS.reduce((sum, team) => sum + (weeklyData[team][w]?.days || 0), 0)
  );
  const grandTotal = Object.values(teamTotals).reduce((sum, t) => sum + t, 0);
  console.log(`   ${'TOTAL'.padEnd(9)} | ${weekTotals.map(v => String(v).padStart(4)).join(' | ')} | ${String(grandTotal).padStart(5)}`);

  // Capacity check (assuming 5 days per week per team)
  console.log('\n📈 CAPACITY UTILIZATION (5 days/week capacity)');
  console.log('============================================================\n');

  console.log('   Team     | ' + weekHeaders.map(w => w.padStart(4)).join(' | '));
  console.log('   ' + '-'.repeat(10 + weekHeaders.length * 7));

  for (const team of TEAMS) {
    const weekValues = weekHeaders.map(w => {
      const days = weeklyData[team][w]?.days || 0;
      const pct = Math.round((days / 5) * 100);
      return pct > 100 ? `${pct}%`.padStart(4) : `${pct}%`.padStart(4);
    });
    console.log(`   ${team.padEnd(9)} | ${weekValues.join(' | ')}`);
  }

  // Identify overloaded weeks
  console.log('\n⚠️  OVERLOADED WEEKS (>100% capacity)');
  console.log('============================================================\n');

  let hasOverload = false;
  for (const team of TEAMS) {
    for (const week of weeks) {
      const days = weeklyData[team][week]?.days || 0;
      if (days > 5) {
        hasOverload = true;
        const initiatives = [...weeklyData[team][week].initiatives].join(', ');
        console.log(`   ⚠️  ${team} - ${week}: ${days} days allocated (${Math.round((days/5)*100)}%)`);
        console.log(`      Initiatives: ${initiatives.substring(0, 80)}${initiatives.length > 80 ? '...' : ''}`);
        console.log('');
      }
    }
  }

  if (!hasOverload) {
    console.log('   ✅ No teams are overloaded!\n');
  }

  // Summary stats
  console.log('============================================================');
  console.log('📊 SUMMARY');
  console.log('============================================================\n');

  for (const team of TEAMS) {
    const total = teamTotals[team];
    const avgPerWeek = total / weeks.length;
    const maxWeek = Object.entries(weeklyData[team])
      .sort((a, b) => b[1].days - a[1].days)[0];
    
    console.log(`   ${team}: ${total} total days, avg ${avgPerWeek.toFixed(1)}/week, peak ${maxWeek[1].days} days (${maxWeek[0]})`);
  }

  console.log('\n🎉 Done!\n');
}

// Run
main();



