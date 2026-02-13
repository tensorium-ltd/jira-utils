/**
 * Generate Release Progress Summary
 * 
 * Shows:
 * 1. How total weighted effort is distributed across releases (as %)
 * 2. For each release, cumulative % complete based on weighted effort × stage percentage
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/functionality-tracker.json');

// Only include actual releases (exclude TBC, Clarify, etc.)
const RELEASE_ORDER = ['Release 1A', 'Release 1B', 'Release 1C', 'Release 1D', 'Release 2A', 'Release 2B'];

function generateReport() {
  console.log('📊 RELEASE PROGRESS SUMMARY');
  console.log('═'.repeat(100));
  console.log(`Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log('═'.repeat(100));

  // Load data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const items = data.items;

  // Filter to only items in the specified releases
  const releaseItems = items.filter(item => RELEASE_ORDER.includes(item.release));

  // Calculate total weighted effort across all releases
  let totalWeightedEffort = 0;
  
  const byRelease = {};
  for (const release of RELEASE_ORDER) {
    byRelease[release] = {
      items: [],
      totalEffort: 0,
      completedEffort: 0,  // Weighted by stage percentage
      itemCount: 0
    };
  }

  for (const item of releaseItems) {
    const release = item.release;
    const effort = item.effort || 1;
    const stagePercentage = item.percentage || 0;  // 0, 0.05, 0.1, 0.25, etc.
    
    totalWeightedEffort += effort;
    
    byRelease[release].items.push(item);
    byRelease[release].totalEffort += effort;
    byRelease[release].completedEffort += effort * stagePercentage;
    byRelease[release].itemCount++;
  }

  // Calculate percentages
  const releaseData = RELEASE_ORDER.map(release => {
    const data = byRelease[release];
    const percentOfTotal = totalWeightedEffort > 0 ? (data.totalEffort / totalWeightedEffort) * 100 : 0;
    const percentComplete = data.totalEffort > 0 ? (data.completedEffort / data.totalEffort) * 100 : 0;
    
    return {
      release,
      items: data.itemCount,
      totalEffort: data.totalEffort,
      completedEffort: data.completedEffort,
      percentOfTotal: percentOfTotal,
      percentComplete: percentComplete
    };
  });

  // Overall totals
  const totalCompletedEffort = releaseData.reduce((sum, r) => sum + r.completedEffort, 0);
  const overallPercentComplete = totalWeightedEffort > 0 ? (totalCompletedEffort / totalWeightedEffort) * 100 : 0;

  // ============================================
  // SECTION 1: Work Distribution Across Releases
  // ============================================
  console.log('\n📦 WORK DISTRIBUTION ACROSS RELEASES');
  console.log('─'.repeat(100));
  console.log(`\nTotal Weighted Effort (Releases 1A-2B): ${totalWeightedEffort}\n`);

  console.log('| Release      | Items | Weighted Effort | % of Total Work |');
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(7) + '|' + '─'.repeat(17) + '|' + '─'.repeat(17) + '|');
  
  for (const r of releaseData) {
    const bar = '█'.repeat(Math.round(r.percentOfTotal / 2));
    console.log(`| ${r.release.padEnd(12)} | ${String(r.items).padStart(5)} | ${String(r.totalEffort).padStart(15)} | ${r.percentOfTotal.toFixed(1).padStart(14)}% |`);
  }
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(7) + '|' + '─'.repeat(17) + '|' + '─'.repeat(17) + '|');
  console.log(`| ${'TOTAL'.padEnd(12)} | ${String(releaseItems.length).padStart(5)} | ${String(totalWeightedEffort).padStart(15)} | ${'100.0'.padStart(14)}% |`);

  // Visual breakdown
  console.log('\n📊 Visual Distribution:\n');
  for (const r of releaseData) {
    const barWidth = Math.round(r.percentOfTotal);
    const bar = '█'.repeat(barWidth);
    console.log(`  ${r.release.padEnd(12)} [${bar.padEnd(50)}] ${r.percentOfTotal.toFixed(1)}%`);
  }

  // ============================================
  // SECTION 2: Completion % Per Release
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('✅ COMPLETION PERCENTAGE BY RELEASE (Weighted)');
  console.log('═'.repeat(100));
  console.log('\nCalculated as: Σ(item effort × item stage %) / total release effort\n');

  console.log('| Release      | Total Effort | Completed Effort | % Complete |');
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(14) + '|' + '─'.repeat(18) + '|' + '─'.repeat(12) + '|');
  
  for (const r of releaseData) {
    console.log(`| ${r.release.padEnd(12)} | ${String(r.totalEffort).padStart(12)} | ${r.completedEffort.toFixed(1).padStart(16)} | ${r.percentComplete.toFixed(1).padStart(9)}% |`);
  }
  console.log('|' + '─'.repeat(14) + '|' + '─'.repeat(14) + '|' + '─'.repeat(18) + '|' + '─'.repeat(12) + '|');
  console.log(`| ${'OVERALL'.padEnd(12)} | ${String(totalWeightedEffort).padStart(12)} | ${totalCompletedEffort.toFixed(1).padStart(16)} | ${overallPercentComplete.toFixed(1).padStart(9)}% |`);

  // Visual progress bars
  console.log('\n📊 Progress by Release:\n');
  for (const r of releaseData) {
    const completeBars = Math.round(r.percentComplete / 2);
    const remainingBars = 50 - completeBars;
    const bar = '█'.repeat(completeBars) + '░'.repeat(remainingBars);
    console.log(`  ${r.release.padEnd(12)} [${bar}] ${r.percentComplete.toFixed(1)}%`);
  }

  // ============================================
  // SECTION 3: Detailed Release Breakdown
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('📋 DETAILED BREAKDOWN BY RELEASE');
  console.log('═'.repeat(100));

  for (const r of releaseData) {
    const releaseItems = byRelease[r.release].items;
    
    console.log(`\n┌─ 📦 ${r.release} ${'─'.repeat(85)}`);
    console.log(`│  Items: ${r.items}  |  Total Effort: ${r.totalEffort}  |  % of Total Work: ${r.percentOfTotal.toFixed(1)}%  |  % Complete: ${r.percentComplete.toFixed(1)}%`);
    
    // Progress bar
    const completeBars = Math.round(r.percentComplete / 2);
    const remainingBars = 50 - completeBars;
    console.log(`│  [${('█'.repeat(completeBars) + '░'.repeat(remainingBars))}]`);
    
    // Group items by stage
    const byStage = {};
    for (const item of releaseItems) {
      const stage = item.currentStage || 'Not Started';
      const pct = item.percentage || 0;
      if (!byStage[stage]) {
        byStage[stage] = { count: 0, effort: 0, percentage: pct };
      }
      byStage[stage].count++;
      byStage[stage].effort += item.effort || 1;
    }

    // Sort stages by percentage (highest first)
    const sortedStages = Object.entries(byStage).sort((a, b) => b[1].percentage - a[1].percentage);

    console.log(`│`);
    console.log(`│  Stage Breakdown:`);
    for (const [stage, data] of sortedStages) {
      const stagePct = (data.percentage * 100).toFixed(0);
      const effortPct = ((data.effort / r.totalEffort) * 100).toFixed(0);
      const icon = data.percentage >= 0.9 ? '✅' : data.percentage > 0 ? '🔧' : '⬜';
      console.log(`│    ${icon} ${stage.padEnd(30)} ${String(data.count).padStart(3)} items, ${String(data.effort).padStart(3)} effort (${effortPct}%) @ ${stagePct}% complete`);
    }
    console.log(`└${'─'.repeat(99)}`);
  }

  // ============================================
  // SECTION 4: Executive Summary
  // ============================================
  console.log('\n\n' + '═'.repeat(100));
  console.log('📊 EXECUTIVE SUMMARY');
  console.log('═'.repeat(100));

  // Calculate work remaining
  const workRemaining = totalWeightedEffort - totalCompletedEffort;

  console.log(`
  TOTAL SCOPE (Releases 1A - 2B)
  ─────────────────────────────────────────────
  Total Items:                ${releaseItems.length}
  Total Weighted Effort:      ${totalWeightedEffort}
  
  PROGRESS
  ─────────────────────────────────────────────
  Completed Effort:           ${totalCompletedEffort.toFixed(1)} (${overallPercentComplete.toFixed(1)}%)
  Remaining Effort:           ${workRemaining.toFixed(1)} (${(100 - overallPercentComplete).toFixed(1)}%)
  
  BY RELEASE
  ─────────────────────────────────────────────`);
  
  for (const r of releaseData) {
    const status = r.percentComplete >= 100 ? '✅' : r.percentComplete >= 50 ? '🔧' : r.percentComplete > 0 ? '📐' : '⬜';
    console.log(`  ${status} ${r.release.padEnd(12)}: ${r.percentOfTotal.toFixed(1).padStart(5)}% of work, ${r.percentComplete.toFixed(1).padStart(6)}% complete`);
  }

  // Pie chart representation
  console.log(`
  WORK DISTRIBUTION (Pie Chart)
  ─────────────────────────────────────────────`);
  
  let cumulative = 0;
  for (const r of releaseData) {
    const sliceStart = cumulative;
    cumulative += r.percentOfTotal;
    console.log(`  ${r.release.padEnd(12)}: ${r.percentOfTotal.toFixed(1).padStart(5)}% [${sliceStart.toFixed(0).padStart(3)}% - ${cumulative.toFixed(0).padStart(3)}%]`);
  }

  console.log('\n' + '═'.repeat(100));
}

generateReport();



















