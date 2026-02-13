/**
 * Generate Weighted Analysis Report
 * 
 * Analyzes functionality tracker with effort weightings (1, 2, 3)
 * to show weighted completion by Workstream and Release
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/functionality-tracker.json');

// Define which stages count as "complete"
const COMPLETE_STAGES = [
  'Ready for Release',
  'Released / Delivered',
  'Closed Out'
];

// Define which stages count as "in progress" (active work)
const IN_PROGRESS_STAGES = [
  'In Design',
  'Design Complete',
  'In Development',
  'Development Complete',
  'In Internal QA / Dev Testing',
  'Ready for UAT',
  'In UAT',
  'UAT Complete'
];

function isComplete(stage) {
  return COMPLETE_STAGES.includes(stage);
}

function isInProgress(stage) {
  return IN_PROGRESS_STAGES.includes(stage);
}

function isNotStarted(stage) {
  return stage === 'Not Started' || stage === null || stage === undefined;
}

function generateReport() {
  console.log('📊 WEIGHTED ANALYSIS REPORT');
  console.log('═'.repeat(120));
  console.log(`Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log('═'.repeat(120));

  // Load data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const items = data.items;

  // Calculate totals
  let totalItems = items.length;
  let totalEffort = 0;
  let completedEffort = 0;
  let inProgressEffort = 0;
  let notStartedEffort = 0;

  for (const item of items) {
    const effort = item.effort || 1;
    totalEffort += effort;
    
    if (isComplete(item.currentStage)) {
      completedEffort += effort;
    } else if (isInProgress(item.currentStage)) {
      inProgressEffort += effort;
    } else {
      notStartedEffort += effort;
    }
  }

  // Overall Summary
  console.log('\n📈 OVERALL WEIGHTED SUMMARY');
  console.log('─'.repeat(120));
  console.log(`\n  Total Items:           ${totalItems}`);
  console.log(`  Total Weighted Effort: ${totalEffort}`);
  console.log(`\n  Weighted Progress:`);
  
  const completePct = ((completedEffort / totalEffort) * 100).toFixed(1);
  const inProgressPct = ((inProgressEffort / totalEffort) * 100).toFixed(1);
  const notStartedPct = ((notStartedEffort / totalEffort) * 100).toFixed(1);
  
  const barWidth = 60;
  const completeBar = Math.round((completedEffort / totalEffort) * barWidth);
  const progressBar = Math.round((inProgressEffort / totalEffort) * barWidth);
  const notStartedBar = barWidth - completeBar - progressBar;
  
  console.log(`  [${'█'.repeat(completeBar)}${'▓'.repeat(progressBar)}${'░'.repeat(Math.max(0, notStartedBar))}]`);
  console.log(`   █ Complete: ${completedEffort} (${completePct}%)  |  ▓ In Progress: ${inProgressEffort} (${inProgressPct}%)  |  ░ Not Started: ${notStartedEffort} (${notStartedPct}%)`);

  // ============================================
  // BREAKDOWN BY RELEASE
  // ============================================
  console.log('\n\n' + '═'.repeat(120));
  console.log('📦 WEIGHTED ANALYSIS BY RELEASE');
  console.log('═'.repeat(120));

  const byRelease = {};
  for (const item of items) {
    const rel = item.release || 'No Release';
    const effort = item.effort || 1;
    
    if (!byRelease[rel]) {
      byRelease[rel] = {
        items: 0,
        totalEffort: 0,
        completedEffort: 0,
        inProgressEffort: 0,
        notStartedEffort: 0,
        byStage: {}
      };
    }
    
    byRelease[rel].items++;
    byRelease[rel].totalEffort += effort;
    
    if (isComplete(item.currentStage)) {
      byRelease[rel].completedEffort += effort;
    } else if (isInProgress(item.currentStage)) {
      byRelease[rel].inProgressEffort += effort;
    } else {
      byRelease[rel].notStartedEffort += effort;
    }
    
    const stage = item.currentStage || 'Not Started';
    if (!byRelease[rel].byStage[stage]) {
      byRelease[rel].byStage[stage] = { count: 0, effort: 0 };
    }
    byRelease[rel].byStage[stage].count++;
    byRelease[rel].byStage[stage].effort += effort;
  }

  // Sort releases in logical order
  const releaseOrder = ['Release 1A', 'Release 1B', 'Release 1C', 'Release 1D', 'Release 2A', 'Release 2B', 'Release Clarify', 'Release TBC', 'No Release'];
  const sortedReleases = Object.entries(byRelease).sort((a, b) => {
    const aIdx = releaseOrder.indexOf(a[0]);
    const bIdx = releaseOrder.indexOf(b[0]);
    if (aIdx === -1 && bIdx === -1) return a[0].localeCompare(b[0]);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // Release Summary Table
  console.log('\n| Release              | Items | Total Effort | Complete | In Progress | Not Started | % Complete |');
  console.log('|' + '─'.repeat(22) + '|' + '─'.repeat(7) + '|' + '─'.repeat(14) + '|' + '─'.repeat(10) + '|' + '─'.repeat(13) + '|' + '─'.repeat(13) + '|' + '─'.repeat(12) + '|');
  
  for (const [release, data] of sortedReleases) {
    const pct = data.totalEffort > 0 ? ((data.completedEffort / data.totalEffort) * 100).toFixed(0) : 0;
    console.log(`| ${release.padEnd(20)} | ${String(data.items).padStart(5)} | ${String(data.totalEffort).padStart(12)} | ${String(data.completedEffort).padStart(8)} | ${String(data.inProgressEffort).padStart(11)} | ${String(data.notStartedEffort).padStart(11)} | ${String(pct).padStart(9)}% |`);
  }

  // Detailed Release Breakdown
  for (const [release, data] of sortedReleases) {
    const completePct = data.totalEffort > 0 ? ((data.completedEffort / data.totalEffort) * 100).toFixed(1) : 0;
    const inProgressPct = data.totalEffort > 0 ? ((data.inProgressEffort / data.totalEffort) * 100).toFixed(1) : 0;
    
    console.log(`\n┌─ 📦 ${release} ${'─'.repeat(Math.max(0, 100 - release.length))}`);
    console.log(`│  Items: ${data.items}  |  Total Effort: ${data.totalEffort}  |  Complete: ${completePct}%  |  In Progress: ${inProgressPct}%`);
    
    // Progress bar
    const rBarWidth = 50;
    const rComplete = Math.round((data.completedEffort / data.totalEffort) * rBarWidth);
    const rProgress = Math.round((data.inProgressEffort / data.totalEffort) * rBarWidth);
    const rNotStarted = Math.max(0, rBarWidth - rComplete - rProgress);
    console.log(`│  [${'█'.repeat(rComplete)}${'▓'.repeat(rProgress)}${'░'.repeat(rNotStarted)}]`);
    
    // Stage breakdown
    console.log(`│`);
    console.log(`│  Stage Breakdown:`);
    const sortedStages = Object.entries(data.byStage).sort((a, b) => b[1].effort - a[1].effort);
    for (const [stage, stageData] of sortedStages) {
      const stagePct = ((stageData.effort / data.totalEffort) * 100).toFixed(0);
      const icon = isComplete(stage) ? '✅' : isInProgress(stage) ? '🔧' : '⬜';
      console.log(`│    ${icon} ${stage.padEnd(30)} ${String(stageData.count).padStart(3)} items, ${String(stageData.effort).padStart(3)} effort (${stagePct}%)`);
    }
    console.log(`└${'─'.repeat(119)}`);
  }

  // ============================================
  // BREAKDOWN BY WORKSTREAM
  // ============================================
  console.log('\n\n' + '═'.repeat(120));
  console.log('📁 WEIGHTED ANALYSIS BY WORKSTREAM');
  console.log('═'.repeat(120));

  const byWorkstream = {};
  for (const item of items) {
    const ws = item.workstream || 'No Workstream';
    const effort = item.effort || 1;
    
    if (!byWorkstream[ws]) {
      byWorkstream[ws] = {
        items: 0,
        totalEffort: 0,
        completedEffort: 0,
        inProgressEffort: 0,
        notStartedEffort: 0,
        byRelease: {}
      };
    }
    
    byWorkstream[ws].items++;
    byWorkstream[ws].totalEffort += effort;
    
    if (isComplete(item.currentStage)) {
      byWorkstream[ws].completedEffort += effort;
    } else if (isInProgress(item.currentStage)) {
      byWorkstream[ws].inProgressEffort += effort;
    } else {
      byWorkstream[ws].notStartedEffort += effort;
    }
    
    // Track by release within workstream
    const rel = item.release || 'No Release';
    if (!byWorkstream[ws].byRelease[rel]) {
      byWorkstream[ws].byRelease[rel] = { count: 0, effort: 0, completed: 0 };
    }
    byWorkstream[ws].byRelease[rel].count++;
    byWorkstream[ws].byRelease[rel].effort += effort;
    if (isComplete(item.currentStage)) {
      byWorkstream[ws].byRelease[rel].completed += effort;
    }
  }

  // Sort workstreams by total effort (descending)
  const sortedWorkstreams = Object.entries(byWorkstream)
    .sort((a, b) => b[1].totalEffort - a[1].totalEffort);

  // Workstream Summary Table
  console.log('\n| Workstream                          | Items | Total Effort | Complete | In Progress | Not Started | % Complete |');
  console.log('|' + '─'.repeat(37) + '|' + '─'.repeat(7) + '|' + '─'.repeat(14) + '|' + '─'.repeat(10) + '|' + '─'.repeat(13) + '|' + '─'.repeat(13) + '|' + '─'.repeat(12) + '|');
  
  for (const [ws, data] of sortedWorkstreams) {
    const pct = data.totalEffort > 0 ? ((data.completedEffort / data.totalEffort) * 100).toFixed(0) : 0;
    console.log(`| ${ws.substring(0, 35).padEnd(35)} | ${String(data.items).padStart(5)} | ${String(data.totalEffort).padStart(12)} | ${String(data.completedEffort).padStart(8)} | ${String(data.inProgressEffort).padStart(11)} | ${String(data.notStartedEffort).padStart(11)} | ${String(pct).padStart(9)}% |`);
  }

  // Detailed Workstream Breakdown
  for (const [ws, data] of sortedWorkstreams) {
    const completePct = data.totalEffort > 0 ? ((data.completedEffort / data.totalEffort) * 100).toFixed(1) : 0;
    const inProgressPct = data.totalEffort > 0 ? ((data.inProgressEffort / data.totalEffort) * 100).toFixed(1) : 0;
    const notStartedPct = data.totalEffort > 0 ? ((data.notStartedEffort / data.totalEffort) * 100).toFixed(1) : 0;
    
    console.log(`\n┌─ 📁 ${ws} ${'─'.repeat(Math.max(0, 100 - ws.length))}`);
    console.log(`│  Items: ${data.items}  |  Total Effort: ${data.totalEffort}  |  Complete: ${completePct}%  |  In Progress: ${inProgressPct}%  |  Not Started: ${notStartedPct}%`);
    
    // Progress bar
    const wBarWidth = 50;
    const wComplete = Math.round((data.completedEffort / data.totalEffort) * wBarWidth);
    const wProgress = Math.round((data.inProgressEffort / data.totalEffort) * wBarWidth);
    const wNotStarted = Math.max(0, wBarWidth - wComplete - wProgress);
    console.log(`│  [${'█'.repeat(wComplete)}${'▓'.repeat(wProgress)}${'░'.repeat(wNotStarted)}]`);
    
    // Release breakdown within workstream
    console.log(`│`);
    console.log(`│  Release Breakdown:`);
    const sortedRels = Object.entries(data.byRelease).sort((a, b) => b[1].effort - a[1].effort);
    for (const [rel, relData] of sortedRels) {
      const relPct = ((relData.effort / data.totalEffort) * 100).toFixed(0);
      const completedPct = relData.effort > 0 ? ((relData.completed / relData.effort) * 100).toFixed(0) : 0;
      console.log(`│    📦 ${rel.padEnd(20)} ${String(relData.count).padStart(3)} items, ${String(relData.effort).padStart(3)} effort (${relPct}% of workstream) - ${completedPct}% complete`);
    }
    console.log(`└${'─'.repeat(119)}`);
  }

  // ============================================
  // WORK REMAINING SUMMARY
  // ============================================
  console.log('\n\n' + '═'.repeat(120));
  console.log('⏳ WORK REMAINING (Weighted Effort Still To Do)');
  console.log('═'.repeat(120));

  // By Release - Work Remaining
  console.log('\n📦 BY RELEASE:');
  console.log('─'.repeat(80));
  
  const remainingByRelease = sortedReleases
    .map(([rel, data]) => ({
      release: rel,
      remaining: data.inProgressEffort + data.notStartedEffort,
      inProgress: data.inProgressEffort,
      notStarted: data.notStartedEffort,
      total: data.totalEffort
    }))
    .filter(r => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  console.log('\n| Release              | Remaining | In Progress | Not Started | % of Total Remaining |');
  console.log('|' + '─'.repeat(22) + '|' + '─'.repeat(11) + '|' + '─'.repeat(13) + '|' + '─'.repeat(13) + '|' + '─'.repeat(22) + '|');
  
  const totalRemaining = inProgressEffort + notStartedEffort;
  for (const r of remainingByRelease) {
    const pctOfTotal = ((r.remaining / totalRemaining) * 100).toFixed(1);
    console.log(`| ${r.release.padEnd(20)} | ${String(r.remaining).padStart(9)} | ${String(r.inProgress).padStart(11)} | ${String(r.notStarted).padStart(11)} | ${pctOfTotal.padStart(19)}% |`);
  }
  console.log(`| ${'TOTAL'.padEnd(20)} | ${String(totalRemaining).padStart(9)} | ${String(inProgressEffort).padStart(11)} | ${String(notStartedEffort).padStart(11)} | ${'100.0'.padStart(19)}% |`);

  // By Workstream - Work Remaining
  console.log('\n\n📁 BY WORKSTREAM:');
  console.log('─'.repeat(80));
  
  const remainingByWorkstream = sortedWorkstreams
    .map(([ws, data]) => ({
      workstream: ws,
      remaining: data.inProgressEffort + data.notStartedEffort,
      inProgress: data.inProgressEffort,
      notStarted: data.notStartedEffort,
      total: data.totalEffort
    }))
    .filter(w => w.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  console.log('\n| Workstream                          | Remaining | In Progress | Not Started | % of Total Remaining |');
  console.log('|' + '─'.repeat(37) + '|' + '─'.repeat(11) + '|' + '─'.repeat(13) + '|' + '─'.repeat(13) + '|' + '─'.repeat(22) + '|');
  
  for (const w of remainingByWorkstream) {
    const pctOfTotal = ((w.remaining / totalRemaining) * 100).toFixed(1);
    console.log(`| ${w.workstream.substring(0, 35).padEnd(35)} | ${String(w.remaining).padStart(9)} | ${String(w.inProgress).padStart(11)} | ${String(w.notStarted).padStart(11)} | ${pctOfTotal.padStart(19)}% |`);
  }
  console.log(`| ${'TOTAL'.padEnd(35)} | ${String(totalRemaining).padStart(9)} | ${String(inProgressEffort).padStart(11)} | ${String(notStartedEffort).padStart(11)} | ${'100.0'.padStart(19)}% |`);

  // Final Summary
  console.log('\n\n' + '═'.repeat(120));
  console.log('📊 EXECUTIVE SUMMARY');
  console.log('═'.repeat(120));
  console.log(`
  Total Functionality Items:    ${totalItems}
  Total Weighted Effort:        ${totalEffort}
  
  ✅ Completed:                  ${completedEffort} effort (${completePct}%)
  🔧 In Progress:                ${inProgressEffort} effort (${inProgressPct}%)
  ⬜ Not Started:                ${notStartedEffort} effort (${notStartedPct}%)
  
  Work Remaining:               ${totalRemaining} effort (${(100 - parseFloat(completePct)).toFixed(1)}%)
  `);

  console.log('═'.repeat(120));
}

generateReport();



















