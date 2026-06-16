# BioHPC Airtable Audit

Generated: 2026-06-16

## Scope and Method

This audit used read-only Airtable MCP commands against base `appQsnn57Oi8vNAWD` (BioHPC Management System), plus one read-only Airtable Metadata API call to retrieve view names because the MCP schema tool does not expose views. No write, create, update, delete, publish, or automation-changing tools were invoked.

Visible tables under the current PAT: HPC Systems, PIs, Sections, Users, Research Groups, Projects, and PI Approval Requests. Tables named `User Requests` and `Project Requests` were not visible as actual tables. Several tables contain text fields named `User Access Requests`, but those are not linked request tables.

## Executive Summary

The onboarding model is partially normalized for PIs, Users, Projects, Sections, and Research Groups, but the request/approval layer is not. The core break is that user onboarding uses a formula URL in `Users -> PI Approval URL` that pre-fills a form field named `Request Record ID` with the Users record ID. The target `PI Approval Requests` table has no link back to Users or PIs, and the only existing approval request record has only `Processed = No` populated. That means the approval form can create or expose an orphan approval record rather than a decision tied to the user, PI, and project records.

The base also appears to lack visible Airtable form/interface pages: MCP returned zero interfaces and zero standalone forms, while the formula URL points to a `pag.../form` path. This strongly suggests the approval link is pointing to an interface/form page that is deleted, unpublished, inaccessible to the PAT, or not part of the exposed base metadata.

No accessible record values contained literal Airtable placeholders such as `{Full Name}` or `{{...}}`, except for the intended prefill URL. However, the blank `PI Approval Requests` record strongly suggests an automation or form mapping is failing to populate dynamic values into plain text fields. The automation editor itself is not exposed by the official MCP tool list, so automation-step conclusions are inferred from schema and data rather than direct automation inspection.

## Tables and Views

| Table | Views exposed by Metadata API |
|---|---|
| HPC Systems | Grid view (grid) |
| PIs | Grid view (grid) |
| Sections | Grid view (grid) |
| Users | All users (grid) |
| Research Groups | Grid view (grid) |
| Projects | Grid view (grid) |
| PI Approval Requests | Grid view (grid) |

MCP `list-pages-for-base` returned 0 interfaces and 0 standalone forms.


## Field Inventory

### HPC Systems

Table ID: `tblOy9Lzf1B1bXXag`; primary field: System Name (fldxnZN9XiIpXs4eB); records observed: 1.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| System Name | `fldxnZN9XiIpXs4eB` | singleLineText |  |
| System Code | `fldiFKXq35qmz6O1V` | singleLineText |  |
| Active System | `fldtUTr245460z7nv` | checkbox |  |
| Support Email | `fldwbV1o3aN9Xff8N` | email |  |
| Default Storage Path | `fldeVrnkFIsXmcuIM` | singleLineText |  |
| System Label (Formula) | `fld27dNldNTHBMAYd` | formula | Formula: `UPPER({fldiFKXq35qmz6O1V})` |
| Alias | `fldt12WGxivOLLdB9` | number |  |
| Stedkode | `fldEXhx2wbOpWsiXd` | number |  |

### PIs

Table ID: `tbl5MpWWVyMbVHcbZ`; primary field: PI ID (fldThFKAjCSo4zN8k); records observed: 21.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| PI ID | `fldThFKAjCSo4zN8k` | formula | Displays 'PI-' followed by the KU ID value. Formula: `"PI-" & UPPER({fldqkPjtKE3oGBrIW})` |
| Full Name | `fldVUFRYfzVVYle4E` | singleLineText |  |
| KU ID | `fldqkPjtKE3oGBrIW` | singleLineText |  |
| Validated KU-ID | `fldq1UIQM8CU7luH6` | formula | Checks if {KU ID} matches the format: three lowercase letters followed by three digits. Formula: `IF(<br>  REGEX_MATCH({fldqkPjtKE3oGBrIW}, "^[a-z]{3}[0-9]{3}$"),<br>  "✅ Valid",<br>  "❌ Invalid"<br>)` |
| PI Registration Status | `fldNwTkxcpNSGemf0` | singleSelect | Choices:     Pending Verification;     Approved;     Rejected |
| Link to Researchgroup website | `fldrc2qglFcE8UY4X` | url |  |
| KU email | `fldg05xEVi3JHuT6u` | email |  |
| Researcher Affiliation Verification | `fldTgJNDWbo8tWSGQ` | aiText | Verifies the researcher's affiliation using their full name, research group name, and the research group website. |
| Section | `fldTzFooGLkYKuS7G` | multipleRecordLinks | Links to Sections; inverse PIs (fldGkipvQlCeq4CuE) |
| Short Section Name | `fldP0EfkLeTlEI9eQ` | multipleLookupValues | Lookup via Section (fldTzFooGLkYKuS7G) -> Short Name (fldrV6pLb7yLwIuMZ) |
| Section Name | `fldVOPnQareartC7x` | multipleLookupValues | Lookup via Section (fldTzFooGLkYKuS7G) -> Section Name (fldUjIhbFT5iuR3zA) |
| Research Group | `fldQn2fuWA6wUh8ZG` | multipleRecordLinks | Links to Research Groups; inverse PI (fldPKJ6X5fVt7QH93) |
| Research Group Name | `fldPvbWa2ONgW1yd3` | multipleLookupValues | Lookup via Research Group (fldQn2fuWA6wUh8ZG) -> Research Group Name (fld86DeBE1KGGbIeZ) |
| Project Invitation Sent | `fldOFmoLHn9NaQtuY` | dateTime |  |
| Active | `fldKoeOAnw2QT31MC` | checkbox |  |
| Notes | `fldvo9REPb0gaJr5u` | multilineText |  |
| Users | `fldhb4vK2maiJ1BQI` | multipleRecordLinks | Links to Users; inverse PIs (fldTVYafKpLVyncCd) |
| Projects | `fldTUOlHjYowoxqOp` | multipleRecordLinks | Links to Projects; inverse PIs (fldw4MldOSo88Uf7C) |
| Researcher Image | `fldnKecqY1spSZDvy` | multipleAttachments | Finds and displays an image of the researcher using their full name and associated web pages. |
| Created | `fldPsV534FvMqDAM3` | createdTime |  |
| Technical Contact Name | `fldsijBBDgW0YD41I` | singleLineText |  |
| Technical Contact Email | `fldJuoDPrkZFy23y8` | email |  |
| Notification Recipients | `fldedqabTKySKgT2y` | formula | Formula: `IF(<br>  {fldJuoDPrkZFy23y8},<br>  {fldg05xEVi3JHuT6u} & "," & {fldJuoDPrkZFy23y8},<br>  {fldg05xEVi3JHuT6u}<br>)` |
| Notification Recipient Names | `fldjAmMz3Q5292NI3` | formula | Formula: `IF(<br>    {fldsijBBDgW0YD41I},<br>    {fldVUFRYfzVVYle4E} & " and " & {fldsijBBDgW0YD41I},<br>    {fldVUFRYfzVVYle4E}<br>)` |
| User Access Requests | `fldN0cOR218GXey4l` | singleLineText |  |
| Responsibility | `fld3mxDvtV3H80QOV` | checkbox | By submitting this form, you confirm that you:<br><br>* Accept responsibility for users, projects, and any associated resource usage or costs incurred under your PI account.<br>* Will approve and manage users affiliated with your BioHPC project space(s).<br>* Will ensure that project activities comply with University of Copenhagen policies, data protection requirements, and relevant regulations.<br>* Remain the owner and responsible party for your BioHPC project space(s), even if one or more Technical Contacts are designated.<br><br>Technical Contacts, which can be selected when creating a project, may receive BioHPC notifications and act on behalf of the PI for routine administrative workflows, including user management, project administration, storage requests, and access approvals. However, ultimate responsibility for the project space remains with the PI. |
| Projects copy | `fldPrA7epv6SFcU0f` | singleLineText |  |
| Website Statistics | `fldbPwg6rcR9WY87l` | singleLineText |  |

### Sections

Table ID: `tblERYsdgYI2I7M6q`; primary field: Section ID (fldFb7jgwiqtjDy0S); records observed: 10.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Section ID | `fldFb7jgwiqtjDy0S` | formula | Formula: `"SEC-" & UPPER({fldrV6pLb7yLwIuMZ})` |
| Section Name | `fldUjIhbFT5iuR3zA` | singleLineText |  |
| Short Name | `fldrV6pLb7yLwIuMZ` | singleLineText |  |
| Department | `fld15kff80si1ev7x` | singleLineText |  |
| Notes | `fldDuWlwH3suGUNIO` | multilineText |  |
| PIs | `fldGkipvQlCeq4CuE` | multipleRecordLinks | Links to PIs; inverse Section (fldTzFooGLkYKuS7G) |
| Research Groups | `fldfpfxciecKgpDMC` | multipleRecordLinks | Links to Research Groups; inverse Section (fldrplE43XwaADVJK) |
| User Access Requests | `flddGIsXFqA9lI5Xd` | singleLineText |  |

### Users

Table ID: `tblgxAv93as9ToK6f`; primary field: KU-ID (fldC5Yj0OTLPfiuEn); records observed: 1.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| KU-ID | `fldC5Yj0OTLPfiuEn` | singleLineText |  |
| Full Name | `fldCFYdHenI7ydikF` | singleLineText |  |
| KU email | `fldxRdNYIKDgDsJ1E` | email |  |
| Secondary email | `fldxyZSjwnvdkSzCY` | email |  |
| Communication Email Choice | `fldGRwAsIB9mQAV7m` | singleSelect | Choices: UCPH email; Secondary email |
| Communication Email (AUTO) | `fldwK40QXb2XSgAIR` | formula | Formula: `IF(<br>  {fldGRwAsIB9mQAV7m} = "Secondary email",<br>  {fldxyZSjwnvdkSzCY},<br>  {fldxRdNYIKDgDsJ1E}<br>)` |
| Account Status | `fldN0LhCUrQbF6yJA` | singleSelect | Choices: Pending PI approval; PI approved - pending creation; Rejected by PI; Created - pending user notification; Active; Expired; Closed / Deleted |
| Is Active (flag) | `fld2b2DSbtA3dpUaS` | formula | Formula: `IF({fldN0LhCUrQbF6yJA} = "Active", 1, 0)` |
| PIs | `fldTVYafKpLVyncCd` | multipleRecordLinks | Links to PIs; inverse Users (fldhb4vK2maiJ1BQI) |
| Notification Recipients (from PIs) | `fldOrdNkIBbDDmS12` | multipleLookupValues | Lookup via PIs (fldTVYafKpLVyncCd) -> Notification Recipients (fldedqabTKySKgT2y) |
| Notification Recipient Names (from PIs) | `fldj9Qich6k55Sndn` | multipleLookupValues | Lookup via PIs (fldTVYafKpLVyncCd) -> Notification Recipient Names (fldjAmMz3Q5292NI3) |
| PI KU email | `fldv5qxaQOsSJ6pw3` | multipleLookupValues | Lookup via PIs (fldTVYafKpLVyncCd) -> KU email (fldg05xEVi3JHuT6u) |
| Section Name | `fldmLnRMsLwN934Xl` | multipleLookupValues | Lookup via PIs (fldTVYafKpLVyncCd) -> Section Name (fldVOPnQareartC7x) |
| Research Group | `fldYxiXKDHCftHb5o` | multipleLookupValues | Lookup via PIs (fldTVYafKpLVyncCd) -> Research Group (fldQn2fuWA6wUh8ZG) |
| Projects | `fldayU532DnnH1HJg` | multipleRecordLinks | Links to Projects; inverse Users (fldh7Xahl1l0q4Ow4) |
| Compute queue | `fldd4Mf92JwiriowP` | multipleSelects | Choices: BioHPC_Normal; BioHPC_Long |
| Agreement to BioHPC Policies | `fld4d65SqMQA6RGiE` | checkbox |  |
| PI Rejection Reason | `fldOgFFF1X2EzVuEc` | multilineText |  |
| Airtable Record ID | `fldh4OI05WcUUHWGK` | formula | Formula: `RECORD_ID()` |
| End Date | `fldu6KTBgvH1Bwno3` | date |  |
| Created time | `fld6YNxdJ5TtP8tvd` | createdTime |  |
| Account Created Date | `fldU4wFYVHxPl3VHT` | dateTime |  |
| PI Approval Date | `fldS5Rgz5tIpCqD6n` | dateTime |  |
| PI Approval URL | `fldSYcRLVcvLwtc7Y` | formula | Formula: `"https://airtable.com/appQsnn57Oi8vNAWD/pagv9KDyDCG0tQCQ5/form?prefill_Request%20Record%20ID=" &<br>{fldh4OI05WcUUHWGK}` |

### Research Groups

Table ID: `tblWQbpjreJxbpC8a`; primary field: Group ID (fldvNAHm4xtmeeJt6); records observed: 71.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Group ID | `fldvNAHm4xtmeeJt6` | formula | Formula: `"GRP-" & {fldf5IvERSXSyYb26} & "-" & UPPER({fldKyXiaGlz64rh7d})` |
| PI | `fldPKJ6X5fVt7QH93` | multipleRecordLinks | Links to PIs; inverse Research Group (fldQn2fuWA6wUh8ZG) |
| Research Group Name | `fld86DeBE1KGGbIeZ` | singleLineText |  |
| Short name | `fldKyXiaGlz64rh7d` | singleLineText |  |
| Section | `fldrplE43XwaADVJK` | multipleRecordLinks | Links to Sections; inverse Research Groups (fldfpfxciecKgpDMC) |
| Section Short Name | `fldf5IvERSXSyYb26` | multipleLookupValues | Lookup via Section (fldrplE43XwaADVJK) -> Short Name (fldrV6pLb7yLwIuMZ) |
| Section Name | `fldKxEwaoqrMwczWG` | multipleLookupValues | Lookup via Section (fldrplE43XwaADVJK) -> Section Name (fldUjIhbFT5iuR3zA) |
| User Access Requests | `fldOSw8E8EVYbSUVL` | singleLineText |  |

### Projects

Table ID: `tblWy1iUVG9UYF13T`; primary field: Project ID (fldec0GUIxFkQSQCb); records observed: 12.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Project ID | `fldec0GUIxFkQSQCb` | formula | Generates a Project ID by prefixing 'PRJ-' and zero-padding the Project Number to 4 digits. Formula: `"PRJ-" & RIGHT("0000" & {fldOPfrACWhHRBmsy}, 3)` |
| Created time | `fldV1qxtEWXp7ZPEf` | createdTime |  |
| Project Status | `fldyHQZ9IGDZskKKf` | singleSelect | Choices: Active; Closed; Ordered |
| Compute Project Name | `fld2MZm41QWvetjg8` | singleLineText |  |
| Project Space Slug | `fldDLpDRsnOV8yNGP` | formula | Formula: `LOWER(<br>SUBSTITUTE(<br>SUBSTITUTE(<br>{fld2MZm41QWvetjg8},<br>" ",<br>"_"<br>),<br>"-",<br>"_"<br>)<br>)` |
| PIs | `fldw4MldOSo88Uf7C` | multipleRecordLinks | Links to PIs; inverse Projects (fldTUOlHjYowoxqOp) |
| PI Full Name | `fldOfbkD8AZvIBGRH` | multipleLookupValues | Lookup via PIs (fldw4MldOSo88Uf7C) -> Full Name (fldVUFRYfzVVYle4E) |
| PI KU ID | `fldO5x3L3C5G9cDU3` | multipleLookupValues | Lookup via PIs (fldw4MldOSo88Uf7C) -> KU ID (fldqkPjtKE3oGBrIW) |
| PI KU email | `fld7I9jwbg44n6x69` | multipleLookupValues | Lookup via PIs (fldw4MldOSo88Uf7C) -> KU email (fldg05xEVi3JHuT6u) |
| PI Section | `fldwwljExBsXFw20L` | multipleLookupValues | Lookup via PIs (fldw4MldOSo88Uf7C) -> Section (fldTzFooGLkYKuS7G) |
| PI Research Group | `fldchfvM9Coofi18I` | multipleLookupValues | Lookup via PIs (fldw4MldOSo88Uf7C) -> Research Group (fldQn2fuWA6wUh8ZG) |
| Expected Capacity in First Six Months | `fldnSb9ShYmNuUj2i` | singleSelect | Choices: Less than 1TB; Less than 100 TB; More than 100 TB |
| Backup - Apps | `fldM1FPuuLrcst5Kl` | singleSelect | Choices: Reduced backup (16 weeks); Basic backup (2 years); GDPR backup; No backup |
| Backup - Data | `fld8vOF5jiqdyo9nk` | singleSelect | Choices: Reduced backup (16 weeks); Basic backup (2 years); GDPR backup; No backup |
| Backup - People | `fld5rbm0pcGefy47I` | singleSelect | Choices: Reduced backup (16 weeks); Basic backup (2 years); GDPR backup; No backup |
| Should Data Be Audited | `fld3ksrE7rXi8K8Qq` | singleSelect | Choices: Yes; No |
| Alias | `fldltg4fOqDNWg0It` | number |  |
| Unitcode | `fld8xinUjYBrUtVb8` | number |  |
| UCPH Specification | `fldNZzaBsoXHv8H73` | number |  |
| Users | `fldh7Xahl1l0q4Ow4` | multipleRecordLinks | Links to Users; inverse Projects (fldayU532DnnH1HJg) |
| Users Full Name | `fldHYFB3zI1XP4bRq` | multipleLookupValues | Lookup via Users (fldh7Xahl1l0q4Ow4) -> Full Name (fldCFYdHenI7ydikF) |
| Users KU-ID | `fldm17AgBIfeRyEH6` | multipleLookupValues | Lookup via Users (fldh7Xahl1l0q4Ow4) -> KU-ID (fldC5Yj0OTLPfiuEn) |
| Users KU email | `fldwPIGMwkBRAgCi4` | multipleLookupValues | Lookup via Users (fldh7Xahl1l0q4Ow4) -> KU email (fldxRdNYIKDgDsJ1E) |
| Backup Summary | `fld7V8rYazxx0X9sD` | formula | Formula: `"Apps: " & {fldM1FPuuLrcst5Kl} &<br>" \| People: " & {fld5rbm0pcGefy47I} &<br>" \| Data: " & {fld8vOF5jiqdyo9nk}` |
| Filesystem Path | `fldp2NYxJWaSpBtjK` | formula | Formula: `"/projects/" & {fldDLpDRsnOV8yNGP}` |
| User Access Requests | `flddJBokao1bA5QfS` | singleLineText |  |
| PI Approval Requests | `fldT5NgfQGNPTXcJA` | multipleRecordLinks | Links to PI Approval Requests; inverse Approved Projects (fldJm5atmctNLhImf) |
| Technical Contact Name | `fldx9QWXGQ3G4I6BC` | singleLineText |  |
| Technical Contact Email | `fldheY7jXQjtYFbaG` | email |  |
| Notification Recipient Names | `fldzNxShcrofbxNY9` | formula | Formula: `IF(<br>    {fldx9QWXGQ3G4I6BC},<br>    {fldOfbkD8AZvIBGRH} & " and " & {fldx9QWXGQ3G4I6BC},<br>    {fldOfbkD8AZvIBGRH}<br>)` |
| Notification Recipients | `fldyNgyBh25Ztnh5w` | formula | Formula: `IF(<br>  {fldheY7jXQjtYFbaG},<br>  {fld7I9jwbg44n6x69} & "," & {fldheY7jXQjtYFbaG},<br>  {fld7I9jwbg44n6x69}<br>)` |
|  Project Number | `fldOPfrACWhHRBmsy` | autoNumber |  |
| Confirm | `fldiDemVwxhSQEZL0` | checkbox |  |

### PI Approval Requests

Table ID: `tblXwuPvCB6c3XPII`; primary field: Request Record ID (fldXlDN1osUasaFIW); records observed: 1.

| Field | Field ID | Type | Notes |
|---|---|---|---|
| Request Record ID | `fldXlDN1osUasaFIW` | singleLineText |  |
| User Name | `fldvtdYOqJG6vnRkt` | singleLineText |  |
| User KU-ID | `fldeqaVMzZB4fN3z8` | singleLineText |  |
| User Email | `fldvW0lD8QnrXwKOt` | email |  |
| PI Name | `fldkb8RFWp3w5Akyj` | singleLineText |  |
| PI Email | `fldQlYh0QUbt1A6Ep` | email |  |
| Processed | `fldfCunTjGq9CVgXc` | singleLineText |  |
| PI Approval Decision | `fld8LPxgtF6ZtBVUQ` | singleSelect | Choices: Approve; Reject |
| Approved Projects | `fldJm5atmctNLhImf` | multipleRecordLinks | Links to Projects; inverse PI Approval Requests (fldT5NgfQGNPTXcJA) |
| Approved Compute Queue | `fldN5xM5v7DiUjtI4` | singleLineText |  |
| Approved End Date | `fldiNrDxDdoIbHK3A` | date |  |
| PI Comments | `fldEueTpAr3eB3k1T` | multilineText |  |
| Approval Timestamp | `fldUNQmG0X0lHUnV5` | createdTime |  |


## Linked Record Model

| From table | Field | To table | Inverse field |
|---|---|---|---|
| PIs | Section | Sections | PIs (fldGkipvQlCeq4CuE) |
| PIs | Research Group | Research Groups | PI (fldPKJ6X5fVt7QH93) |
| PIs | Users | Users | PIs (fldTVYafKpLVyncCd) |
| PIs | Projects | Projects | PIs (fldw4MldOSo88Uf7C) |
| Sections | PIs | PIs | Section (fldTzFooGLkYKuS7G) |
| Sections | Research Groups | Research Groups | Section (fldrplE43XwaADVJK) |
| Users | PIs | PIs | Users (fldhb4vK2maiJ1BQI) |
| Users | Projects | Projects | Users (fldh7Xahl1l0q4Ow4) |
| Research Groups | PI | PIs | Research Group (fldQn2fuWA6wUh8ZG) |
| Research Groups | Section | Sections | Research Groups (fldfpfxciecKgpDMC) |
| Projects | PIs | PIs | Projects (fldTUOlHjYowoxqOp) |
| Projects | Users | Users | Projects (fldayU532DnnH1HJg) |
| Projects | PI Approval Requests | PI Approval Requests | Approved Projects (fldJm5atmctNLhImf) |
| PI Approval Requests | Approved Projects | Projects | PI Approval Requests (fldT5NgfQGNPTXcJA) |


Important modeling observations:

- `PIs` links to `Users`, `Projects`, `Sections`, and `Research Groups`.
- `Users` links directly to `PIs` and `Projects`.
- `Projects` links to `PIs`, `Users`, and `PI Approval Requests`.
- `PI Approval Requests` only links to `Projects` through `Approved Projects`; it does not link to `Users` or `PIs`.
- `User Access Requests` fields on PIs, Sections, Research Groups, and Projects are plain text fields, not linked request records.

## Formula Inventory

| Table | Field | Formula | References |
|---|---|---|---|
| HPC Systems | System Label (Formula) (`fld27dNldNTHBMAYd`) | `UPPER({fldiFKXq35qmz6O1V})` | System Code (fldiFKXq35qmz6O1V) |
| PIs | PI ID (`fldThFKAjCSo4zN8k`) | `"PI-" & UPPER({fldqkPjtKE3oGBrIW})` | KU ID (fldqkPjtKE3oGBrIW) |
| PIs | Validated KU-ID (`fldq1UIQM8CU7luH6`) | `IF(<br>  REGEX_MATCH({fldqkPjtKE3oGBrIW}, "^[a-z]{3}[0-9]{3}$"),<br>  "✅ Valid",<br>  "❌ Invalid"<br>)` | KU ID (fldqkPjtKE3oGBrIW) |
| PIs | Notification Recipients (`fldedqabTKySKgT2y`) | `IF(<br>  {fldJuoDPrkZFy23y8},<br>  {fldg05xEVi3JHuT6u} & "," & {fldJuoDPrkZFy23y8},<br>  {fldg05xEVi3JHuT6u}<br>)` | Technical Contact Email (fldJuoDPrkZFy23y8), KU email (fldg05xEVi3JHuT6u) |
| PIs | Notification Recipient Names (`fldjAmMz3Q5292NI3`) | `IF(<br>    {fldsijBBDgW0YD41I},<br>    {fldVUFRYfzVVYle4E} & " and " & {fldsijBBDgW0YD41I},<br>    {fldVUFRYfzVVYle4E}<br>)` | Technical Contact Name (fldsijBBDgW0YD41I), Full Name (fldVUFRYfzVVYle4E) |
| Sections | Section ID (`fldFb7jgwiqtjDy0S`) | `"SEC-" & UPPER({fldrV6pLb7yLwIuMZ})` | Short Name (fldrV6pLb7yLwIuMZ) |
| Users | Communication Email (AUTO) (`fldwK40QXb2XSgAIR`) | `IF(<br>  {fldGRwAsIB9mQAV7m} = "Secondary email",<br>  {fldxyZSjwnvdkSzCY},<br>  {fldxRdNYIKDgDsJ1E}<br>)` | Communication Email Choice (fldGRwAsIB9mQAV7m), Secondary email (fldxyZSjwnvdkSzCY), KU email (fldxRdNYIKDgDsJ1E) |
| Users | Is Active (flag) (`fld2b2DSbtA3dpUaS`) | `IF({fldN0LhCUrQbF6yJA} = "Active", 1, 0)` | Account Status (fldN0LhCUrQbF6yJA) |
| Users | Airtable Record ID (`fldh4OI05WcUUHWGK`) | `RECORD_ID()` |  |
| Users | PI Approval URL (`fldSYcRLVcvLwtc7Y`) | `"https://airtable.com/appQsnn57Oi8vNAWD/pagv9KDyDCG0tQCQ5/form?prefill_Request%20Record%20ID=" &<br>{fldh4OI05WcUUHWGK}` | Airtable Record ID (fldh4OI05WcUUHWGK) |
| Research Groups | Group ID (`fldvNAHm4xtmeeJt6`) | `"GRP-" & {fldf5IvERSXSyYb26} & "-" & UPPER({fldKyXiaGlz64rh7d})` | Section Short Name (fldf5IvERSXSyYb26), Short name (fldKyXiaGlz64rh7d) |
| Projects | Project ID (`fldec0GUIxFkQSQCb`) | `"PRJ-" & RIGHT("0000" & {fldOPfrACWhHRBmsy}, 3)` |  Project Number (fldOPfrACWhHRBmsy) |
| Projects | Project Space Slug (`fldDLpDRsnOV8yNGP`) | `LOWER(<br>SUBSTITUTE(<br>SUBSTITUTE(<br>{fld2MZm41QWvetjg8},<br>" ",<br>"_"<br>),<br>"-",<br>"_"<br>)<br>)` | Compute Project Name (fld2MZm41QWvetjg8) |
| Projects | Backup Summary (`fld7V8rYazxx0X9sD`) | `"Apps: " & {fldM1FPuuLrcst5Kl} &<br>" \| People: " & {fld5rbm0pcGefy47I} &<br>" \| Data: " & {fld8vOF5jiqdyo9nk}` | Backup - Apps (fldM1FPuuLrcst5Kl), Backup - People (fld5rbm0pcGefy47I), Backup - Data (fld8vOF5jiqdyo9nk) |
| Projects | Filesystem Path (`fldp2NYxJWaSpBtjK`) | `"/projects/" & {fldDLpDRsnOV8yNGP}` | Project Space Slug (fldDLpDRsnOV8yNGP) |
| Projects | Notification Recipient Names (`fldzNxShcrofbxNY9`) | `IF(<br>    {fldx9QWXGQ3G4I6BC},<br>    {fldOfbkD8AZvIBGRH} & " and " & {fldx9QWXGQ3G4I6BC},<br>    {fldOfbkD8AZvIBGRH}<br>)` | Technical Contact Name (fldx9QWXGQ3G4I6BC), PI Full Name (fldOfbkD8AZvIBGRH) |
| Projects | Notification Recipients (`fldyNgyBh25Ztnh5w`) | `IF(<br>  {fldheY7jXQjtYFbaG},<br>  {fld7I9jwbg44n6x69} & "," & {fldheY7jXQjtYFbaG},<br>  {fld7I9jwbg44n6x69}<br>)` | Technical Contact Email (fldheY7jXQjtYFbaG), PI KU email (fld7I9jwbg44n6x69) |


Formula issues and cautions:

- `Projects -> Project ID` description says the project number is zero-padded to four digits, but the formula uses `RIGHT("0000" & {Project Number}, 3)`, producing values such as `PRJ-018` rather than `PRJ-0018`.
- `Users -> PI Approval URL` is hard-coded to `https://airtable.com/appQsnn57Oi8vNAWD/pagv9KDyDCG0tQCQ5/form?...`. If the page ID changes, is unpublished, or is not accessible to the PI, every generated approval link breaks.
- Notification recipient formulas concatenate email addresses into comma-separated text. That can work for email actions, but it is fragile compared with a dedicated email/collaborator field or a rollup that returns a clean list.

## Workflow Trace

### PI Registration

Observed fields: `PIs -> PI Registration Status`, `Validated KU-ID`, `Researcher Affiliation Verification`, `Responsibility`, contact fields, Section and Research Group links. The intended workflow appears to be:

1. PI submits/enters Full Name, KU ID, KU email, section/research group, website, and responsibility confirmation.
2. `Validated KU-ID` checks the KU ID format.
3. `Researcher Affiliation Verification` uses AI text based on name, website, and research group.
4. `PI Registration Status` should move through Pending Verification, Approved, or Rejected.
5. Approved PIs become selectable for Projects and Users.

Concerns:

- Status choice names contain leading spaces, which can break exact-match automations or make values awkward to compare.
- Technical contact is stored on both PIs and Projects. That duplication should be intentional; otherwise notifications may diverge.

### Project Onboarding

Observed fields: `Projects -> Project Status`, `Compute Project Name`, `Project Space Slug`, PIs link, backup selections, audit flag, technical contact, notification formulas, and `Confirm`. The intended workflow appears to be:

1. Project request captures a PI, compute project name, expected capacity, backup choices, audit flag, and optional technical contact.
2. Formulas derive Project ID, slug, backup summary, filesystem path, and notification recipients.
3. Project moves between Ordered, Active, and Closed.
4. Users can be linked after approval/account creation.

Concerns:

- There is no visible `Project Requests` table. New requests appear to become Projects directly, or request state is represented only by `Project Status` and `Confirm`.
- The `User Access Requests` field on Projects is plain text, so it cannot trace request records reliably.

### User Onboarding

Observed fields: `Users -> Account Status`, PIs link, Projects link, compute queue, policy agreement, end date, communication email, PI approval fields, and `PI Approval URL`. The intended workflow appears to be:

1. User submits KU ID, name, email choice, PI, desired projects/queues, policy agreement, and end date.
2. Account status begins as Pending PI approval.
3. PI receives `PI Approval URL`.
4. PI approval should update the user to PI approved - pending creation or Rejected by PI.
5. Admin creates account, sets Account Created Date, notifies user, then user becomes Active.

Current data shows one User record, already Active. Its PI approval URL pre-fills `Request Record ID=recXocbp6ykrDw4uK`, where `recXocbp6ykrDw4uK` is the Users record ID.

### PI Approval Workflow End to End

Intended path inferred from schema:

1. A User record is created.
2. `Users -> Airtable Record ID` returns the User record ID via `RECORD_ID()`.
3. `Users -> PI Approval URL` creates an Airtable form URL and pre-fills `Request Record ID` with that User record ID.
4. The PI opens the link, chooses Approve/Reject, optionally chooses Approved Projects, queue, end date, and comments.
5. A record is created in `PI Approval Requests`.
6. An automation should find the User whose record ID equals `PI Approval Requests -> Request Record ID`, then update User status, PI Approval Date, projects/queues/end date, and rejection reason as needed.
7. A separate provisioning/notification workflow should create the account and notify the user/admin.

Observed breakpoints:

- `PI Approval Requests` has no linked User field and no linked PI field. Matching depends entirely on a plain text `Request Record ID` value.
- The only visible `PI Approval Requests` record contains `Processed = No` and created time, but does not contain Request Record ID, User Name, User KU-ID, PI Name, PI Email, decision, project, queue, or end date.
- The approval form/page referenced by the URL is not visible through MCP page discovery or Metadata API views.
- `Approval Timestamp` is a created-time field, so it records when the approval request row was created, not when a PI made a decision.

## Why Approval Links and Prefilled Forms Are Not Working

Most likely causes, ordered by confidence:

1. **The URL points to a non-visible or invalid page/form.** The formula uses `pagv9KDyDCG0tQCQ5/form`, but MCP found no interfaces and no standalone forms. The Metadata API only found grid views.
2. **The approval form is not tied to a real request table.** The URL pre-fills a field called `Request Record ID`, but there is no `User Requests` table and no linked request record. It is really carrying the Users record ID as plain text.
3. **The approval request record is orphaned.** Existing `PI Approval Requests` record `recybz7y8tSSqflAv` has only `Processed = No`. It is not linked to a user, PI, or project, and it has no decision fields populated.
4. **Prefill field naming is brittle.** The URL uses `prefill_Request%20Record%20ID`. Airtable prefill names must match the exact form field label exposed on that form. Any rename, hidden field, interface form difference, or page/form mismatch will silently fail.
5. **The formula hard-codes the page ID.** If the page was rebuilt, copied, deleted, or unpublished, the formula will continue generating stale links.

## Automations Likely Writing Literal Text or Missing Dynamic Values

The official MCP tool list does not expose Airtable automations, so I could not inspect automation steps directly. From accessible records:

- I found no stored values like `{Full Name}`, `{{Full Name}}`, or other obvious literal dynamic placeholders in visible record data.
- The visible approval request record is nearly empty, which is consistent with one of these automation/form issues:
  - Form prefill is not applying, so `Request Record ID` is blank.
  - Automation action fields were configured as static text or left unmapped instead of dynamic tokens.
  - Automation is triggered but cannot find the matching User because it searches the wrong field/table.
  - Automation expects a `User Requests` or `Project Requests` table that does not exist or is not accessible.

Automation steps to inspect manually in Airtable:

- Email-to-PI action: verify URL is inserted from the `PI Approval URL` field, not typed once as literal text.
- Approval form submitted trigger: verify it reads the submitted `Request Record ID`.
- Find User action: verify it searches `Users -> Airtable Record ID` for the submitted request ID.
- Update User action: verify status, PI Approval Date, projects, queues, end date, and rejection reason use dynamic values from the approval request record.
- Any create approval request action: verify User Name, KU ID, User Email, PI Name, and PI Email are dynamic tokens, not plain typed labels.

## Simpler Recommended Design

Replace the current plain-text request layer with one canonical request table.

### Proposed Tables

- **PIs**: PI master data only.
- **Users**: user/account master data only.
- **Projects**: approved/real project spaces only.
- **Access Requests**: one row per user onboarding/access request.
- **Project Requests**: optional, only if project creation needs a separate approval path before becoming a Project.

### Access Requests Fields

Recommended minimum fields:

- Request ID: autonumber/formula.
- User: linked record to Users.
- PI: linked record to PIs.
- Requested Projects: linked records to Projects.
- Requested Queues: multi-select.
- Requested End Date: date.
- Status: Submitted, Pending PI Approval, Approved by PI, Rejected by PI, Pending Provisioning, Provisioned, Closed.
- PI Decision: Approve/Reject.
- PI Decision Date: last modified time or explicit dateTime updated by automation.
- PI Comments.
- Approval URL/Button: formula that points to an approval form for this request.
- Processed: checkbox, not text.

### Approval Flow

1. User request form creates or updates a User, then creates one Access Request.
2. Automation emails PI with an approval URL for that Access Request.
3. PI approval form updates the Access Request directly, or submits to a small Approval Responses table linked to Access Requests.
4. Automation updates Access Request status and, only on approval, links User to approved Projects and queues.
5. Provisioning automation/admin view works from Access Requests where Status = Approved by PI.
6. Account creation updates User status and marks Access Request Provisioned.

### Design Rules

- Prefer linked records over copied text for User, PI, Project, and Request relationships.
- Use one status field per workflow object.
- Avoid hard-coded page IDs in formulas where possible; keep form URLs in one configuration table or one formula field per request table.
- Use checkboxes/selects for machine state, not free text like `Processed = No`.
- Keep copied snapshot text only when you intentionally need historical snapshots.
- Use `ENCODE_URL_COMPONENT()` for non-record-id prefill values.
- Avoid leading/trailing spaces in select option names.

## High Priority Fixes

1. Create or restore a real request table for user onboarding, or rename `PI Approval Requests` to serve as the canonical Access Requests table.
2. Add linked fields from `PI Approval Requests`/Access Requests to Users and PIs.
3. Replace `Processed` text with a checkbox or status select.
4. Replace `Approval Timestamp` created-time with an actual decision timestamp.
5. Rebuild the approval form/page and update `Users -> PI Approval URL` to point to the current valid form.
6. Validate that the form includes and accepts `Request Record ID`, or better, that it writes directly to an Access Request record.
7. Audit automations manually for dynamic token mappings.
8. Fix `Projects -> Project ID` padding mismatch.
9. Remove leading spaces from `PI Registration Status` options.

## Evidence Files

Local read-only extracts used during this audit were stored in `/private/tmp` during analysis:

- `biohpc_tables.json`
- `biohpc_schema.json`
- `biohpc_records_*.json`
- `biohpc_pages.json`
- `biohpc_meta_tables.json`

They were not written back to Airtable.
