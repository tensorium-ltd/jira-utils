#!/usr/bin/env node

/**
 * Combined Team Impact Analysis – NH Sprint 37
 *
 * Merges Blocked + In QA/Review delays to show total impact on each team.
 * Answers: Which teams are most affected by blocked work AND QA bottlenecks?
 */

const fs = require('fs');
const path = require('path');

const QA_REVIEW_STATUSES = ['In QA', 'Ready for QA', 'Ready for Review', 'In Review'];

function formatDuration(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hrs = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hrs > 0) return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  return `${Math.floor(ms / 60000)} min`;
}

function main() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  const dateStr = new Date().toISOString().split('T')[0];

  let blockedPath = path.join(reportsDir, `blocked-analysis-${dateStr}.json`);
  let longCyclePath = path.join(reportsDir, `long-cycle-time-analysis-${dateStr}.json`);

  if (!fs.existsSync(blockedPath)) {
    const blockedFiles = fs.readdirSync(reportsDir).filter((f) => f.startsWith('blocked-analysis-') && f.endsWith('.json'));
    if (blockedFiles.length === 0) {
      console.error('Blocked analysis not found. Run "npm run blocked-analysis" first.');
      process.exit(1);
    }
    blockedPath = path.join(reportsDir, blockedFiles.sort().reverse()[0]);
  }
  if (!fs.existsSync(longCyclePath)) {
    const lcFiles = fs.readdirSync(reportsDir).filter((f) => f.startsWith('long-cycle-time-analysis-') && f.endsWith('.json'));
    if (lcFiles.length === 0) {
      console.error('Long cycle time analysis not found. Run "npm run long-cycle-analysis" first.');
      process.exit(1);
    }
    longCyclePath = path.join(reportsDir, lcFiles.sort().reverse()[0]);
  }

  const blockedReport = JSON.parse(fs.readFileSync(blockedPath, 'utf8'));
  const longCycleReport = JSON.parse(fs.readFileSync(longCyclePath, 'utf8'));

  const teamStats = {};

  function ensureTeam(team) {
    const t = team || 'Unassigned';
    if (!teamStats[t]) {
      teamStats[t] = {
        blockedCount: 0,
        blockedMs: 0,
        qaDelayMs: 0,
        qaDelayStories: 0,
        blockedKeys: [],
        qaDelayKeys: []
      };
    }
    return t;
  }

  for (const b of blockedReport.blocked || []) {
    const team = ensureTeam(b.team);
    teamStats[team].blockedCount++;
    teamStats[team].blockedMs += b.timeInCurrentStatusMs || 0;
    teamStats[team].blockedKeys.push(b.key);
  }

  for (const a of longCycleReport.analyses || []) {
    let qaMs = 0;
    for (const s of a.statusBreakdown || []) {
      if (QA_REVIEW_STATUSES.some((qs) => (s.status || '').toLowerCase().includes(qs.toLowerCase()))) {
        qaMs += s.ms || 0;
      }
    }
    if (qaMs > 0) {
      const team = ensureTeam(a.team);
      teamStats[team].qaDelayMs += qaMs;
      teamStats[team].qaDelayStories++;
      teamStats[team].qaDelayKeys.push(a.key);
    }
  }

  const teams = Object.keys(teamStats).sort((a, b) => {
    const totalA = teamStats[a].blockedMs + teamStats[a].qaDelayMs;
    const totalB = teamStats[b].blockedMs + teamStats[b].qaDelayMs;
    return totalB - totalA;
  });

  const mdLines = [];
  mdLines.push('# Combined Team Impact – Blocked + QA Delays');
  mdLines.push('');
  mdLines.push(`**Generated:** ${dateStr}`);
  mdLines.push(`**Sprint:** NH Sprint 37`);
  mdLines.push('');
  mdLines.push('Combines:');
  mdLines.push('- **Blocked:** Tickets currently in Blocked status');
  mdLines.push('- **QA delays:** Time spent in Ready for QA, In QA, Ready for Review, In Review (from completed stories > 5 days)');
  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Team impact summary');
  mdLines.push('');
  mdLines.push('| Team | Blocked (tickets) | Blocked (time) | QA delays (stories) | QA delays (time) | **Total impact** |');
  mdLines.push('|------|-------------------|----------------|----------------------|------------------|------------------|');

  for (const team of teams) {
    const s = teamStats[team];
    const totalMs = s.blockedMs + s.qaDelayMs;
    mdLines.push(
      `| ${team} | ${s.blockedCount} | ${formatDuration(s.blockedMs)} | ${s.qaDelayStories} | ${formatDuration(s.qaDelayMs)} | **${formatDuration(totalMs)}** |`
    );
  }

  mdLines.push('');
  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Insights');
  mdLines.push('');

  const totalBlockedMs = teams.reduce((sum, t) => sum + teamStats[t].blockedMs, 0);
  const totalQaMs = teams.reduce((sum, t) => sum + teamStats[t].qaDelayMs, 0);

  const worstBlocked = teams.reduce((best, t) =>
    teamStats[t].blockedMs > teamStats[best].blockedMs ? t : best
  );
  const worstQa = teams.reduce((best, t) =>
    teamStats[t].qaDelayMs > teamStats[best].qaDelayMs ? t : best
  );

  mdLines.push(`- **Total blocked time:** ${formatDuration(totalBlockedMs)} across all teams`);
  mdLines.push(`- **Total QA delay time:** ${formatDuration(totalQaMs)} (from long-cycle completed stories)`);
  mdLines.push(`- **Most blocked:** ${worstBlocked} (${formatDuration(teamStats[worstBlocked].blockedMs)})`);
  mdLines.push(`- **Most QA delays:** ${worstQa} (${formatDuration(teamStats[worstQa].qaDelayMs)})`);
  mdLines.push('');

  const combined = teams.map((t) => ({ team: t, totalMs: teamStats[t].blockedMs + teamStats[t].qaDelayMs }));
  const mostImpacted = combined[0];
  if (mostImpacted && mostImpacted.totalMs > 0) {
    mdLines.push(`- **Highest combined impact:** ${mostImpacted.team} – ${formatDuration(mostImpacted.totalMs)}`);
  }
  mdLines.push('');

  mdLines.push('---');
  mdLines.push('');
  mdLines.push('## Detail by team');
  mdLines.push('');

  for (const team of teams) {
    const s = teamStats[team];
    mdLines.push(`### ${team}`);
    mdLines.push('');
    mdLines.push(`- Blocked: ${s.blockedCount} tickets, ${formatDuration(s.blockedMs)}`);
    if (s.blockedKeys.length > 0) {
      mdLines.push(`  - ${s.blockedKeys.join(', ')}`);
    }
    mdLines.push(`- QA delays: ${s.qaDelayStories} completed stories, ${formatDuration(s.qaDelayMs)}`);
    if (s.qaDelayKeys.length > 0) {
      mdLines.push(`  - ${s.qaDelayKeys.join(', ')}`);
    }
    mdLines.push('');
  }

  const jsonPath = path.join(reportsDir, `combined-team-impact-${dateStr}.json`);
  const mdPath = path.join(reportsDir, `combined-team-impact-${dateStr}.md`);

  const report = {
    generatedAt: new Date().toISOString(),
    sprint: 'NH Sprint 37',
    teamStats: Object.fromEntries(
      teams.map((t) => [
        t,
        {
          ...teamStats[t],
          blockedFormatted: formatDuration(teamStats[t].blockedMs),
          qaDelayFormatted: formatDuration(teamStats[t].qaDelayMs),
          totalMs: teamStats[t].blockedMs + teamStats[t].qaDelayMs,
          totalFormatted: formatDuration(teamStats[t].blockedMs + teamStats[t].qaDelayMs)
        }
      ])
    )
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('\n📊 Combined Team Impact (Blocked + QA Delays)');
  console.log('='.repeat(60));
  console.log('');
  console.log('| Team        | Blocked      | QA delays    | Total impact |');
  console.log('|-------------|--------------|--------------|--------------|');
  for (const team of teams) {
    const s = teamStats[team];
    const total = formatDuration(s.blockedMs + s.qaDelayMs);
    console.log(`| ${team.padEnd(12)} | ${s.blockedCount} (${formatDuration(s.blockedMs).padEnd(10)}) | ${s.qaDelayStories} (${formatDuration(s.qaDelayMs).padEnd(10)}) | ${total.padEnd(12)} |`);
  }
  console.log('');
  console.log(`✅ Report saved: ${jsonPath}`);
  console.log(`✅ Markdown saved: ${mdPath}`);
}

main();
