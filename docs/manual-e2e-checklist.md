# Manual E2E Checklist

Use this checklist in the VS Code Extension Development Host after `npm run build` or `npm run watch`.

## Setup

- Launch the Extension Development Host with `F5`.
- Confirm Tessra opens without login, telemetry, update checks, or other background network calls.
- Use a local fixture API or an explicitly chosen test endpoint for HTTP and WebSocket requests.
- Keep at least one light theme and one dark theme pass for request-panel layout checks.

## Request Panel

- Create, switch, close, pin, duplicate, and reorder enough request tabs to force horizontal tab overflow.
- Confirm keyboard flows: `Ctrl+T`, `Ctrl+W`, `Ctrl+Enter`, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+F`, `Alt+1..6`, and `Alt+Shift+1..5`.
- Confirm the add-tab control, request tabs, close buttons, response action menu, and key row remove buttons are keyboard reachable and visibly focused.
- Confirm request editor tabs stay tab-based: re-click the active Params / Headers / Body / Auth / Scripts / Settings tab to collapse its body, re-click to expand it, switch to another tab to show only that tab's body, and verify a manually dragged request/response divider position is restored after collapse/expand.
- Send HTTP requests with `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.
- Cancel a slow request and confirm the active tab and history state remain consistent.
- Verify request settings: timeout, redirects, TLS validation override, max response size, retry count, retry delay, stop after headers, save to history, skip default headers, and disable scripts.
- Verify body types: JSON, XML, form-urlencoded, form-data text fields, form-data files, binary file, and raw text.
- Verify auth modes: none, Basic, Bearer, API Key header, and API Key query.

## Variables And Scripts

- Create, edit, switch, and delete environments.
- Confirm the request panel environment editor renders collapsed by default, shows the active environment name plus variable count, expands/collapses from the header, and shows `Environment: None` when no environment is active.
- Confirm requests still resolve environment variables while the editor is collapsed, and after editing variables while expanded.
- Resolve `{{variable}}` values across URL, params, headers, body, auth, and scripts.
- Confirm unresolved variables are surfaced before send.
- Confirm variable preview and autocomplete work from text inputs and textareas.
- Run pre-request and test scripts using `pm`, `env`, `test`, `expect`, and `assert`.
- Import a request with scripts and confirm scripts stay disabled until explicitly trusted.
- Toggle per-request script disabling and confirm scripts are skipped.

## Collections, History, And Storage

- Create collections, folders, and requests from the sidebar and request panel.
- Save new requests, update existing requests, and Save As from an existing request.
- Run a collection, stop a run, and rerun failed requests only.
- Confirm runner results save to history only when each request has Save to history enabled.
- Pin, unpin, delete, and filter history using `status:`, `method:`, `host:`, and `pinned:` tokens.
- Set `tessra.historyMaxItems` low enough to confirm pruning.
- Switch `tessra.workspaceProfile`, create a custom profile, and confirm collections, history, environments, default headers, and saved tabs are isolated.
- Corrupt one storage JSON file in a disposable profile and confirm Tessra creates a `.corrupt-*` backup, warns, and falls back to defaults.
- In a disposable user-data directory, confirm first-run Arc Client storage migration copies data only when Tessra storage is empty.

## Response Experience

- Verify response body modes: Raw, Pretty, JSON tree, XML path view, Cookies, Headers, Tests, and HTML Preview.
- Confirm HTML preview blocks external scripts, styles, images, iframes, embeds, media, refresh meta tags, and base tags.
- Confirm response find supports plain text, case-sensitive search, regex search, previous/next, clear, and persisted state.
- Copy response body, URL, status, headers, JSONPath, XPath, and cURL.
- Save a response body to disk.
- Pin two responses and compare them in Raw, Normalized, and Pretty modes with ignore headers, ignore JSON paths, metadata summary, and fold unchanged sections.
- Confirm response timing metadata shows requested, received or ended, duration, and readable local timestamps.

## Import, Export, And Codegen

- Import OpenAPI JSON and confirm collections plus base URL environment values.
- Import and export Postman collections.
- From the Environments title bar, run `Import Environment` for a valid Postman Environment JSON and confirm variables, disabled values, empty `values: []`, duplicate-name suffixing, activation, and editing.
- Try invalid JSON, a Postman Environment without `name`, and one without `values`; confirm each shows an error and does not overwrite existing environments.
- Export Postman environments.
- Import cURL and copy requests as cURL.
- Generate code for `fetch`, `axios`, and `Java HttpURLConnection`.

## WebSocket

- Connect to `ws://` and `wss://` endpoints.
- Send text messages from the Body tab composer.
- Confirm inbound and outbound messages are logged in order.
- Confirm binary frames render as base64 with byte counts.
- Disconnect manually and close an active WebSocket tab.

## Localization And Themes

- Switch `tessra.displayLanguage` between `en`, `ko`, and `ja`; confirm panel labels, prompts, notifications, and the in-app guide update without losing request state.
- Switch `tessra.requestPanelTheme` across `default`, `minimal-cool`, `product`, and `bold-color`.
- Confirm dense layouts remain usable at narrow panel widths and short panel heights.

## Final Checks

- Run `npm test`.
- Run `npm run build`.
- Review `README.md`, `README.ko.md`, `AGENTS.md`, and `CLAUDE.md` whenever a user-visible behavior or setting changed.
