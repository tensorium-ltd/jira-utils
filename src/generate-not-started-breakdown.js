/**
 * Generate Not Started (0%) Work Breakdown Report
 * 
 * Shows all items that haven't been started yet, grouped by workstream
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/functionality-tracker.json');

function generateReport() {
  console.log('📊 NOT STARTED (0%) WORK BREAKDOWN BY WORKSTREAM');
  console.log('═'.repeat(100));
  console.log(`Generated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log('═'.repeat(100));

  // Load data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const items = data.items;

  // Filter to Not Started items only
  const notStartedItems = items.filter(item => 
    item.currentStage === 'Not Started' || 
    item.currentStage === null || 
    item.currentStage === undefined
  );
  
  const totalItems = items.length;
  const notStartedPct = ((notStartedItems.length / totalItems) * 100).toFixed(1);
  
  console.log(`\n⬜ Total "Not Started" items: ${notStartedItems.length} of ${totalItems} (${notStartedPct}%)`);
  console.log('─'.repeat(100));

  // Group by workstream
  const byWorkstream = {};
  for (const item of notStartedItems) {
    const ws = item.workstream || 'No Workstream';
    if (!byWorkstream[ws]) {
      byWorkstream[ws] = {
        items: [],
        byRelease: {}
      };
    }
    byWorkstream[ws].items.push(item);
    
    const release = item.release || 'No Release';
    byWorkstream[ws].byRelease[release] = (byWorkstream[ws].byRelease[release] || 0) + 1;
  }

  // Sort by item count descending
  const sorted = Object.entries(byWorkstream)
    .sort((a, b) => b[1].items.length - a[1].items.length);

  // Display breakdown
  console.log('\n📁 NOT STARTED ITEMS BY WORKSTREAM:\n');
  
  let rank = 1;
  for (const [wsName, wsData] of sorted) {
    const count = wsData.items.length;
    const pct = ((count / notStartedItems.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / 2));
    
    console.log(`${String(rank).padStart(2)}. ${wsName.padEnd(40)} ${String(count).padStart(3)} items (${pct.padStart(5)}%) ${bar}`);
    
    // Show release breakdown for this workstream
    const releaseDetails = Object.entries(wsData.byRelease)
      .sort((a, b) => b[1] - a[1])
      .map(([rel, cnt]) => `${rel}: ${cnt}`)
      .join(', ');
    console.log(`    └─ ${releaseDetails}`);
    console.log('');
    
    rank++;
  }

  // Summary by Release
  console.log('\n' + '═'.repeat(100));
  console.log('📊 NOT STARTED ITEMS BY RELEASE');
  console.log('═'.repeat(100));
  
  const byRelease = {};
  for (const item of notStartedItems) {
    const rel = item.release || 'No Release';
    byRelease[rel] = (byRelease[rel] || 0) + 1;
  }
  
  const sortedReleases = Object.entries(byRelease)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('\n| Release | Not Started | % of Not Started |');
  console.log('|' + '─'.repeat(30) + '|' + '─'.repeat(13) + '|' + '─'.repeat(18) + '|');
  
  for (const [release, count] of sortedReleases) {
    const pct = ((count / notStartedItems.length) * 100).toFixed(1);
    console.log(`| ${release.padEnd(28)} | ${String(count).padStart(11)} | ${pct.padStart(15)}% |`);
  }

  // Detailed list by workstream and release
  console.log('\n\n' + '═'.repeat(100));
  console.log('📋 DETAILED LIST OF ALL NOT STARTED ITEMS');
  console.log('═'.repeat(100));
  
  for (const [wsName, wsData] of sorted) {
    console.log(`\n┌─ 📁 ${wsName} (${wsData.items.length} not started) ${'─'.repeat(Math.max(0, 75 - wsName.length))}`);
    
    // Group items by release within workstream
    const itemsByRelease = {};
    for (const item of wsData.items) {
      const rel = item.release || 'No Release';
      if (!itemsByRelease[rel]) itemsByRelease[rel] = [];
      itemsByRelease[rel].push(item);
    }
    
    for (const [release, releaseItems] of Object.entries(itemsByRelease).sort()) {
      console.log(`│`);
      console.log(`│  📦 ${release} (${releaseItems.length})`);
      for (const item of releaseItems) {
        const name = (item.name || 'Unnamed').substring(0, 60);
        console.log(`│     ⬜ ${name}`);
      }
    }
    console.log('└' + '─'.repeat(99));
  }

  // Priority recommendations
  console.log('\n\n' + '═'.repeat(100));
  console.log('💡 PRIORITY RECOMMENDATIONS');
  console.log('═'.repeat(100));
  
  // Items in Release 1D or 2A that are not started (priority)
  const priorityReleases = ['Release 1D', 'Release 2A'];
  const priorityItems = notStartedItems.filter(item => 
    priorityReleases.includes(item.release)
  );
  
  console.log(`\n⚠️  ${priorityItems.length} items in Release 1D/2A are still Not Started:`);
  
  const priorityByWs = {};
  for (const item of priorityItems) {
    const ws = item.workstream || 'No Workstream';
    if (!priorityByWs[ws]) priorityByWs[ws] = [];
    priorityByWs[ws].push(item);
  }
  
  for (const [ws, items] of Object.entries(priorityByWs).sort((a,b) => b[1].length - a[1].length)) {
    console.log(`\n  📁 ${ws} (${items.length} items):`);
    for (const item of items.slice(0, 5)) {
      console.log(`     • ${item.name} [${item.release}]`);
    }
    if (items.length > 5) {
      console.log(`     ... and ${items.length - 5} more`);
    }
  }

  // Summary stats
  console.log('\n\n' + '═'.repeat(100));
  console.log('📊 SUMMARY STATISTICS');
  console.log('═'.repeat(100));
  console.log(`\n  Total Items:              ${totalItems}`);
  console.log(`  Not Started:              ${notStartedItems.length} (${notStartedPct}%)`);
  console.log(`  In Progress/Complete:     ${totalItems - notStartedItems.length} (${(100 - parseFloat(notStartedPct)).toFixed(1)}%)`);
  console.log(`\n  Workstreams with 0% work: ${sorted.length}`);
  console.log(`  Priority items (1D/2A):   ${priorityItems.length}`);
  
  console.log('\n' + '═'.repeat(100));
}

generateReport();



















