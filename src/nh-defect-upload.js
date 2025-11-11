const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Configuration
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://benchmarkestimating.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = 'VER10';
const EPIC_KEY = 'VER10-8245';
const CSV_FILE_PATH = path.join(__dirname, '../data/CCET Release 1 C UAT Defect Log.csv');

// Validate environment variables
function validateConfig() {
  if (!JIRA_EMAIL) {
    console.error('❌ Error: JIRA_EMAIL environment variable is not set');
    console.log('\nSet it with: export JIRA_EMAIL="your-email@company.com"');
    process.exit(1);
  }
  
  if (!JIRA_API_TOKEN) {
    console.error('❌ Error: JIRA_API_TOKEN environment variable is not set');
    console.log('\nSet it with: export JIRA_API_TOKEN="your-api-token"');
    process.exit(1);
  }

  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error('❌ Error: CSV file not found at', CSV_FILE_PATH);
    process.exit(1);
  }
}

// Create axios instance for JIRA API
function createJiraClient() {
  // Disable SSL verification for development
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  return axios.create({
    baseURL: JIRA_BASE_URL,
    auth: {
      username: JIRA_EMAIL,
      password: JIRA_API_TOKEN
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

// Read and parse CSV file
function readCSV() {
  console.log('📄 Reading CSV file:', CSV_FILE_PATH);
  
  let fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
  
  // Remove UTF-8 BOM if present
  if (fileContent.charCodeAt(0) === 0xFEFF) {
    fileContent = fileContent.substring(1);
  }
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });
  
  console.log(`   ✓ Found ${records.length} rows in CSV\n`);
  return records;
}

// Extract priority from severity/priority column
function extractPriority(severityText) {
  if (!severityText) return 'P3'; // Default to P3
  
  // Try to extract P1, P2, P3, or P4 from the text
  const match = severityText.match(/P([1-4])/i);
  if (match) {
    return `P${match[1]}`;
  }
  
  return 'P3'; // Default
}

// Format description from CSV row
function formatDescription(row) {
  const description = [];
  
  description.push('h3. Defect Details from UAT\n');
  
  // Add each field as a key-value pair
  const fields = [
    { label: 'Raised By', value: row['Raised By'] },
    { label: 'Date Raised', value: row['Date Raised'] },
    { label: 'Environment', value: row['Environment'] },
    { label: 'Module / Area', value: row['Module / Area'] },
    { label: 'Related Requirement', value: row['Related Requirement'] },
    { label: 'Test Case ID', value: row['Test Case ID'] },
    { label: 'Defect Description', value: row['Defect Description'] },
    { label: 'Severity / Priority', value: row['Severity / Priority'] },
    { label: 'Business Impact', value: row['Business Impact'] },
    { label: 'Impact Area', value: row['Impact Area'] },
    { label: 'Workaround Available?', value: row['Workaround Available?'] },
    { label: 'Go/No-Go Risk', value: row['Go/No-Go Risk'] },
    { label: 'Comments / Notes', value: row['Comments / Notes'] }
  ];
  
  fields.forEach(field => {
    if (field.value && field.value.trim() !== '' && field.value.trim() !== 'N/A') {
      description.push(`*${field.label}:* ${field.value}`);
    }
  });
  
  return description.join('\n');
}

// Check if bug already exists in JIRA
async function checkIfExists(client, defectName) {
  try {
    // Escape special characters in the defect name for JQL
    const escapedName = defectName.replace(/"/g, '\\"');
    
    const jql = `project = ${PROJECT_KEY} AND issuetype = Bug AND summary ~ "${escapedName}"`;
    
    const response = await client.post('/rest/api/3/search/jql', {
      jql: jql,
      maxResults: 1,
      fields: ['key', 'summary']
    });
    
    if (response.data.issues && response.data.issues.length > 0) {
      return response.data.issues[0].key;
    }
    
    return null;
  } catch (error) {
    console.error(`   ⚠️  Error checking for existing bug: ${error.message}`);
    return null;
  }
}

// Discover required field IDs and get defaults
async function discoverRequiredFields(client) {
  try {
    const fieldsResponse = await client.get('/rest/api/3/field');
    
    // Find Epic Link field
    const epicField = fieldsResponse.data.find(field => 
      field.name === 'Epic Link' || field.id === 'customfield_10014' || field.schema?.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'
    );
    const epicLinkId = epicField ? epicField.id : 'customfield_10014';
    
    // Find Company field
    const companyField = fieldsResponse.data.find(field => 
      field.name === 'Company' || field.id === 'customfield_11650'
    );
    const companyFieldId = companyField ? companyField.id : 'customfield_11650';
    
    // Get project components (for default)
    const projectResponse = await client.get(`/rest/api/3/project/${PROJECT_KEY}`);
    const defaultComponent = projectResponse.data.components?.[0];
    
    // Get create metadata to find valid company values
    const metaResponse = await client.get(`/rest/api/3/issue/createmeta?projectKeys=${PROJECT_KEY}&issuetypeNames=Bug&expand=projects.issuetypes.fields`);
    const bugMeta = metaResponse.data.projects?.[0]?.issuetypes?.find(it => it.name === 'Bug');
    const companyFieldMeta = bugMeta?.fields?.[companyFieldId];
    const defaultCompany = companyFieldMeta?.allowedValues?.[0];
    
    // Find Caroline Wallen's user account
    let carolineAccount = null;
    try {
      const userSearchResponse = await client.get('/rest/api/3/user/search', {
        params: { query: 'Caroline Wallen' }
      });
      if (userSearchResponse.data && userSearchResponse.data.length > 0) {
        carolineAccount = userSearchResponse.data[0];
        console.log(`   ✓ Found assignee: Caroline Wallen (${carolineAccount.accountId})`);
      } else {
        console.log('   ⚠️  Caroline Wallen not found, issues will be unassigned');
      }
    } catch (error) {
      console.log('   ⚠️  Could not find Caroline Wallen user');
    }
    
    // Get project versions to find "Release 1C"
    let release1CVersion = null;
    try {
      const versionsResponse = await client.get(`/rest/api/3/project/${PROJECT_KEY}/versions`);
      release1CVersion = versionsResponse.data.find(v => v.name === 'Release 1C');
      if (release1CVersion) {
        console.log(`   ✓ Found fixVersion: Release 1C (${release1CVersion.id})`);
      } else {
        console.log('   ⚠️  Release 1C version not found');
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch project versions');
    }
    
    console.log(`   ✓ Found Epic Link field: ${epicLinkId}`);
    console.log(`   ✓ Found Component: ${defaultComponent?.name || 'None'}`);
    console.log(`   ✓ Found Company: ${defaultCompany?.value || 'None'}\n`);
    
    return { 
      epicLinkId, 
      companyFieldId,
      defaultComponent,
      defaultCompany,
      carolineAccount,
      release1CVersion
    };
  } catch (error) {
    console.error(`   ⚠️  Error discovering required fields: ${error.message}\n`);
    return { 
      epicLinkId: 'customfield_10014',
      companyFieldId: 'customfield_11650',
      defaultComponent: null,
      defaultCompany: null,
      carolineAccount: null,
      release1CVersion: null
    };
  }
}

// Get priority ID from priority name
async function getPriorityId(client, priorityCode) {
  try {
    const response = await client.get('/rest/api/3/priority');
    
    // Map priority code (P1, P2, P3, P4) to full JIRA priority name
    const priorityMap = {
      'P1': 'P1 - Critical',
      'P2': 'P2 - High',
      'P3': 'P3 - Medium',
      'P4': 'P4 - Low'
    };
    
    const priorityName = priorityMap[priorityCode] || 'P3 - Medium';
    const priority = response.data.find(p => p.name === priorityName);
    
    if (priority) {
      return priority.id;
    }
    
    // Fallback: try to find by partial match
    const fallbackPriority = response.data.find(p => p.name && p.name.includes(priorityCode));
    if (fallbackPriority) {
      return fallbackPriority.id;
    }
    
    // Return P3 (Medium) as default
    const defaultPriority = response.data.find(p => p.name === 'P3 - Medium');
    return defaultPriority ? defaultPriority.id : '3';
  } catch (error) {
    console.error(`   ⚠️  Error getting priority ID: ${error.message}`);
    return '3'; // Default to Medium
  }
}

// Create bug in JIRA
async function createBug(client, defect, requiredFields) {
  try {
    const summary = defect['Defect Name'];
    const priorityCode = extractPriority(defect['Severity / Priority']);
    const description = formatDescription(defect);
    
    // Get priority ID
    const priorityId = await getPriorityId(client, priorityCode);
    
    const issueData = {
      fields: {
        project: {
          key: PROJECT_KEY
        },
        issuetype: {
          name: 'Bug'
        },
        summary: summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description
                }
              ]
            }
          ]
        },
        priority: {
          id: priorityId
        }
      }
    };
    
    // Add Epic Link
    issueData.fields[requiredFields.epicLinkId] = EPIC_KEY;
    
    // Add required Component field (use default)
    if (requiredFields.defaultComponent) {
      issueData.fields.components = [{ id: requiredFields.defaultComponent.id }];
    }
    
    // Add required Company field (use default)
    if (requiredFields.defaultCompany && requiredFields.companyFieldId) {
      issueData.fields[requiredFields.companyFieldId] = [requiredFields.defaultCompany];
    }
    
    // Assign to Caroline Wallen
    if (requiredFields.carolineAccount) {
      issueData.fields.assignee = { accountId: requiredFields.carolineAccount.accountId };
    }
    
    // Set fixVersion to Release 1C
    if (requiredFields.release1CVersion) {
      issueData.fields.fixVersions = [{ id: requiredFields.release1CVersion.id }];
    }
    
    const response = await client.post('/rest/api/3/issue', issueData);
    
    return response.data.key;
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ JIRA API Error: ${error.response.status}`);
      console.error(`   Details: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ❌ Error creating bug: ${error.message}`);
    }
    throw error;
  }
}

// Process defects from CSV
async function processDefects(client, defects, requiredFields) {
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  const results = {
    created: [],
    skipped: [],
    errors: []
  };
  
  for (const defect of defects) {
    const defectName = defect['Defect Name'];
    
    // Skip if defect name is empty
    if (!defectName || defectName.trim() === '') {
      continue;
    }
    
    // Skip test examples
    if (defectName.toUpperCase().includes('TEST EXAMPLE')) {
      console.log(`⏭️  Skipping test example: ${defectName}`);
      skipped++;
      results.skipped.push({ name: defectName, reason: 'Test example' });
      continue;
    }
    
    console.log(`\n🔍 Processing: ${defectName}`);
    
    // Check if already exists
    const existingKey = await checkIfExists(client, defectName);
    if (existingKey) {
      console.log(`   ⏭️  Already exists as ${existingKey}, skipping`);
      skipped++;
      results.skipped.push({ name: defectName, reason: `Already exists as ${existingKey}` });
      continue;
    }
    
    // Create the bug
    try {
      const newKey = await createBug(client, defect, requiredFields);
      console.log(`   ✅ Created bug: ${newKey}`);
      created++;
      results.created.push({ name: defectName, key: newKey });
    } catch (error) {
      console.log(`   ❌ Failed to create bug for: ${defectName}`);
      errors++;
      results.errors.push({ name: defectName, error: error.message });
    }
  }
  
  return { created, skipped, errors, results };
}

// Main function
async function main() {
  console.log('🚀 NH UAT Defect Upload to JIRA\n');
  console.log('============================================================');
  console.log(`   Epic: ${EPIC_KEY}`);
  console.log(`   Project: ${PROJECT_KEY}`);
  console.log(`   JIRA Instance: ${JIRA_BASE_URL}\n`);
  
  // Validate configuration
  validateConfig();
  
  // Create JIRA client
  const client = createJiraClient();
  
  // Discover required fields
  console.log('🔍 Discovering required fields...');
  const requiredFields = await discoverRequiredFields(client);
  
  // Read CSV
  const defects = readCSV();
  
  // Process defects
  console.log('📝 Processing defects...\n');
  const summary = await processDefects(client, defects, requiredFields);
  
  // Print summary
  console.log('\n============================================================');
  console.log('📊 SUMMARY:\n');
  console.log(`   Total Defects Processed: ${defects.length}`);
  console.log(`   ✅ Created: ${summary.created}`);
  console.log(`   ⏭️  Skipped: ${summary.skipped}`);
  console.log(`   ❌ Errors: ${summary.errors}\n`);
  
  if (summary.results.created.length > 0) {
    console.log('Created Bugs:');
    summary.results.created.forEach(item => {
      console.log(`   - ${item.key}: ${item.name}`);
    });
    console.log();
  }
  
  if (summary.results.skipped.length > 0) {
    console.log('Skipped:');
    summary.results.skipped.forEach(item => {
      console.log(`   - ${item.name} (${item.reason})`);
    });
    console.log();
  }
  
  if (summary.results.errors.length > 0) {
    console.log('Errors:');
    summary.results.errors.forEach(item => {
      console.log(`   - ${item.name}: ${item.error}`);
    });
    console.log();
  }
  
  console.log('🎉 Done!\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});

