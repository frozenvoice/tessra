# Marketplace Copy

This file collects launch-ready copy for the VS Code Marketplace listing, screenshots, and release assets.

## Positioning

### Primary line
The local-first REST API client for VS Code.

### Supporting line
No login. No cloud sync. No paywalled core workflows.

### Alternative short lines
- Build and send API requests in VS Code without accounts or cloud lock-in.
- A Thunder Client-style workflow for teams that want local-first control.
- Organize, script, and replay API requests without leaving VS Code.

## Marketplace Short Description

Offline-first REST API client for VS Code. No login required, no cloud dependency.

## README Hero Copy

Use this near the top of the Marketplace README:

> Tessra is built for developers who want a fast Thunder Client-style workflow inside VS Code without accounts, sync requirements, or pricing gates around everyday features. Data stays on the machine, and network traffic only happens when the user explicitly sends an API request.

## Screenshot Plan

Store final files in [images/marketplace](/E:/Dev/GitHub/tessra/images/marketplace).

### Screenshot 1
Title: Multi-tab request workflow
Show: method selector, URL bar, tabs, headers/body/auth, response viewer in one frame
Caption: Build and send requests without leaving VS Code.

### Screenshot 2
Title: Collections, environments, and history
Show: sidebar with Collections, Environments, History all populated
Caption: Organize requests, switch environments, and replay history locally.

### Screenshot 3
Title: Scripts and test results
Show: pre-request/test scripts tab plus response tests panel
Caption: Automate tokens, assertions, and post-response checks inside the editor.

### Screenshot 4
Title: Import from the tools developers already use
Show: cURL import flow or Postman import/export flow
Caption: Bring over existing requests from cURL and Postman quickly.

### Screenshot 5
Title: Generate client code from a request
Show: code generation output for `fetch`, `axios`, or Java
Caption: Turn a working request into reusable code in seconds.

## Screenshot Style Notes

- Use realistic API examples, not empty states
- Keep one strong focal point per screenshot
- Prefer light theme screenshots first unless the UI looks stronger in dark theme
- Avoid tiny text by cropping tightly around the important UI
- Keep captions outcome-focused, not feature-list-focused

## Launch Checklist

- English `README.md` is the Marketplace default
- Korean `README.ko.md` is linked near the top
- `package.json` description is concise and clear
- `package.nls.json` and `package.nls.ko.json` cover UI strings
- Use the prepared `images/icon.png` extension icon
- Keep the README screenshots polished and up to date
