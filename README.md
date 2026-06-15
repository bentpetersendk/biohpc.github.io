# BioHPC Website

This repository contains the static GitHub Pages website for BioHPC.

## Dynamic Website Statistics

The production site reads public statistics from the separate `dashboard-data` repository instead of storing generated JSON in this website repository.

The BioHPC statistics URL is configured in `config.js`:

```js
siteConfig.urls.biohpcStats
```

The current production source is:

```text
https://raw.githubusercontent.com/bentpetersendk/dashboard-data/main/biohpc/stats.json
```

The website repository keeps the Airtable export script for maintainability, but its scheduled publishing workflow should run from `dashboard-data`.

### Airtable Source Tables

Website statistics are calculated directly from the operational Airtable source tables:

- `Users`
- `PIs`
- `Research Groups`
- `Projects`
- `User Access Requests`

No separate Website Statistics table is required.

### Required GitHub Secrets

Add these repository secrets in GitHub under **Settings > Secrets and variables > Actions**:

- `AIRTABLE_TOKEN` - Airtable personal access token with read access to the base.
- `AIRTABLE_BASE_ID` - Airtable base ID, such as `app...`.

Optional:

- `AIRTABLE_VIEW` - Airtable view name to use when counting records. If omitted, all records in each table are counted.

Optional repository variables can override the default Airtable `filterByFormula` expressions:

- `AIRTABLE_TOTAL_USERS_REGISTERED_FORMULA`
- `AIRTABLE_ACTIVE_USERS_FORMULA`
- `AIRTABLE_APPROVED_USERS_FORMULA`
- `AIRTABLE_PENDING_USER_REQUESTS_FORMULA`
- `AIRTABLE_APPROVED_PIS_FORMULA`
- `AIRTABLE_PENDING_PI_REQUESTS_FORMULA`
- `AIRTABLE_ACTIVE_PROJECTS_FORMULA`
- `AIRTABLE_ORDERED_PROJECTS_FORMULA`

The defaults use the current BioHPC Airtable schema:

- total users registered: `OR(LOWER({Account Status}) = "active", LOWER({Account Status}) = "inactive", LOWER({Account Status}) = "disabled", LOWER({Account Status}) = "suspended", LOWER({Account Status}) = "deactivated", LOWER({Account Status}) = "closed")`
- active users: `LOWER({Account Status}) = "active"`
- approved users: `LOWER({Account Status}) = "active"` retained for existing consumers and defaults to the active-access definition.
- pending user requests: `LOWER({Account Status}) = "pending pi approval"`
- registered PIs: all records in the `PIs` table.
- approved PIs: `{PI Registration Status} = "Approved"`
- pending PIs: `{PI Registration Status} = "Pending Verification"`
- active projects: `LOWER({Project Status}) = "active"`
- ordered projects: `LOWER({Project Status}) = "ordered"`

The public `users.registered` metric represents historical platform growth: users who have ever been approved and onboarded. The public `users.active` metric represents current BioHPC access. If new non-active onboarded user statuses are added in Airtable, include them by updating `AIRTABLE_TOTAL_USERS_REGISTERED_FORMULA`.

The public `pis.registered` metric represents all Principal Investigators registered in BioHPC. The public `pis.approved` metric represents Principal Investigators whose registration status is Approved, and `pis.pending_requests` represents Principal Investigators whose registration status is Pending Verification.

### Publishing Statistics

Use the dashboard-data workflow included in `dashboard-data/.github/workflows/update_biohpc_stats.yml` as the scheduled publisher. It generates `biohpc/stats.json` in the dashboard-data repository and commits only when the JSON changes.

### Adding More Metrics

Edit the `METRICS` tuple and `STATS_TEMPLATE` near the top of `scripts/update_stats.py`:

```python
Metric("storage", "allocated_tb", "Storage", "AIRTABLE_STORAGE_ALLOCATED_FORMULA")
```

The metric configuration maps a public JSON section and field to an Airtable source table and optional formula. Add future sections such as `storage`, `compute`, or `billing` to `STATS_TEMPLATE` without changing the overall JSON structure. Set `STATS_OUTPUT_PATH` when running the script if the output should go somewhere other than `biohpc/stats.json`.
