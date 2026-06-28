# Airtable Project Membership Approval Setup

This document captures the exact live Airtable schema and the remaining setup required to switch Project Membership approvals to the BioHPC approval page.

## Current Live Table

Table:

- `Project Membership Requests`
- table id: `tblNB3tT1jmDj4C1p`

## Live Fields Reused

- `User`
- `Full Name (from User)`
- `Project`
- `Status`
- `Approval Link`
- `Approval Date`
- `Source`
- `PI Decision`
- `Email sent for PI Approval`
- `Notification Recipient Names (from Project Space)`
- `Notification Recipients (from Project Space)`
- `PI`
- `PI KU email (from Project)`
- `Project Space Slug (from Project)`
- `Compute Project Name (from Project)`

## Live Fields Added

These fields were added directly to Airtable:

- `Approval Token`
- `Processed By`
- `Processed At`
- `Rejected Reason`
- `Decision Source`
- `Approval Link Sent At`

## Live Fields Not Added

No separate `Approved By` field was added because the existing table already has:

- `Approval Date`

The new workflow uses:

- `Processed By`
- `Processed At`

and can continue writing `Approval Date` for compatibility with any downstream logic.

## Live Status And Decision Values

These existing single-select values are already present and should be reused exactly:

Status:

- `Pending PI Approval`
- `Approved - Pending Provisioning`
- `Active`
- `Rejected`

PI Decision:

- `Approve`
- `Reject`

Source:

- `User Form`
- `PI Form`
- `Admin`

## Live Schema Changes Already Applied

### Approval Link

The `Approval Link` formula was updated from the old Airtable PI form to the BioHPC approval page:

```text
IF(
  {Approval Token},
  CONCATENATE(
    "https://biohpc.dk/approve.html?type=membership&token=",
    ENCODE_URL_COMPONENT({Approval Token})
  ),
  ""
)
```

This means new and existing records will point to the GitHub Pages approval flow once `Approval Token` is populated.

## Trigger Rule For Genuine User Requests

The request-created automation should trigger only when all of the following are true:

- `Source = User Form`
- `Status` is empty or should move to `Pending PI Approval`
- `Approval Token` is empty

This prevents the old PI-form path from re-entering the workflow.

## Automation 1: Request-Created Approval Email

Create or update an Airtable automation for new user-submitted membership requests.

### Trigger

When record matches conditions in `Project Membership Requests`:

- `Source = User Form`
- `Approval Token` is empty

### Action 1

Run a script to generate a UUID if `Approval Token` is empty.

Inputs:

- `recordId`

Script:

```javascript
const { recordId } = input.config();

const table = base.getTable("Project Membership Requests");
const record = await table.selectRecordAsync(recordId);

if (!record) {
  throw new Error("Record not found.");
}

if (record.getCellValueAsString("Approval Token")) {
  output.set("approvalToken", record.getCellValueAsString("Approval Token"));
  return;
}

const approvalToken = crypto.randomUUID();

await table.updateRecordAsync(recordId, {
  "Approval Token": approvalToken,
  "Status": { name: "Pending PI Approval" },
});

output.set("approvalToken", approvalToken);
```

### Action 2

Send email to:

- `Notification Recipients (from Project Space)`

Suggested subject:

```text
BioHPC approval required: Project membership request
```

Suggested body:

```text
BioHPC has received a Project Membership Request that requires review.

User: {Full Name (from User)}
Project: {Project}
Status: Pending PI Approval

Review request:
{Approval Link}
```

### Action 3

Update record:

- `Email sent for PI Approval` = checked
- `Approval Link Sent At` = current timestamp

If you prefer, the timestamp can also be set inside the script action.

## Automation 2: Lookup Webhook

Create an Airtable automation with trigger:

- `When webhook received`

This automation should accept:

```json
{
  "type": "membership",
  "token": "UUID",
  "action": "lookup"
}
```

### Validation Rules

- `type` must equal `membership`
- `token` must be present
- `action` must equal `lookup`

### Lookup Logic

Find the record in `Project Membership Requests` where:

- `Approval Token = token`

If no record exists, return:

```json
{
  "status": "invalid"
}
```

If the record exists and `Status = Pending PI Approval`, return:

```json
{
  "status": "pending",
  "request": {
    "title": "Project Membership Request",
    "subtitle": "Review the request below.",
    "userName": "<Full Name (from User)>",
    "projectName": "<Project>",
    "principalInvestigator": "<PI-derived or Notification Recipient Names-derived value>",
    "technicalContact": "<Technical Contact Name when present>",
    "status": "pending",
    "statusLabel": "Pending Approval"
  }
}
```

If the record exists and `Status = Approved - Pending Provisioning` or `Active`, return:

```json
{
  "status": "approved",
  "request": {
    "title": "Project Membership Request",
    "subtitle": "Review the request below.",
    "userName": "<Full Name (from User)>",
    "projectName": "<Project>",
    "principalInvestigator": "<PI-derived value>",
    "technicalContact": "<Technical Contact Name when present>",
    "status": "approved",
    "statusLabel": "Approved",
    "processedBy": "<Processed By>",
    "processedAt": "<Processed At or Approval Date>",
    "reason": ""
  }
}
```

If the record exists and `Status = Rejected`, return:

```json
{
  "status": "rejected",
  "request": {
    "title": "Project Membership Request",
    "subtitle": "Review the request below.",
    "userName": "<Full Name (from User)>",
    "projectName": "<Project>",
    "principalInvestigator": "<PI-derived value>",
    "technicalContact": "<Technical Contact Name when present>",
    "status": "rejected",
    "statusLabel": "Rejected",
    "processedBy": "<Processed By>",
    "processedAt": "<Processed At or Approval Date>",
    "reason": "<Rejected Reason>"
  }
}
```

## Automation 3: Decision Webhook

Create a second Airtable automation with trigger:

- `When webhook received`

Input:

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
  "reason": "Optional text"
}
```

### Validation Rules

- `type` must equal `membership`
- `token` must be present
- `decision` must be `approve` or `reject`

### Decision Logic

1. Find the record by `Approval Token`.
2. If not found, return `{ "status": "invalid" }`.
3. If `Status` is already `Approved - Pending Provisioning`, `Active`, or `Rejected`, return the current processed state without updating anything.
4. If pending and `decision = approve`, update:
   - `PI Decision` = `Approve`
   - `Status` = `Approved - Pending Provisioning`
   - `Processed By` = approver label
   - `Processed At` = now
   - `Approval Date` = today
   - `Decision Source` = `biohpc-approve-page`
5. If pending and `decision = reject`, update:
   - `PI Decision` = `Reject`
   - `Status` = `Rejected`
   - `Rejected Reason` = webhook reason or blank
   - `Processed By` = approver label
   - `Processed At` = now
   - `Approval Date` = today
   - `Decision Source` = `biohpc-approve-page`

### Approver Identity

The frontend does not currently send approver identity. The Airtable automation therefore needs one of these approaches:

1. Set `Processed By` to a neutral value like `PI/Technical Contact via approval link`.
2. Extend the frontend later so the lookup response includes a signed approver label and the decision call sends it back.

Option 1 is the minimum viable path and works today without weakening security.

## Old Automation To Disable

Disable or rewrite the automation that currently creates a new `Project Membership Requests` record from the Airtable PI approval form.

The presence of both:

- `Source = User Form`
- `Source = PI Form`

for the same user/project pair confirms the old duplicate-record flow is still active.

At minimum:

- stop sending or using the old Airtable PI form link
- disable any automation triggered by `Source = PI Form` that leads to approval record creation

## Website Config

Once the two webhook automations exist, set:

```js
siteConfig.approvals.endpoints.lookup = "https://...airtable webhook url..."
siteConfig.approvals.endpoints.decision = "https://...airtable webhook url..."
```

## Important Constraint

The missing piece from this environment is Airtable automation creation and webhook URL generation. The schema and formula changes were applied live, but the actual automation objects and webhook URLs still need to be created in Airtable unless you have another management interface for Airtable automations.

## Live Test Results On 2026-06-28

The provided webhook URLs were tested directly.

### Lookup webhook

Request body:

```json
{
  "type": "membership",
  "token": "abbea970-4538-4a33-a333-111d0cc72647",
  "action": "lookup"
}
```

Observed HTTP response:

```json
{
  "success": true
}
```

This is not compatible with the frontend contract, which requires:

```json
{
  "status": "pending|approved|rejected|invalid|expired",
  "request": { ... }
}
```

### Invalid lookup webhook

Request body:

```json
{
  "type": "membership",
  "token": "00000000-0000-0000-0000-000000000000",
  "action": "lookup"
}
```

Observed HTTP response:

```json
{
  "success": true
}
```

This means invalid-token handling is not being returned to the caller.

### Decision webhook

Request body:

```json
{
  "type": "membership",
  "token": "abbea970-4538-4a33-a333-111d0cc72647",
  "decision": "approve",
  "reason": ""
}
```

Observed HTTP response:

```json
{
  "success": true
}
```

After the call, the original pending user-form record remained unchanged:

- `Status` still `Pending PI Approval`
- no `PI Decision`
- no `Processed By`
- no `Processed At`

## Conclusion From Live Testing

The current Airtable webhook setup is not sufficient to support the frontend as implemented.

There are two separate problems:

1. The lookup webhook does not return the JSON payload the frontend needs to render request state.
2. The decision webhook did not update the original record when tested with the live pending token.

As currently configured, the Airtable webhook flow is not production-ready.

## Required Production Fix

To make the current frontend work, the approval backend must provide synchronous JSON responses for both lookup and decision requests.

That backend can:

- call Airtable internally
- update the original record only
- return sanitized JSON to the browser

Possible implementations:

- a small external serverless function layer in front of Airtable
- a trusted backend endpoint outside GitHub Pages

Direct Airtable generic webhooks, as currently tested, do not satisfy the frontend contract by themselves.
