const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Colors
const COLORS = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  lightGray: '#ECF0F1',
  darkGray: '#7F8C8D'
};

// Read the design progress JSON file
function readDesignProgressData() {
  const filePath = path.join(__dirname, '..', 'reports', 'design-progress.json');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Error: design-progress.json not found');
    console.log('   Please run: npm run design-progress first');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data;
}

// Draw header
function drawHeader(doc, data) {
  doc.fontSize(20)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text('Design Status Report', 50, 50);
  
  doc.fontSize(10)
     .fillColor(COLORS.darkGray)
     .font('Helvetica')
     .text(`Project: ${data.project}`, 50, 75)
     .text(`Date: ${data.date}`, 50, 88);
  
  doc.moveTo(50, 105)
     .lineTo(545, 105)
     .stroke(COLORS.lightGray);
}

// Draw summary box
function drawSummary(doc, data, y) {
  doc.fontSize(12)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text('Summary', 50, y);
  
  y += 20;
  
  doc.fontSize(10)
     .fillColor(COLORS.darkGray)
     .font('Helvetica')
     .text(`Total Design Tasks: ${data.summary.totalTasks}`, 60, y)
     .text(`Tasks with Progress: ${data.summary.tasksWithProgress}`, 60, y + 15)
     .text(`Average Progress: ${data.summary.averageProgress}%`, 60, y + 30);
  
  return y + 50;
}

// Draw table for a fix version
function drawTable(doc, title, tasks, startY) {
  let y = startY;
  
  // Title
  doc.fontSize(14)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text(title, 50, y);
  
  y += 25;
  
  if (!tasks || tasks.length === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.darkGray)
       .font('Helvetica')
       .text('No tasks found', 50, y);
    return y + 30;
  }
  
  // Table headers
  doc.fontSize(8)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold');
  
  doc.rect(50, y, 495, 20)
     .fill(COLORS.primary);
  
  doc.text('Key', 55, y + 6, { width: 55 });
  doc.text('Sprint', 112, y + 6, { width: 55 });
  doc.text('Due', 170, y + 6, { width: 45 });
  doc.text('Prog', 218, y + 6, { width: 30 });
  doc.text('Status', 252, y + 6, { width: 60 });
  doc.text('Summary', 315, y + 6, { width: 225 });
  
  y += 20;
  
  // Table rows
  doc.font('Helvetica')
     .fontSize(8);
  
  const sortedTasks = [...tasks].sort((a, b) => a.key.localeCompare(b.key));
  
  for (const task of sortedTasks) {
    // Check if we need a new page
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    
    const progress = task.progress !== null ? task.progress : 0;
    const bgColor = y % 40 === 20 ? COLORS.lightGray : '#FFFFFF';
    
    doc.rect(50, y, 495, 20)
       .fill(bgColor);
    
    doc.fillColor(COLORS.primary)
       .text(task.key, 55, y + 6, { width: 55, ellipsis: true });
    
    // Sprint (shorten "NH Sprint" to just the number)
    const sprintText = task.sprint ? task.sprint.replace('NH Sprint ', 'S') : '-';
    doc.fillColor(COLORS.darkGray)
       .text(sprintText, 112, y + 6, { width: 55, ellipsis: true });
    
    // Due date (format: MM/DD)
    const dueDateText = task.dueDate ? task.dueDate.substring(5).replace('-', '/') : '-';
    doc.fillColor(COLORS.darkGray)
       .text(dueDateText, 170, y + 6, { width: 45 });
    
    // Color code progress
    let progressColor = COLORS.danger;
    if (progress >= 75) progressColor = COLORS.success;
    else if (progress >= 40) progressColor = COLORS.warning;
    
    doc.fillColor(progressColor)
       .text(`${progress}%`, 218, y + 6, { width: 30 });
    
    doc.fillColor(COLORS.darkGray)
       .text(task.status, 252, y + 6, { width: 60, ellipsis: true });
    
    const shortSummary = task.summary.replace('Design: ', '');
    doc.text(shortSummary, 315, y + 6, { width: 225, ellipsis: true });
    
    y += 20;
  }
  
  return y + 20;
}

// Draw horizontal bar chart
function drawBarChart(doc, title, tasks, startY) {
  let y = startY;
  
  // Check if we need a new page
  if (y > 650) {
    doc.addPage();
    y = 50;
  }
  
  // Title
  doc.fontSize(14)
     .fillColor(COLORS.primary)
     .font('Helvetica-Bold')
     .text(title, 50, y);
  
  y += 25;
  
  if (!tasks || tasks.length === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.darkGray)
       .font('Helvetica')
       .text('No tasks found', 50, y);
    return y + 30;
  }
  
  // Sort by progress (descending)
  const sortedTasks = [...tasks].sort((a, b) => {
    const aProgress = a.progress !== null ? a.progress : 0;
    const bProgress = b.progress !== null ? b.progress : 0;
    return bProgress - aProgress;
  });
  
  const maxBarWidth = 300;
  const barHeight = 18;
  const spacing = 4;
  
  for (const task of sortedTasks) {
    // Check if we need a new page
    if (y > 720) {
      doc.addPage();
      y = 50;
      
      // Redraw title on new page
      doc.fontSize(14)
         .fillColor(COLORS.primary)
         .font('Helvetica-Bold')
         .text(title + ' (continued)', 50, y);
      y += 25;
    }
    
    const progress = task.progress !== null ? task.progress : 0;
    const barWidth = (progress / 100) * maxBarWidth;
    
    // Task key
    doc.fontSize(8)
       .fillColor(COLORS.primary)
       .font('Helvetica')
       .text(task.key, 50, y + 4, { width: 70 });
    
    // Bar background
    doc.rect(125, y, maxBarWidth, barHeight)
       .fill(COLORS.lightGray);
    
    // Bar foreground
    let barColor = COLORS.danger;
    if (progress >= 75) barColor = COLORS.success;
    else if (progress >= 40) barColor = COLORS.warning;
    
    if (barWidth > 0) {
      doc.rect(125, y, barWidth, barHeight)
         .fill(barColor);
    }
    
    // Progress percentage
    doc.fontSize(8)
       .fillColor(COLORS.primary)
       .font('Helvetica-Bold')
       .text(`${progress}%`, 430, y + 4, { width: 40, align: 'right' });
    
    // Task summary (shortened)
    const shortSummary = task.summary.replace('Design: ', '');
    doc.fontSize(7)
       .fillColor(COLORS.darkGray)
       .font('Helvetica')
       .text(shortSummary.substring(0, 40) + (shortSummary.length > 40 ? '...' : ''), 475, y + 5, { width: 70 });
    
    y += barHeight + spacing;
  }
  
  return y + 20;
}

// Generate the PDF
function generatePDF() {
  console.log('\n📄 Generating Design Status PDF...\n');
  
  const data = readDesignProgressData();
  
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  const outputPath = path.join(__dirname, '..', 'reports', 'design-status.pdf');
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  
  // Page 1: Header, Summary, and Release 1D Table
  drawHeader(doc, data);
  let y = drawSummary(doc, data, 120);
  
  const release1D = data.byFixVersion['Release 1D'];
  y = drawTable(doc, '📋 Release 1D Design Tasks', release1D?.tasks || [], y + 10);
  
  // Page 2: Release 2A Table
  doc.addPage();
  const release2A = data.byFixVersion['Release 2A'];
  y = drawTable(doc, '📋 Release 2A Design Tasks', release2A?.tasks || [], 50);
  
  // Page 3: Release 1D Bar Chart
  doc.addPage();
  y = drawBarChart(doc, '📊 Release 1D Progress Chart', release1D?.tasks || [], 50);
  
  // Page 4: Release 2A Bar Chart
  doc.addPage();
  y = drawBarChart(doc, '📊 Release 2A Progress Chart', release2A?.tasks || [], 50);
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`✅ PDF generated: ${outputPath}\n`);
  });
}

// Main execution
try {
  generatePDF();
} catch (error) {
  console.error(`\n❌ Error generating PDF: ${error.message}\n`);
  process.exit(1);
}

