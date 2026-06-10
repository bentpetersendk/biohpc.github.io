# Deployment Notes

The v2 website is designed to be deployed as static files from the `website-v2/` directory of the GitHub Pages repository.

## Current Production Site

Do not change the repository root `index.html` as part of v2 development. It currently hosts the production landing behavior.

## Preview Deployment

After committing and pushing this directory, the v2 site should be available at:

```text
https://biohpc.dk/website-v2/
```

## Pre-launch Checklist

- Replace placeholder Airtable URLs in `config.js`.
- Replace placeholder documentation and support URLs in `config.js`.
- Confirm contact details in `config.js`.
- Confirm pricing and resource usage wording in `config.js`.
- Test desktop and mobile layouts.
- Test all request buttons and documentation/support links.
