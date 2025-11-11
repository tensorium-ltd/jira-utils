const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Configuration
const COLORS = {
  primary: '#4472C4',
  success: '#70AD47',
  warning: '#FFC000',
  danger: '#C55A11',
  gray: '#808080',
  lightGray: '#E7E6E6',
  darkGray: '#505050',
  white: '#FFFFFF',
  black: '#000000',
  dev: '#9966FF',
  qa: '#FF9933',
  completed: '#70AD47'
};

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Sprint number is required');
    console.log('\nUsage: npm run assignee-pdf <sprint-number>');
    console.log('Example: npm run assignee-pdf 31');
    process.exit(1);
  }
  
  return args[0];
}

// Load JSON data
function loadData(sprintNumber) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  const filename = `assignee-report-sprint-${sprintNumber}.json`;
  const filepath = path.join(reportsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Error: Report file not found: ${filepath}`);
    console.log('\nPlease run "npm run assignee-report" first to generate the data.');
    console.log(`Make sure CURRENT_SPRINT is set to "NH Sprint ${sprintNumber}" in generate-assignee-report.js`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return data;
}

// Format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate PDF Report
function generatePDF(data) {
  const doc = new PDFDocument({ 
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true
  });
  
  const outputDir = path.join(__dirname, '..', 'reports');
  // Extract sprint number from currentSprint (e.g., "NH Sprint 31" -> "31")
  const sprintNumber = data.currentSprint.match(/\d+/)?.[0] || 'unknown';
  const outputPath = path.join(outputDir, `assignee-report-sprint-${sprintNumber}.pdf`);
  
  doc.pipe(fs.createWriteStream(outputPath));
  
  // PAGE 1: Team Allocation
  drawHeader(doc, data);
  drawSummary(doc, data);
  
  // Draw team allocation if available
  if (data.teams && data.teams.length > 0) {
    drawTeamAllocation(doc, data);
  }
  
  // PAGE 2: Assignee Details
  doc.addPage();
  doc.fontSize(18)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text('Work Allocation by Assignee', 50, 50);
  
  doc.y = 80;
  
  drawWorkloadChart(doc, data);
  
  // Add assignee details
  let yPos = doc.y + 20;
  
  data.assignees.forEach((assignee, index) => {
    yPos = drawAssigneeSection(doc, assignee, index + 1, yPos);
  });
  
  // Add footers to all pages
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1, range.count);
  }
  
  doc.end();
  
  return outputPath;
}

// Draw header
function drawHeader(doc, data) {
  // Title
  doc.fontSize(24)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text('Team Assignee Report', 50, 50);
  
  // Date and Sprint
  doc.fontSize(12)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(formatDate(data.date), 50, 80);
  
  doc.fontSize(11)
     .fillColor(COLORS.darkGray)
     .text(`Sprint: ${data.currentSprint} | Project: ${data.project}`, 50, 100);
  
  // Horizontal line
  doc.moveTo(50, 120)
     .lineTo(doc.page.width - 50, 120)
     .strokeColor(COLORS.lightGray)
     .lineWidth(1)
     .stroke();
  
  doc.y = 140;
}

// Draw summary section
function drawSummary(doc, data) {
  const summary = data.summary;
  const startX = 50;
  const boxWidth = 120;
  const boxHeight = 70;
  const gap = 15;
  
  doc.fontSize(16)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Summary', startX, doc.y);
  
  doc.y += 20;
  const summaryY = doc.y;
  
  // Active Assignees
  drawMetricBox(doc, startX, summaryY, boxWidth, boxHeight, 
    summary.activeAssignees.toString(), 
    'Active Assignees', 
    COLORS.primary);
  
  // Today's Work
  drawMetricBox(doc, startX + boxWidth + gap, summaryY, boxWidth, boxHeight,
    `${summary.totalIssues} / ${summary.totalStoryPoints}`,
    'Issues / Points Today',
    COLORS.success);
  
  // Sprint Workload
  drawMetricBox(doc, startX + (boxWidth + gap) * 2, summaryY, boxWidth, boxHeight,
    `${summary.totalSprintIssues} / ${summary.totalSprintWorkload}`,
    'Sprint Issues / Points',
    COLORS.warning);
  
  // Unassigned
  if (summary.unassignedIssues > 0) {
    drawMetricBox(doc, startX + (boxWidth + gap) * 3, summaryY, boxWidth, boxHeight,
      `${summary.unassignedIssues} / ${summary.unassignedStoryPoints}`,
      'Unassigned',
      COLORS.danger);
  }
  
  doc.y = summaryY + boxHeight + 30;
}

// Draw metric box
function drawMetricBox(doc, x, y, width, height, value, label, color) {
  // Box
  doc.rect(x, y, width, height)
     .fillAndStroke(COLORS.white, color)
     .lineWidth(2);
  
  // Value
  doc.fontSize(20)
     .fillColor(color)
     .font('Helvetica-Bold')
     .text(value, x, y + 15, { width: width, align: 'center' });
  
  // Label
  doc.fontSize(9)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(label, x, y + height - 22, { width: width, align: 'center' });
}

// Draw team allocation section
function drawTeamAllocation(doc, data) {
  const startX = 50;
  const maxBarWidth = 480;
  
  // Check if we need a new page
  if (doc.y > 600) {
    doc.addPage();
  }
  
  doc.fontSize(16)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Sprint Allocation by Team', startX, doc.y);
  
  doc.y += 20;
  
  // Sort teams by total points descending
  const sortedTeams = [...data.teams].sort((a, b) => b.totalPoints - a.totalPoints);
  
  // Find max for scaling
  const maxPoints = Math.max(...sortedTeams.map(t => t.totalPoints));
  
  sortedTeams.forEach((team, index) => {
    const yPos = doc.y;
    
    // Check if we need a new page
    if (yPos > 700) {
      doc.addPage();
      doc.y = 50;
    }
    
    // Team name
    doc.fontSize(10)
       .fillColor(COLORS.black)
       .font('Helvetica-Bold')
       .text(team.name, startX, yPos, { width: 150, ellipsis: true });
    
    // Calculate bar widths
    const totalBarWidth = (team.totalPoints / maxPoints) * maxBarWidth;
    const completedBarWidth = (team.completedPoints / maxPoints) * maxBarWidth;
    const activeBarWidth = (team.activePoints / maxPoints) * maxBarWidth;
    
    const barY = yPos + 15;
    const barHeight = 18;
    
    // Draw total bar (background - light gray)
    doc.rect(startX, barY, totalBarWidth, barHeight)
       .fillAndStroke(COLORS.lightGray, COLORS.gray)
       .lineWidth(1);
    
    // Draw completed bar (green)
    if (completedBarWidth > 0) {
      doc.rect(startX, barY, completedBarWidth, barHeight)
         .fillAndStroke(COLORS.completed, COLORS.completed)
         .lineWidth(0);
    }
    
    // Draw active bar (orange) - stacked after completed
    if (activeBarWidth > 0) {
      doc.rect(startX + completedBarWidth, barY, activeBarWidth, barHeight)
         .fillAndStroke(COLORS.warning, COLORS.warning)
         .lineWidth(0);
    }
    
    // Percentage complete
    const percentComplete = team.totalPoints > 0 
      ? Math.round((team.completedPoints / team.totalPoints) * 100) 
      : 0;
    
    // Labels - show inline after the bar
    const labelX = startX + totalBarWidth + 8;
    doc.fontSize(8)
       .fillColor(COLORS.darkGray)
       .font('Helvetica')
       .text(`${team.totalPoints}pts | ${team.completedPoints} done (${percentComplete}%) | ${team.activePoints} active`, 
             labelX, barY + 4, { width: 200 });
    
    doc.y = barY + barHeight + 8;
  });
  
  // Legend
  doc.y += 10;
  const legendY = doc.y;
  const legendBoxSize = 12;
  const legendGap = 120;
  
  // Completed
  doc.rect(startX, legendY, legendBoxSize, legendBoxSize)
     .fillAndStroke(COLORS.completed, COLORS.completed);
  doc.fontSize(9)
     .fillColor(COLORS.darkGray)
     .font('Helvetica')
     .text('Completed', startX + legendBoxSize + 5, legendY + 2);
  
  // Active
  doc.rect(startX + legendGap, legendY, legendBoxSize, legendBoxSize)
     .fillAndStroke(COLORS.warning, COLORS.warning);
  doc.fontSize(9)
     .fillColor(COLORS.darkGray)
     .text('Active', startX + legendGap + legendBoxSize + 5, legendY + 2);
  
  // Not Started (gray)
  doc.rect(startX + legendGap * 2, legendY, legendBoxSize, legendBoxSize)
     .fillAndStroke(COLORS.lightGray, COLORS.gray);
  doc.fontSize(9)
     .fillColor(COLORS.darkGray)
     .text('Not Started', startX + legendGap * 2 + legendBoxSize + 5, legendY + 2);
  
  doc.y = legendY + legendBoxSize + 25;
}

// Draw workload chart
function drawWorkloadChart(doc, data) {
  const startX = 50;
  const barWidth = 500;
  const barHeight = 25;
  
  doc.fontSize(14)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Sprint Workload by Assignee', startX, doc.y);
  
  doc.y += 15;
  
  // Sort by sprint workload descending
  const sorted = [...data.assignees].sort((a, b) => 
    (b.currentSprintWorkload?.points || 0) - (a.currentSprintWorkload?.points || 0)
  );
  
  // Show top 10
  const top = sorted.slice(0, 10);
  const maxPoints = Math.max(...top.map(a => a.currentSprintWorkload?.points || 0));
  
  top.forEach(assignee => {
    const yPos = doc.y;
    const workload = assignee.currentSprintWorkload || { count: 0, points: 0 };
    
    // Assignee name
    doc.fontSize(10)
       .fillColor(COLORS.black)
       .font('Helvetica')
       .text(assignee.name.substring(0, 20), startX, yPos + 6, { width: 120 });
    
    // Stats
    doc.fontSize(8)
       .fillColor(COLORS.gray)
       .text(`${workload.count} issues`, startX + 130, yPos + 7);
    
    // Bar
    const barLength = maxPoints > 0 ? (workload.points / maxPoints) * (barWidth - 280) : 0;
    
    // Determine color based on workload
    let barColor = COLORS.success;
    if (workload.points > 15) {
      barColor = COLORS.danger;
    } else if (workload.points > 8) {
      barColor = COLORS.warning;
    }
    
    doc.rect(startX + 210, yPos + 3, barLength, 18)
       .fill(barColor);
    
    // Points label
    doc.fontSize(10)
       .fillColor(COLORS.white)
       .font('Helvetica-Bold')
       .text(workload.points.toString(), startX + 220, yPos + 6);
    
    doc.y = yPos + barHeight;
  });
  
  doc.y += 10;
}

// Draw assignee section
function drawAssigneeSection(doc, assignee, number, startY) {
  // Check if we need a new page
  if (startY > 650) {
    doc.addPage();
    startY = 50;
  }
  
  doc.y = startY;
  
  // Assignee header with number
  doc.fontSize(13)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text(`${number}. ${assignee.name}`, 50, doc.y);
  
  // Today's stats
  doc.fontSize(9)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(`Today: ${assignee.totalIssues} issues (${assignee.totalStoryPoints} pts) | ` +
           `Sprint: ${assignee.currentSprintWorkload?.count || 0} active (${assignee.currentSprintWorkload?.points || 0} pts)`,
           230, doc.y + 2);
  
  doc.y += 20;
  
  // Mini bars for today's work
  const startX = 50;
  const miniBarY = doc.y;
  
  // Today's activity mini chart
  doc.fontSize(9)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Today:', startX, miniBarY);
  
  const totalToday = assignee.totalStoryPoints || 1;
  let xOffset = startX + 45;
  
  if (assignee.inDev.points > 0) {
    const width = Math.max(30, (assignee.inDev.points / totalToday) * 100);
    doc.rect(xOffset, miniBarY - 2, width, 12)
       .fill(COLORS.dev);
    doc.fontSize(8)
       .fillColor(COLORS.white)
       .font('Helvetica-Bold')
       .text(`Dev ${assignee.inDev.points}`, xOffset + 3, miniBarY);
    xOffset += width + 5;
  }
  
  if (assignee.inQA.points > 0) {
    const width = Math.max(30, (assignee.inQA.points / totalToday) * 100);
    doc.rect(xOffset, miniBarY - 2, width, 12)
       .fill(COLORS.qa);
    doc.fontSize(8)
       .fillColor(COLORS.white)
       .font('Helvetica-Bold')
       .text(`QA ${assignee.inQA.points}`, xOffset + 3, miniBarY);
    xOffset += width + 5;
  }
  
  if (assignee.completed.points > 0) {
    const width = Math.max(30, (assignee.completed.points / totalToday) * 100);
    doc.rect(xOffset, miniBarY - 2, width, 12)
       .fill(COLORS.completed);
    doc.fontSize(8)
       .fillColor(COLORS.white)
       .font('Helvetica-Bold')
       .text(`Done ${assignee.completed.points}`, xOffset + 3, miniBarY);
  }
  
  doc.y = miniBarY + 20;
  
  // Sprint workload details
  if (assignee.currentSprintWorkload && assignee.currentSprintWorkload.count > 0) {
    doc.fontSize(9)
       .fillColor(COLORS.darkGray)
       .font('Helvetica-Bold')
       .text('Active Sprint Issues:', startX, doc.y);
    
    doc.y += 12;
    
    // Show first 5 issues
    const issues = assignee.currentSprintWorkload.issues.slice(0, 5);
    
    doc.fontSize(8)
       .fillColor(COLORS.black)
       .font('Helvetica');
    
    issues.forEach(issue => {
      if (doc.y > 720) {
        doc.addPage();
        doc.y = 50;
      }
      
      const issueY = doc.y;
      
      // Issue key
      if (issue.key) {
        doc.fillColor(COLORS.primary)
           .font('Helvetica-Bold')
           .text(issue.key, startX + 5, issueY, { width: 80 });
      }
      
      // Points
      doc.fillColor(COLORS.warning)
         .font('Helvetica-Bold')
         .text(`${issue.storyPoints}pt`, startX + 90, issueY, { width: 30 });
      
      // Status
      doc.fillColor(COLORS.gray)
         .font('Helvetica')
         .text(issue.status, startX + 125, issueY, { width: 80 });
      
      // Summary
      const summary = issue.summary ? (issue.summary.length > 50 ? issue.summary.substring(0, 47) + '...' : issue.summary) : '';
      doc.fillColor(COLORS.black)
         .text(summary, startX + 210, issueY, { width: 290 });
      
      doc.y = issueY + 12;
    });
    
    if (assignee.currentSprintWorkload.count > 5) {
      doc.fontSize(8)
         .fillColor(COLORS.gray)
         .font('Helvetica-Oblique')
         .text(`... and ${assignee.currentSprintWorkload.count - 5} more`, startX + 5, doc.y);
      doc.y += 12;
    }
  }
  
  // Separator line
  doc.moveTo(50, doc.y + 5)
     .lineTo(doc.page.width - 50, doc.y + 5)
     .strokeColor(COLORS.lightGray)
     .lineWidth(0.5)
     .stroke();
  
  doc.y += 15;
  
  return doc.y;
}

// Draw footer
function drawFooter(doc, pageNum, totalPages) {
  // Horizontal line
  doc.moveTo(50, doc.page.height - 70)
     .lineTo(doc.page.width - 50, doc.page.height - 70)
     .strokeColor(COLORS.lightGray)
     .lineWidth(1)
     .stroke();
  
  // Footer text
  doc.fontSize(8)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(
       `Generated on ${new Date().toLocaleString('en-GB')}`,
       50,
       doc.page.height - 55,
       { align: 'left' }
     );
  
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    50,
    doc.page.height - 55,
    { align: 'right' }
  );
}

// Main function
function main() {
  console.log('\n📊 Generating Assignee Report PDF...');
  console.log('='.repeat(60));
  
  const sprintNumber = parseArgs();
  console.log(`   Sprint: NH Sprint ${sprintNumber}`);
  
  // Load data
  console.log('\n📖 Loading data...');
  const data = loadData(sprintNumber);
  console.log(`   ✓ Loaded data for ${data.summary.activeAssignees} assignees`);
  
  // Generate PDF
  console.log('\n📄 Generating PDF...');
  const outputPath = generatePDF(data);
  
  console.log(`\n✅ PDF report generated successfully!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log('\n🎉 Done!');
}

// Run the script
main();

