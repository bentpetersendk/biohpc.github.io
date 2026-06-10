# BioHPC Website v2

This directory contains the new BioHPC website prototype. It is intentionally isolated from the current production homepage.

Production root:

- `../index.html` remains the existing homepage and should not be modified for this v2 work.

Preview URL after deployment:

- `https://biohpc.dk/website-v2/`

## Site Structure

- `index.html` - overview and primary onboarding entry points
- `getting-access.html` - current Airtable-based onboarding workflow
- `project-spaces.html` - PI to Project Space to Users model
- `documentation.html` - documentation and support entry points
- `pricing.html` - resource usage and cost recovery copy
- `contact.html` - support and request links
- `config.js` - centralized URLs, contact details, and editable pricing text
- `styles.css` - shared responsive styling
- `script.js` - shared config binding and navigation behavior
- `assets/` - local visual assets used by the v2 site

## Editing Content

Most page copy is plain HTML in the page files. Shared values that are likely to change are kept in `config.js`.

Use the same header and footer structure when adding future pages so the site remains consistent.

## Updating Airtable Links

Edit `website-v2/config.js`:

```js
urls: {
  piRegistrationForm: "...",
  projectSpaceRequestForm: "...",
  userRequestForm: "...",
  documentation: "...",
  support: "..."
}
```

Buttons and links with `data-href` automatically read from this configuration.

## Updating Contact Information

Edit the `contact` block in `website-v2/config.js`:

```js
contact: {
  email: "support@biohpc.dk",
  phone: "",
  organization: "BioHPC, University of Copenhagen"
}
```

## Pricing and Resource Usage

The pricing page reads its editable policy text from the `pricing` block in `config.js`. Replace the placeholder wording there when current CPU, memory, allocation, and cost-recovery language is finalized.

## Deployment Notes

This is a plain static site. No build step or dependency installation is required.

Commit the `website-v2/` directory to the GitHub Pages repository. The existing root `index.html` should remain unchanged so the current production website continues working.

## Promoting v2 Later

When BioHPC is ready to replace the production homepage:

1. Review and finalize all Airtable, documentation, support, contact, and pricing values in `website-v2/config.js`.
2. Test every page under `https://biohpc.dk/website-v2/`.
3. Copy or move the v2 files to the repository root in a separate release change.
4. Update relative asset and page links if needed.
5. Keep a backup of the current production `index.html` until the replacement is verified.
