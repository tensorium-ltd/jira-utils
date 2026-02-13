/**
 * Generate Release TBC Breakdown Report
 * 
 * Shows how "Release TBC" items are distributed across workstreams
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/functionality-tracker.json');

function generateReport() {
  console.log('📊 RELEASE TBC BREAKDOWN BY WORKSTREAM');
  console.log('═'.repeat(100));
  console.log(`Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log('═'.repeat(100));

  // Load data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const items = data.items;

  // Filter to Release TBC items only
  const tbcItems = items.filter(item => item.release === 'Release TBC');
  
  console.log(`\n📋 Total "Release TBC" items: ${tbcItems.length}`);
  console.log('─'.repeat(100));

  // Group by workstream
  const byWorkstream = {};
  for (const item of tbcItems) {
    const ws = item.workstream || 'No Workstream';
    if (!byWorkstream[ws]) {
      byWorkstream[ws] = {
        items: [],
        stages: {}
      };
    }
    byWorkstream[ws].items.push(item);
    
    const stage = item.currentStage || 'Unknown';
    byWorkstream[ws].stages[stage] = (byWorkstream[ws].stages[stage] || 0) + 1;
  }

  // Sort by item count descending
  const sorted = Object.entries(byWorkstream)
    .sort((a, b) => b[1].items.length - a[1].items.length);

  // Display breakdown
  console.log('\n📁 BREAKDOWN BY WORKSTREAM:\n');
  
  let rank = 1;
  for (const [wsName, wsData] of sorted) {
    const count = wsData.items.length;
    const pct = ((count / tbcItems.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / 2));
    
    console.log(`${String(rank).padStart(2)}. ${wsName.padEnd(40)} ${String(count).padStart(3)} items (${pct.padStart(5)}%) ${bar}`);
    
    // Show stage breakdown for this workstream
    const stageDetails = Object.entries(wsData.stages)
      .sort((a, b) => b[1] - a[1])
      .map(([stage, cnt]) => `${stage}: ${cnt}`)
      .join(', ');
    console.log(`    └─ ${stageDetails}`);
    console.log('');
    
    rank++;
  }

  // Summary table
  console.log('\n' + '═'.repeat(100));
  console.log('📊 SUMMARY TABLE');
  console.log('═'.repeat(100));
  console.log('\n| Workstream | Items | % of TBC | Stage Breakdown |');
  console.log('|' + '─'.repeat(42) + '|' + '─'.repeat(7) + '|' + '─'.repeat(10) + '|' + '─'.repeat(40) + '|');
  
  for (const [wsName, wsData] of sorted) {
    const count = wsData.items.length;
    const pct = ((count / tbcItems.length) * 100).toFixed(1);
    const stageDetails = Object.entries(wsData.stages)
      .sort((a, b) => b[1] - a[1])
      .map(([stage, cnt]) => `${stage}(${cnt})`)
      .join(', ');
    
    console.log(`| ${wsName.padEnd(40)} | ${String(count).padStart(5)} | ${pct.padStart(7)}% | ${stageDetails.substring(0, 38).padEnd(38)} |`);
  }

  // List all TBC items with details
  console.log('\n\n' + '═'.repeat(100));
  console.log('📋 DETAILED LIST OF ALL RELEASE TBC ITEMS');
  console.log('═'.repeat(100));
  
  for (const [wsName, wsData] of sorted) {
    console.log(`\n┌─ 📁 ${wsName} (${wsData.items.length} items) ${'─'.repeat(Math.max(0, 80 - wsName.length))}`);
    
    for (const item of wsData.items) {
      const stage = item.currentStage || 'Unknown';
      const stageIcon = stage === 'Not Started' ? '⬜' : 
                        stage === 'In Design' ? '📐' : 
                        stage === 'In Development' ? '🔧' : '•';
      const name = (item.name || 'Unnamed').substring(0, 60);
      console.log(`│  ${stageIcon} ${name.padEnd(62)} [${stage}]`);
    }
    console.log('└' + '─'.repeat(99));
  }

  // Recommendations
  console.log('\n\n' + '═'.repeat(100));
  console.log('💡 RECOMMENDATIONS');
  console.log('═'.repeat(100));
  
  const topThree = sorted.slice(0, 3);
  console.log('\nTop 3 workstreams with most TBC items (prioritize for release assignment):');
  for (let i = 0; i < topThree.length; i++) {
    const [ws, data] = topThree[i];
    console.log(`  ${i + 1}. ${ws} - ${data.items.length} items needing release assignment`);
  }

  // Items that are in development but have no release - these are urgent
  const inDevTBC = tbcItems.filter(item => 
    item.currentStage === 'In Development' || 
    item.currentStage === 'Design Complete'
  );
  
  if (inDevTBC.length > 0) {
    console.log(`\n⚠️  URGENT: ${inDevTBC.length} items are In Development/Design Complete but have no release assigned:`);
    for (const item of inDevTBC) {
      console.log(`   • ${item.name} (${item.workstream}) - ${item.currentStage}`);
    }
  }

  console.log('\n' + '═'.repeat(100));
}

generateReport();



















