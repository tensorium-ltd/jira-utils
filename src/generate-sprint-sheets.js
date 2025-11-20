const ExcelJS = require('exceljs');
const path = require('path');
const axios = require('axios');

// Configuration for JIRA API
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';

// Disable SSL verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Get credentials from environment
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Helper function to check if a date is a weekend
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

// Helper function to format date as DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial) {
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  return null;
}

// Parse sprint name from header
function parseSprintHeader(header) {
  if (!header || typeof header !== 'string') return null;
  
  const match = header.match(/Sprint\s+(\d+)/i);
  if (!match) return null;
  
  return {
    sprintName: `Sprint ${match[1]}`,
    sprintNumber: match[1]
  };
}

// Parse date from Excel serial or string
function parseSprintDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's already a Date object (ExcelJS reads dates as Date objects)
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // If it's a formula object with a result (ExcelJS formula cells)
  if (typeof dateValue === 'object' && dateValue.result !== undefined) {
    const result = dateValue.result;
    if (typeof result === 'number') {
      return excelDateToJSDate(result);
    }
    if (result instanceof Date) {
      return result;
    }
  }
  
  // If it's a serial number
  if (typeof dateValue === 'number') {
    return excelDateToJSDate(dateValue);
  }
  
  return null;
}

// Generate array of dates for a 14-day sprint
function generateSprintDates(startDate) {
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push({
      date: new Date(date),
      isWeekend: isWeekend(date)
    });
  }
  return dates;
}

// Count working days in a sprint
function countWorkingDays(sprintDates) {
  return sprintDates.filter(d => !d.isWeekend).length;
}

// Distribute story points across working days (2 decimal places)
function distributePoints(totalPoints, workingDays) {
  if (totalPoints === 0 || workingDays === 0) return 0;
  return Math.round((totalPoints / workingDays) * 100) / 100;
}

/**
 * Create authenticated JIRA client
 */
function createJiraClient() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.log('⚠️  WARNING: JIRA credentials not found in environment variables');
    console.log('   Skipping Progress sheet updates (requires JIRA_EMAIL and JIRA_API_TOKEN)');
    return null;
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Get the date when an issue was completed
 */
function getCompletionDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  const completedStatuses = ['READY FOR RELEASE', 'CLOSED', 'DONE', 'COMPLETED'];
  
  for (let i = issue.changelog.histories.length - 1; i >= 0; i--) {
    const history = issue.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' && 
          completedStatuses.some(s => s === item.toString?.toUpperCase() || s === item.to)) {
        return history.created.split('T')[0];
      }
    }
  }

  const currentStatus = issue.fields.status.name.toUpperCase();
  if (completedStatuses.includes(currentStatus)) {
    return issue.fields.updated?.split('T')[0] || null;
  }

  return null;
}

/**
 * Get daily completed story points from JIRA for a sprint
 */
async function getDailyCompletedPoints(client, sprintName, sprintDates, storyPointsField) {
  if (!client) {
    return null;
  }

  try {
    console.log(`\n🔍 Fetching actual completion data from JIRA for ${sprintName}...`);
    
    // Get all issues in the sprint with changelog
    const searchResponse = await client.post('/rest/api/3/search/jql', {
      jql: `project = ${PROJECT_KEY} AND sprint = "${sprintName}" AND issuetype in (Story, Bug)`,
      maxResults: 1000
    });

    const allIssues = [];
    for (const issueRef of searchResponse.data.issues || []) {
      const key = issueRef.key || issueRef.id;
      if (!key) continue;
      
      try {
        const detailResponse = await client.get(`/rest/api/3/issue/${key}`, {
          params: {
            fields: `key,summary,status,${storyPointsField},issuetype,updated`,
            expand: 'changelog'
          }
        });
        allIssues.push(detailResponse.data);
      } catch (err) {
        console.warn(`   ⚠️  Could not fetch ${key}`);
      }
    }

    console.log(`   ✓ Fetched ${allIssues.length} issues from JIRA`);

    // Calculate daily completions
    const dailyPoints = {};
    const sprintStartDate = formatDateForJira(sprintDates[0].date);
    
    for (const issue of allIssues) {
      const completionDate = getCompletionDate(issue);
      if (!completionDate || completionDate < sprintStartDate) {
        continue;
      }

      const issueType = issue.fields.issuetype?.name;
      if (issueType !== 'Story' && issueType !== 'Bug') {
        continue;
      }

      let points = issue.fields[storyPointsField];
      if (!points || points === 0) {
        points = 2; // Default for Stories/Bugs without points
      }

      if (!dailyPoints[completionDate]) {
        dailyPoints[completionDate] = 0;
      }
      dailyPoints[completionDate] += points;
    }

    // Map to sprint days (0-13)
    const dailyArray = [];
    for (let i = 0; i < sprintDates.length; i++) {
      const dateStr = formatDateForJira(sprintDates[i].date);
      dailyArray.push(dailyPoints[dateStr] || 0);
    }

    const totalCompleted = dailyArray.reduce((sum, pts) => sum + pts, 0);
    console.log(`   ✓ ${totalCompleted} points completed across sprint`);

    return dailyArray;
  } catch (error) {
    console.error(`   ❌ Error fetching JIRA data: ${error.message}`);
    return null;
  }
}

/**
 * Format date for JIRA queries (YYYY-MM-DD)
 */
function formatDateForJira(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Discover the Story Points custom field
 */
async function discoverStoryPointsField(client) {
  if (!client) {
    return 'customfield_10003'; // Default
  }

  try {
    const response = await client.get('/rest/api/3/field');
    const storyPointsField = response.data.find(field => 
      field.name === 'Story Points' || 
      field.name === 'Story point estimate' ||
      field.key === 'customfield_10003'
    );
    
    return storyPointsField ? storyPointsField.key : 'customfield_10003';
  } catch (error) {
    console.warn(`   ⚠️  Could not discover Story Points field, using default`);
    return 'customfield_10003';
  }
}

/**
 * Update the Progress sheet with actual daily story points
 */
async function updateProgressSheet(workbook, sprints, client, storyPointsField) {
  const progressSheet = workbook.getWorksheet('Progress');
  if (!progressSheet) {
    console.log('\n⚠️  WARNING: "Progress" sheet not found in workbook');
    console.log('   Skipping Progress sheet updates');
    return;
  }

  console.log('\n📊 Updating Progress sheet with actual daily completions...');

  // Find the rows we need to update
  let actualRowNum = null;
  let cumulativeActualRowNum = null;
  let varianceRowNum = null;
  let plannedRowNum = null;
  let cumulativePlannedRowNum = null;

  progressSheet.eachRow((row, rowNumber) => {
    const firstCell = row.getCell(1).value;
    if (firstCell && typeof firstCell === 'string') {
      const cellValue = firstCell.trim();
      if (cellValue === 'Actual Story Points' || cellValue === 'Actual') {
        actualRowNum = rowNumber;
      } else if (cellValue === 'Cumulative Actual') {
        cumulativeActualRowNum = rowNumber;
      } else if (cellValue === 'Variance') {
        varianceRowNum = rowNumber;
      } else if (cellValue === 'Story Points Committed' || cellValue === 'Planned' || cellValue === 'Daily Planned') {
        plannedRowNum = rowNumber;
      } else if (cellValue === 'Cumulative Planned' || cellValue === 'Cumulative Committed') {
        cumulativePlannedRowNum = rowNumber;
      }
    }
  });

  if (!actualRowNum) {
    console.log('   ⚠️  Could not find "Actual Story Points" row in Progress sheet');
    return;
  }

  console.log(`   ✓ Found Actual row at line ${actualRowNum}`);
  if (cumulativeActualRowNum) console.log(`   ✓ Found Cumulative Actual row at line ${cumulativeActualRowNum}`);
  if (varianceRowNum) console.log(`   ✓ Found Variance row at line ${varianceRowNum}`);

  // Determine which sprint column to update (find the current or most recent sprint)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let targetSprint = null;
  for (const sprint of sprints) {
    const sprintEnd = new Date(sprint.startDate);
    sprintEnd.setDate(sprintEnd.getDate() + 13); // Sprint is 14 days (0-13)
    
    if (sprint.startDate <= today && sprintEnd >= today) {
      // Current sprint
      targetSprint = sprint;
      break;
    } else if (sprintEnd < today) {
      // Past sprint - keep track of most recent
      targetSprint = sprint;
    }
  }

  if (!targetSprint) {
    console.log('   ⚠️  No current or recent sprint found to update');
    return;
  }

  console.log(`   ✓ Updating data for ${targetSprint.sprintName}`);

  // Get daily completed points from JIRA
  const sprintDates = generateSprintDates(targetSprint.startDate);
  const dailyCompletedPoints = await getDailyCompletedPoints(client, targetSprint.sprintName, sprintDates, storyPointsField);

  if (!dailyCompletedPoints) {
    console.log('   ⚠️  Could not fetch daily completion data from JIRA');
    return;
  }

  // Find the column offset for this sprint (assumes Day 1, Day 2, etc. headers)
  // Typically Progress sheet has sprint days starting at column B (column 2)
  const startCol = 2; // Column B
  
  // Update Actual Story Points row
  const actualRow = progressSheet.getRow(actualRowNum);
  let cumulativePoints = 0;
  
  for (let dayIdx = 0; dayIdx < 14; dayIdx++) {
    const colNum = startCol + dayIdx;
    const points = dailyCompletedPoints[dayIdx] || 0;
    
    // Only fill in actual points up to today
    const dayDate = new Date(targetSprint.startDate);
    dayDate.setDate(dayDate.getDate() + dayIdx);
    dayDate.setHours(0, 0, 0, 0);
    
    if (dayDate <= today) {
      actualRow.getCell(colNum).value = points > 0 ? points : 0;
    }
  }
  
  console.log(`   ✓ Updated Actual Story Points row`);

  // Update Cumulative Actual row
  if (cumulativeActualRowNum) {
    const cumulativeRow = progressSheet.getRow(cumulativeActualRowNum);
    cumulativePoints = 0;
    
    for (let dayIdx = 0; dayIdx < 14; dayIdx++) {
      const colNum = startCol + dayIdx;
      const colLetter = String.fromCharCode(65 + colNum - 1); // Convert to Excel column letter
      
      const dayDate = new Date(targetSprint.startDate);
      dayDate.setDate(dayDate.getDate() + dayIdx);
      dayDate.setHours(0, 0, 0, 0);
      
      if (dayDate <= today) {
        // Use formula to sum actual points from day 1 to current day
        cumulativeRow.getCell(colNum).value = {
          formula: `SUM($B$${actualRowNum}:${colLetter}$${actualRowNum})`
        };
      }
    }
    
    console.log(`   ✓ Updated Cumulative Actual row with formulas`);
  }

  // Update Variance row (Planned - Actual)
  if (varianceRowNum) {
    const varianceRow = progressSheet.getRow(varianceRowNum);
    
    for (let dayIdx = 0; dayIdx < 14; dayIdx++) {
      const colNum = startCol + dayIdx;
      const colLetter = String.fromCharCode(65 + colNum - 1);
      
      const dayDate = new Date(targetSprint.startDate);
      dayDate.setDate(dayDate.getDate() + dayIdx);
      dayDate.setHours(0, 0, 0, 0);
      
      if (dayDate <= today) {
        // Variance = Cumulative Planned - Cumulative Actual
        if (cumulativePlannedRowNum && cumulativeActualRowNum) {
          varianceRow.getCell(colNum).value = {
            formula: `${colLetter}$${cumulativePlannedRowNum}-${colLetter}$${cumulativeActualRowNum}`
          };
        } else if (plannedRowNum && actualRowNum) {
          // Fallback: Daily Planned - Daily Actual
          varianceRow.getCell(colNum).value = {
            formula: `${colLetter}$${plannedRowNum}-${colLetter}$${actualRowNum}`
          };
        }
      }
    }
    
    if (cumulativePlannedRowNum && cumulativeActualRowNum) {
      console.log(`   ✓ Updated Variance row with formulas (Cumulative Planned - Cumulative Actual)`);
    } else if (plannedRowNum && actualRowNum) {
      console.log(`   ✓ Updated Variance row with formulas (Daily Planned - Daily Actual)`);
    } else {
      console.log(`   ⚠️  Could not update Variance row - missing Planned row reference`);
    }
  } else {
    console.log(`   ℹ️  No Variance row found - skipping variance calculations`);
  }

  console.log(`   ✅ Progress sheet updated successfully!`);
}

// Main function to generate sprint sheets
async function generateSprintSheets() {
  const filePath = path.join(__dirname, '..', 'data', 'NH Story Point Plan.xlsx');
  
  console.log('Reading workbook:', filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  // Get the first sheet (original data)
  const originalSheet = workbook.worksheets[0];
  
  // Read data from original sheet
  const data = [];
  originalSheet.eachRow((row, rowNumber) => {
    const rowData = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowData[colNumber - 1] = cell.value;
    });
    data.push(rowData);
  });
  
  if (data.length === 0) {
    console.error('No data found in the sheet');
    return;
  }
  
  const headers = data[0];
  const dateRow = data[1];
  console.log('Headers found:', headers.slice(0, 10));
  
  // Parse sprints from headers
  const sprints = [];
  
  for (let i = 1; i < headers.length; i++) {
    const sprintInfo = parseSprintHeader(headers[i]);
    if (sprintInfo && dateRow[i]) {
      const startDate = parseSprintDate(dateRow[i]);
      if (startDate) {
        sprintInfo.startDate = startDate;
        sprintInfo.columnIndex = i;
        sprints.push(sprintInfo);
        console.log(`Found sprint: ${sprintInfo.sprintName} starting ${formatDate(sprintInfo.startDate)}`);
      }
    }
  }
  
  if (sprints.length === 0) {
    console.error('No sprints found in headers');
    return;
  }
  
  // Look for Story Points Delivered row in the main sheet
  const deliveredPoints = {};
  console.log('\nLooking for Story Points Delivered row...');
  for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    if (!row || !row[0]) continue;
    
    const rowName = String(row[0]).trim();
    
    // Debug: show row names that might match
    if (rowName.toLowerCase().includes('delivered') || rowName.toLowerCase().includes('story')) {
      console.log(`  Found row: "${rowName}"`);
    }
    
    if (rowName === 'Story Points Delivered') {
      console.log('✓ Found Story Points Delivered row in main sheet');
      sprints.forEach(sprint => {
        const deliveredValue = row[sprint.columnIndex];
        console.log(`  ${sprint.sprintName}: raw value = ${deliveredValue}, type = ${typeof deliveredValue}`);
        let points = 0;
        
        // Handle different value types (number, string, formula object)
        if (deliveredValue !== null && deliveredValue !== undefined && deliveredValue !== '') {
          // If it's a formula object, get the result
          if (typeof deliveredValue === 'object' && deliveredValue.result !== undefined) {
            const result = deliveredValue.result;
            if (typeof result === 'number') {
              points = result;
            } else if (typeof result === 'string') {
              const parsed = parseFloat(result.trim());
              points = isNaN(parsed) ? 0 : parsed;
            }
            console.log(`    Formula result: ${points}`);
          } else {
            // Regular number or string
            const parsed = parseFloat(String(deliveredValue).trim());
            points = isNaN(parsed) ? 0 : parsed;
          }
        }
        
        deliveredPoints[sprint.sprintName] = points;
        if (points > 0) {
          console.log(`  ✓ ${sprint.sprintName}: ${points} points delivered`);
        }
      });
      break;
    }
  }
  
  if (Object.keys(deliveredPoints).length === 0) {
    console.log('⚠️  WARNING: No Story Points Delivered row found in main sheet');
  }
  
  // Extract epic names and their story points
  const epics = [];
  let sprint30Total = 0;
  console.log('\nExtracting epic points...');
  
  for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    if (!row || !row[0]) continue;
    
    const epicName = row[0];
    const epicNameStr = String(epicName).trim();
    
    // Stop processing if we hit "IGNORE BELOW" row (check various cases)
    const epicNameUpper = epicNameStr.toUpperCase();
    if (epicNameUpper === 'IGNORE BELOW' || epicNameUpper.includes('IGNORE')) {
      console.log(`  ✓ Reached "${epicNameStr}" marker - stopping epic extraction`);
      break;
    }
    
    // Debug: show what rows are being skipped
    const skipRows = [
      'Dates',
      'TOTALS',
      'TOTAL Committed Story Points Per Sprint',
      'Story Points Delivered'
    ];
    
    if (skipRows.includes(epicNameStr) || epicNameStr.toLowerCase().includes('total')) {
      console.log(`  Skipping row: "${epicNameStr}"`);
      
      // If it's a TOTALS row, let's see what the Sprint 30 total is
      if (epicNameStr === 'TOTALS' || epicNameStr === 'TOTAL Committed Story Points Per Sprint') {
        const sprint30Sprint = sprints.find(s => s.sprintName === 'Sprint 30');
        if (sprint30Sprint) {
          const totalValue = row[sprint30Sprint.columnIndex];
          let actualValue = totalValue;
          
          // Handle formula objects
          if (typeof totalValue === 'object' && totalValue !== null && totalValue.result !== undefined) {
            actualValue = totalValue.result;
          }
          
          console.log(`    This TOTALS row shows Sprint 30: ${actualValue}`);
        }
      }
      continue;
    }
    
    const sprintPoints = {};
    
    sprints.forEach(sprint => {
      const pointValue = row[sprint.columnIndex];
      let points = 0;
      if (pointValue !== null && pointValue !== undefined && pointValue !== '') {
        const parsed = parseFloat(String(pointValue).trim());
        points = isNaN(parsed) ? 0 : parsed;
      }
      sprintPoints[sprint.sprintName] = points;
      
      // Track Sprint 30 total for debugging
      if (sprint.sprintName === 'Sprint 30' && points > 0) {
        sprint30Total += points;
      }
    });
    
    epics.push({
      name: epicName,
      sprintPoints
    });
  }
  
  console.log(`Found ${epics.length} epics`);
  console.log(`Sprint 30 total from individual epics: ${sprint30Total}`);
  
  // Debug: Show all epics with Sprint 30 points
  console.log('\nAll epics with Sprint 30 points:');
  epics.forEach(epic => {
    const sprint30Points = epic.sprintPoints['Sprint 30'] || 0;
    if (sprint30Points > 0) {
      const epicNameUpper = String(epic.name).toUpperCase().trim();
      const marker = (epicNameUpper.includes('BUG') || epicNameUpper.includes('STABIL')) ? ' ⚠️' : '';
      console.log(`  "${epic.name}": ${sprint30Points} points${marker}`);
    }
  });
  
  // Generate a sheet for each sprint
  for (const sprint of sprints) {
    console.log(`\nGenerating sheet for ${sprint.sprintName}...`);
    
    const sprintDates = generateSprintDates(sprint.startDate);
    const workingDays = countWorkingDays(sprintDates);
    
    console.log(`  14 calendar days, ${workingDays} working days`);
    
    // Remove existing sheet if it exists
    const existingSheet = workbook.getWorksheet(sprint.sprintName);
    if (existingSheet) {
      console.log(`  Removing existing sheet "${sprint.sprintName}"...`);
      workbook.removeWorksheet(existingSheet.id);
    }
    
    // Create new worksheet
    const worksheet = workbook.addWorksheet(sprint.sprintName);
    
    // Add header row
    const headerRow = worksheet.getRow(1);
    headerRow.getCell(1).value = 'Epic';
    sprintDates.forEach((dateInfo, idx) => {
      headerRow.getCell(idx + 2).value = formatDate(dateInfo.date);
    });
    
    // Style header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;
    
    // Add epic data rows
    let currentRow = 2;
    epics.forEach(epic => {
      const totalPoints = epic.sprintPoints[sprint.sprintName] || 0;
      
      // Skip epics with 0 story points for this sprint
      if (totalPoints === 0) {
        return;
      }
      
      const pointsPerWorkingDay = distributePoints(totalPoints, workingDays);
      
      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = epic.name;
      
      sprintDates.forEach((dateInfo, idx) => {
        const points = dateInfo.isWeekend ? 0 : (totalPoints > 0 ? pointsPerWorkingDay : 0);
        // Use blank cell instead of 0 when no points allocated
        row.getCell(idx + 2).value = points > 0 ? points : null;
      });
      
      currentRow++;
    });
    
    // Add summary rows
    const committedRowNum = currentRow;
    const committedRow = worksheet.getRow(committedRowNum);
    committedRow.getCell(1).value = 'Story Points Committed';
    
    // Calculate daily totals (only for epics with points in this sprint)
    for (let dayIdx = 0; dayIdx < sprintDates.length; dayIdx++) {
      let dayTotal = 0;
      epics.forEach(epic => {
        const totalPoints = epic.sprintPoints[sprint.sprintName] || 0;
        
        // Skip epics with 0 points for this sprint
        if (totalPoints === 0) {
          return;
        }
        
        const pointsPerWorkingDay = distributePoints(totalPoints, workingDays);
        dayTotal += sprintDates[dayIdx].isWeekend ? 0 : (totalPoints > 0 ? pointsPerWorkingDay : 0);
      });
      // Use blank cell instead of 0 when no points allocated
      committedRow.getCell(dayIdx + 2).value = dayTotal > 0 ? dayTotal : null;
    }
    
    // Style committed row
    committedRow.font = { bold: true };
    committedRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
    };
    
    // Add Story Points Delivered row
    const deliveredRowNum = currentRow + 1;
    const deliveredRow = worksheet.getRow(deliveredRowNum);
    deliveredRow.getCell(1).value = 'Story Points Delivered';
    
    // Distribute delivered points from main sheet across days up to today
    const totalDelivered = deliveredPoints[sprint.sprintName] || 0;
    if (totalDelivered > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for comparison
      
      // Calculate which days have passed (from sprint start to today)
      let daysElapsed = 0;
      let workingDaysElapsed = 0;
      
      for (let dayIdx = 0; dayIdx < sprintDates.length; dayIdx++) {
        const dayDate = new Date(sprintDates[dayIdx].date);
        dayDate.setHours(0, 0, 0, 0);
        
        if (dayDate <= today) {
          daysElapsed = dayIdx + 1;
          if (!sprintDates[dayIdx].isWeekend) {
            workingDaysElapsed++;
          }
        }
      }
      
      // Distribute delivered points across working days elapsed
      if (workingDaysElapsed > 0) {
        const pointsPerDay = Math.round((totalDelivered / workingDaysElapsed) * 100) / 100;
        
        for (let dayIdx = 0; dayIdx < daysElapsed; dayIdx++) {
          if (!sprintDates[dayIdx].isWeekend) {
            deliveredRow.getCell(dayIdx + 2).value = pointsPerDay;
          } else {
            deliveredRow.getCell(dayIdx + 2).value = null; // Blank for weekends
          }
        }
        
        console.log(`  ${totalDelivered} delivered points distributed across ${workingDaysElapsed} working days (${pointsPerDay} pts/day)`);
      }
    }
    
    // Style delivered row
    deliveredRow.font = { bold: true };
    deliveredRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF2CC' }
    };
    
    // Empty row for spacing
    currentRow += 2;
    
    // Add Story Points Remaining row with formulas
    const remainingRowNum = currentRow + 1;
    const remainingRow = worksheet.getRow(remainingRowNum);
    remainingRow.getCell(1).value = 'Story Points Remaining';
    
    for (let dayIdx = 0; dayIdx < sprintDates.length; dayIdx++) {
      const colLetter = String.fromCharCode(66 + dayIdx); // B, C, D, etc.
      // Formula: Cumulative Committed - Cumulative Delivered
      remainingRow.getCell(dayIdx + 2).value = {
        formula: `SUM($B$${committedRowNum}:${colLetter}$${committedRowNum})-SUM($B$${deliveredRowNum}:${colLetter}$${deliveredRowNum})`
      };
    }
    
    remainingRow.font = { bold: true };
    
    // Add burndown chart data area
    currentRow = remainingRowNum + 2;
    
    // Day numbers row
    const dayRow = worksheet.getRow(currentRow);
    dayRow.getCell(1).value = 'Day';
    for (let day = 1; day <= 14; day++) {
      dayRow.getCell(day + 1).value = day;
    }
    dayRow.font = { bold: true };
    dayRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };
    
    // Points Remaining row (references to formulas above)
    const chartDataRow = worksheet.getRow(currentRow + 1);
    chartDataRow.getCell(1).value = 'Points Remaining';
    for (let day = 1; day <= 14; day++) {
      const colLetter = String.fromCharCode(65 + day); // B, C, D, etc.
      chartDataRow.getCell(day + 1).value = {
        formula: `${colLetter}${remainingRowNum}`
      };
    }
    
    // Add chart instructions
    currentRow += 3;
    const instrTitle = worksheet.getRow(currentRow);
    instrTitle.getCell(1).value = `To create burndown chart for ${sprint.sprintName}:`;
    instrTitle.font = { bold: true, color: { argb: 'FF0000FF' } };
    
    const instr1 = worksheet.getRow(currentRow + 1);
    instr1.getCell(1).value = '1. Select the Day and Points Remaining data above';
    
    const instr2 = worksheet.getRow(currentRow + 2);
    instr2.getCell(1).value = '2. Insert > Chart > Line Chart';
    
    const instr3 = worksheet.getRow(currentRow + 3);
    instr3.getCell(1).value = `3. Set chart title to "Burndown for ${sprint.sprintName}"`;
    
    // Set column widths
    worksheet.getColumn(1).width = 50; // Epic column
    for (let i = 2; i <= 15; i++) {
      worksheet.getColumn(i).width = 12; // Date columns
    }
    
    // Count epics with points in this sprint
    const epicsWithPoints = epics.filter(epic => (epic.sprintPoints[sprint.sprintName] || 0) > 0).length;
    console.log(`  Sheet "${sprint.sprintName}" created with ${epicsWithPoints} epics (${epics.length - epicsWithPoints} skipped) + summary rows + formatting`);
  }
  
  // Update Progress sheet with actual daily completions from JIRA
  const client = createJiraClient();
  if (client) {
    const storyPointsField = await discoverStoryPointsField(client);
    console.log(`   Using Story Points field: ${storyPointsField}`);
    await updateProgressSheet(workbook, sprints, client, storyPointsField);
  }

  // Write the updated workbook
  console.log('\nWriting updated workbook...');
  await workbook.xlsx.writeFile(filePath);
  console.log('✅ Done! Sprint sheets with full formatting have been added to the workbook.');
  
  return filePath;
}

// Run the script
(async () => {
  try {
    await generateSprintSheets();
  } catch (error) {
    console.error('Error generating sprint sheets:', error);
    console.error(error.stack);
    process.exit(1);
  }
})();
