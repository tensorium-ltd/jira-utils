# JIRA Integration - Story Points Report

This script fetches completed story points from JIRA based on status changes within a date range.

## Setup

### Authentication
The script uses your JIRA email and Personal Access Token (PAT) for authentication.

Set these environment variables before running:

```bash
export JIRA_EMAIL="richard.casey@benchmarkestimating.com"
export JIRA_API_TOKEN="your-token-here"
```

**Note:** Your API token is already configured. Keep it secure and never commit it to version control.

## Usage

### Command Line
```bash
npm run jira-points -- <start-date> <end-date>
```

### Example
```bash
# Get story points completed in November 2024
npm run jira-points -- 2024-11-01 2024-11-30

# Get story points for last quarter of 2024
npm run jira-points -- 2024-10-01 2024-12-31
```

### Date Format
- Dates must be in `YYYY-MM-DD` format
- Start date must be before or equal to end date

## How It Works

The script:

1. **Queries JIRA** using JQL: `project = VER10 AND status changed to ("READY FOR RELEASE", "CLOSED") during (startDate, endDate)`
2. **Extracts Story Points** from the `Story Points` custom field (customfield_10003)
3. **Finds Status Change Dates** from the issue changelog
4. **Calculates Totals** and generates a summary

## Output

Results are saved to: `reports/jira-completed-points-{startDate}-to-{endDate}.json`

### JSON Structure
```json
{
  "dateRange": {
    "start": "2024-11-01",
    "end": "2024-11-30"
  },
  "summary": {
    "totalStoryPoints": 145,
    "issueCount": 23,
    "issuesWithPoints": 20,
    "issuesWithoutPoints": 3,
    "project": "VER10"
  },
  "issues": [
    {
      "key": "VER10-123",
      "summary": "Implement user authentication",
      "storyPoints": 8,
      "statusChangedDate": "2024-11-15",
      "currentStatus": "CLOSED"
    }
  ]
}
```

## Configuration

### Project
Current project: **VER10**

To change the project, edit `PROJECT_KEY` in `src/get-jira-completed-points.js`

### Status Names
Current completed statuses:
- **READY FOR RELEASE**
- **CLOSED**

To change these, edit `COMPLETED_STATUSES` array in the script.

### JIRA Instance
Current instance: https://benchmarkestimating.atlassian.net

To change, set the `JIRA_BASE_URL` environment variable.

## Troubleshooting

### No Issues Found
If the script returns 0 issues, check:
- The date range includes dates when issues were actually completed
- The project key is correct (VER10)
- The status names match your JIRA workflow
- Issues have the "Story Points" field populated

### Authentication Error (401)
- Verify your JIRA_EMAIL is correct
- Check that your JIRA_API_TOKEN is valid and hasn't expired
- Regenerate token at: https://id.atlassian.com/manage-profile/security/api-tokens

### Network Error
- Ensure you have internet connectivity
- Check that benchmarkestimating.atlassian.net is accessible
- Verify your firewall/proxy settings

## Example Workflow

```bash
# Set credentials (do this once per terminal session)
export JIRA_EMAIL="richard.casey@benchmarkestimating.com"
export JIRA_API_TOKEN="your-token"

# Get points for different time periods
npm run jira-points -- 2024-11-01 2024-11-30  # November
npm run jira-points -- 2024-12-01 2024-12-31  # December
npm run jira-points -- 2024-01-01 2024-12-31  # Full year

# View results
cat reports/jira-completed-points-2024-11-01-to-2024-11-30.json
```

## Integration with Sprint Reports

This JIRA integration can complement your existing sprint reporting:
- Use JIRA data to verify actual story points completed
- Compare JIRA totals with your Excel-based sprint tracking
- Cross-reference epic completion rates


