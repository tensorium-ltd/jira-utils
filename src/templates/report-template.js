const PDFDocument = require('pdfkit');
const fs = require('fs');

// Color scheme
const COLORS = {
  primary: '#4472C4',
  secondary: '#70AD47',
  danger: '#C55A11',
  warning: '#FFC000',
  gray: '#808080',
  lightGray: '#E7E6E6',
  darkGray: '#404040',
  featureWork: '#5B9BD5',
  bugs: '#ED7D31',
  stabilization: '#A5A5A5'
};

// Helper to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

// Draw a rounded rectangle
function roundedRect(doc, x, y, width, height, radius) {
  doc.moveTo(x + radius, y)
     .lineTo(x + width - radius, y)
     .quadraticCurveTo(x + width, y, x + width, y + radius)
     .lineTo(x + width, y + height - radius)
     .quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
     .lineTo(x + radius, y + height)
     .quadraticCurveTo(x, y + height, x, y + height - radius)
     .lineTo(x, y + radius)
     .quadraticCurveTo(x, y, x + radius, y);
}

// Draw header
function drawHeader(doc, sprintData) {
  const PROJECT_NAME = 'National Highways Phase 3 Delivery';
  
  // Draw blue header bar
  doc.fillColor(hexToRgb(COLORS.primary))
     .rect(0, 0, 612, 80)
     .fill();
  
  // Project name
  doc.fillColor('#FFFFFF')
     .fontSize(24)
     .font('Helvetica-Bold')
     .text(PROJECT_NAME, 50, 20, { width: 512 });
  
  // Sprint title and date range
  doc.fontSize(18)
     .font('Helvetica')
     .text(`Sprint ${sprintData.sprintNumber} Report`, 50, 50);
  
  // Date range - next to sprint label
  if (sprintData.startDate && sprintData.endDate) {
    doc.fontSize(12)
       .font('Helvetica')
       .text(`(${sprintData.startDate} - ${sprintData.endDate})`, 240, 52);
  }
  
  // Report date - top right corner only
  const reportDate = new Date().toLocaleDateString('en-GB');
  doc.fontSize(9)
     .text(`Generated: ${reportDate}`, 450, 25, { width: 112, align: 'right' });
}

// Draw metric card
function drawMetricCard(doc, x, y, width, height, title, value, subtitle, color) {
  // Draw card background
  doc.save();
  doc.fillColor(hexToRgb(COLORS.lightGray))
     .opacity(0.3);
  roundedRect(doc, x, y, width, height, 8);
  doc.fill();
  doc.restore();
  
  // Draw colored top border
  doc.fillColor(hexToRgb(color))
     .rect(x, y, width, 4)
     .fill();
  
  // Title
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(9)
     .font('Helvetica')
     .text(title, x + 10, y + 10, { width: width - 20 });
  
  // Value
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(color))
     .text(value, x + 10, y + 24, { width: width - 20 });
  
  // Subtitle
  if (subtitle) {
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.gray))
       .text(subtitle, x + 10, y + height - 18, { width: width - 20 });
  }
}

// Draw status badge
function drawStatusBadge(doc, x, y, status, color) {
  const badgeWidth = 120;
  const badgeHeight = 30;
  
  // Background
  doc.fillColor(hexToRgb(color))
     .opacity(0.2);
  roundedRect(doc, x, y, badgeWidth, badgeHeight, 15);
  doc.fill();
  
  // Text
  doc.fillColor(hexToRgb(color))
     .opacity(1)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text(status, x, y + 8, { width: badgeWidth, align: 'center' });
}

// Draw executive summary page
function drawExecutiveSummary(doc, sprintData) {
  drawHeader(doc, sprintData);
  
  let y = 100;
  
  // Executive Summary section
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('Executive Summary', 50, y);
  
  y += 20;
  
  // Metric cards (smaller)
  const cardWidth = 125;
  const cardHeight = 65;
  const gap = 15;
  
  // Total Committed
  drawMetricCard(doc, 50, y, cardWidth, cardHeight,
    'Total Committed',
    sprintData.totalCommitted.toString(),
    'Story Points',
    COLORS.primary);
  
  // Total Delivered
  drawMetricCard(doc, 50 + cardWidth + gap, y, cardWidth, cardHeight,
    'Total Delivered',
    sprintData.totalDelivered.toString(),
    'Story Points',
    COLORS.secondary);
  
  // Delivery %
  drawMetricCard(doc, 50 + (cardWidth + gap) * 2, y, cardWidth, cardHeight,
    'Delivery Rate',
    `${sprintData.deliveryPercentage}%`,
    'of Committed',
    sprintData.deliveryPercentage >= 90 ? COLORS.secondary : 
    sprintData.deliveryPercentage >= 70 ? COLORS.warning : COLORS.danger);
  
  y += cardHeight + 15;
  
  // Status indicator
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Sprint Status:', 50, y);
  
  const statusInfo = sprintData.deliveryPercentage >= 90 ?
    { status: 'On Track', color: COLORS.secondary } :
    sprintData.deliveryPercentage >= 70 ?
    { status: 'At Risk', color: COLORS.warning } :
    { status: 'Off Track', color: COLORS.danger };

  drawStatusBadge(doc, 170, y - 5, statusInfo.status, statusInfo.color);

  y += 35;
  
  // Sprint Metrics Table (narrower to make room for chart)
  const metricsStartY = y;
  
  doc.fontSize(13)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Sprint Metrics', 50, y);
  
  y += 18;
  
  // Draw metrics table (narrower)
  const tableX = 50;
  const col1Width = 140;
  const col2Width = 120;
  const rowHeight = 18;
  
  const remaining = sprintData.totalCommitted - sprintData.totalDelivered;
  const targetVelocity = sprintData.totalCommitted / sprintData.totalWorkingDays;
  
  // Determine if metrics are "okay" (within 10% of target)
  const velocityOkay = sprintData.currentVelocity >= targetVelocity * 0.9;
  const predictedOkay = sprintData.predictedTotal >= sprintData.totalCommitted * 0.9;
  const deliveryOkay = sprintData.deliveryPercentage >= 90;
  
  const metrics = [
    ['Sprint Progress:', `Day ${sprintData.workingDaysElapsed} of ${sprintData.totalWorkingDays} working days`, null],
    ['Story Points Remaining:', `${remaining} points`, null],
    ['Epics in Sprint:', `${sprintData.epics.length} epics`, null],
    ['Target Velocity:', `${targetVelocity.toFixed(1)} pts/day`, null],
    ['Actual Velocity:', `${sprintData.currentVelocity.toFixed(1)} pts/day`, velocityOkay],
    ['Predicted Total:', `${sprintData.predictedTotal} points`, predictedOkay],
    ['Delivery Rate:', `${sprintData.deliveryPercentage}%`, deliveryOkay]
  ];
  
  metrics.forEach((metric, index) => {
    const rowY = y + (index * rowHeight);
    const indicator = metric[2];
    
    // Alternate row colors
    if (index % 2 === 0) {
      doc.fillColor(hexToRgb(COLORS.lightGray))
         .opacity(0.3)
         .rect(tableX, rowY, col1Width + col2Width, rowHeight)
         .fill()
         .opacity(1);
    }
    
    // Label - consistent font size
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .fontSize(8)
       .font('Helvetica-Bold')
       .text(metric[0], tableX + 8, rowY + 4, { width: col1Width - 16 });
    
    // Value - consistent font size
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .fontSize(8)
       .font('Helvetica')
       .text(metric[1], tableX + col1Width + 8, rowY + 4, { width: col2Width - 30 });
    
    // Add indicator (green tick or red cross)
    if (indicator !== null) {
      if (indicator === true) {
        // Green tick (checkmark) - draw a simple checkmark
        doc.save();
        doc.strokeColor(hexToRgb(COLORS.secondary))
           .lineWidth(2);
        
        const iconX = tableX + col1Width + col2Width - 14;
        const iconY = rowY + 5;
        
        // Draw checkmark
        doc.moveTo(iconX, iconY + 4)
           .lineTo(iconX + 3, iconY + 7)
           .lineTo(iconX + 8, iconY)
           .stroke();
        doc.restore();
      } else {
        // Red cross - draw an X
        doc.save();
        doc.strokeColor(hexToRgb(COLORS.danger))
           .lineWidth(2);
        
        const iconX = tableX + col1Width + col2Width - 14;
        const iconY = rowY + 5;
        
        // Draw X
        doc.moveTo(iconX, iconY)
           .lineTo(iconX + 8, iconY + 8)
           .stroke();
        doc.moveTo(iconX + 8, iconY)
           .lineTo(iconX, iconY + 8)
           .stroke();
        doc.restore();
      }
    }
  });
  
  // Draw velocity over time chart next to the table
  const chartX = tableX + col1Width + col2Width + 40;
  drawVelocityOverTimeChart(doc, sprintData, chartX, metricsStartY);
  
  y += metrics.length * rowHeight + 12;
  
  // Add velocity metrics bar chart (more compact)
  drawVelocityBarChart(doc, sprintData, 50, y);
  
  // Add project-level metrics if available
  if (sprintData.projectData) {
    // Calculate space: title(16) + 3 main bars(18*3) + breakdown label(16) + 3 breakdown bars(18*3) + gaps(5*5) + padding(10)
    y += 16 + (18 * 6) + 16 + (5 * 5) + 10;
    drawProjectMetrics(doc, sprintData.projectData, 50, y);
  }
}

// Draw velocity over time chart
function drawVelocityOverTimeChart(doc, sprintData, x, y) {
  const chartWidth = 240;
  const chartHeight = 140;
  const padding = { top: 30, right: 20, bottom: 30, left: 40 };
  
  const plotX = x + padding.left;
  const plotY = y + padding.top;
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Calculate target velocity
  const targetVelocity = sprintData.totalCommitted / sprintData.totalWorkingDays;
  const currentVelocity = sprintData.currentVelocity;
  const currentDay = sprintData.workingDaysElapsed;
  const totalDays = sprintData.totalWorkingDays;
  
  // Determine Y-axis scale
  const maxVelocity = Math.max(targetVelocity, currentVelocity) * 1.2;
  const yScale = plotHeight / maxVelocity;
  const xScale = plotWidth / totalDays;
  
  // Title
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Velocity Over Time', x, y);
  
  // Draw chart background
  doc.save();
  doc.fillColor(hexToRgb(COLORS.lightGray))
     .opacity(0.1)
     .rect(plotX, plotY, plotWidth, plotHeight)
     .fill()
     .opacity(1);
  doc.restore();
  
  // Draw axes
  doc.strokeColor(hexToRgb(COLORS.darkGray))
     .lineWidth(1)
     .moveTo(plotX, plotY + plotHeight)
     .lineTo(plotX + plotWidth, plotY + plotHeight) // X-axis
     .stroke()
     .moveTo(plotX, plotY)
     .lineTo(plotX, plotY + plotHeight) // Y-axis
     .stroke();
  
  // X-axis label
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.gray))
     .text('Days', plotX + plotWidth / 2 - 10, plotY + plotHeight + 18);
  
  // Y-axis label (rotated)
  doc.save();
  doc.translate(plotX - 28, plotY + plotHeight / 2)
     .rotate(-90)
     .fontSize(8)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.gray))
     .text('Velocity (pts/day)', 0, 0);
  doc.restore();
  
  // Draw grid lines and Y-axis labels
  const yTicks = 3;
  for (let i = 0; i <= yTicks; i++) {
    const velocityValue = (maxVelocity / yTicks) * i;
    const gridY = plotY + plotHeight - (velocityValue * yScale);
    
    // Grid line
    doc.save();
    doc.strokeColor(hexToRgb(COLORS.lightGray))
       .opacity(0.5)
       .lineWidth(0.5)
       .moveTo(plotX, gridY)
       .lineTo(plotX + plotWidth, gridY)
       .stroke()
       .opacity(1);
    doc.restore();
    
    // Y-axis label
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.gray))
       .text(velocityValue.toFixed(0), plotX - 32, gridY - 3, { width: 25, align: 'right' });
  }
  
  // Draw X-axis ticks (every 2 days)
  for (let day = 0; day <= totalDays; day += 2) {
    const tickX = plotX + (day * xScale);
    
    // Tick mark
    doc.strokeColor(hexToRgb(COLORS.darkGray))
       .lineWidth(0.5)
       .moveTo(tickX, plotY + plotHeight)
       .lineTo(tickX, plotY + plotHeight + 3)
       .stroke();
    
    // Label
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.gray))
       .text(day.toString(), tickX - 5, plotY + plotHeight + 6);
  }
  
  // Draw target velocity line (horizontal)
  const targetY = plotY + plotHeight - (targetVelocity * yScale);
  doc.save();
  doc.strokeColor(hexToRgb(COLORS.primary))
     .lineWidth(2)
     .opacity(0.7)
     .moveTo(plotX, targetY)
     .lineTo(plotX + plotWidth, targetY)
     .stroke()
     .opacity(1);
  doc.restore();
  
  // Label for target line
  doc.fontSize(7)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.primary))
     .text(`Target: ${targetVelocity.toFixed(1)}`, plotX + plotWidth - 50, targetY - 10);
  
  // Draw current velocity point
  if (currentDay > 0 && currentDay <= totalDays) {
    const currentX = plotX + (currentDay * xScale);
    const currentY = plotY + plotHeight - (currentVelocity * yScale);
    
    // Draw line from start to current point
    doc.save();
    doc.strokeColor(hexToRgb(currentVelocity >= targetVelocity * 0.9 ? COLORS.secondary : COLORS.danger))
       .lineWidth(2)
       .moveTo(plotX, plotY + plotHeight)
       .lineTo(currentX, currentY)
       .stroke();
    doc.restore();
    
    // Draw point
    const pointColor = currentVelocity >= targetVelocity * 0.9 ? COLORS.secondary : COLORS.danger;
    doc.fillColor(hexToRgb(pointColor))
       .circle(currentX, currentY, 4)
       .fill();
    
    // Label for current point
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .fillColor(hexToRgb(pointColor))
       .text(`Now: ${currentVelocity.toFixed(1)}`, currentX - 20, currentY - 14);
  }
  
  // Legend
  const legendY = y + chartHeight + 5;
  
  // Target line legend
  doc.strokeColor(hexToRgb(COLORS.primary))
     .lineWidth(2)
     .opacity(0.7)
     .moveTo(x, legendY)
     .lineTo(x + 15, legendY)
     .stroke()
     .opacity(1);
  doc.fontSize(7)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Required', x + 18, legendY - 3);
  
  // Actual line legend
  const actualColor = currentVelocity >= targetVelocity * 0.9 ? COLORS.secondary : COLORS.danger;
  doc.strokeColor(hexToRgb(actualColor))
     .lineWidth(2)
     .moveTo(x + 70, legendY)
     .lineTo(x + 85, legendY)
     .stroke();
  doc.fontSize(7)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Actual', x + 88, legendY - 3);
}

// Draw velocity bar chart (horizontal bars stacked vertically)
function drawVelocityBarChart(doc, sprintData, x, y) {
  const maxBarWidth = 320;
  const barHeight = 18;
  const gap = 5;
  const labelWidth = 120;
  
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Performance Comparison', x, y);
  
  y += 16;
  
  // Find max value for scaling
  const maxValue = Math.max(sprintData.totalCommitted, sprintData.totalDelivered, sprintData.predictedTotal || 0);
  
  // Bar 1: Committed
  const committedWidth = (sprintData.totalCommitted / maxValue) * maxBarWidth;
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Committed', x, y + 7, { width: labelWidth });
  
  doc.fillColor(hexToRgb(COLORS.primary))
     .opacity(0.8)
     .rect(x + labelWidth, y, committedWidth, barHeight)
     .fill()
     .opacity(1);
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(sprintData.totalCommitted.toString() + ' pts', 
           x + labelWidth + committedWidth + 10, y + 7);
  
  y += barHeight + gap;
  
  // Bar 2: Delivered
  const deliveredWidth = (sprintData.totalDelivered / maxValue) * maxBarWidth;
  const deliveryColor = sprintData.deliveryPercentage >= 90 ? COLORS.secondary :
                        sprintData.deliveryPercentage >= 70 ? COLORS.warning : COLORS.danger;
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Delivered', x, y + 7, { width: labelWidth });
  
  doc.fillColor(hexToRgb(deliveryColor))
     .opacity(0.8)
     .rect(x + labelWidth, y, deliveredWidth, barHeight)
     .fill()
     .opacity(1);
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(10)
     .font('Helvetica-Bold')
     .text(`${sprintData.totalDelivered} pts (${sprintData.deliveryPercentage}%)`, 
           x + labelWidth + deliveredWidth + 10, y + 7);
  
  y += barHeight + gap + 3; // Extra gap before breakdown
  
  // Add "Breakdown:" label
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Breakdown:', x, y);
  
  y += 16;
  
  // Bar 3: Feature Work
  if (sprintData.featureWorkDelivered !== undefined) {
    const featureWidth = (sprintData.featureWorkDelivered / maxValue) * maxBarWidth;
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.darkGray))
       .text('• Features', x + 10, y + 6, { width: labelWidth - 10 });
    
    if (featureWidth > 0) {
      doc.fillColor(hexToRgb(COLORS.featureWork))
         .opacity(0.7)
         .rect(x + labelWidth, y, featureWidth, barHeight)
         .fill()
         .opacity(1);
    }
    
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .fontSize(10)
       .font('Helvetica')
       .text(sprintData.featureWorkDelivered.toString() + ' pts', 
             x + labelWidth + (featureWidth > 0 ? featureWidth : 0) + 10, y + 6);
    
    y += barHeight + gap;
  }
  
  // Bar 4: Bugs
  if (sprintData.bugsDelivered !== undefined) {
    const bugsWidth = (sprintData.bugsDelivered / maxValue) * maxBarWidth;
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.darkGray))
       .text('• Bugs', x + 10, y + 6, { width: labelWidth - 10 });
    
    if (bugsWidth > 0) {
      doc.fillColor(hexToRgb(COLORS.bugs))
         .opacity(0.7)
         .rect(x + labelWidth, y, bugsWidth, barHeight)
         .fill()
         .opacity(1);
    }
    
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .fontSize(10)
       .font('Helvetica')
       .text(sprintData.bugsDelivered.toString() + ' pts', 
             x + labelWidth + (bugsWidth > 0 ? bugsWidth : 0) + 10, y + 6);
    
    y += barHeight + gap;
  }
  
  // Bar 5: Stabilization
  if (sprintData.stabilizationDelivered !== undefined) {
    const stabilizationWidth = (sprintData.stabilizationDelivered / maxValue) * maxBarWidth;
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(hexToRgb(COLORS.darkGray))
       .text('• Stabilization', x + 10, y + 6, { width: labelWidth - 10 });
    
    if (stabilizationWidth > 0) {
      doc.fillColor(hexToRgb(COLORS.stabilization))
         .opacity(0.7)
         .rect(x + labelWidth, y, stabilizationWidth, barHeight)
         .fill()
         .opacity(1);
    }
    
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .fontSize(10)
       .font('Helvetica')
       .text(sprintData.stabilizationDelivered.toString() + ' pts', 
             x + labelWidth + (stabilizationWidth > 0 ? stabilizationWidth : 0) + 10, y + 6);
  }
}

// Draw project-level metrics section
function drawProjectMetrics(doc, projectData, x, y) {
  // Section header
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Overall Project Status', x, y);
  
  y += 16;
  
  // Key metrics in a compact layout
  const metricsY = y;
  const colWidth = 165;
  
  // Column 1: Total Project Points
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.gray))
     .text('Total Project Story Points:', x, metricsY);
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.primary))
     .text(projectData.totalProjectPoints.toString(), x, metricsY + 11);
  
  // Column 2: Delivered with %
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.gray))
     .text('Delivered So Far:', x + colWidth, metricsY);
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.secondary))
     .text(`${projectData.totalDelivered} (${projectData.deliveredPercentage}%)`, x + colWidth, metricsY + 11);
  
  // Column 3: Working Days Remaining
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(hexToRgb(COLORS.gray))
     .text('Working Days Remaining:', x + colWidth * 2, metricsY);
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.warning))
     .text(projectData.workingDaysRemaining.toString(), x + colWidth * 2, metricsY + 11);
  
  y += 28;
  
  // Required velocity prominently displayed
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.danger))
     .text(`Required Daily Velocity to Complete: ${projectData.requiredDailyVelocity} pts/day`, x, y);
  
  y += 14;
  
  // Add overrun/underrun metric if available
  if (projectData.daysOverrun !== undefined && projectData.daysOverrun !== null) {
    const overrunText = projectData.isOverrun 
      ? `At current velocity: OVERRUN by ${projectData.daysOverrun} working days`
      : projectData.daysOverrun < 0
      ? `At current velocity: UNDERRUN by ${Math.abs(projectData.daysOverrun)} working days`
      : `At current velocity: On track to complete on time`;
    
    const overrunColor = projectData.isOverrun ? COLORS.danger : COLORS.secondary;
    
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor(hexToRgb(overrunColor))
       .text(overrunText, x, y);
  }
  
  y += 14;
  
  // Project progress bars
  const maxBarWidth = 320;
  const barHeight = 16;
  const gap = 4;
  const labelWidth = 120;
  
  const maxValue = projectData.totalProjectPoints;
  
  // Bar 1: Total Project Points (baseline)
  const totalWidth = maxBarWidth;
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Total Project', x, y + 5, { width: labelWidth - 10 });
  
  doc.fillColor(hexToRgb(COLORS.primary))
     .opacity(0.3)
     .rect(x + labelWidth, y, totalWidth, barHeight)
     .fill()
     .opacity(1);
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(9)
     .font('Helvetica')
     .text(projectData.totalProjectPoints.toString() + ' pts', 
           x + labelWidth + totalWidth + 10, y + 5);
  
  y += barHeight + gap;
  
  // Bar 2: Delivered So Far
  const deliveredWidth = (projectData.totalDelivered / maxValue) * maxBarWidth;
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Delivered', x, y + 5, { width: labelWidth - 10 });
  
  if (deliveredWidth > 0) {
    doc.fillColor(hexToRgb(COLORS.secondary))
       .opacity(0.8)
       .rect(x + labelWidth, y, deliveredWidth, barHeight)
       .fill()
       .opacity(1);
  }
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(9)
     .font('Helvetica')
     .text(`${projectData.totalDelivered} pts (${projectData.deliveredPercentage}%)`, 
           x + labelWidth + (deliveredWidth > 0 ? deliveredWidth : 0) + 10, y + 5);
  
  y += barHeight + gap;
  
  // Bar 3: Remaining
  const remainingWidth = (projectData.totalRemaining / maxValue) * maxBarWidth;
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Remaining', x, y + 5, { width: labelWidth - 10 });
  
  if (remainingWidth > 0) {
    doc.fillColor(hexToRgb(COLORS.danger))
       .opacity(0.6)
       .rect(x + labelWidth, y, remainingWidth, barHeight)
       .fill()
       .opacity(1);
  }
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(9)
     .font('Helvetica')
     .text(projectData.totalRemaining.toString() + ' pts', 
           x + labelWidth + (remainingWidth > 0 ? remainingWidth : 0) + 10, y + 5);
}

// Draw burndown chart
function drawBurndownChart(doc, sprintData) {
  const chartX = 80;
  const chartY = 200;
  const chartWidth = 450;
  const chartHeight = 300;
  
  // Chart title
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text(`Burndown Chart - Sprint ${sprintData.sprintNumber}`, 50, 120);
  
  // Draw chart background
  doc.fillColor(hexToRgb(COLORS.lightGray))
     .opacity(0.1)
     .rect(chartX, chartY, chartWidth, chartHeight)
     .fill()
     .opacity(1);
  
  // Draw grid lines
  doc.strokeColor(hexToRgb(COLORS.lightGray))
     .lineWidth(0.5);
  
  for (let i = 0; i <= 5; i++) {
    const y = chartY + (chartHeight / 5) * i;
    doc.moveTo(chartX, y)
       .lineTo(chartX + chartWidth, y)
       .stroke();
  }
  
  for (let i = 0; i <= 14; i++) {
    const x = chartX + (chartWidth / 14) * i;
    doc.moveTo(x, chartY)
       .lineTo(x, chartY + chartHeight)
       .stroke();
  }
  
  // Calculate scale
  const maxPoints = Math.max(...sprintData.remainingByDay, sprintData.totalCommitted);
  const scale = chartHeight / maxPoints;
  
  // Draw ideal burndown line (straight line from total to 0)
  doc.strokeColor(hexToRgb(COLORS.gray))
     .lineWidth(2)
     .opacity(0.5)
     .dash(5, { space: 5 });
  
  const idealStart = chartY + (chartHeight - sprintData.totalCommitted * scale);
  const idealEnd = chartY + chartHeight;
  
  doc.moveTo(chartX, idealStart)
     .lineTo(chartX + chartWidth, idealEnd)
     .stroke()
     .undash()
     .opacity(1);
  
  // Draw actual burndown line
  doc.strokeColor(hexToRgb(COLORS.primary))
     .lineWidth(3);
  
  for (let i = 0; i < sprintData.remainingByDay.length; i++) {
    const x = chartX + (chartWidth / 14) * i;
    const y = chartY + chartHeight - (sprintData.remainingByDay[i] * scale);
    
    if (i === 0) {
      doc.moveTo(x, y);
    } else {
      doc.lineTo(x, y);
    }
    
    // Draw point
    doc.circle(x, y, 4).fill();
    if (i < sprintData.remainingByDay.length - 1) {
      doc.moveTo(x, y);
    }
  }
  doc.stroke();
  
  // Draw axes labels
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(9)
     .font('Helvetica');
  
  // X-axis labels (days)
  for (let i = 0; i <= 14; i += 2) {
    const x = chartX + (chartWidth / 14) * i;
    doc.text(`${i}`, x - 10, chartY + chartHeight + 10, { width: 20, align: 'center' });
  }
  
  // X-axis title
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('Days', chartX + chartWidth / 2 - 15, chartY + chartHeight + 35);
  
  // Y-axis labels
  for (let i = 0; i <= 5; i++) {
    const y = chartY + (chartHeight / 5) * (5 - i);
    const value = Math.round((maxPoints / 5) * i);
    doc.fontSize(9)
       .font('Helvetica')
       .text(value.toString(), chartX - 35, y - 5, { width: 30, align: 'right' });
  }
  
  // Y-axis title
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .save()
     .translate(chartX - 60, chartY + chartHeight / 2)
     .rotate(-90)
     .text('Story Points Remaining', 0, 0, { width: chartHeight, align: 'center' })
     .restore();
  
  // Legend
  const legendY = chartY + chartHeight + 70;
  
  // Ideal line
  doc.strokeColor(hexToRgb(COLORS.gray))
     .lineWidth(2)
     .opacity(0.5)
     .dash(5, { space: 5 })
     .moveTo(chartX + 50, legendY)
     .lineTo(chartX + 90, legendY)
     .stroke()
     .undash()
     .opacity(1);
  
  doc.fontSize(10)
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Ideal Burndown', chartX + 100, legendY - 5);
  
  // Actual line
  doc.strokeColor(hexToRgb(COLORS.primary))
     .lineWidth(3)
     .moveTo(chartX + 250, legendY)
     .lineTo(chartX + 290, legendY)
     .stroke();
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .text('Actual Burndown', chartX + 300, legendY - 5);
}

// Draw detailed metrics page
function drawDetailedMetrics(doc, sprintData) {
  doc.addPage();
  drawHeader(doc, sprintData);
  
  let y = 120;
  
  // Title
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(20)
     .font('Helvetica-Bold')
     .text('Detailed Epic Breakdown', 50, y);
  
  y += 40;
  
  // Table header
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor('#FFFFFF');
  
  doc.fillColor(hexToRgb(COLORS.primary))
     .rect(50, y, 512, 25)
     .fill();
  
  doc.fillColor('#FFFFFF')
     .text('Epic', 60, y + 7, { width: 350 })
     .text('Committed', 420, y + 7, { width: 70, align: 'right' })
     .text('Status', 500, y + 7, { width: 52, align: 'center' });
  
  y += 25;
  
  // Table rows
  doc.fontSize(9)
     .font('Helvetica');
  
  const rowHeight = 20;
  const maxRows = 20; // Limit to prevent overflow
  
  sprintData.epics.slice(0, maxRows).forEach((epic, index) => {
    // Alternate row colors
    if (index % 2 === 0) {
      doc.fillColor(hexToRgb(COLORS.lightGray))
         .opacity(0.3)
         .rect(50, y, 512, rowHeight)
         .fill()
         .opacity(1);
    }
    
    // Epic name (truncate if too long)
    const epicName = epic.name.length > 55 ? epic.name.substring(0, 52) + '...' : epic.name;
    doc.fillColor(hexToRgb(COLORS.darkGray))
       .text(epicName, 60, y + 5, { width: 350 });
    
    // Committed points
    doc.text(epic.committed.toString(), 420, y + 5, { width: 70, align: 'right' });
    
    // Status indicator (for epics with points)
    if (epic.committed > 0) {
      doc.fillColor(hexToRgb(COLORS.secondary))
         .circle(526, y + 10, 4)
         .fill();
    }
    
    y += rowHeight;
  });
  
  // Summary at bottom
  y += 20;
  
  if (sprintData.epics.length > maxRows) {
    doc.fontSize(9)
       .fillColor(hexToRgb(COLORS.gray))
       .text(`... and ${sprintData.epics.length - maxRows} more epics`, 60, y);
    y += 20;
  }
  
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(hexToRgb(COLORS.darkGray))
     .text('Total Story Points:', 60, y)
     .text(sprintData.totalCommitted.toString(), 420, y, { width: 70, align: 'right' });
}

// Draw Page 1: Simple Sprint Status
function drawSimpleSprintStatus(doc, sprintData) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  
  // Draw header
  drawHeader(doc, sprintData);
  
  let y = 110;
  
  // Release information banner
  doc.fillColor(hexToRgb(COLORS.primary))
     .fontSize(16)
     .font('Helvetica-Bold')
     .text(sprintData.release.name, margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 30;
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(12)
     .font('Helvetica')
     .text(`Ending at Sprint ${sprintData.release.endSprint}`, margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 40;
  
  // Release metrics - three columns
  if (sprintData.releaseData) {
    const releaseMetricY = y;
    const metricCol1X = margin + 30;
    const metricCol2X = pageWidth / 2 - 70;
    const metricCol3X = pageWidth - margin - 140;
    const metricColWidth = 130;
    
    // Total Committed
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(10)
       .font('Helvetica')
       .text('Release Total', metricCol1X, releaseMetricY, { width: metricColWidth, align: 'center' });
    
    doc.fillColor(hexToRgb(COLORS.primary))
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(sprintData.releaseData.totalCommitted.toString(), metricCol1X, releaseMetricY + 18, { width: metricColWidth, align: 'center' });
    
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(9)
       .font('Helvetica')
       .text('story points', metricCol1X, releaseMetricY + 42, { width: metricColWidth, align: 'center' });
    
    // Total Delivered
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(10)
       .font('Helvetica')
       .text('Release Delivered', metricCol2X, releaseMetricY, { width: metricColWidth, align: 'center' });
    
    doc.fillColor(hexToRgb(COLORS.secondary))
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(sprintData.releaseData.totalDelivered.toString(), metricCol2X, releaseMetricY + 18, { width: metricColWidth, align: 'center' });
    
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(9)
       .font('Helvetica')
       .text('story points', metricCol2X, releaseMetricY + 42, { width: metricColWidth, align: 'center' });
    
    // Percentage Complete
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(10)
       .font('Helvetica')
       .text('Release Complete', metricCol3X, releaseMetricY, { width: metricColWidth, align: 'center' });
    
    const percentageColor = sprintData.releaseData.percentageComplete >= 75 ? COLORS.secondary :
                            sprintData.releaseData.percentageComplete >= 50 ? COLORS.warning :
                            COLORS.danger;
    
    doc.fillColor(hexToRgb(percentageColor))
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(`${sprintData.releaseData.percentageComplete}%`, metricCol3X, releaseMetricY + 18, { width: metricColWidth, align: 'center' });
    
    doc.fillColor(hexToRgb(COLORS.gray))
       .fontSize(9)
       .font('Helvetica')
       .text('progress', metricCol3X, releaseMetricY + 42, { width: metricColWidth, align: 'center' });
    
    y += 70;
  }
  
  // Separator line
  doc.strokeColor(hexToRgb(COLORS.lightGray))
     .lineWidth(1)
     .moveTo(margin + 30, y)
     .lineTo(pageWidth - margin - 30, y)
     .stroke();
  
  y += 20;
  
  // Section title for current sprint
  doc.fillColor(hexToRgb(COLORS.primary))
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Current Sprint Performance', margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 35;
  
  // Main metrics - Large and centered
  const centerX = pageWidth / 2;
  const metricSpacing = 140;
  
  // Story Points Committed
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(12)
     .font('Helvetica')
     .text('Story Points Committed', margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 22;
  
  doc.fillColor(hexToRgb(COLORS.primary))
     .fontSize(40)
     .font('Helvetica-Bold')
     .text(sprintData.totalCommitted.toString(), margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 55;
  
  // Story Points Delivered So Far
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(12)
     .font('Helvetica')
     .text('Story Points Delivered So Far', margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 22;
  
  const deliveryColor = sprintData.totalDelivered >= sprintData.totalCommitted * 0.9 ? COLORS.secondary : 
                        sprintData.totalDelivered >= sprintData.totalCommitted * 0.7 ? COLORS.warning : 
                        COLORS.danger;
  
  doc.fillColor(hexToRgb(deliveryColor))
     .fontSize(40)
     .font('Helvetica-Bold')
     .text(sprintData.totalDelivered.toString(), margin, y, { width: pageWidth - (margin * 2), align: 'center' });
  
  y += 55;
  
  // Progress bar
  const barWidth = 400;
  const barHeight = 30;
  const barX = (pageWidth - barWidth) / 2;
  
  // Background
  doc.fillColor(hexToRgb(COLORS.lightGray))
     .rect(barX, y, barWidth, barHeight)
     .fill();
  
  // Progress fill
  const progressWidth = (sprintData.totalDelivered / sprintData.totalCommitted) * barWidth;
  doc.fillColor(hexToRgb(deliveryColor))
     .rect(barX, y, Math.min(progressWidth, barWidth), barHeight)
     .fill();
  
  // Percentage text
  const percentage = Math.round((sprintData.totalDelivered / sprintData.totalCommitted) * 100);
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(16)
     .font('Helvetica-Bold')
     .text(`${percentage}%`, barX, y + 7, { width: barWidth, align: 'center' });
  
  y += 50;
  
  // Velocity metrics - side by side
  const col1X = margin;
  const col2X = centerX + 20;
  const colWidth = (pageWidth - (margin * 2) - 40) / 2;
  
  // Target velocity
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(11)
     .font('Helvetica')
     .text('Target Velocity Per Day', col1X, y, { width: colWidth, align: 'center' });
  
  doc.fillColor(hexToRgb(COLORS.darkGray))
     .fontSize(11)
     .font('Helvetica')
     .text('Actual Velocity Today', col2X, y, { width: colWidth, align: 'center' });
  
  y += 20;
  
  doc.fillColor(hexToRgb(COLORS.primary))
     .fontSize(32)
     .font('Helvetica-Bold')
     .text(`${sprintData.targetVelocity.toFixed(1)}`, col1X, y, { width: colWidth, align: 'center' });
  
  const todayVelocityColor = sprintData.deliveredToday >= sprintData.targetVelocity * 0.9 ? COLORS.secondary : COLORS.danger;
  
  doc.fillColor(hexToRgb(todayVelocityColor))
     .fontSize(32)
     .font('Helvetica-Bold')
     .text(`${sprintData.deliveredToday.toFixed(1)}`, col2X, y, { width: colWidth, align: 'center' });
  
  y += 40;
  
  doc.fillColor(hexToRgb(COLORS.gray))
     .fontSize(10)
     .font('Helvetica')
     .text('pts/day', col1X, y, { width: colWidth, align: 'center' });
  
  doc.fillColor(hexToRgb(COLORS.gray))
     .fontSize(10)
     .font('Helvetica')
     .text('pts/day', col2X, y, { width: colWidth, align: 'center' });
}

// Draw footer
function drawFooter(doc, pageNum, totalPages) {
  doc.fontSize(8)
     .fillColor(hexToRgb(COLORS.gray))
     .text(`Page ${pageNum} of ${totalPages}`, 50, 750, {
       width: 512,
       align: 'center'
     });
}

// Main PDF generation function
// Draw Design Progress page with horizontal bars for each epic
function drawDesignProgress(doc, sprintData, startPageNum, totalPages) {
  const margin = 40;
  const pageWidth = 612; // Letter size width
  let y = margin + 20;
  let currentPageNum = startPageNum;
  
  // Title
  doc.fontSize(24)
     .font('Helvetica-Bold')
     .fillColor(COLORS.primary)
     .text('Epic Design Progress', margin, y, { align: 'center', width: pageWidth - (margin * 2) });
  
  y += 50;
  
  // Check if we have design data
  if (!sprintData.designProgress || sprintData.designProgress.length === 0) {
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor(COLORS.gray)
       .text('No design progress data available', margin, y + 100, { align: 'center', width: pageWidth - (margin * 2) });
    
    // Draw footer for this page
    drawFooter(doc, currentPageNum, totalPages);
    return 1; // Return number of pages used
  }
  
  // Sort by epic name for consistency
  const designs = [...sprintData.designProgress].sort((a, b) => a.epic.localeCompare(b.epic));
  
  const barHeight = 20;
  const barSpacing = 35;
  const maxBarWidth = pageWidth - (margin * 2) - 150; // Leave space for epic name and percentage
  const epicNameWidth = 350;
  
  // Calculate how many items fit per page
  const itemsPerPage = Math.floor((792 - y - 80) / barSpacing); // 792 is letter height, leave room for footer
  
  designs.forEach((design, index) => {
    // Add new page if needed
    if (index > 0 && index % itemsPerPage === 0) {
      // Draw footer on current page before adding new one
      drawFooter(doc, currentPageNum, totalPages);
      
      doc.addPage();
      currentPageNum++;
      y = margin + 20;
      
      // Repeat title on new page
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor(COLORS.primary)
         .text('Epic Design Progress (continued)', margin, y, { align: 'center', width: pageWidth - (margin * 2) });
      y += 40;
    }
    
    // Epic name (truncate if too long)
    let epicName = design.epic;
    if (epicName.length > 50) {
      epicName = epicName.substring(0, 47) + '...';
    }
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#000000')
       .text(epicName, margin, y + 5, { width: epicNameWidth, lineBreak: false, ellipsis: true });
    
    // Draw background bar (gray)
    const barX = margin + epicNameWidth + 10;
    doc.rect(barX, y, maxBarWidth, barHeight)
       .fillAndStroke(COLORS.lightGray, COLORS.gray);
    
    // Draw progress bar (colored based on percentage)
    const progressWidth = (design.percentComplete / 100) * maxBarWidth;
    let barColor;
    
    if (design.percentComplete >= 90) {
      barColor = COLORS.secondary; // Green
    } else if (design.percentComplete >= 50) {
      barColor = COLORS.warning; // Orange
    } else {
      barColor = COLORS.danger; // Red
    }
    
    if (progressWidth > 0) {
      doc.rect(barX, y, progressWidth, barHeight)
         .fill(barColor);
    }
    
    // Percentage text
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text(`${design.percentComplete}%`, barX + maxBarWidth + 10, y + 5);
    
    y += barSpacing;
  });
  
  // Summary statistics at the bottom if space allows
  if (y < 700) {
    y += 20;
    
    const completed = designs.filter(d => d.percentComplete === 100).length;
    const inProgress = designs.filter(d => d.percentComplete > 0 && d.percentComplete < 100).length;
    const notStarted = designs.filter(d => d.percentComplete === 0).length;
    const avgProgress = Math.round(designs.reduce((sum, d) => sum + d.percentComplete, 0) / designs.length);
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.primary)
       .text('Design Summary:', margin, y);
    
    y += 20;
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#000000')
       .text(`Total Epics: ${designs.length}`, margin, y)
       .text(`Completed: ${completed}`, margin, y + 15)
       .text(`In Progress: ${inProgress}`, margin, y + 30)
       .text(`Not Started: ${notStarted}`, margin, y + 45)
       .text(`Average Progress: ${avgProgress}%`, margin, y + 60);
  }
  
  // Draw footer on final page
  drawFooter(doc, currentPageNum, totalPages);
  
  // Return number of pages used
  return currentPageNum - startPageNum + 1;
}

async function generatePDF(sprintData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'LETTER',
        margins: { top: 0, bottom: 50, left: 0, right: 0 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Determine total pages based on whether we have design data
      let totalPages = 2;
      if (sprintData.designProgress && sprintData.designProgress.length > 0) {
        // Calculate additional pages needed for design progress
        const itemsPerPage = Math.floor((792 - 40 - 20 - 80) / 35); // Same calculation as in drawDesignProgress
        const designPages = Math.ceil(sprintData.designProgress.length / itemsPerPage);
        totalPages = 2 + designPages;
      }
      
      // Page 1: Simple Sprint Status
      drawSimpleSprintStatus(doc, sprintData);
      drawFooter(doc, 1, totalPages);
      
      // Page 2: Detailed Insights
      doc.addPage();
      drawExecutiveSummary(doc, sprintData);
      drawFooter(doc, 2, totalPages);
      
      // Page 3+: Design Progress (if data available)
      if (sprintData.designProgress && sprintData.designProgress.length > 0) {
        doc.addPage();
        drawDesignProgress(doc, sprintData, 3, totalPages);
      }
      
      doc.end();
      
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };

