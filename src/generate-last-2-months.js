#!/usr/bin/env node

/**
 * Last 2 Months Daily Completion Metrics
 * 
 * Analyzes real daily completion data to calculate:
 * - Daily story points completed
 * - Mean daily completion rate
 * - Standard deviation (reliability indicator)
 * - Working days only (5-day week)
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'https://benchmarkestimating.atlassian.net';
const PROJECT_KEY = 'VER10';
const STORY_POINTS_FIELD = 'customfield_10003';

// Team custom fields
const TEAM_FIELDS = ['customfield_12700', 'customfield_13445', 'customfield_13462'];

// Completed statuses
const COMPLETED_STATUSES = ['READY FOR RELEASE', 'CLOSED', 'DONE', 'COMPLETED'];

// Teams we care about
const TEAMS_OF_INTEREST = ['Team 1', 'Team 2', 'Team 3', 'Team 4'];

/**
 * Creates an authenticated Jira API client
 */
function createJiraClient() {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!email || !apiToken) {
    console.error('❌ Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set');
    process.exit(1);
  }

  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

/**
 * Calculate date 2 months ago
 */
function getTwoMonthsAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return date.toISOString().split('T')[0];
}

/**
 * Get all working days (Mon-Fri) in a date range
 */
function getWorkingDays(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      days.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Fetch issues with cursor-based pagination
 */
async function fetchIssues(client, jql) {
  console.log(`   JQL: ${jql}`);
  
  let allIssueKeys = [];
  let nextPageToken = null;
  
  do {
    const body = {
      jql: jql,
      maxResults: 100,
      fields: ['key']
    };
    
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }
    
    const response = await client.post('/rest/api/3/search/jql', body);
    const issues = response.data.issues || [];
    allIssueKeys = allIssueKeys.concat(issues.map(i => i.key));
    
    nextPageToken = response.data.nextPageToken || null;
    
    console.log(`   Fetched ${allIssueKeys.length} issue keys${nextPageToken ? ' (more pages...)' : ''}`);
    
    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);
  
  return allIssueKeys;
}

/**
 * Fetch issue details with changelog
 */
async function fetchIssueDetails(client, issueKey) {
  const teamFieldsStr = TEAM_FIELDS.join(',');
  const response = await client.get(`/rest/api/3/issue/${issueKey}`, {
    params: {
      fields: `key,summary,status,issuetype,${STORY_POINTS_FIELD},${teamFieldsStr}`,
      expand: 'changelog'
    }
  });
  return response.data;
}

/**
 * Extract team name from issue
 */
function getTeam(issue) {
  for (const fieldName of TEAM_FIELDS) {
    const value = issue.fields[fieldName];
    if (value) {
      if (Array.isArray(value)) {
        const teamValue = value.map(v => v.value || v.name || v).join(', ');
        // Normalize team names
        for (const team of TEAMS_OF_INTEREST) {
          if (teamValue.includes(team.replace('Team ', ''))) {
            return team;
          }
        }
        return teamValue;
      } else if (typeof value === 'object') {
        const teamValue = value.value || value.name || '';
        for (const team of TEAMS_OF_INTEREST) {
          if (teamValue.includes(team.replace('Team ', ''))) {
            return team;
          }
        }
        return teamValue;
      } else {
        return String(value);
      }
    }
  }
  return 'Unassigned';
}

/**
 * Get the completion date from changelog
 */
function getCompletionDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  // Find the last transition to a completed status
  for (let i = issue.changelog.histories.length - 1; i >= 0; i--) {
    const history = issue.changelog.histories[i];
    for (const item of history.items) {
      if (item.field === 'status' && 
          COMPLETED_STATUSES.some(s => 
            s === item.toString?.toUpperCase() || 
            item.toString?.toUpperCase().includes(s)
          )) {
        return history.created.split('T')[0];
      }
    }
  }

  return null;
}

/**
 * Calculate mean
 */
function calculateMean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values, mean) {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${day} ${months[date.getMonth()]}`;
}

/**
 * Main function
 */
async function main() {
  const twoMonthsAgo = getTwoMonthsAgo();
  const today = new Date().toISOString().split('T')[0];
  const workingDays = getWorkingDays(twoMonthsAgo, today);

  console.log('\n📊 Last 2 Months - Daily Completion Metrics');
  console.log('============================================================');
  console.log(`   Period: ${twoMonthsAgo} to ${today}`);
  console.log(`   Working days: ${workingDays.length}`);
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log('============================================================\n');

  try {
    const client = createJiraClient();

    // Query for stories and bugs resolved in the last 2 months
    const jql = `project = ${PROJECT_KEY} AND issuetype in (Story, Bug) AND resolved >= "${twoMonthsAgo}"`;
    
    console.log('⏳ Fetching resolved issues...');
    const issueKeys = await fetchIssues(client, jql);
    
    console.log(`\n⏳ Fetching changelogs for ${issueKeys.length} issues...`);
    
    // Initialize daily data - overall and by team
    const dailyData = {};
    const teamDailyData = {};
    
    for (const team of TEAMS_OF_INTEREST) {
      teamDailyData[team] = {};
      for (const day of workingDays) {
        teamDailyData[team][day] = { points: 0, issues: [] };
      }
    }
    
    for (const day of workingDays) {
      dailyData[day] = { points: 0, issues: [] };
    }

    // Fetch each issue's changelog to get completion date
    let processed = 0;
    let issuesWithCompletionDate = 0;
    
    for (const key of issueKeys) {
      try {
        const issue = await fetchIssueDetails(client, key);
        const completionDate = getCompletionDate(issue);
        
        if (completionDate && dailyData[completionDate]) {
          const type = issue.fields.issuetype?.name;
          const team = getTeam(issue);
          let points = issue.fields[STORY_POINTS_FIELD] || 0;
          
          // Apply defaults
          if (points === 0) {
            points = type === 'Story' ? 2 : 1;
          }
          
          // Overall data
          dailyData[completionDate].points += points;
          dailyData[completionDate].issues.push({
            key: issue.key,
            type,
            points,
            team,
            summary: issue.fields.summary
          });
          
          // Team-specific data
          if (TEAMS_OF_INTEREST.includes(team) && teamDailyData[team][completionDate]) {
            teamDailyData[team][completionDate].points += points;
            teamDailyData[team][completionDate].issues.push({
              key: issue.key,
              type,
              points,
              summary: issue.fields.summary
            });
          }
          
          issuesWithCompletionDate++;
        }
        
        processed++;
        if (processed % 50 === 0) {
          console.log(`   Processed ${processed}/${issueKeys.length}...`);
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        if (err.response?.status === 429) {
          console.log('   Rate limited, waiting...');
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    console.log(`   ✓ Processed ${processed} issues`);
    console.log(`   ✓ ${issuesWithCompletionDate} had completion dates in working days\n`);

    // Calculate statistics
    const dailyPoints = workingDays.map(day => dailyData[day].points);
    const nonZeroDays = dailyPoints.filter(p => p > 0);
    
    const meanAll = calculateMean(dailyPoints);
    const stdDevAll = calculateStdDev(dailyPoints, meanAll);
    
    const meanNonZero = calculateMean(nonZeroDays);
    const stdDevNonZero = calculateStdDev(nonZeroDays, meanNonZero);
    
    const totalPoints = dailyPoints.reduce((sum, p) => sum + p, 0);
    const daysWithWork = nonZeroDays.length;
    const daysWithoutWork = workingDays.length - daysWithWork;

    // Display summary
    console.log('============================================================');
    console.log('📈 SUMMARY');
    console.log('============================================================\n');
    
    console.log(`   Total Story Points:          ${totalPoints}`);
    console.log(`   Working Days:                ${workingDays.length}`);
    console.log(`   Days with completions:       ${daysWithWork} (${((daysWithWork/workingDays.length)*100).toFixed(1)}%)`);
    console.log(`   Days without completions:    ${daysWithoutWork}`);
    
    console.log('\n   ─────────────────────────────────────────');
    console.log('   📊 ALL WORKING DAYS (including zero days):');
    console.log(`      Mean:                     ${meanAll.toFixed(2)} SP/day`);
    console.log(`      Std Deviation:            ${stdDevAll.toFixed(2)}`);
    console.log(`      Coefficient of Variation: ${meanAll > 0 ? ((stdDevAll/meanAll)*100).toFixed(1) : 0}%`);
    
    console.log('\n   📊 DAYS WITH WORK ONLY (excluding zero days):');
    console.log(`      Mean:                     ${meanNonZero.toFixed(2)} SP/day`);
    console.log(`      Std Deviation:            ${stdDevNonZero.toFixed(2)}`);
    console.log(`      Coefficient of Variation: ${meanNonZero > 0 ? ((stdDevNonZero/meanNonZero)*100).toFixed(1) : 0}%`);

    // Weekly averages
    const weeks = workingDays.length / 5;
    console.log('\n   📅 WEEKLY PROJECTION:');
    console.log(`      Mean (all days):          ${(meanAll * 5).toFixed(1)} SP/week`);
    console.log(`      Mean (work days only):    ${(meanNonZero * 5).toFixed(1)} SP/week`);

    // Confidence intervals (using 1.96 for 95% CI)
    const marginOfError = 1.96 * (stdDevAll / Math.sqrt(workingDays.length));
    console.log('\n   🎯 95% CONFIDENCE INTERVAL (daily):');
    console.log(`      Lower bound:              ${Math.max(0, meanAll - marginOfError).toFixed(2)} SP/day`);
    console.log(`      Upper bound:              ${(meanAll + marginOfError).toFixed(2)} SP/day`);

    // Team-specific statistics
    console.log('\n============================================================');
    console.log('👥 BREAKDOWN BY TEAM');
    console.log('============================================================\n');

    console.log('   Team     | Total SP | Days w/Work | Mean/Day | Std Dev | CV%   | Weekly');
    console.log('   ' + '-'.repeat(75));

    const teamStats = {};
    
    for (const team of TEAMS_OF_INTEREST) {
      const teamDailyPoints = workingDays.map(day => teamDailyData[team][day].points);
      const teamNonZeroDays = teamDailyPoints.filter(p => p > 0);
      const teamTotal = teamDailyPoints.reduce((sum, p) => sum + p, 0);
      const teamMean = calculateMean(teamDailyPoints);
      const teamStdDev = calculateStdDev(teamDailyPoints, teamMean);
      const teamCV = teamMean > 0 ? (teamStdDev / teamMean) * 100 : 0;
      const teamWeekly = teamMean * 5;
      
      teamStats[team] = {
        total: teamTotal,
        daysWithWork: teamNonZeroDays.length,
        mean: teamMean,
        stdDev: teamStdDev,
        cv: teamCV,
        weekly: teamWeekly,
        dailyPoints: teamDailyPoints
      };
      
      const teamName = team.padEnd(8);
      const totalStr = String(teamTotal).padStart(8);
      const daysStr = String(teamNonZeroDays.length).padStart(11);
      const meanStr = teamMean.toFixed(2).padStart(8);
      const stdDevStr = teamStdDev.toFixed(2).padStart(7);
      const cvStr = teamCV.toFixed(1).padStart(5);
      const weeklyStr = teamWeekly.toFixed(1).padStart(6);
      
      console.log(`   ${teamName} | ${totalStr} | ${daysStr} | ${meanStr} | ${stdDevStr} | ${cvStr} | ${weeklyStr}`);
    }
    
    console.log('   ' + '-'.repeat(75));
    
    // Show team totals as % of overall
    console.log('\n   Team Contribution:');
    for (const team of TEAMS_OF_INTEREST) {
      const pct = totalPoints > 0 ? ((teamStats[team].total / totalPoints) * 100).toFixed(1) : 0;
      console.log(`      ${team}: ${teamStats[team].total} SP (${pct}%)`);
    }

    // Display daily breakdown
    console.log('\n============================================================');
    console.log('📅 DAILY BREAKDOWN');
    console.log('============================================================\n');
    
    console.log('   DATE          | POINTS | ISSUES | DETAILS');
    console.log('   ' + '-'.repeat(65));
    
    // Group by week for display
    let weekTotal = 0;
    let weekDays = 0;
    let currentWeek = null;
    
    for (const day of workingDays) {
      const data = dailyData[day];
      const weekNum = getWeekNumber(day);
      
      if (currentWeek !== null && weekNum !== currentWeek) {
        console.log(`   ${'─'.repeat(65)}`);
        console.log(`   Week ${currentWeek} Total: ${weekTotal} SP over ${weekDays} days`);
        console.log(`   ${'─'.repeat(65)}`);
        weekTotal = 0;
        weekDays = 0;
      }
      
      currentWeek = weekNum;
      weekTotal += data.points;
      weekDays++;
      
      const dateStr = formatDate(day).padEnd(13);
      const points = String(data.points).padStart(6);
      const issueCount = String(data.issues.length).padStart(6);
      const details = data.issues.slice(0, 3).map(i => i.key).join(', ') || '-';
      
      console.log(`   ${dateStr} | ${points} | ${issueCount} | ${details}`);
    }
    
    // Final week total
    if (weekDays > 0) {
      console.log(`   ${'─'.repeat(65)}`);
      console.log(`   Week ${currentWeek} Total: ${weekTotal} SP over ${weekDays} days`);
    }

    // Save report
    const reportData = {
      generatedAt: new Date().toISOString(),
      period: { start: twoMonthsAgo, end: today },
      workingDays: workingDays.length,
      daysWithCompletions: daysWithWork,
      totalPoints,
      statistics: {
        allDays: { mean: meanAll, stdDev: stdDevAll, cv: meanAll > 0 ? stdDevAll/meanAll : 0 },
        workDaysOnly: { mean: meanNonZero, stdDev: stdDevNonZero, cv: meanNonZero > 0 ? stdDevNonZero/meanNonZero : 0 },
        confidenceInterval95: { lower: Math.max(0, meanAll - marginOfError), upper: meanAll + marginOfError }
      },
      dailyData: workingDays.map(day => ({
        date: day,
        points: dailyData[day].points,
        issues: dailyData[day].issues
      }))
    };

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const outputPath = path.join(reportsDir, 'last-2-months-daily.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));

    console.log('\n============================================================');
    console.log(`✅ Report saved to: ${outputPath}`);
    console.log('\n🎉 Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

/**
 * Get ISO week number
 */
function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Run
main();

