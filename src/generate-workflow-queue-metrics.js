#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const DEFAULT_PROJECT_KEY = 'VER10';
const MIN_START_DATE = '2026-01-19';
const TARGET_SPRINTS = ['NH Sprint 34', 'NH Sprint 35'];

function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  if (!JIRA_API_TOKEN) {
    console.error('Error: JIRA_API_TOKEN environment variable is not set');
    process.exit(1);
  }
}

function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 30000
  });
}

function printUsage() {
  console.log('\nUsage:');
  console.log('  npm run workflow-queue-metrics -- <start-date> <end-date> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --project <KEY>          Jira project key (default: VER10)');
  console.log('  --fix-version <NAME>     Optional fixVersion filter');
  console.log('  --workflow <NAME>        Workflow name (informational)');
  console.log('  --status-order "<A,B>"   Override status order (comma-separated)');
  console.log('');
  console.log(`Dates must be YYYY-MM-DD. Start date is clamped to ${MIN_START_DATE}.`);
  console.log(`Filters: sprint in (${TARGET_SPRINTS.map(sprint => `"${sprint}"`).join(', ')})`);
}

function clampStartDate(startDate) {
  if (new Date(startDate) < new Date(MIN_START_DATE)) {
    console.warn(`Warning: start-date adjusted to ${MIN_START_DATE}.`);
    return MIN_START_DATE;
  }
  return startDate;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  let startDate = args[0];
  const endDate = args[1];
  const options = {
    projectKey: DEFAULT_PROJECT_KEY,
    fixVersion: null,
    workflowName: null,
    statusOrderOverride: null
  };

  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--project' && args[i + 1]) {
      options.projectKey = args[i + 1];
      i += 1;
    } else if (arg === '--fix-version' && args[i + 1]) {
      options.fixVersion = args[i + 1];
      i += 1;
    } else if (arg === '--workflow' && args[i + 1]) {
      options.workflowName = args[i + 1];
      i += 1;
    } else if (arg === '--status-order' && args[i + 1]) {
      options.statusOrderOverride = args[i + 1]
        .split(',')
        .map(status => status.trim())
        .filter(Boolean);
      i += 1;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    console.error('Error: start-date and end-date must be YYYY-MM-DD.');
    process.exit(1);
  }

  startDate = clampStartDate(startDate);

  if (new Date(startDate) > new Date(endDate)) {
    console.error('Error: start-date must be before or equal to end-date.');
    process.exit(1);
  }

  return { startDate, endDate, options };
}

function buildDateRange(startDate, endDate) {
  const days = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    days.push(current.toISOString().split('T')[0]);
  }
  return days;
}

async function fetchIssuesByJql(client, jql, fields) {
  const results = [];
  let nextPageToken = null;

  do {
    const body = {
      jql,
      maxResults: 100,
      fields
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const response = await client.post('/rest/api/3/search/jql', body);
    results.push(...(response.data.issues || []));
    nextPageToken = response.data.nextPageToken || null;

    if (nextPageToken) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (nextPageToken);

  return results;
}

async function fetchIssueWithChangelog(client, issueKey) {
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: 'summary,status,created',
      expand: 'changelog'
    }
  });
  return response.data;
}

async function fetchProjectStatuses(client, projectKey) {
  const response = await client.get(`/rest/api/3/project/${projectKey}/statuses`);
  const statuses = new Map();
  (response.data || []).forEach(issueType => {
    (issueType.statuses || []).forEach(status => {
      statuses.set(status.name, {
        name: status.name,
        category: status.statusCategory?.name || null
      });
    });
  });
  return Array.from(statuses.values());
}

function normalizeStatus(status) {
  return status ? status.trim().toUpperCase() : '';
}

function buildStatusOrderFromTransitions(transitionsByIssue, statusList) {
  const positions = new Map();
  const statusSet = new Set(statusList.map(status => status.name));

  transitionsByIssue.forEach(transitions => {
    const sequence = [];
    transitions.forEach(event => {
      if (event.from && (sequence.length === 0 || sequence[sequence.length - 1] !== event.from)) {
        sequence.push(event.from);
      }
      if (event.to && sequence[sequence.length - 1] !== event.to) {
        sequence.push(event.to);
      }
    });

    sequence.forEach((status, index) => {
      if (!statusSet.has(status)) return;
      const current = positions.get(status) || { sum: 0, count: 0 };
      current.sum += index;
      current.count += 1;
      positions.set(status, current);
    });
  });

  const ordered = Array.from(statusSet).sort((a, b) => {
    const aPos = positions.get(a);
    const bPos = positions.get(b);
    const aScore = aPos ? aPos.sum / aPos.count : Number.POSITIVE_INFINITY;
    const bScore = bPos ? bPos.sum / bPos.count : Number.POSITIVE_INFINITY;
    if (aScore === bScore) return a.localeCompare(b);
    return aScore - bScore;
  });

  return ordered;
}

function extractStatusTransitions(issue, statusMap) {
  const histories = issue.changelog?.histories || [];
  const transitions = [];

  histories.forEach(history => {
    (history.items || []).forEach(item => {
      if (item.field !== 'status' || !item.toString || !item.fromString) return;
      const fromStatus = statusMap?.get(normalizeStatus(item.fromString))?.name || item.fromString;
      const toStatus = statusMap?.get(normalizeStatus(item.toString))?.name || item.toString;
      transitions.push({
        at: history.created,
        from: fromStatus,
        to: toStatus
      });
    });
  });

  transitions.sort((a, b) => new Date(a.at) - new Date(b.at));
  return transitions;
}

function initDailyMetrics(days, statusOrder) {
  const metrics = {};
  days.forEach(date => {
    metrics[date] = {};
    statusOrder.forEach(status => {
      metrics[date][status] = {
        lambda: 0,
        mu: 0,
        wip: 0,
        utilization: null,
        cycleTime: {
          count: 0,
          meanDays: null,
          medianDays: null,
          p85Days: null
        },
        flags: {
          lambdaGreaterThanMu: false,
          wipIncreasing: false,
          utilizationRisk: false
        }
      };
    });
  });
  return metrics;
}

function addTransitionCounts(dailyMetrics, statusOrderSet, transition) {
  const date = transition.at.split('T')[0];
  if (!dailyMetrics[date]) return;
  if (transition.to && statusOrderSet.has(transition.to)) {
    dailyMetrics[date][transition.to].lambda += 1;
  }
  if (transition.from && statusOrderSet.has(transition.from)) {
    dailyMetrics[date][transition.from].mu += 1;
  }
}

function isDateInRange(dateStr, startDate, endDate) {
  return dateStr >= startDate && dateStr <= endDate;
}

function addCycleTimes(cycleTimesByStatus, cycleTimesByStatusByDay, status, entryAt, exitAt) {
  const durationDays = (new Date(exitAt) - new Date(entryAt)) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(durationDays) || durationDays < 0) return;
  if (!cycleTimesByStatus[status]) {
    cycleTimesByStatus[status] = [];
  }
  cycleTimesByStatus[status].push(durationDays);

  const exitDate = exitAt.split('T')[0];
  if (!cycleTimesByStatusByDay[exitDate]) {
    cycleTimesByStatusByDay[exitDate] = {};
  }
  if (!cycleTimesByStatusByDay[exitDate][status]) {
    cycleTimesByStatusByDay[exitDate][status] = [];
  }
  cycleTimesByStatusByDay[exitDate][status].push(durationDays);
}

function collectCycleTimes(issue, transitions, cycleTimesByStatus, cycleTimesByStatusByDay, startDate, endDate) {
  if (!transitions.length) return;

  const createdAt = issue.fields?.created;
  let currentStatus = transitions[0].from || null;
  let statusStart = createdAt || transitions[0].at;

  transitions.forEach(event => {
    if (currentStatus && event.from === currentStatus) {
      const exitDate = event.at.split('T')[0];
      if (isDateInRange(exitDate, startDate, endDate)) {
        addCycleTimes(cycleTimesByStatus, cycleTimesByStatusByDay, currentStatus, statusStart, event.at);
      }
    }
    currentStatus = event.to;
    statusStart = event.at;
  });
}

function computeStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, mean: null, median: null, p85: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  const p85Index = Math.ceil(count * 0.85) - 1;
  const p85 = sorted[Math.min(Math.max(p85Index, 0), count - 1)];
  return { count, mean, median, p85 };
}

function applyCycleTimeStats(dailyMetrics, cycleTimesByStatusByDay, cycleTimesByStatus) {
  Object.entries(dailyMetrics).forEach(([date, statuses]) => {
    Object.keys(statuses).forEach(status => {
      const daily = cycleTimesByStatusByDay[date]?.[status] || [];
      const dailyStats = computeStats(daily);
      statuses[status].cycleTime.count = dailyStats.count;
      statuses[status].cycleTime.meanDays = dailyStats.mean;
      statuses[status].cycleTime.medianDays = dailyStats.median;
      statuses[status].cycleTime.p85Days = dailyStats.p85;
    });
  });

  const summary = {};
  Object.entries(cycleTimesByStatus).forEach(([status, values]) => {
    const stats = computeStats(values);
    summary[status] = {
      count: stats.count,
      meanDays: stats.mean,
      medianDays: stats.median,
      p85Days: stats.p85
    };
  });

  return summary;
}

function applyWipBackcast(dailyMetrics, days, currentWipByStatus) {
  const wip = { ...currentWipByStatus };
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const date = days[i];
    Object.keys(dailyMetrics[date]).forEach(status => {
      dailyMetrics[date][status].wip = wip[status] || 0;
      const lambda = dailyMetrics[date][status].lambda;
      const mu = dailyMetrics[date][status].mu;
      wip[status] = (wip[status] || 0) - lambda + mu;
      if (wip[status] < 0) wip[status] = 0;
    });
  }
}

function applyUtilizationAndFlags(dailyMetrics, days) {
  const flagged = [];
  const flaggedByDay = [];

  for (let i = 0; i < days.length; i += 1) {
    const date = days[i];
    const previousDate = i > 0 ? days[i - 1] : null;

    Object.entries(dailyMetrics[date]).forEach(([status, metrics]) => {
      const { lambda, mu } = metrics;
      metrics.utilization = mu === 0 ? null : lambda / mu;
      metrics.flags.lambdaGreaterThanMu = lambda > mu;
      metrics.flags.utilizationRisk = metrics.utilization !== null && metrics.utilization > 0.85;

      if (previousDate) {
        const previousWip = dailyMetrics[previousDate]?.[status]?.wip || 0;
        metrics.flags.wipIncreasing = metrics.wip > previousWip;
      }

      const reasons = [];
      if (metrics.flags.lambdaGreaterThanMu) reasons.push('lambda_gt_mu');
      if (metrics.flags.wipIncreasing) reasons.push('wip_increasing');
      if (metrics.flags.utilizationRisk) reasons.push('rho_gt_0_85');

      if (reasons.length) {
        flaggedByDay.push({ date, status, reasons });
        flagged.push(status);
      }
    });
  }

  return {
    flaggedStatuses: Array.from(new Set(flagged)).sort(),
    flaggedByDay
  };
}

async function fetchCurrentWipByStatus(client, projectKey, fixVersion, statusOrder, sprints) {
  const statusList = statusOrder.map(status => `"${status}"`).join(', ');
  const clauses = [`project = ${projectKey}`, `status in (${statusList})`];
  if (sprints && sprints.length) {
    const sprintList = sprints.map(sprint => `"${sprint}"`).join(', ');
    clauses.push(`sprint in (${sprintList})`);
  }
  if (fixVersion) {
    clauses.push(`fixVersion = "${fixVersion}"`);
  }

  const jql = `${clauses.join(' AND ')}`;
  const issues = await fetchIssuesByJql(client, jql, ['status']);
  const counts = {};
  statusOrder.forEach(status => { counts[status] = 0; });
  issues.forEach(issue => {
    const statusName = issue.fields?.status?.name;
    if (statusName && counts[statusName] !== undefined) {
      counts[statusName] += 1;
    }
  });
  return counts;
}

function collectTransitionsFromIssues(issues, statusMap) {
  const transitionsByIssue = new Map();
  issues.forEach(issue => {
    const transitions = extractStatusTransitions(issue, statusMap);
    transitionsByIssue.set(issue.key, transitions);
  });
  return transitionsByIssue;
}

async function main() {
  validateConfig();
  const { startDate, endDate, options } = parseArgs();
  const days = buildDateRange(startDate, endDate);
  const client = createJiraClient();

  const projectStatuses = await fetchProjectStatuses(client, options.projectKey);
  const statusMap = new Map(projectStatuses.map(status => [normalizeStatus(status.name), status]));

  const sprintList = TARGET_SPRINTS.map(sprint => `"${sprint}"`).join(', ');
  const jqlClauses = [
    `project = ${options.projectKey}`,
    `sprint in (${sprintList})`,
    `updated >= "${startDate}"`,
    `updated <= "${endDate}"`
  ];
  if (options.fixVersion) {
    jqlClauses.push(`fixVersion = "${options.fixVersion}"`);
  }
  const jql = jqlClauses.join(' AND ');

  const issueRefs = await fetchIssuesByJql(client, jql, ['key']);
  const issues = [];

  for (const issueRef of issueRefs) {
    try {
      const issue = await fetchIssueWithChangelog(client, issueRef.key);
      issues.push(issue);
    } catch (error) {
      console.warn(`Warning: could not fetch ${issueRef.key}: ${error.message}`);
    }
  }

  const transitionsByIssue = collectTransitionsFromIssues(issues, statusMap);
  const seenStatuses = new Set();
  transitionsByIssue.forEach(transitions => {
    transitions.forEach(event => {
      if (event.from) seenStatuses.add(event.from);
      if (event.to) seenStatuses.add(event.to);
    });
  });

  const statusList = seenStatuses.size > 0
    ? projectStatuses.filter(status => seenStatuses.has(status.name))
    : projectStatuses;
  const statusOrder = options.statusOrderOverride && options.statusOrderOverride.length > 0
    ? options.statusOrderOverride
    : buildStatusOrderFromTransitions(transitionsByIssue, statusList);
  const issueMap = new Map(issues.map(issue => [issue.key, issue]));

  const statusOrderSet = new Set(statusOrder);
  const dailyMetrics = initDailyMetrics(days, statusOrder);
  const cycleTimesByStatus = {};
  const cycleTimesByStatusByDay = {};

  transitionsByIssue.forEach((transitions, issueKey) => {
    transitions.forEach(transition => {
      if (!statusOrderSet.has(transition.from) && !statusOrderSet.has(transition.to)) return;
      addTransitionCounts(dailyMetrics, statusOrderSet, transition);
    });

    const issue = issueMap.get(issueKey);
    if (issue) {
      collectCycleTimes(issue, transitions, cycleTimesByStatus, cycleTimesByStatusByDay, startDate, endDate);
    }
  });

  const currentWipByStatus = await fetchCurrentWipByStatus(
    client,
    options.projectKey,
    options.fixVersion,
    statusOrder,
    TARGET_SPRINTS
  );

  applyWipBackcast(dailyMetrics, days, currentWipByStatus);
  const cycleTimeSummary = applyCycleTimeStats(dailyMetrics, cycleTimesByStatusByDay, cycleTimesByStatus);
  const flagsSummary = applyUtilizationAndFlags(dailyMetrics, days);

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      dateRange: { start: startDate, end: endDate },
      projectKey: options.projectKey,
      sprints: TARGET_SPRINTS,
      fixVersion: options.fixVersion,
      workflowName: options.workflowName,
      statusOrderSource: options.statusOrderOverride ? 'override' : 'project-statuses+transitions',
      statusOrder,
      wipAsOf: new Date().toISOString().split('T')[0],
      assumptions: [
        'WIP time series is backcast from current snapshot.',
        'Cycle times are computed for status exits within date range.',
        'Status order derived from transition sequences unless overridden.'
      ]
    },
    statusMetrics: dailyMetrics,
    cycleTimeSummary,
    flagsSummary
  };

  const filename = `workflow-queue-metrics-${startDate}-to-${endDate}.json`;
  const filepath = path.join(reportsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  console.log(`Report saved: ${filepath}`);
}

main().catch(error => {
  console.error('Failed to generate workflow queue metrics');
  console.error(error.message);
  process.exit(1);
});
