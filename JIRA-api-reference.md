# JIRA API Reference

Reference document for JIRA REST API endpoints and patterns used in this project.

## Authentication

All API calls use **Basic Auth** with JIRA email and API token:

```javascript
const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
// Header: Authorization: Basic <base64>
```

**Environment variables:**
- `JIRA_EMAIL` – Atlassian account email
- `JIRA_API_TOKEN` – API token (create at id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_BASE_URL` – e.g. `https://benchmarkestimating.atlassian.net`

---

## REST API v3 Endpoints

### Search (JQL)

**POST** `/rest/api/3/search/jql`

Cursor-based pagination (Jira Cloud). Returns issues matching JQL.

```javascript
const body = {
  jql: 'project = VER10 AND sprint = "NH Sprint 37"',
  maxResults: 100,
  fields: ['key', 'summary', 'status', 'issuetype', 'assignee'],
  nextPageToken: null  // omit on first request, use from response for next page
};
const response = await client.post('/rest/api/3/search/jql', body);
// response.data.issues
// response.data.nextPageToken
```

### Get Issue

**GET** `/rest/api/3/issue/{issueIdOrKey}`

```javascript
// Basic
client.get(`/rest/api/3/issue/${key}`, {
  params: { fields: 'key,summary,status,issuetype,assignee' }
});

// With changelog (for status/assignee history)
client.get(`/rest/api/3/issue/${key}`, {
  params: {
    fields: 'key,summary,status,assignee',
    expand: 'changelog'
  }
});
```

### Get Issue Changelog (standalone)

**GET** `/rest/api/3/issue/{issueIdOrKey}/changelog`

Returns paginated changelog. Alternative to `expand=changelog` on issue fetch.

### List Fields

**GET** `/rest/api/3/field`

Returns all fields. Use to discover custom field IDs dynamically.

### Project Versions

**GET** `/rest/api/3/project/{projectIdOrKey}/versions`

Returns fix versions for a project.

### Project Statuses

**GET** `/rest/api/3/project/{projectIdOrKey}/statuses`

Returns workflow statuses for the project.

### Update Issue

**PUT** `/rest/api/3/issue/{issueIdOrKey}`

```javascript
await client.put(`/rest/api/3/issue/${key}`, {
  data: {
    fields: { fixVersions: [{ name: 'Release 2A' }] }
  }
});
```

---

## Agile / Scrum API

### List Sprints for Board

**GET** `/rest/agile/1.0/board/{boardId}/sprint`

```javascript
client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
  params: {
    state: 'active,closed,future',
    startAt: 0,
    maxResults: 50
  }
});
// response.data.values – array of sprints
// response.data.isLast
// Sprint: { id, name, state, startDate, endDate }
```

### Sprint Report (GreenHopper – legacy)

**GET** `/rest/greenhopper/1.0/rapid/charts/sprintreport`

```javascript
client.get('/rest/greenhopper/1.0/rapid/charts/sprintreport', {
  params: { rapidViewId: boardId, sprintId: sprint.id }
});
```

---

## Custom Fields (VER10 project)

| Field ID | Name | Usage |
|----------|------|-------|
| `customfield_10003` | Story Points | Story point estimate |
| `customfield_11150` | Sprint | Sprint assignment (multi-select) |
| `customfield_12700` | Team | Team 1, Team 2, etc. |
| `customfield_10014` | Epic Link | Links issue to epic |
| `customfield_13542` | FR Reference | Functional requirement mapping |
| `customfield_11650` | Company | Company field |
| `customfield_13445`, `customfield_13462` | Team (alternates) | Alternative team fields |

**Discovery pattern:**
```javascript
const fields = (await client.get('/rest/api/3/field')).data;
const storyPointsField = fields.find(f => 
  f.name?.toLowerCase().includes('story point')
);
// Use storyPointsField?.id || 'customfield_10003'
```

---

## JQL Patterns

### Basic filters

```
project = VER10
issuetype in (Story, Bug, "Sub-bug", "Sub-task")
sprint = "NH Sprint 37"
sprint = 3393                    # by sprint ID
status in ("Open", "In Dev")
statusCategory = Done
statusCategory = "In Progress"
statusCategory = "To Do"
statusCategory != Done
fixVersion = "Release 2A"
assignee is not EMPTY
```

### Historical / changelog

```
status WAS IN ("Ready for Release", "Closed") ON "2026-02-18 16:00"
status CHANGED TO ("In Dev") AFTER "2026-02-01"
status CHANGED TO ("Done") DURING ("2026-02-01", "2026-02-15")
status CHANGED FROM ("In QA", "In Review") TO ("In Dev") AFTER "2026-02-01"
status CHANGED TO ("In Dev") AFTER -2d
```

### Epic / parent

```
parent = VER10-8959
"Epic Link" = VER10-8959
parentEpic = VER10-8959
"Parent Link" = VER10-8959
```

### Combined (epic children)

```
project = VER10 AND (parent = VER10-8959 OR "Epic Link" = VER10-8959 OR parentEpic = VER10-8959) AND issuetype in (Story, Bug, "Sub-bug", "Sub-task")
```

---

## Response Structures

### Issue

```javascript
{
  key: 'VER10-1234',
  id: '12345',
  fields: {
    summary: '...',
    status: { name: 'In Dev', statusCategory: { name: 'In Progress' } },
    issuetype: { name: 'Story' },
    assignee: { displayName: 'John Doe', accountId: '...' },
    customfield_10003: 5,        // story points
    customfield_12700: { value: 'Team 1' },
    parent: { key: 'VER10-100' },
    customfield_10014: 'VER10-100'  // Epic Link
  }
}
```

### Changelog (expand=changelog)

```javascript
{
  changelog: {
    histories: [
      {
        created: '2026-02-20T14:30:00.000Z',
        author: { displayName: 'Jane Smith' },
        items: [
          { field: 'status', fromString: 'Open', toString: 'In Dev' },
          { field: 'assignee', toString: 'John Doe' }
        ]
      }
    ]
  }
}
```

### Sprint (Agile API)

```javascript
{
  id: 3393,
  name: 'NH Sprint 37',
  state: 'active',
  startDate: '2026-02-17T00:00:00.000Z',
  endDate: '2026-02-24T00:00:00.000Z'
}
```

---

## Project Constants

- **Project key:** `VER10`
- **Board ID:** `149`
- **Sprint name:** `NH Sprint 37` (configurable)

---

## Completed Statuses

Common statuses treated as "done":

```
Ready for Release, Ready for release, Complete, Completed, Done, Closed, Resolved
```

---

## Pagination Notes

- **Search JQL:** Uses `nextPageToken` (cursor), not `startAt`
- **Agile sprints:** Uses `startAt` + `maxResults`, check `isLast`
- **Changelog:** Paginated; use `expand=changelog` for full history on single issue (may truncate on very long histories)

---

## Rate Limiting

Scripts typically add `await new Promise(r => setTimeout(r, 80))` or similar between sequential API calls to avoid rate limits.
