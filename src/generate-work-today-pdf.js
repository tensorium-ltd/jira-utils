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
    // Default to today's date
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  return args[0];
}

// Load JSON data
function loadData(date) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  const filename = `work-done-today-${date}.json`;
  const filepath = path.join(reportsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Error: Report file not found: ${filepath}`);
    console.log('\nPlease run "npm run work-today" first to generate the data.');
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
  const outputPath = path.join(outputDir, `work-done-today-${data.date}.pdf`);
  
  doc.pipe(fs.createWriteStream(outputPath));
  
  // Draw the report
  drawHeader(doc, data);
  drawSummary(doc, data);
  drawTypeBreakdown(doc, data);
  drawStatusBreakdown(doc, data);
  
  // Add details sections
  let yPos = doc.y + 30;
  
  if (data.movedToDev.issues.length > 0) {
    yPos = drawIssueSection(doc, 'Moved to Development', data.movedToDev.issues, COLORS.dev, yPos);
  }
  
  if (data.movedToQA.issues.length > 0) {
    yPos = drawIssueSection(doc, 'Moved to QA', data.movedToQA.issues, COLORS.qa, yPos);
  }
  
  if (data.completed.issues.length > 0) {
    yPos = drawIssueSection(doc, 'Completed (Ready for Release / Closed)', data.completed.issues, COLORS.completed, yPos);
  }
  
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
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  // Title
  doc.fontSize(24)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text('Daily Work Report', 50, 50);
  
  // Date
  doc.fontSize(12)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(formatDate(data.date), 50, 80);
  
  // Project
  doc.fontSize(10)
     .fillColor(COLORS.darkGray)
     .text(`Project: ${data.project}`, 50, 100);
  
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
  const boxWidth = 150;
  const boxHeight = 80;
  const gap = 20;
  
  doc.fontSize(16)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Summary', startX, doc.y);
  
  doc.y += 20;
  const summaryY = doc.y;
  
  // Total Issues Box
  drawMetricBox(doc, startX, summaryY, boxWidth, boxHeight, 
    summary.totalIssues.toString(), 
    'Total Issues', 
    COLORS.primary);
  
  // Total Story Points Box
  drawMetricBox(doc, startX + boxWidth + gap, summaryY, boxWidth, boxHeight,
    summary.totalStoryPoints.toString(),
    'Total Story Points',
    COLORS.success);
  
  // Average Points per Issue
  const avgPoints = summary.totalIssues > 0 
    ? (summary.totalStoryPoints / summary.totalIssues).toFixed(1)
    : '0';
  drawMetricBox(doc, startX + (boxWidth + gap) * 2, summaryY, boxWidth, boxHeight,
    avgPoints,
    'Avg Points/Issue',
    COLORS.warning);
  
  doc.y = summaryY + boxHeight + 30;
}

// Draw metric box
function drawMetricBox(doc, x, y, width, height, value, label, color) {
  // Box
  doc.rect(x, y, width, height)
     .fillAndStroke(COLORS.white, color)
     .lineWidth(2);
  
  // Value
  doc.fontSize(32)
     .fillColor(color)
     .font('Helvetica-Bold')
     .text(value, x, y + 15, { width: width, align: 'center' });
  
  // Label
  doc.fontSize(10)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(label, x, y + height - 25, { width: width, align: 'center' });
}

// Draw type breakdown
function drawTypeBreakdown(doc, data) {
  const breakdown = data.summary.breakdown;
  const startX = 50;
  const barWidth = 500;
  const barHeight = 30;
  
  doc.fontSize(14)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Breakdown by Issue Type', startX, doc.y);
  
  doc.y += 15;
  
  // Sort by points descending
  const types = Object.entries(breakdown).sort((a, b) => b[1].points - a[1].points);
  
  types.forEach(([type, data]) => {
    const yPos = doc.y;
    
    // Type name and stats
    doc.fontSize(11)
       .fillColor(COLORS.black)
       .font('Helvetica')
       .text(`${type}:`, startX, yPos + 8);
    
    doc.fontSize(9)
       .fillColor(COLORS.gray)
       .text(`${data.count} issues, ${data.points} pts`, startX + 80, yPos + 9);
    
    // Bar
    const maxPoints = Math.max(...types.map(t => t[1].points));
    const barLength = maxPoints > 0 ? (data.points / maxPoints) * (barWidth - 200) : 0;
    
    doc.rect(startX + 200, yPos + 5, barLength, 20)
       .fill(getColorForType(type));
    
    // Points label
    doc.fontSize(10)
       .fillColor(COLORS.black)
       .font('Helvetica-Bold')
       .text(data.points.toString(), startX + 210 + barLength, yPos + 8);
    
    doc.y = yPos + barHeight;
  });
  
  doc.y += 10;
}

// Draw status breakdown
function drawStatusBreakdown(doc, data) {
  const summary = data.summary;
  const startX = 50;
  const barWidth = 500;
  const barHeight = 35;
  
  doc.fontSize(14)
     .fillColor(COLORS.black)
     .font('Helvetica-Bold')
     .text('Breakdown by Status', startX, doc.y);
  
  doc.y += 15;
  
  const statuses = [
    { label: 'Moved to Dev', issues: summary.movedToDevIssues, points: summary.movedToDevStoryPoints, color: COLORS.dev },
    { label: 'Moved to QA', issues: summary.movedToQAIssues, points: summary.movedToQAStoryPoints, color: COLORS.qa },
    { label: 'Completed', issues: summary.completedIssues, points: summary.completedStoryPoints, color: COLORS.completed }
  ];
  
  const maxPoints = Math.max(...statuses.map(s => s.points));
  
  statuses.forEach(status => {
    if (status.issues > 0) {
      const yPos = doc.y;
      
      // Status name and stats
      doc.fontSize(11)
         .fillColor(COLORS.black)
         .font('Helvetica-Bold')
         .text(status.label, startX, yPos + 10);
      
      doc.fontSize(9)
         .fillColor(COLORS.gray)
         .font('Helvetica')
         .text(`${status.issues} issues, ${status.points} pts`, startX + 180, yPos + 11);
      
      // Bar
      const barLength = maxPoints > 0 ? (status.points / maxPoints) * (barWidth - 330) : 0;
      
      doc.rect(startX + 310, yPos + 5, barLength, 25)
         .fill(status.color);
      
      // Points label
      doc.fontSize(11)
         .fillColor(COLORS.white)
         .font('Helvetica-Bold')
         .text(status.points.toString(), startX + 320, yPos + 10);
      
      doc.y = yPos + barHeight;
    }
  });
  
  doc.y += 10;
}

// Draw issue section
function drawIssueSection(doc, title, issues, color, startY) {
  // Check if we need a new page
  if (startY > 650) {
    doc.addPage();
    startY = 50;
  }
  
  doc.y = startY;
  
  // Section title
  doc.fontSize(14)
     .fillColor(color)
     .font('Helvetica-Bold')
     .text(title, 50, doc.y);
  
  doc.fontSize(10)
     .fillColor(COLORS.gray)
     .font('Helvetica')
     .text(`${issues.length} issues`, 300, doc.y);
  
  doc.y += 20;
  
  // Table header
  const tableX = 50;
  const colWidths = { key: 80, type: 60, points: 50, summary: 300 };
  
  doc.fontSize(9)
     .fillColor(COLORS.white)
     .font('Helvetica-Bold');
  
  // Header background
  doc.rect(tableX, doc.y, 495, 20)
     .fill(color);
  
  const headerY = doc.y + 6;
  doc.text('Issue Key', tableX + 5, headerY)
     .text('Type', tableX + colWidths.key + 5, headerY)
     .text('Points', tableX + colWidths.key + colWidths.type + 5, headerY)
     .text('Summary', tableX + colWidths.key + colWidths.type + colWidths.points + 5, headerY);
  
  doc.y += 25;
  
  // Issues
  doc.fontSize(8)
     .fillColor(COLORS.black)
     .font('Helvetica');
  
  issues.forEach((issue, index) => {
    // Check if we need a new page
    if (doc.y > 720) {
      doc.addPage();
      doc.y = 50;
    }
    
    const rowY = doc.y;
    const rowHeight = 25;
    
    // Alternating row background
    if (index % 2 === 0) {
      doc.rect(tableX, rowY, 495, rowHeight)
         .fill(COLORS.lightGray);
    }
    
    // Issue data
    doc.fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text(issue.key, tableX + 5, rowY + 8, { width: colWidths.key - 10 });
    
    doc.fillColor(COLORS.black)
       .font('Helvetica')
       .text(issue.issueType, tableX + colWidths.key + 5, rowY + 8, { width: colWidths.type - 10 });
    
    const pointsText = issue.defaulted ? `${issue.storyPoints}*` : issue.storyPoints.toString();
    doc.text(pointsText, tableX + colWidths.key + colWidths.type + 5, rowY + 8, { width: colWidths.points - 10 });
    
    const summaryText = issue.summary.length > 60 ? issue.summary.substring(0, 57) + '...' : issue.summary;
    doc.text(summaryText, tableX + colWidths.key + colWidths.type + colWidths.points + 5, rowY + 8, { 
      width: colWidths.summary - 10,
      ellipsis: true
    });
    
    doc.y = rowY + rowHeight;
  });
  
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

// Get color for issue type
function getColorForType(type) {
  switch (type.toLowerCase()) {
    case 'story':
      return COLORS.primary;
    case 'bug':
      return COLORS.danger;
    case 'epic':
      return COLORS.success;
    default:
      return COLORS.gray;
  }
}

// Main function
function main() {
  console.log('\n📊 Generating Work Done Today PDF Report...');
  console.log('='.repeat(60));
  
  const date = parseArgs();
  console.log(`   Date: ${date}`);
  
  // Load data
  console.log('\n📖 Loading data...');
  const data = loadData(date);
  console.log(`   ✓ Loaded data for ${data.summary.totalIssues} issues (${data.summary.totalStoryPoints} points)`);
  
  // Generate PDF
  console.log('\n📄 Generating PDF...');
  const outputPath = generatePDF(data);
  
  console.log(`\n✅ PDF report generated successfully!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log('\n🎉 Done!');
}

// Run the script
main();

