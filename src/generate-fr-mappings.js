require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';

// Custom field for FR Reference NH
const FR_REFERENCE_FIELD = 'customfield_13542';

// Validate environment variables
function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    process.exit(1);
  }
  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
    process.exit(1);
  }
}

// Create JIRA API client
function createJiraClient() {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  
  return axios.create({
    baseURL: JIRA_BASE_URL,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry
async function fetchWithRetry(client, jql, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.post('/rest/api/3/search/jql', {
        jql: jql,
        maxResults: 100,
        fields: ['key', 'summary', 'issuetype', 'fixVersions', FR_REFERENCE_FIELD]
      });
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      console.log(`   ⚠️  Request failed, retrying (${attempt}/${maxRetries})...`);
      await sleep(1000 * attempt);
    }
  }
}

// Fetch all issues with pagination
async function fetchAllIssues(client, jql) {
  let allIssues = [];
  let lastKey = null;
  let hasMore = true;
  let pageCount = 0;
  
  while (hasMore) {
    let query = jql;
    if (lastKey) {
      query = `${query} AND key > "${lastKey}"`;
    }
    query = `${query} ORDER BY key ASC`;
    
    const response = await fetchWithRetry(client, query);
    
    const issues = response.data.issues || [];
    if (issues.length === 0) {
      hasMore = false;
    } else {
      allIssues = allIssues.concat(issues);
      lastKey = issues[issues.length - 1].key;
      pageCount++;
      process.stdout.write(`   Fetched ${allIssues.length} issues...\r`);
      if (issues.length < 100) hasMore = false;
      // Small delay between pages to avoid rate limiting
      if (hasMore) await sleep(100);
    }
  }
  console.log(''); // Clear the line
  return allIssues;
}

// Canonicalize FR values: FR 111, FR111, FR-111 -> FR111
function canonicalizeFR(value) {
  if (!value) return null;
  
  // Remove spaces and dashes, convert to uppercase
  const normalized = value.toUpperCase().replace(/[\s\-]/g, '');
  
  // Match FR followed by digits
  const match = normalized.match(/FR(\d+)/);
  if (match) {
    return `FR${match[1]}`;
  }
  return null;
}

// Extract all FR values from a field value string
function extractFRValues(fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'string') return [];
  
  // Find all FR patterns in the string
  // Patterns: FR511, FR 511, FR-511, etc.
  const frPattern = /FR[\s\-]?\d+/gi;
  const matches = fieldValue.match(frPattern) || [];
  
  // Canonicalize each match
  const canonicalFRs = matches.map(canonicalizeFR).filter(Boolean);
  
  // Return unique values
  return [...new Set(canonicalFRs)];
}

// Get release name from fixVersions
function getReleaseNames(fixVersions) {
  if (!fixVersions || !Array.isArray(fixVersions) || fixVersions.length === 0) {
    return ['No Release'];
  }
  return fixVersions.map(v => v.name);
}

// Simplify release name for grouping
function simplifyReleaseName(name) {
  // Extract Release 1A, 1B, 1C, 1D, 2A, 2B pattern
  const match = name.match(/Release\s*(\d[A-Z])/i);
  if (match) {
    return `Release ${match[1].toUpperCase()}`;
  }
  return name;
}

async function generateFRMappings() {
  validateConfig();
  const client = createJiraClient();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           FR REFERENCE MAPPINGS REPORT - Release 1D');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Fetch Epics and Stories for Release 1D only
  console.log('🔍 Fetching Epics and Stories for Release 1D...');
  const jql = `project = ${PROJECT_KEY} AND issuetype in (Epic, Story) AND fixVersion = "Release 1D"`;
  const issues = await fetchAllIssues(client, jql);
  
  console.log(`   ✓ Found ${issues.length} issues (Epics + Stories)`);
  console.log('');
  
  // Data structures
  const allFRs = new Map(); // FR -> { count, issues: [] }
  const frByRelease = new Map(); // Release -> Set of FRs
  const issuesWithFR = [];
  const issuesWithoutFR = [];
  
  // Process each issue
  issues.forEach(issue => {
    const frFieldValue = issue.fields[FR_REFERENCE_FIELD];
    const frValues = extractFRValues(frFieldValue);
    const releases = getReleaseNames(issue.fields.fixVersions);
    const simplifiedReleases = [...new Set(releases.map(simplifyReleaseName))];
    
    if (frValues.length > 0) {
      issuesWithFR.push({
        key: issue.key,
        summary: issue.fields.summary,
        type: issue.fields.issuetype?.name,
        frs: frValues,
        releases: simplifiedReleases
      });
      
      // Add to all FRs map
      frValues.forEach(fr => {
        if (!allFRs.has(fr)) {
          allFRs.set(fr, { count: 0, issues: [] });
        }
        allFRs.get(fr).count++;
        allFRs.get(fr).issues.push(issue.key);
      });
      
      // Add to release mapping
      simplifiedReleases.forEach(release => {
        if (!frByRelease.has(release)) {
          frByRelease.set(release, new Set());
        }
        frValues.forEach(fr => frByRelease.get(release).add(fr));
      });
    } else {
      issuesWithoutFR.push(issue.key);
    }
  });
  
  // Sort FRs numerically
  const sortedFRs = [...allFRs.keys()].sort((a, b) => {
    const numA = parseInt(a.replace('FR', ''));
    const numB = parseInt(b.replace('FR', ''));
    return numA - numB;
  });
  
  // Output: Summary of all unique FRs
  console.log('📊 ALL UNIQUE FR REFERENCES');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log(`Found ${sortedFRs.length} unique FR references across ${issuesWithFR.length} issues`);
  console.log(`(${issuesWithoutFR.length} issues have no FR reference)`);
  console.log('');
  
  console.log('| FR Reference | Issue Count |');
  console.log('|--------------|------------:|');
  
  sortedFRs.forEach(fr => {
    const data = allFRs.get(fr);
    console.log(`| ${fr} | ${data.count} |`);
  });
  
  console.log('');
  
  // Output: FRs by Release
  console.log('📋 UNIQUE FRs BY RELEASE');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  
  // Sort releases
  const releaseOrder = ['Release 1A', 'Release 1B', 'Release 1C', 'Release 1D', 'Release 2A', 'Release 2B', 'No Release'];
  const sortedReleases = [...frByRelease.keys()].sort((a, b) => {
    const indexA = releaseOrder.indexOf(a);
    const indexB = releaseOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  sortedReleases.forEach(release => {
    const frs = frByRelease.get(release);
    const sortedReleaseFRs = [...frs].sort((a, b) => {
      const numA = parseInt(a.replace('FR', ''));
      const numB = parseInt(b.replace('FR', ''));
      return numA - numB;
    });
    
    console.log(`### ${release} (${sortedReleaseFRs.length} unique FRs)`);
    console.log('');
    console.log(sortedReleaseFRs.join(', '));
    console.log('');
  });
  
  // Summary table by release
  console.log('📊 FR COUNT BY RELEASE');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('| Release | Unique FRs |');
  console.log('|---------|----------:|');
  
  sortedReleases.forEach(release => {
    const frs = frByRelease.get(release);
    console.log(`| ${release} | ${frs.size} |`);
  });
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run the report
generateFRMappings().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});

