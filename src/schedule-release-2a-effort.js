const XLSX = require('xlsx');
const path = require('path');

const SPREADSHEET_PATH = path.join(__dirname, '..', 'data', 'Release 2A Plan - Working Copy.xlsx');

// Column indices (0-based)
const COL_B = 1;  // Feature name
const COL_J = 9;  // Design completion date
const COL_N = 13; // Team days effort
const COL_P = 15; // First date column
const COL_ES = 148; // Last date column (ES)

// Convert Excel serial date to JS Date
function excelDateToJS(serial) {
  if (!serial || isNaN(serial)) return null;
  return new Date((serial - 25569) * 86400 * 1000);
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  if (!date) return 'NONE';
  return date.toISOString().split('T')[0];
}

// Get column letter from index
function colLetter(index) {
  return XLSX.utils.encode_col(index);
}

function runScheduler(applyChanges = false) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  RELEASE 2A EFFORT SCHEDULER' + (applyChanges ? ' - APPLYING CHANGES' : ' - MOCK RUN'));
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Read spreadsheet
  const workbook = XLSX.readFile(SPREADSHEET_PATH);
  const sheet = workbook.Sheets['Work Plan'];
  
  if (!sheet) {
    console.error('Error: Could not find "Work Plan" sheet');
    process.exit(1);
  }

  // Build date column mapping (column index -> date), excluding weekends
  const dateColumns = {};
  const columnDates = {};
  const weekendColumns = [];
  
  console.log('📅 Reading date columns (P to EE)...');
  for (let c = COL_P; c <= COL_ES; c++) {
    const cell = sheet[XLSX.utils.encode_cell({r: 1, c: c})]; // Row 2 has dates
    if (cell && cell.v) {
      const date = excelDateToJS(cell.v);
      if (date) {
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendColumns.push({ col: colLetter(c), date: formatDate(date), day: dayOfWeek === 0 ? 'Sun' : 'Sat' });
          continue; // Skip weekends
        }
        const dateStr = formatDate(date);
        dateColumns[c] = dateStr;
        columnDates[dateStr] = c;
      }
    }
  }
  
  const dateRange = Object.values(dateColumns);
  console.log(`   ✓ Found ${dateRange.length} working day columns (excluding ${weekendColumns.length} weekend days)`);
  console.log(`   ✓ Range: ${dateRange[0]} to ${dateRange[dateRange.length - 1]}`);

  // Collect all rows with effort > 0
  console.log('');
  console.log('📊 Reading rows with effort...');
  
  const rows = [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  for (let r = 2; r <= range.e.r; r++) { // Start from row 3 (index 2)
    // Skip row 26 (totals row)
    if (r === 25) continue; // Row 26 = index 25
    
    const cellN = sheet[XLSX.utils.encode_cell({r: r, c: COL_N})];
    const cellJ = sheet[XLSX.utils.encode_cell({r: r, c: COL_J})];
    const cellB = sheet[XLSX.utils.encode_cell({r: r, c: COL_B})];
    
    if (cellN && cellN.v && cellN.v > 0) {
      const effort = Math.ceil(cellN.v); // Round up
      const designDate = excelDateToJS(cellJ?.v);
      const featureName = cellB?.v || '(unnamed)';
      
      rows.push({
        rowIndex: r,
        rowNumber: r + 1, // Excel row number (1-based)
        feature: featureName,
        designDate: designDate,
        designDateStr: formatDate(designDate),
        originalEffort: cellN.v,
        effort: effort
      });
    }
  }
  
  console.log(`   ✓ Found ${rows.length} rows with effort > 0`);

  // Sort rows: first by design date (nulls last), then by row number
  rows.sort((a, b) => {
    if (a.designDate && b.designDate) {
      return a.designDate.getTime() - b.designDate.getTime();
    }
    if (a.designDate && !b.designDate) return -1;
    if (!a.designDate && b.designDate) return 1;
    return a.rowNumber - b.rowNumber;
  });

  console.log('');
  console.log('📋 Sorted rows by design date:');
  rows.forEach((row, idx) => {
    console.log(`   ${idx + 1}. Row ${row.rowNumber}: ${row.feature.substring(0, 35).padEnd(35)} | Design: ${row.designDateStr.padEnd(10)} | Effort: ${row.originalEffort} → ${row.effort} days`);
  });

  // Initialize day usage tracker
  const dayUsed = {};
  for (const col in dateColumns) {
    dayUsed[col] = false;
  }

  // Schedule each row
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  SCHEDULING RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  const schedule = [];
  let totalScheduled = 0;
  let totalUnscheduled = 0;

  for (const row of rows) {
    const scheduledDays = [];
    let daysNeeded = row.effort;
    
    // Find first available column after design date
    for (let c = COL_P; c <= COL_ES && daysNeeded > 0; c++) {
      if (dayUsed[c]) continue;
      
      const colDate = dateColumns[c];
      if (!colDate) continue;
      
      // Check if this date is >= design date (or no design date)
      if (row.designDate) {
        const colDateObj = new Date(colDate);
        if (colDateObj < row.designDate) continue;
      }
      
      // Schedule this day
      dayUsed[c] = true;
      scheduledDays.push({
        column: c,
        columnLetter: colLetter(c),
        date: colDate
      });
      daysNeeded--;
    }

    const scheduled = scheduledDays.length;
    totalScheduled += scheduled;
    
    if (scheduled < row.effort) {
      totalUnscheduled += (row.effort - scheduled);
    }

    schedule.push({
      ...row,
      scheduledDays: scheduledDays,
      fullyScheduled: scheduled === row.effort
    });

    // Output row schedule
    const statusIcon = scheduled === row.effort ? '✓' : '⚠️';
    console.log(`${statusIcon} Row ${row.rowNumber}: ${row.feature.substring(0, 30).padEnd(30)} | ${scheduled}/${row.effort} days scheduled`);
    
    if (scheduledDays.length > 0) {
      const daysList = scheduledDays.map(d => `${d.columnLetter} (${d.date})`).join(', ');
      console.log(`   → ${daysList}`);
    } else {
      console.log(`   → No days available after design date ${row.designDateStr}`);
    }
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`   Total rows processed:     ${rows.length}`);
  console.log(`   Total days scheduled:     ${totalScheduled}`);
  console.log(`   Days that couldn't fit:   ${totalUnscheduled}`);
  console.log(`   Available day columns:    ${Object.keys(dateColumns).length}`);
  console.log(`   Days used:                ${Object.values(dayUsed).filter(v => v).length}`);
  console.log(`   Days remaining:           ${Object.values(dayUsed).filter(v => !v).length}`);

  // Show mock output table
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  MOCK OUTPUT TABLE (What will be written)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('| Row | Feature                          | Design Date | Effort | Columns to Fill |');
  console.log('|-----|----------------------------------|-------------|--------|-----------------|');
  
  for (const item of schedule) {
    const cols = item.scheduledDays.map(d => d.columnLetter).join(', ') || '(none)';
    const feature = item.feature.substring(0, 32).padEnd(32);
    console.log(`| ${String(item.rowNumber).padStart(3)} | ${feature} | ${item.designDateStr.padEnd(11)} | ${String(item.effort).padStart(6)} | ${cols} |`);
  }

  // Apply changes if requested
  if (applyChanges) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('  APPLYING CHANGES TO SPREADSHEET');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    
    // First, clear all cells in P-EE for data rows
    console.log('   Clearing existing values in columns P-EE...');
    for (const item of schedule) {
      for (let c = COL_P; c <= COL_ES; c++) {
        const cellAddr = XLSX.utils.encode_cell({r: item.rowIndex, c: c});
        if (sheet[cellAddr]) {
          delete sheet[cellAddr];
        }
      }
    }
    
    // Write new values
    console.log('   Writing scheduled values...');
    let cellsWritten = 0;
    for (const item of schedule) {
      for (const day of item.scheduledDays) {
        const cellAddr = XLSX.utils.encode_cell({r: item.rowIndex, c: day.column});
        sheet[cellAddr] = { t: 'n', v: 1 };
        cellsWritten++;
      }
    }
    
    console.log(`   ✓ Wrote ${cellsWritten} cells`);
    
    // Save workbook
    console.log('   Saving workbook...');
    XLSX.writeFile(workbook, SPREADSHEET_PATH);
    console.log('   ✓ Saved to: ' + SPREADSHEET_PATH);
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('  THIS WAS A MOCK RUN - NO CHANGES MADE');
    console.log('  To apply changes, run with --apply flag');
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }
}

// Check for --apply flag
const applyChanges = process.argv.includes('--apply');
runScheduler(applyChanges);

