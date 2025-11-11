const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Project configuration
const PROJECT_NAME = 'National Highways Phase 3 Delivery';

// Color scheme
const COLORS = {
  primary: '#4472C4',
  secondary: '#70AD47',
  danger: '#C55A11',
  warning: '#FFC000',
  gray: '#808080',
  lightGray: '#E7E6E6',
  white: '#FFFFFF',
  black: '#000000'
};

// S-Curve distribution functions
function distributeSCurve(totalPoints, workingDays) {
  // Standard S-curve profile (percentages of total per day)
  // For 10-day sprint: [5%, 7%, 10%, 12%, 13%, 13%, 12%, 10%, 7%, 5%]
  
  const sCurveProfile = {
    10: [0.05, 0.07, 0.10, 0.12, 0.13, 0.13, 0.12, 0.10, 0.07, 0.05],
    9: [0.05, 0.07, 0.11, 0.13, 0.14, 0.14, 0.13, 0.11, 0.07],
    8: [0.06, 0.08, 0.12, 0.14, 0.14, 0.14, 0.12, 0.08],
    7: [0.07, 0.10, 0.13, 0.15, 0.15, 0.13, 0.10],
    6: [0.08, 0.12, 0.15, 0.15, 0.12, 0.08],
    5: [0.10, 0.15, 0.20, 0.15, 0.10]
  };
  
  // Get profile or generate one
  const profile = sCurveProfile[workingDays] || generateSCurveProfile(workingDays);
  
  // Distribute points according to profile
  const distribution = profile.map(percentage => 
    Math.round(totalPoints * percentage * 100) / 100
  );
  
  // Adjust for rounding (ensure sum equals totalPoints)
  const sum = distribution.reduce((a, b) => a + b, 0);
  const diff = Math.round((totalPoints - sum) * 100) / 100;
  if (Math.abs(diff) > 0.01) {
    distribution[Math.floor(workingDays / 2)] += diff; // Add difference to middle day
  }
  
  return distribution;
}

function generateSCurveProfile(days) {
  // Generate S-curve for any number of days
  // Uses smoothstep function for S-curve shape
  const profile = [];
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1); // 0 to 1
    // S-curve using smoothstep function
    const smoothT = t * t * (3 - 2 * t);
    profile.push(smoothT);
  }
  
  // Normalize to percentages that sum to 1
  const sum = profile.reduce((a, b) => a + b, 0);
  return profile.map(v => v / sum);
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Sprint number is required');
    console.log('Usage: npm run report -- <sprint-number>');
    console.log('Example: npm run report -- 30');
    process.exit(1);
  }
  
  const sprintNumber = args[0];
  
  if (!/^\d+$/.test(sprintNumber)) {
    console.error('❌ Error: Sprint number must be a number');
    process.exit(1);
  }
  
  return { sprintNumber: parseInt(sprintNumber, 10) };
}

// Determine release information for a sprint
function getReleaseInfo(sprintNumber) {
  if (sprintNumber <= 33) {
    return {
      name: 'Release 1D',
      endSprint: 33,
      type: 'feature'
    };
  } else if (sprintNumber <= 36) {
    return {
      name: 'Release 2A',
      endSprint: 36,
      type: 'feature'
    };
  } else {
    return {
      name: 'Bug Fixing Phase',
      endSprint: 38,
      type: 'bugfix'
    };
  }
}

// Read "DELIVERED TODAY" value from main sheet (from column B)
async function readDeliveredToday(workbook, sprintNumber) {
  const mainSheet = workbook.worksheets[0];
  let deliveredToday = 0;
  
  // Find the "DELIVERED TODAY" row and read from column B (column 2)
  mainSheet.eachRow((row, rowNum) => {
    const firstCell = row.getCell(1).value;
    const cellStr = String(firstCell || '').toUpperCase();
    
    if (cellStr === 'DELIVERED TODAY') {
      // Read the delivered today value from column B
      const val = row.getCell(2).value;
      
      if (val !== null && val !== undefined) {
        deliveredToday = typeof val === 'object' && val.result !== undefined ? val.result : val;
      }
    }
  });
  
  return deliveredToday;
}

// Read release-level data from main sheet
async function readReleaseData(workbook, releaseInfo) {
  const mainSheet = workbook.worksheets[0];
  
  const releaseData = {
    releaseName: releaseInfo.name,
    totalCommitted: 0,
    totalDelivered: 0,
    percentageComplete: 0
  };
  
  // Determine which sprint columns to sum based on the release
  let startSprintCol, endSprintCol;
  
  if (releaseInfo.name === 'Release 1D') {
    // Sprint 30-33 = columns 4-7
    startSprintCol = 4;
    endSprintCol = 7;
  } else if (releaseInfo.name === 'Release 2A') {
    // Sprint 34-36 = columns 8-10
    startSprintCol = 8;
    endSprintCol = 10;
  } else {
    // Bug fixing phase: Sprint 37-38 = columns 11-12
    startSprintCol = 11;
    endSprintCol = 12;
  }
  
  // Find the committed and delivered rows
  mainSheet.eachRow((row, rowNum) => {
    const firstCell = row.getCell(1).value;
    const cellStr = String(firstCell || '').toUpperCase();
    
    // Sum up committed points for the release sprints
    if (cellStr.includes('TOTAL COMMITTED') && cellStr.includes('SPRINT')) {
      for (let col = startSprintCol; col <= endSprintCol; col++) {
        const val = row.getCell(col).value;
        if (val !== null && val !== undefined) {
          const numVal = typeof val === 'object' && val.result !== undefined ? val.result : val;
          if (typeof numVal === 'number') {
            releaseData.totalCommitted += numVal;
          }
        }
      }
    }
    
    // Sum up delivered points for the release sprints
    if (cellStr === 'STORY POINTS DELIVERED') {
      for (let col = startSprintCol; col <= endSprintCol; col++) {
        const val = row.getCell(col).value;
        if (val !== null && val !== undefined) {
          const numVal = typeof val === 'object' && val.result !== undefined ? val.result : val;
          if (typeof numVal === 'number') {
            releaseData.totalDelivered += numVal;
          }
        }
      }
    }
  });
  
  // Calculate percentage
  if (releaseData.totalCommitted > 0) {
    releaseData.percentageComplete = Math.round((releaseData.totalDelivered / releaseData.totalCommitted) * 100);
  }
  
  return releaseData;
}

// Update Progress sheet with daily velocity data for all dates
async function updateProgressSheet(workbook, targetVelocity, actualVelocity, projectData) {
  let progressSheet = workbook.getWorksheet('Progress');
  
  if (!progressSheet) {
    console.log('\n📈 Progress sheet not found - please ensure it exists with date columns');
    return;
  }
  
  console.log('\n📈 Updating Progress sheet...');
  
  // Read all sprint data from the main sheet to get target velocities
  const mainSheet = workbook.worksheets[0];
  const headerRow = mainSheet.getRow(1);
  const sprintDataList = [];
  
  // First, find the "TOTAL Committed Story Points Per Sprint" row
  let committedPointsRow = null;
  mainSheet.eachRow((row, rowNum) => {
    const firstCell = row.getCell(1).value;
    const cellStr = String(firstCell || '').toUpperCase();
    
    if (cellStr.includes('TOTAL COMMITTED') && cellStr.includes('SPRINT')) {
      committedPointsRow = row;
    }
  });
  
  // Calculate total committed for Sprints 31, 32, 33 (Release 1D) for burndown
  let totalRelease1DCommitted = 0;
  if (committedPointsRow) {
    // Sprint 31 = column 5, Sprint 32 = column 6, Sprint 33 = column 7
    for (let col = 5; col <= 7; col++) {
      const val = committedPointsRow.getCell(col).value;
      if (val !== null && val !== undefined) {
        const numVal = typeof val === 'object' && val.result !== undefined ? val.result : val;
        if (typeof numVal === 'number') {
          totalRelease1DCommitted += numVal;
        }
      }
    }
  }
  
  console.log(`   ✓ Release 1D Total Committed (Sprints 31-33): ${totalRelease1DCommitted} points`);
  
  // Parse sprint dates and calculate target velocities
  headerRow.eachCell((cell, colNumber) => {
    const cellValue = String(cell.value || '');
    if (cellValue.includes('Sprint ')) {
      const sprintNumber = parseInt(cellValue.replace('Sprint ', ''));
      
      // Get the date from row 2
      const dateCell = mainSheet.getRow(2).getCell(colNumber);
      let startDate = null;
      
      if (dateCell.value) {
        let dateVal = dateCell.value;
        if (dateVal && typeof dateVal === 'object' && dateVal.result !== undefined) {
          dateVal = dateVal.result;
        }
        
        if (dateVal instanceof Date) {
          startDate = new Date(dateVal);
        } else if (typeof dateVal === 'number') {
          startDate = excelDateToJSDate(dateVal);
        } else if (typeof dateVal === 'string') {
          startDate = parseSprintDate(dateVal);
        }
      }
      
      if (startDate && committedPointsRow) {
        startDate.setHours(0, 0, 0, 0);
        
        // Get committed points for this sprint from the row we found
        let committedPoints = 0;
        const val = committedPointsRow.getCell(colNumber).value;
        if (val !== null && val !== undefined) {
          committedPoints = typeof val === 'object' && val.result !== undefined ? val.result : val;
        }
        
        // Calculate S-curve distribution (10 working days per sprint)
        const workingDays = 10;
        const sCurveDistribution = distributeSCurve(committedPoints, workingDays);
        
        sprintDataList.push({
          sprintNumber,
          startDate,
          committedPoints,
          workingDays,
          sCurveDistribution
        });
      }
    }
  });
  
  console.log(`   ✓ Found ${sprintDataList.length} sprints with velocity data`);
  
  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Iterate through all date columns in Progress sheet and populate rows 2 and 3
  const progressHeaderRow = progressSheet.getRow(1);
  let todayColumn = null;
  let updatedCells = 0;
  
  progressHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber === 1) return; // Skip the label column
    
    let cellValue = cell.value;
    let cellDate = null;
    
    // Handle formula objects with result property
    if (cellValue && typeof cellValue === 'object' && cellValue.result !== undefined) {
      cellValue = cellValue.result;
    }
    
    // Parse the date
    if (cellValue instanceof Date) {
      cellDate = new Date(cellValue);
      cellDate.setHours(0, 0, 0, 0);
    } else if (typeof cellValue === 'number') {
      cellDate = excelDateToJSDate(cellValue);
      cellDate.setHours(0, 0, 0, 0);
    } else if (typeof cellValue === 'string') {
      const parts = cellValue.split('/');
      if (parts.length === 3) {
        cellDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        cellDate.setHours(0, 0, 0, 0);
      }
    }
    
    if (!cellDate) return;
    
    // Check if this is today
    if (cellDate.getTime() === today.getTime()) {
      todayColumn = colNumber;
    }
    
    // Find which sprint this date belongs to and calculate working day
    let sprintVelocity = 0;
    for (let i = 0; i < sprintDataList.length; i++) {
      const sprint = sprintDataList[i];
      const nextSprint = sprintDataList[i + 1];
      
      // Check if date falls within this sprint (before next sprint starts or after last sprint)
      if (cellDate >= sprint.startDate) {
        if (!nextSprint || cellDate < nextSprint.startDate) {
          // Calculate which working day this is within the sprint (0-based)
          let workingDayIndex = 0;
          let tempDate = new Date(sprint.startDate);
          
          while (tempDate < cellDate) {
            const tempDayOfWeek = tempDate.getDay();
            // Count only weekdays
            if (tempDayOfWeek !== 0 && tempDayOfWeek !== 6) {
              workingDayIndex++;
            }
            tempDate.setDate(tempDate.getDate() + 1);
          }
          
          // Get S-curve value for this working day
          if (workingDayIndex < sprint.sCurveDistribution.length) {
            sprintVelocity = sprint.sCurveDistribution[workingDayIndex];
          }
          break;
        }
      }
    }
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = cellDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      sprintVelocity = 0;
    }
    
    // Update row 2 with S-curve target velocity for this date
    if (sprintVelocity > 0) {
      progressSheet.getRow(2).getCell(colNumber).value = Math.round(sprintVelocity * 10) / 10;
      updatedCells++;
    }
  });
  
  console.log(`   ✓ Updated ${updatedCells} cells in Row 2 with target velocities`);
  
  // Update today's actual velocity in row 3
  if (todayColumn) {
    console.log(`   ✓ Found today's date (${today.toLocaleDateString('en-GB')}) in column ${todayColumn}`);
    
    const actualCell = progressSheet.getRow(3).getCell(todayColumn);
    actualCell.value = actualVelocity;
    
    // Remove any existing color formatting
    actualCell.fill = null;
    actualCell.font = null;
    
    // Get today's target velocity from Row 2 (S-curve value)
    const todayTargetVelocity = progressSheet.getRow(2).getCell(todayColumn).value || 0;
    
    // Determine status for logging
    let statusLabel;
    if (actualVelocity >= todayTargetVelocity) {
      statusLabel = 'On Track';
    } else if (actualVelocity >= todayTargetVelocity * 0.8) {
      statusLabel = 'At Risk';
    } else {
      statusLabel = 'Off Track';
    }
    
    console.log(`   ✓ Updated Row 3 (Actual Velocity): ${actualVelocity} pts/day (Target: ${todayTargetVelocity}) [${statusLabel}]`);
  } else {
    console.log(`   ⚠️  Could not find today's date (${today.toLocaleDateString('en-GB')}) in Progress sheet`);
  }
  
  // Calculate cumulative values for rows 4, 5, and 6
  console.log('   Calculating cumulative and burndown values...');
  
  let cumulativeCommitted = 0;
  let cumulativeActual = 0;
  let cumulativeUpdates = 0;
  
  progressHeaderRow.eachCell((cell, colNumber) => {
    if (colNumber === 1) return; // Skip the label column
    
    // Parse the date for this column
    let cellValue = cell.value;
    if (cellValue && typeof cellValue === 'object' && cellValue.result !== undefined) {
      cellValue = cellValue.result;
    }
    
    let cellDate = null;
    if (cellValue instanceof Date) {
      cellDate = new Date(cellValue);
      cellDate.setHours(0, 0, 0, 0);
    } else if (typeof cellValue === 'number') {
      cellDate = excelDateToJSDate(cellValue);
      cellDate.setHours(0, 0, 0, 0);
    }
    
    // Check if this column is today or before
    const isOnOrBeforeToday = cellDate && cellDate.getTime() <= today.getTime();
    
    // Get target and actual values for this day
    const targetVal = progressSheet.getRow(2).getCell(colNumber).value;
    const actualVal = progressSheet.getRow(3).getCell(colNumber).value;
    
    // Add to cumulative committed if there's a target value
    if (targetVal !== null && targetVal !== undefined && typeof targetVal === 'number') {
      cumulativeCommitted += targetVal;
    }
    
    // Add to cumulative actual if there's an actual value
    if (actualVal !== null && actualVal !== undefined && typeof actualVal === 'number') {
      cumulativeActual += actualVal;
    }
    
    // Row 4: Cumulative Committed
    if (cumulativeCommitted > 0) {
      progressSheet.getRow(4).getCell(colNumber).value = Math.round(cumulativeCommitted * 10) / 10;
    }
    
    // Row 5: Cumulative Actual
    if (cumulativeActual > 0) {
      progressSheet.getRow(5).getCell(colNumber).value = Math.round(cumulativeActual * 10) / 10;
    }
    
    // Row 6: Variance (Cumulative Actual - Cumulative Committed)
    // Only calculate variance up to and including today
    if (cumulativeCommitted > 0 && isOnOrBeforeToday) {
      const variance = cumulativeActual - cumulativeCommitted;
      progressSheet.getRow(6).getCell(colNumber).value = Math.round(variance * 10) / 10;
    } else {
      // Clear variance for future days
      progressSheet.getRow(6).getCell(colNumber).value = null;
    }
    
    // Row 7: Burndown (Release 1D Total - Cumulative Actual)
    if (totalRelease1DCommitted > 0) {
      const burndown = totalRelease1DCommitted - cumulativeActual;
      progressSheet.getRow(7).getCell(colNumber).value = Math.round(burndown * 10) / 10;
      cumulativeUpdates++;
    }
  });
  
  console.log(`   ✓ Updated ${cumulativeUpdates} cells with cumulative and burndown values`);
}

// Read design progress from Designs sheet
async function readDesignProgress(workbook) {
  const designSheet = workbook.getWorksheet('Designs');
  const designs = [];
  
  if (!designSheet) {
    console.log('⚠️  Designs sheet not found - skipping design progress');
    return designs;
  }
  
  console.log('\n📐 Reading design progress...');
  
  designSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // Skip header row
    
    const epicName = row.getCell(1).value;
    let percentComplete = row.getCell(2).value;
    
    if (epicName && percentComplete !== null && percentComplete !== undefined) {
      // Handle formula results
      if (typeof percentComplete === 'object' && percentComplete.result !== undefined) {
        percentComplete = percentComplete.result;
      }
      
      // Convert to number and ensure it's a percentage (0-100)
      percentComplete = typeof percentComplete === 'number' ? percentComplete : parseFloat(percentComplete);
      
      if (!isNaN(percentComplete)) {
        // If it's already a decimal (0-1), convert to percentage
        if (percentComplete <= 1) {
          percentComplete = percentComplete * 100;
        }
        
        designs.push({
          epic: String(epicName).trim(),
          percentComplete: Math.round(percentComplete)
        });
      }
    }
  });
  
  console.log(`   ✓ Found ${designs.length} epics with design progress`);
  return designs;
}

// Read project-level data from main sheet
async function readProjectData(workbook) {
  const mainSheet = workbook.worksheets[0]; // First sheet is the main plan
  
  const projectData = {
    totalProjectPoints: 0,
    totalDelivered: 0,
    totalRemaining: 0,
    deliveredPercentage: 0,
    lastSprintEndDate: null,
    workingDaysRemaining: 0,
    requiredDailyVelocity: 0
  };
  
  // Find the TOTAL PROJECT REMAINING STORY POINTS row
  mainSheet.eachRow((row, rowNum) => {
    const firstCell = row.getCell(1).value;
    const cellStr = String(firstCell || '').toUpperCase();
    
    // Get total remaining from row 59
    if (cellStr.includes('TOTAL PROJECT') && cellStr.includes('REMAIN')) {
      const val = row.getCell(2).value;
      projectData.totalRemaining = val !== null && val !== undefined ? 
        (typeof val === 'object' && val.result !== undefined ? val.result : val) : 0;
    }
    
    // Get total delivered across all sprints (row 50)
    if (cellStr === 'STORY POINTS DELIVERED') {
      let total = 0;
      for (let col = 2; col <= 12; col++) { // Sprints are in columns 2-12
        const val = row.getCell(col).value;
        if (val !== null && val !== undefined) {
          const numVal = typeof val === 'object' && val.result !== undefined ? val.result : val;
          if (typeof numVal === 'number') {
            total += numVal;
          }
        }
      }
      projectData.totalDelivered = total;
    }
  });
  
  // Calculate total project points
  projectData.totalProjectPoints = projectData.totalRemaining + projectData.totalDelivered;
  projectData.deliveredPercentage = projectData.totalProjectPoints > 0 
    ? Math.round((projectData.totalDelivered / projectData.totalProjectPoints) * 100) 
    : 0;
  
  // Find the last sprint end date (Sprint 38, column 12)
  // Row 2 should have the end date
  const lastSprintDateCell = mainSheet.getRow(2).getCell(12).value;
  if (lastSprintDateCell && typeof lastSprintDateCell === 'object' && lastSprintDateCell.result) {
    // It's a formula, get the result
    const dateVal = lastSprintDateCell.result;
    if (typeof dateVal === 'number') {
      // Excel serial date
      projectData.lastSprintEndDate = excelDateToJSDate(dateVal);
    } else {
      projectData.lastSprintEndDate = new Date(dateVal);
    }
  } else if (typeof lastSprintDateCell === 'number') {
    projectData.lastSprintEndDate = excelDateToJSDate(lastSprintDateCell);
  } else if (lastSprintDateCell) {
    projectData.lastSprintEndDate = new Date(lastSprintDateCell);
  }
  
  // Calculate working days remaining from today to end of last sprint
  if (projectData.lastSprintEndDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let workingDays = 0;
    const currentDate = new Date(today);
    
    while (currentDate <= projectData.lastSprintEndDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    projectData.workingDaysRemaining = workingDays;
    projectData.requiredDailyVelocity = workingDays > 0 
      ? Math.round((projectData.totalRemaining / workingDays) * 10) / 10 
      : 0;
  }
  
  return projectData;
}

// Helper function to convert Excel date serial to JS Date
function excelDateToJSDate(serial) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

// Helper function to parse sprint date string (e.g., "06-Nov")
function parseSprintDate(dateStr) {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const parts = dateStr.toLowerCase().split('-');
  
  if (parts.length === 2) {
    const day = parseInt(parts[0]);
    const monthIndex = months.indexOf(parts[1]);
    
    if (monthIndex !== -1 && !isNaN(day)) {
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, monthIndex, day);
    }
  }
  
  return null;
}

// Read sprint data from Excel
async function readSprintData(sprintNumber) {
  const filePath = path.join(__dirname, '..', 'data', 'NH Story Point Plan.xlsx');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }
  
  console.log(`Reading data from ${filePath}...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const sheetName = `Sprint ${sprintNumber}`;
  const worksheet = workbook.getWorksheet(sheetName);
  
  if (!worksheet) {
    throw new Error(`Sprint sheet "${sheetName}" not found. Available sheets: ${workbook.worksheets.map(w => w.name).join(', ')}`);
  }
  
  console.log(`Found sheet: ${sheetName}`);
  
  // Extract data from the worksheet
  const data = {
    sprintNumber,
    sprintName: sheetName,
    dates: [],
    epics: [],
    committedByDay: [],
    deliveredByDay: [],
    remainingByDay: [],
    totalCommitted: 0,
    totalDelivered: 0,
    deliveryPercentage: 0,
    startDate: null,
    endDate: null
  };
  
  // Read header row to get dates (row 1)
  const headerRow = worksheet.getRow(1);
  for (let col = 2; col <= 15; col++) {
    const dateValue = headerRow.getCell(col).value;
    if (dateValue) {
      data.dates.push(dateValue);
    }
  }
  
  // Set start and end dates
  if (data.dates.length > 0) {
    data.startDate = data.dates[0];
    data.endDate = data.dates[data.dates.length - 1];
  }
  
  // Find the summary rows
  let committedRowNum = null;
  let deliveredRowNum = null;
  let remainingRowNum = null;
  
  worksheet.eachRow((row, rowNumber) => {
    const firstCell = row.getCell(1).value;
    if (firstCell === 'Story Points Committed') {
      committedRowNum = rowNumber;
    } else if (firstCell === 'Story Points Delivered') {
      deliveredRowNum = rowNumber;
    } else if (firstCell === 'Story Points Remaining') {
      remainingRowNum = rowNumber;
    }
  });
  
  if (!committedRowNum || !deliveredRowNum) {
    throw new Error('Could not find summary rows in the sprint sheet');
  }
  
  // Read committed points by day
  const committedRow = worksheet.getRow(committedRowNum);
  for (let col = 2; col <= 15; col++) {
    const value = committedRow.getCell(col).value;
    data.committedByDay.push(value || 0);
    data.totalCommitted += (value || 0);
  }
  
  // Read delivered points by day
  const deliveredRow = worksheet.getRow(deliveredRowNum);
  for (let col = 2; col <= 15; col++) {
    const value = deliveredRow.getCell(col).value;
    data.deliveredByDay.push(value || 0);
    data.totalDelivered += (value || 0);
  }
  
  // Round totals for report display
  data.totalCommitted = Math.round(data.totalCommitted);
  data.totalDelivered = Math.round(data.totalDelivered);
  
  // Calculate remaining by day (cumulative)
  let cumulativeCommitted = 0;
  let cumulativeDelivered = 0;
  for (let i = 0; i < data.committedByDay.length; i++) {
    cumulativeCommitted += data.committedByDay[i];
    cumulativeDelivered += data.deliveredByDay[i];
    data.remainingByDay.push(cumulativeCommitted - cumulativeDelivered);
  }
  
  // Calculate delivery percentage
  if (data.totalCommitted > 0) {
    data.deliveryPercentage = Math.round((data.totalDelivered / data.totalCommitted) * 100);
  }
  
  // Calculate velocity metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Count working days elapsed
  let workingDaysElapsed = 0;
  let totalWorkingDays = 0;
  
  for (let i = 0; i < data.dates.length; i++) {
    const dateValue = data.dates[i];
    let dayDate;
    
    // Parse the date string (DD/MM/YYYY)
    if (typeof dateValue === 'string') {
      const parts = dateValue.split('/');
      dayDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      dayDate = new Date(dateValue);
    }
    dayDate.setHours(0, 0, 0, 0);
    
    // Check if it's a weekend
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    
    if (!isWeekend) {
      totalWorkingDays++;
      if (dayDate <= today) {
        workingDaysElapsed++;
      }
    }
  }
  
  data.workingDaysElapsed = workingDaysElapsed;
  data.totalWorkingDays = totalWorkingDays;
  
  // Calculate target velocity (points that should be delivered per day to meet commitment)
  data.targetVelocity = totalWorkingDays > 0 ? 
    Math.round((data.totalCommitted / totalWorkingDays) * 10) / 10 : 0;
  
  // Calculate current velocity (points per working day)
  data.currentVelocity = workingDaysElapsed > 0 ? 
    Math.round((data.totalDelivered / workingDaysElapsed) * 10) / 10 : 0;
  
  // Predicted total at current rate
  data.predictedTotal = Math.round(data.currentVelocity * totalWorkingDays);
  
  // Calculate velocity uplift needed to meet commitment
  const remainingDays = totalWorkingDays - workingDaysElapsed;
  const remainingPoints = data.totalCommitted - data.totalDelivered;
  
  if (remainingDays > 0 && data.currentVelocity > 0) {
    const requiredVelocity = remainingPoints / remainingDays;
    data.velocityUpliftNeeded = Math.round(((requiredVelocity / data.currentVelocity) - 1) * 100);
  } else {
    data.velocityUpliftNeeded = 0;
  }
  
  // Read epic data (rows 2 to committedRowNum - 1)
  // Track BUGS and STABILIZATION committed points for proportional breakdown
  let bugsCommitted = 0;
  let stabilizationCommitted = 0;
  
  console.log('\nAnalyzing epic breakdown...');
  
  for (let rowNum = 2; rowNum < committedRowNum; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const epicName = row.getCell(1).value;
    
    if (!epicName || epicName === '') continue;
    
    let epicCommitted = 0;
    
    for (let col = 2; col <= 15; col++) {
      const committedValue = row.getCell(col).value || 0;
      epicCommitted += committedValue;
    }
    
    // Check if this epic is BUGS or STABILIZATION (with various spellings)
    const epicNameUpper = String(epicName).toUpperCase().trim();
    
    if (epicNameUpper === 'BUGS' || epicNameUpper === 'BUG') {
      console.log(`  Found BUGS row: ${epicCommitted} points`);
      bugsCommitted += epicCommitted;
    } else if (epicNameUpper === 'STABILIZATION' || 
               epicNameUpper === 'STABILISATION' ||
               epicNameUpper === 'STABILIZE' ||
               epicNameUpper === 'STABLIZE' ||
               epicNameUpper === 'STABLISATION' ||
               epicNameUpper.includes('STABIL') ||
               epicNameUpper.includes('STABL')) {
      console.log(`  Found STABILIZATION row ("${epicName}"): ${epicCommitted} points`);
      stabilizationCommitted += epicCommitted;
    }
    
    data.epics.push({
      name: epicName,
      committed: epicCommitted,
      delivered: 0 // We don't track epic-level delivered in the current sheet structure
    });
  }
  
  // Calculate breakdown of delivered work based on proportions of committed work
  // Assume delivered work is distributed proportionally to committed work
  const bugsRatio = data.totalCommitted > 0 ? bugsCommitted / data.totalCommitted : 0;
  const stabilizationRatio = data.totalCommitted > 0 ? stabilizationCommitted / data.totalCommitted : 0;
  
  data.bugsCommitted = Math.round(bugsCommitted);
  data.stabilizationCommitted = Math.round(stabilizationCommitted);
  data.featureWorkCommitted = Math.round(data.totalCommitted - bugsCommitted - stabilizationCommitted);
  
  data.bugsDelivered = Math.round(data.totalDelivered * bugsRatio);
  data.stabilizationDelivered = Math.round(data.totalDelivered * stabilizationRatio);
  data.featureWorkDelivered = Math.round(data.totalDelivered - data.bugsDelivered - data.stabilizationDelivered);
  
  console.log(`✅ Data loaded: ${data.totalCommitted} committed, ${data.totalDelivered} delivered (${data.deliveryPercentage}%)`);
  console.log(`   Breakdown - Committed: ${data.featureWorkCommitted} features, ${data.bugsCommitted} bugs, ${data.stabilizationCommitted} stabilization`);
  console.log(`   Breakdown - Delivered: ${data.featureWorkDelivered} features, ${data.bugsDelivered} bugs, ${data.stabilizationDelivered} stabilization`);
  
  return data;
}

// Determine sprint status based on delivery percentage
function getSprintStatus(deliveryPercentage) {
  if (deliveryPercentage >= 90) {
    return { status: 'On Track', color: COLORS.secondary };
  } else if (deliveryPercentage >= 70) {
    return { status: 'At Risk', color: COLORS.warning };
  } else {
    return { status: 'Off Track', color: COLORS.danger };
  }
}

// Main function
async function generateReport() {
  try {
    const { sprintNumber } = parseArgs();
    
    console.log(`\n📊 Generating Sprint ${sprintNumber} Report...`);
    console.log('='.repeat(50));
    
    // Read sprint data
    const sprintData = await readSprintData(sprintNumber);
    
    // Add release information
    sprintData.release = getReleaseInfo(sprintNumber);
    console.log(`   Release: ${sprintData.release.name} (ends at Sprint ${sprintData.release.endSprint})`);
    
    // Read project-level data
    console.log('\nReading project-level data...');
    const filePath = path.join(__dirname, '..', 'data', 'NH Story Point Plan.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const projectData = await readProjectData(workbook);
    
    // Read delivered today value
    const deliveredToday = await readDeliveredToday(workbook, sprintNumber);
    sprintData.deliveredToday = deliveredToday;
    console.log(`   Delivered Today: ${deliveredToday} points`);
    
    // Read release-level data
    const releaseData = await readReleaseData(workbook, sprintData.release);
    sprintData.releaseData = releaseData;
    console.log(`\n📦 Release Data: ${releaseData.releaseName}`);
    console.log(`   Total Committed: ${releaseData.totalCommitted} points`);
    console.log(`   Total Delivered: ${releaseData.totalDelivered} points`);
    console.log(`   Percentage Complete: ${releaseData.percentageComplete}%`);
    
    // Calculate overrun/underrun based on current sprint velocity
    if (sprintData.currentVelocity > 0) {
      const daysNeededAtCurrentVelocity = projectData.totalRemaining / sprintData.currentVelocity;
      projectData.daysOverrun = Math.round(daysNeededAtCurrentVelocity - projectData.workingDaysRemaining);
      projectData.isOverrun = projectData.daysOverrun > 0;
      
      console.log(`   Days needed at current velocity (${sprintData.currentVelocity.toFixed(1)} pts/day): ${Math.round(daysNeededAtCurrentVelocity)} days`);
      if (projectData.isOverrun) {
        console.log(`   ⚠️  Project will OVERRUN by ${projectData.daysOverrun} working days`);
      } else if (projectData.daysOverrun < 0) {
        console.log(`   ✅ Project will UNDERRUN by ${Math.abs(projectData.daysOverrun)} working days`);
      } else {
        console.log(`   ✅ Project on track to complete on time`);
      }
    }
    
    console.log(`✅ Project data: ${projectData.totalProjectPoints} total points, ${projectData.totalDelivered} delivered (${projectData.deliveredPercentage}%)`);
    console.log(`   ${projectData.workingDaysRemaining} working days remaining, required velocity: ${projectData.requiredDailyVelocity} pts/day`);
    
    // Merge project data into sprint data
    sprintData.projectData = projectData;
    
    // Read design progress
    const designProgress = await readDesignProgress(workbook);
    sprintData.designProgress = designProgress;
    
    // Update Progress sheet with today's velocity data
    await updateProgressSheet(workbook, sprintData.targetVelocity, sprintData.deliveredToday, projectData);
    
    // Save the workbook after updating Progress sheet
    try {
      await workbook.xlsx.writeFile(filePath);
      console.log('   ✓ Progress sheet saved to Excel file');
    } catch (err) {
      console.log(`   ⚠️  Could not save Progress sheet: ${err.message}`);
    }
    
    // Create PDF
    const outputPath = path.join(__dirname, '..', 'reports', `Sprint-${sprintNumber}-Report.pdf`);
    
    // Import report template
    const { generatePDF } = require('./templates/report-template');
    await generatePDF(sprintData, outputPath);
    
    console.log(`\n✅ Report generated successfully!`);
    console.log(`📄 Output: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Error generating report:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateReport();



