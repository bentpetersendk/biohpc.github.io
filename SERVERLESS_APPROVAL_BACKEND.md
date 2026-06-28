# Serverless Approval Backend

This backend replaces the Airtable webhook dependency while preserving the existing frontend contract in `approve.html` and `js/approve.js`.

## Goal

Keep the GitHub Pages frontend exactly as implemented and move approval logic to a small serverless API that:

- accepts token-based lookup and decision requests
- uses the Airtable REST API privately
- updates the original `Project Membership Requests` record only
- returns the JSON already expected by the frontend
- never exposes Airtable secrets or Airtable record IDs to the browser

## Chosen Implementation

This repository now includes a Vercel Serverless Functions backend in:

- [backend/approval-vercel/api/_lib/approval.js](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/api/_lib/approval.js)
- [backend/approval-vercel/api/index.js](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/api/index.js)
- [backend/approval-vercel/api/lookup.js](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/api/lookup.js)
- [backend/approval-vercel/api/decision.js](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/api/decision.js)
- [backend/approval-vercel/vercel.json](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/vercel.json)

Vercel documents function routing and repository configuration in its official docs:

- https://vercel.com/docs/functions
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration

## API Contract

### `POST /lookup`

Request:

```json
{
  "type": "membership",
  "token": "UUID",
  "action": "lookup"
}
```

Response:

```json
{
  "status": "pending|approved|rejected|invalid",
  "request": {
    "title": "Project Membership Request",
    "subtitle": "Review the request below.",
    "userName": "Bent Petersen",
    "projectName": "PRJ-015",
    "principalInvestigator": "John Smith",
    "technicalContact": "Jane Doe",
    "status": "pending",
    "statusLabel": "Pending Approval",
    "processedBy": "",
    "processedAt": "",
    "rejectionReason": "",
    "reason": ""
  }
}
```

### `POST /decision`

Request:

```json
{
  "type": "membership",
  "token": "UUID",
  "decision": "approve",
  "reason": ""
}
```

or:

```json
{
  "type": "membership",
  "token": "UUID",
  "decision": "reject",
  "reason": "Optional reason"
}
```

The backend returns the same processed-state JSON contract as the lookup endpoint.

## Airtable Behavior

The Vercel backend is hard-wired to the live `Project Membership Requests` table and current field names:

- `Approval Token`
- `Status`
- `PI Decision`
- `Processed By`
- `Processed At`
- `Approval Date`
- `Rejected Reason`
- `Decision Source`
- `Full Name (from User)`
- `Project`
- `PI`
- `Notification Recipient Names (from Project Space)`

Approval updates:

- `PI Decision = Approve`
- `Status = Approved - Pending Provisioning`
- `Processed By`
- `Processed At`
- `Approval Date`
- `Decision Source = biohpc-approve-page`

Reject updates:

- `PI Decision = Reject`
- `Status = Rejected`
- `Rejected Reason`
- `Processed By`
- `Processed At`
- `Approval Date`
- `Decision Source = biohpc-approve-page`

If the request is already approved or rejected, the backend returns the current processed state without updating anything.

## Duplicate Detection

The Vercel backend enforces token uniqueness by querying Airtable with `maxRecords=2`.

- zero matches: returns `{"status":"invalid"}`
- one match: processes normally
- more than one match: returns HTTP `409`

This prevents ambiguous approval tokens from mutating records.

## Deployment

Deploy [backend/approval-vercel](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel) as its own Vercel project.

Required environment variables:

- `AIRTABLE_BASE_ID`
- `AIRTABLE_TOKEN`
- `APPROVAL_PROCESSED_BY_LABEL`
- `CORS_ALLOWED_ORIGINS`
- `AIRTABLE_TIME_ZONE`
- `AIRTABLE_USER_LOCALE`

An example file is included at:

- [backend/approval-vercel/.env.example](/Users/bentpetersen/GitHub/BioHPC_Website/backend/approval-vercel/.env.example)

The `vercel.json` rewrites let the deployed backend answer:

- `GET /`
- `POST /lookup`
- `POST /decision`

## Frontend Configuration

Update [config.js](/Users/bentpetersen/GitHub/BioHPC_Website/config.js) so the existing frontend calls the Vercel backend instead of Airtable webhooks:

```js
siteConfig.approvals.endpoints.lookup = "https://<vercel-host>/lookup";
siteConfig.approvals.endpoints.decision = "https://<vercel-host>/decision";
```

No changes are required in `approve.html` or `js/approve.js`.

## Removing The Old Airtable Form Workflow

Once the Vercel backend is deployed and `config.js` points to it:

1. Stop using Airtable generic webhook endpoints for approvals.
2. Disable the old PI approval Airtable Form and any automation that creates `Source = PI Form` records.
3. Keep the original user submission Airtable Form only.

## Manual Verification Checklist

1. Submit one new Project Membership Request through the existing user Airtable Form.
2. Confirm exactly one `Project Membership Requests` record is created.
3. Confirm `Approval Token` is populated.
4. Confirm `Approval Link` points to `approve.html`.
5. Open the approval link and verify lookup returns request details.
6. Approve the request.
7. Confirm the original record updates to `Approved - Pending Provisioning`.
8. Re-open the same link and confirm the page shows the already-approved state without buttons.
9. Submit another test request and reject it with an optional reason.
10. Confirm the original record updates to `Rejected` and stores `Rejected Reason`.
