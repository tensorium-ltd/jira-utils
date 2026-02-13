#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log('\nUsage:');
  console.log('  npm run workflow-queue-summary -- <path-to-json>');
  console.log('  npm run workflow-queue-summary');
  console.log('');
  console.log('If no path is provided, the most recent workflow-queue-metrics report is used.');
}

function resolveInputPath(argPath) {
  if (argPath) {
    return path.resolve(process.cwd(), argPath);
  }

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    console.error('Error: reports directory not found.');
    process.exit(1);
  }

  const candidates = fs.readdirSync(reportsDir)
    .filter(name => name.startsWith('workflow-queue-metrics-') && name.endsWith('.json'))
    .map(name => ({
      name,
      fullPath: path.join(reportsDir, name),
      mtime: fs.statSync(path.join(reportsDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    console.error('Error: no workflow-queue-metrics JSON reports found.');
    process.exit(1);
  }

  return candidates[0].fullPath;
}

function loadReport(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`Error: file not found: ${filepath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

function summarizeStatusMetrics(statusMetrics, statusOrder) {
  const totals = {};
  const dayCounts = {};

  Object.entries(statusMetrics || {}).forEach(([date, statuses]) => {
    statusOrder.forEach(status => {
      const metrics = statuses[status];
      if (!metrics) return;
      if (!totals[status]) {
        totals[status] = { lambda: 0, mu: 0, wip: 0, utilizationSum: 0, utilizationCount: 0 };
        dayCounts[status] = 0;
      }
      totals[status].lambda += metrics.lambda || 0;
      totals[status].mu += metrics.mu || 0;
      totals[status].wip += metrics.wip || 0;
      if (metrics.utilization !== null && metrics.utilization !== undefined) {
        totals[status].utilizationSum += metrics.utilization;
        totals[status].utilizationCount += 1;
      }
      dayCounts[status] += 1;
    });
  });

  const averages = {};
  statusOrder.forEach(status => {
    const total = totals[status];
    if (!total || !dayCounts[status]) return;
    averages[status] = {
      avgLambda: total.lambda / dayCounts[status],
      avgMu: total.mu / dayCounts[status],
      avgWip: total.wip / dayCounts[status],
      avgUtilization: total.utilizationCount > 0 ? total.utilizationSum / total.utilizationCount : null
    };
  });

  return averages;
}

function buildSummaryLines(report, inputPath) {
  const metadata = report.metadata || {};
  const statusOrder = metadata.statusOrder || [];
  const dateRange = metadata.dateRange || {};
  const cycleTimeSummary = report.cycleTimeSummary || {};
  const flagsSummary = report.flagsSummary || {};
  const averages = summarizeStatusMetrics(report.statusMetrics, statusOrder);

  const lines = [];
  lines.push('# Workflow Queue Summary');
  lines.push('');
  lines.push(`Source: ${inputPath}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Project: ${metadata.projectKey || 'n/a'}`);
  if (metadata.sprints && metadata.sprints.length) {
    lines.push(`Sprints: ${metadata.sprints.join(', ')}`);
  }
  lines.push(`Date Range: ${dateRange.start || 'n/a'} to ${dateRange.end || 'n/a'}`);
  lines.push(`WIP Snapshot As Of: ${metadata.wipAsOf || 'n/a'}`);
  lines.push('');

  if (flagsSummary.flaggedStatuses && flagsSummary.flaggedStatuses.length) {
    lines.push('## Bottleneck Flags');
    lines.push('');
    lines.push(`Flagged Statuses: ${flagsSummary.flaggedStatuses.join(', ')}`);
    if (flagsSummary.flaggedByDay && flagsSummary.flaggedByDay.length) {
      lines.push('');
      lines.push('| Date | Status | Reasons |');
      lines.push('|------|--------|---------|');
      flagsSummary.flaggedByDay.forEach(entry => {
        lines.push(`| ${entry.date} | ${entry.status} | ${entry.reasons.join(', ')} |`);
      });
    }
    lines.push('');
  }

  lines.push('## Status Averages (Daily)');
  lines.push('');
  lines.push('| Status | Avg λ | Avg μ | Avg WIP | Avg ρ |');
  lines.push('|--------|-------|-------|---------|-------|');
  statusOrder.forEach(status => {
    const avg = averages[status];
    if (!avg) return;
    lines.push(`| ${status} | ${formatNumber(avg.avgLambda)} | ${formatNumber(avg.avgMu)} | ${formatNumber(avg.avgWip)} | ${formatNumber(avg.avgUtilization)} |`);
  });
  lines.push('');

  lines.push('## Cycle Time Summary');
  lines.push('');
  lines.push('| Status | Count | Mean (days) | Median (days) | P85 (days) |');
  lines.push('|--------|-------|-------------|---------------|------------|');
  statusOrder.forEach(status => {
    const stats = cycleTimeSummary[status];
    if (!stats) return;
    lines.push(`| ${status} | ${stats.count} | ${formatNumber(stats.meanDays)} | ${formatNumber(stats.medianDays)} | ${formatNumber(stats.p85Days)} |`);
  });

  return lines;
}

function saveSummary(lines, inputPath) {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const inputBase = path.basename(inputPath).replace('.json', '');
  const outputPath = path.join(reportsDir, `${inputBase}-summary.md`);
  fs.writeFileSync(outputPath, lines.join('\n'));
  return outputPath;
}

function main() {
  const argPath = process.argv[2];
  if (argPath === '--help' || argPath === '-h') {
    printUsage();
    return;
  }

  const inputPath = resolveInputPath(argPath);
  const report = loadReport(inputPath);
  const lines = buildSummaryLines(report, inputPath);
  const outputPath = saveSummary(lines, inputPath);

  console.log(`Summary saved: ${outputPath}`);
}

main();
