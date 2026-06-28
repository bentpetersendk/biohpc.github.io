# BioHPC Approval Workflow

This document describes the production-ready approval workflow for BioHPC approval links hosted on GitHub Pages.

## Goal

Replace Airtable approval forms with a secure token-based approval flow that:

- keeps Airtable secrets out of the frontend
- updates the original Airtable record instead of creating a new one
- prevents duplicate approvals and duplicate notification loops
- provides a reusable approval pattern for future request types

The original Airtable request form remains in place for request creation. Approval itself no longer uses Airtable Forms.

## Frontend Architecture

The website now includes a single generic approval page:

- `approve.html`

Supporting files:

- `css/approve.css`
- `js/approve.js`
- `config.js`

The page is parameterized through the URL:

```text
https://biohpc.dk/approve.html?type=membership&token=<uuid>
```

This allows future request types such as `user`, `project`, `renewal`, or `delegate` to reuse the same page without creating separate approval pages.

## Token Flow

1. A user submits the existing Airtable form for a Project Membership Request.
2. Airtable creates one record in the Project Membership Requests table.
3. An Airtable automation generates and stores a UUID in `Approval Token`.
4. The automation emails the PI and Technical Contact with a BioHPC approval link containing:
   - `type=membership`
   - `token=<Approval Token>`
5. `approve.html` sends the token to a webhook endpoint.
6. Airtable automation looks up the original record by `Approval Token`.
7. Airtable returns a sanitized response for display.
8. When the approver clicks Approve or Reject, the frontend sends a second webhook request using only the token and decision.
9. Airtable updates the original record and returns the new status.

The browser never receives or submits Airtable record IDs.

## Webhook Flow

The frontend expects two configurable POST endpoints in `config.js`:

```js
siteConfig.approvals.endpoints.lookup
siteConfig.approvals.endpoints.decision
```

### Lookup request payload

```json
{
  "type": "membership",
  "token": "8c5fcb76-9691-4d89-b88b-662f0dbe0f41",
  "action": "lookup"
}
```

### Lookup response contract

```json
{
  "status": "pending",
  "request": {
    "title": "Project Membership Request",
    "subtitle": "Review the request below.",
    "userName": "Bent Petersen",
    "projectName": "PRJ-015",
    "principalInvestigator": "John Smith",
    "technicalContact": "Jane Doe",
    "status": "pending",
    "statusLabel": "Pending Approval"
  }
}
```

Other valid `status` values:

- `approved`
- `rejected`
- `invalid`
- `expired`

For already processed requests, include the actor and timestamp:

```json
{
  "status": "approved",
  "request": {
    "title": "Project Membership Request",
    "userName": "Bent Petersen",
    "projectName": "PRJ-015",
    "principalInvestigator": "John Smith",
    "technicalContact": "Jane Doe",
    "status": "approved",
    "statusLabel": "Approved",
    "processedBy": "John Smith",
    "processedAt": "2026-06-28T12:45:00Z"
  }
}
```

### Decision request payload

Approve:

```json
{
  "type": "membership",
  "token": "8c5fcb76-9691-4d89-b88b-662f0dbe0f41",
  "decision": "approve",
  "reason": ""
}
```

Reject:

```json
{
  "type": "membership",
  "token": "8c5fcb76-9691-4d89-b88b-662f0dbe0f41",
  "decision": "reject",
  "reason": "External collaborator not permitted"
}
```

The decision webhook should update the original Airtable record and return the final processed state in the same response format used by the lookup endpoint.

## Security Model

The GitHub Pages frontend must never communicate directly with Airtable tables or APIs.

Security properties of this design:

- no Airtable personal access token in frontend code
- no Airtable API key in frontend code
- no Airtable record IDs exposed to users
- the frontend knows only request type and UUID token
- all privileged Airtable operations occur inside Airtable automations or a trusted webhook receiver

If token expiration is added later, the lookup or decision endpoint should return:

```json
{
  "status": "expired"
}
```

The frontend already handles that state.

## Required Airtable Fields

The implementation assumes the Project Membership Requests table includes at least:

- `Approval Token`
- `Status`
- `PI Decision`
- `Approved By`
- `Approval Date`
- `Rejected Reason`
- `Email Sent`
- `Project`
- `User`
- `Technical Contact`
- `Principal Investigator`

Recommended additions for clean automation behavior:

- `Approval Status Label`
- `Processed By`
- `Processed At`
- `Approval Link Sent At`
- `Approval Expires At` (optional, future)
- `Decision Source` (for audit, e.g. `biohpc-approve-page`)

If you want a single processed-state response regardless of approve or reject, `Processed By` and `Processed At` simplify automation logic.

## Required Airtable Automation Changes

### 1. Request creation automation

Trigger when a Project Membership Request record is created.

Actions:

- generate UUID if `Approval Token` is empty
- set `Status` to a pending state such as `Pending Approval`
- mark email state fields as needed
- email PI and Technical Contact using `approve.html?type=membership&token=<Approval Token>`

### 2. Lookup webhook automation

Expose a webhook URL that:

- accepts `type`, `token`, and `action=lookup`
- validates `type=membership`
- finds the original record by `Approval Token`
- returns only sanitized frontend-safe fields
- returns `approved` or `rejected` instead of a pending payload if already processed
- returns `invalid` when no matching token exists
- returns `expired` when token expiry is enabled and the token is no longer valid

### 3. Decision webhook automation

Expose a webhook URL that:

- accepts `type`, `token`, `decision`, and optional `reason`
- finds the original record by `Approval Token`
- checks whether the record is still pending
- if already processed, returns the processed state without changing the record
- if pending, updates the original record only
- sets decision, processed-by fields, timestamps, and optional rejection reason
- suppresses duplicate email behavior tied to new record creation
- returns the final processed state payload

## Future Extension Points

To add more approval types later:

1. Add a new entry under `siteConfig.approvals.requestTypes` in `config.js`.
2. Reuse `approve.html` and `js/approve.js`.
3. Extend the lookup and decision automations to branch on `type`.
4. Return the same response contract for the new type.

This keeps the frontend generic while allowing separate Airtable tables or automations per workflow.

## Manual Deployment Steps

1. Set `siteConfig.approvals.endpoints.lookup` in `config.js`.
2. Set `siteConfig.approvals.endpoints.decision` in `config.js`.
3. Commit and push the website changes to the GitHub Pages publishing branch.
4. Configure or update the Airtable automations described above.
5. Send a test Project Membership Request through the existing Airtable form.
6. Verify:
   - only one Airtable record exists
   - the approval email contains the BioHPC link
   - lookup shows the request correctly
   - approving updates the original record
   - reopening the same link shows the already-processed state
   - rejecting stores the optional reason

## Production Assumptions Requiring Confirmation

- whether lookup and decision use two separate webhooks or one shared endpoint routed by payload
- exact Airtable table name for membership requests
- exact field names, especially for processed-by and processed-at values
- whether Technical Contact approvals should populate the same decision fields as PI approvals
- whether token expiration should be enabled immediately
- whether the webhook response should include the approver identity derived from Airtable or from automation context
