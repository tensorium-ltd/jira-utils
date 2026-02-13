#!/usr/bin/env node

/**
 * FR Reference Lookup by Ticket
 * 
 * Fetches FR references for a specific ticket and all its child tickets.
 * Usage: node src/generate-fr-by-ticket.js VER10-1234
 *        node src/generate-fr-by-ticket.js VER10-1234 VER10-5678 VER10-9999
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

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
async function fetchWithRetry(client, url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.get(url, options);
      return response;
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'] || 5;
        console.log(`   ⚠️  Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (attempt === maxRetries) throw err;
      console.log(`   ⚠️  Request failed, retrying (${attempt}/${maxRetries})...`);
      await sleep(1000 * attempt);
    }
  }
}

// Fetch issue by key via JQL (more reliable)
async function fetchIssue(client, issueKey) {
  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql: `key = ${issueKey}`,
      maxResults: 1,
      fields: ['key', 'summary', 'issuetype', 'status', 'parent', 'subtasks', 'issuelinks', FR_REFERENCE_FIELD]
    });
    
    if (response.data.issues?.length > 0) {
      return response.data.issues[0];
    }
    return null;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

// Fetch linked issues from an issue's issuelinks field
async function fetchLinkedIssues(client, issueLinks = []) {
  const linkedIssues = [];
  
  for (const link of issueLinks) {
    // Get either the inward or outward linked issue
    const linkedIssue = link.inwardIssue || link.outwardIssue;
    if (!linkedIssue) continue;
    
    const linkType = link.type?.name || 'Unknown';
    const direction = link.inwardIssue ? 'inward' : 'outward';
    
    // Fetch full details of the linked issue
    try {
      const response = await client.post('/rest/api/3/search/jql', {
        jql: `key = ${linkedIssue.key}`,
        maxResults: 1,
        fields: ['key', 'summary', 'issuetype', 'status', FR_REFERENCE_FIELD]
      });
      
      if (response.data.issues?.length > 0) {
        const fullIssue = response.data.issues[0];
        fullIssue.linkType = linkType;
        fullIssue.linkDirection = direction;
        linkedIssues.push(fullIssue);
      }
      await sleep(50);
    } catch (err) {
      // Include basic info from the link itself
      linkedIssues.push({
        key: linkedIssue.key,
        fields: {
          summary: linkedIssue.fields?.summary || '',
          issuetype: linkedIssue.fields?.issuetype,
          status: linkedIssue.fields?.status,
          [FR_REFERENCE_FIELD]: null
        },
        linkType,
        linkDirection: direction
      });
    }
  }
  
  return linkedIssues;
}

// Search for child issues via parent/epic link AND fetch linked issues
async function fetchChildIssues(client, parentKey, issueLinks = []) {
  const allChildren = [];
  
  // First, try to find issues with parent relationship
  try {
    const jqlQueries = [
      `parent = "${parentKey}"`,
      `"Epic Link" = "${parentKey}"`,
      `"parentEpic" = "${parentKey}"`
    ];
    
    for (const jql of jqlQueries) {
      try {
        const response = await client.post('/rest/api/3/search/jql', {
          jql: jql,
          maxResults: 100,
          fields: ['key', 'summary', 'issuetype', 'status', 'parent', FR_REFERENCE_FIELD]
        });
        
        const issues = response.data.issues || [];
        for (const issue of issues) {
          if (!allChildren.find(c => c.key === issue.key)) {
            allChildren.push(issue);
          }
        }
      } catch (e) {
        // Continue to next query
      }
    }
  } catch (err) {
    // Continue
  }
  
  // Also fetch linked issues from issuelinks field
  const linkedIssues = await fetchLinkedIssues(client, issueLinks);
  for (const issue of linkedIssues) {
    if (!allChildren.find(c => c.key === issue.key)) {
      allChildren.push(issue);
    }
  }
  
  return allChildren;
}

// Canonicalize FR values: FR 111, FR111, FR-111 -> FR111
function canonicalizeFR(value) {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[\s\-]/g, '');
  const match = normalized.match(/FR(\d+)/);
  if (match) {
    return `FR${match[1]}`;
  }
  return null;
}

// Extract all FR values from a field value string
function extractFRValues(fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'string') return [];
  const frPattern = /FR[\s\-]?\d+/gi;
  const matches = fieldValue.match(frPattern) || [];
  const canonicalFRs = matches.map(canonicalizeFR).filter(Boolean);
  return [...new Set(canonicalFRs)];
}

// Format issue for display
function formatIssue(issue, indent = '') {
  const type = issue.fields?.issuetype?.name || issue.issuetype?.name || 'Unknown';
  const summary = issue.fields?.summary || issue.summary || '';
  const status = issue.fields?.status?.name || issue.status?.name || '';
  const frValue = issue.fields?.[FR_REFERENCE_FIELD] || '';
  const frs = extractFRValues(frValue);
  const linkType = issue.linkType || null;
  const linkDirection = issue.linkDirection || null;
  
  return {
    key: issue.key,
    type,
    summary,
    status,
    frRaw: frValue,
    frs,
    indent,
    linkType,
    linkDirection
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\nUsage: node src/generate-fr-by-ticket.js <TICKET-KEY> [TICKET-KEY2] ...');
    console.log('\nExample: node src/generate-fr-by-ticket.js VER10-8473');
    console.log('         node src/generate-fr-by-ticket.js VER10-9084 VER10-8473 VER10-8168');
    process.exit(1);
  }

  validateConfig();
  const client = createJiraClient();
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('           FR REFERENCE LOOKUP BY TICKET');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const allFRs = new Set();
  const results = [];
  
  for (const ticketKey of args) {
    console.log(`🔍 Fetching ${ticketKey}...`);
    
    const issue = await fetchIssue(client, ticketKey);
    
    if (!issue) {
      console.log(`   ❌ Ticket not found: ${ticketKey}\n`);
      continue;
    }
    
    const mainIssue = formatIssue(issue);
    results.push({ main: mainIssue, children: [] });
    mainIssue.frs.forEach(fr => allFRs.add(fr));
    
    // Fetch child issues (passing issuelinks from the main issue)
    console.log(`   📥 Fetching child/linked issues...`);
    const issueLinks = issue.fields?.issuelinks || [];
    const children = await fetchChildIssues(client, ticketKey, issueLinks);
    console.log(`   ✓ Found ${children.length} linked/child issues\n`);
    
    for (const child of children) {
      const childInfo = formatIssue(child, '  ');
      results[results.length - 1].children.push(childInfo);
      childInfo.frs.forEach(fr => allFRs.add(fr));
    }
    
    await sleep(100);
  }
  
  // Display results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const result of results) {
    const { main, children } = result;
    
    console.log(`📋 ${main.key} (${main.type})`);
    console.log(`   Summary: ${main.summary}`);
    console.log(`   Status: ${main.status}`);
    console.log(`   FR Reference: ${main.frs.length > 0 ? main.frs.join(', ') : '(none)'}`);
    if (main.frRaw && main.frs.length === 0) {
      console.log(`   Raw FR Field: "${main.frRaw}"`);
    }
    console.log('');
    
    if (children.length > 0) {
      console.log(`   Linked/Child Issues (${children.length}):`);
      console.log('   ─────────────────────────────────────────────────────────');
      
      for (const child of children) {
        const frStr = child.frs.length > 0 ? `[${child.frs.join(', ')}]` : '[no FR]';
        const linkInfo = child.linkType ? ` (${child.linkType})` : '';
        console.log(`   ${child.key} (${child.type})${linkInfo} ${frStr}`);
        console.log(`      ${child.summary.substring(0, 60)}${child.summary.length > 60 ? '...' : ''}`);
      }
      console.log('');
    }
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const sortedFRs = [...allFRs].sort((a, b) => {
    const numA = parseInt(a.replace('FR', ''));
    const numB = parseInt(b.replace('FR', ''));
    return numA - numB;
  });
  
  console.log(`Total unique FRs found: ${sortedFRs.length}`);
  if (sortedFRs.length > 0) {
    console.log(`FRs: ${sortedFRs.join(', ')}`);
  }
  
  // Count issues with/without FRs
  let withFR = 0;
  let withoutFR = 0;
  
  for (const result of results) {
    if (result.main.frs.length > 0) withFR++; else withoutFR++;
    for (const child of result.children) {
      if (child.frs.length > 0) withFR++; else withoutFR++;
    }
  }
  
  console.log(`\nIssues with FR: ${withFR}`);
  console.log(`Issues without FR: ${withoutFR}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Run
main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});

