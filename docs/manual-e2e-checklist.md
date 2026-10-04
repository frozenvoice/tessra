# Manual E2E Checklist

Use this checklist in the VS Code Extension Development Host after `npm run build` or `npm run watch`.

Automated UI coverage for core click paths lives in `npm run test:e2e` (see `docs/testing.md`). Keep this file for visual / OS / Marketplace QA that automation does not replace.

## Automated (UI E2E)

Covered by `e2e/specs/*` against a real VS Code Electron host + localhost fixture server:

- Basic Send (`/users` JSON response)
- URL / Params canonical serialization (single `_limit`, duplicate `tag` keys)
- Environment disclosure (status strip → variable editor)
- Variable Usage `Used N` disclosure
- Body JSON→XML Convert + undo
- Response Pin / Compare primary discoverability (+ overflow utilities smoke)
- Send Stop / cancellation (slow endpoint)
- Script utilities (HMAC in pre-request + SHA/Base64 assertions in Tests)
- Collection Runner selection / reset (`e2e/specs/runner/07-runner-selection.spec.ts`)
- Collection Runner Clear / Select all / zero selection (`e2e/specs/runner/08-runner-select-clear.spec.ts`)
- Path Variables request-local override (`e2e/specs/17-path-variables.spec.ts`)
- Request More narrow-viewport geometry (`e2e/specs/18-request-more-narrow.spec.ts`)
- Path Variable occurrence resolution UI (`e2e/specs/19-path-variable-resolution-ui.spec.ts`)
- Body text single-scroll-owner (`e2e/specs/20-body-scroll-ownership.spec.ts`)
- Response tab keyboard navigation and immediate editor-close draft preservation (`e2e/specs/21-accessibility-and-draft.spec.ts`, #21/#22)
- Environment/profile switch during a held HTTP response, with storage isolation (`e2e/specs/23-execution-context.spec.ts`)
- Critical UI regression gate (`npm run test:e2e:ui-regressions` → #18/#19/#20)

Unusual OS / display-scaling context-menu behavior can still be spot-checked manually; the stable suite covers the keyboard context-menu path (see `docs/testing.md`).

## Manual remaining

- Visual quality, theme skins, long-text clipping
- Marketplace screenshots
- Unusual OS / display scaling behavior
- Deep Guide locale reading pass
- WebSocket edge cases / Backup / History pin / full application restart restore
- Dirty-close dialog and request-tab context menu keyboard behavior across OS/display settings
- Script trust prompts and error wording; see `docs/script-security.md` for execution limits

## 1.2.6 Smoke (~5 min)

Headers-only stream cleanup. Run this pass on the packaged VSIX before Marketplace publish.

- Install the 1.2.6 VSIX and send a normal GET; confirm status, headers, and body render as before.
- Enable Settings → Stop after headers against an endpoint that streams a long or endless body. Confirm the response shows status and headers with an empty body, and the request does not stay in a sending state.
- Repeat the headers-only send several times; confirm each completes promptly.
- Confirm a failing `pm.expect(1).to.equal(2)` still shows actual and expected values.
- Edit a request, close the editor immediately, and reopen it; confirm the latest draft is kept.
- Inspect the VSIX contents (`npx vsce ls`) and confirm no `.kilo`, `demo`, or test output is included.

## 1.2.4 Smoke (~5 min)

Script assertion messages and the README video. Run this pass before Marketplace publish.

- In a test script, add failing `pm.expect(1).to.equal(2)`, `pm.expect({ a: 1 }).to.eql({ a: 2 })`, and `pm.expect(null).to.be.ok`. Send and confirm the Tests tab shows the actual and expected values on one line each.
- Add a passing `pm.expect(pm.response.json()).to.have.property(...)` and confirm it still passes.
- Open the extension page in VS Code's Extensions view; confirm the README video starts muted and loops, and the controls can unmute it.

## 1.2.3 Smoke (~10 min)

Execution isolation, storage protection, and the README demo video. Run this pass before Marketplace publish.

- Send a slow request, switch the active environment mid-flight, and confirm the response and script changes land in the starting environment.
- Start a Collection Runner run and change `tessra.workspaceProfile`; confirm the run stops and no late results appear.
- Press Stop while a large Body is being prepared; confirm nothing is sent.
- Edit a request and close the editor immediately; reopen and confirm the draft is intact.
- Corrupt a copy of `collections.json` (valid JSON, wrong shape) in a scratch profile; confirm the warning, the `.corrupt-*` backup, and that the file is not overwritten.
- Open the extension page in VS Code's Extensions view and confirm the README video plays, with the poster shown before playback.

## 1.2.2 Smoke (~10 min)

Path Variable occurrence UI and Body single-scroll-owner. Run this pass before Marketplace publish.

- Environment has `baseUrl` but not `dsgIdn`. URL: `{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do`. Set Path Variables `dsgIdn` to `1111`.
- Confirm the path `{{dsgIdn}}` has no red underline and the variable popover shows Request / `1111`, not missing-from-environment.
- Send and confirm the path is `/mz-chat/1111/...`.
- Append `?echo={{dsgIdn}}`. Confirm the path occurrence stays resolved and the query occurrence stays unresolved.
- Open Body JSON with a long payload on a short window. Confirm one vertical scrollbar on the textarea, wheel moves the body text, and the highlight overlay stays in sync.
- Resize the Request/Response split and switch JSON → Raw → JSON; confirm the single-scroll contract still holds. Form Data should not keep text-mode overflow.

## 1.0.14 Smoke (~10 min)

Script utilities for signing / encoding. Use dummy secrets only.

- Pre-request: `pm.crypto.sha256` and `pm.crypto.hmacSha256` → `pm.environment.set`.
- Send a localhost (or fixture) request; confirm environment values updated.
- Test script: assert SHA known vector + Base64 roundtrip; confirm Tests tab passes.
- Generate `pm.uuid()` and `pm.time.unix()` / `unixMs`; confirm formats.
- Invalid Base64 decode surfaces as a failed test / script error (not silent empty string).
- Confirm `disableScripts` and imported untrusted script policies still block execution.
- Spot-check Collection Runner still runs scripts through the shared ScriptRunner path.

## 1.0.13 Smoke (~10 min)

`.env` → Tessra Environment import. Use dummy secrets only.

- Create a temporary `.env` (or `.env.local` / `production.env`) with a few `KEY=value` lines and one intentional malformed line.
- Run `Tessra: Import Environment`, choose the file (use All Files if the OS filter hides extensionless `.env`).
- Confirm the variable count / skipped-line warning, then Import.
- Confirm Environments tree shows a new entry named after the basename; Edit Variables shows the expected keys/values (all enabled).
- Confirm the previously active environment stays active (no auto Set Active).
- Import the same file again and confirm a unique name such as `.env (2)`.
- Re-import a Postman Environment JSON once and confirm that path still works.

## 1.0.12 Smoke (~10 min)

Collection Runner per-run request selection. Run this pass before Marketplace publish.

- [Automated] Runner selection / Clear / Select all via `npm run test:e2e` (or focused `npm run test:e2e:runner`).
- Spot-check Stop, Rerun Failed (failed selected only), and history only for executed selected requests.
- Nested folders + WebSocket row labeling still worth a quick manual glance.

## 1.0.11 Smoke (~10–15 min)

Guide currency, URL/Params serialization, and Pin/Compare discoverability.

- Open `Tessra: Open Guide` in English, Korean, and Japanese; confirm status strip / Pin+Compare+`⋯` / Body conversion / Workspace Backup / WebSocket wording matches the live panel (no topline chip-wall language).
- With a URL that already has `?a=1` and a Params row `a=1`, Send once and confirm the final request URL does not duplicate `a`.
- Confirm Response sticky summary still shows Pin / Compare; Copy / Save / Mode / metadata remain under `⋯`.
- Spot-check Quiet Instrument primary path (Method → URL → Send), status strip Env/`Used N`, one Body Convert/Keep/Cancel path, and Workspace Backup export validation (`schemaVersion` 1).

## 1.0.10 Smoke (~10–15 min)

Quiet Instrument layout and Body workflows. Keep as a deeper regression pass when touching request-panel chrome.

- Confirm Method → URL → Send reads as the primary path; infrequent actions sit in overflow; no pill-wall meta chrome.
- Confirm the status strip shows environment (`N vars`), Defaults, request `Used N`, Scripts/History cues, and risk overrides; Env shows Tessra accent + tiny tesseract mark; click Environment to toggle the variable editor; click `Used N` / Vars to toggle Variable Usage in strip disclosure; expand disclosure for workspace profile / details.
- Toggle environment (or none); confirm strip updates and `{{variable}}` resolution still works.
- Toggle Scripts present/off and History on/off; confirm strip cues update.
- Confirm Defaults count / Defaults skipped appear correctly; enable TLS insecure and confirm a warning segment.
- Send a request and Stop an in-flight request; confirm response sticky summary owns success/error emphasis (Send stays host action color).
- Confirm JSON Body mirror overlay highlights while typing; switch to XML and confirm overlay language switches; switch to raw and confirm overlay is off.
- With non-empty JSON, change type to XML → Convert; confirm result. Undo restores previous type + content together.
- Cancel and Keep text paths: Cancel keeps prior type; Keep text changes type without structural rewrite.
- Force an invalid convert (e.g. nested JSON → form-urlencoded); confirm failure toast and original body preserved.
- Narrow the panel; confirm status-strip priority collapse and primary path remain usable.
- Spot-check light and dark host themes; confirm focus-visible rings on strip links/primary controls.
- With OS reduced-motion (or equivalent), confirm celebration/loading animations are muted.
- Smoke Collection Runner start/stop, WebSocket connect/send/disconnect, and workspace Backup export validation (schemaVersion 1).

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
- Confirm changing Body type with non-empty content shows Convert / Keep text / Cancel (no auto-convert); empty body changes type immediately; Convert failure keeps the original body; Ctrl+Z after Convert restores previous type and content together.
- Confirm JSON Body shows syntax highlighting in the mirror overlay while the real textarea remains editable; switch to XML and confirm the overlay refreshes to XML highlighting; switch to raw and confirm the overlay is off; WebSocket Body composer stays plain.
- Edit a JSON Body, send the request, return to Body, confirm `Ctrl+Z` restores the previous edit, and confirm `Ctrl+Y` or `Ctrl+Shift+Z` reapplies it.
- Switch from Body to another request editor tab and back, then confirm Body undo/redo still works for the same request.
- Verify auth modes: none, Basic, Bearer, API Key header, and API Key query.

## Variables And Scripts

- Create, edit, switch, and delete environments.
- Confirm the request panel status strip shows the active environment and its defined variable count (`N vars`), separate from request `Used N`; the variable editor opens from the Environment segment (keyboard Enter/Space), strip expand, or Environments view (not a permanent collapsed card above the compose path).
- Confirm requests still resolve environment variables while the editor is closed, and after editing variables while open.
- Resolve `{{variable}}` values across URL, params, headers, body, auth, and scripts.
- Confirm Path Variables appear under the URL bar for full path-segment placeholders (e.g. `{{baseUrl}}/users/{{userId}}` shows `userId` only).
- Confirm Environment fallback, Override / Reset, and that Environment storage is not mutated by Path Variable edits.
- Confirm nested variables such as `host -> baseUrl -> apiUrl` resolve recursively.
- Confirm circular references and unresolved nested variables are reported before send.
- Confirm unresolved variables are surfaced before send.
- Confirm variable preview and autocomplete work from text inputs and textareas.
- Run pre-request and test scripts using `pm`, `env`, `test`, `expect`, and `assert`.
- Set `tessra.scriptTimeoutMs`, then confirm long-running pre-request and test scripts time out clearly in single-request and collection-runner flows.
- Import a request with scripts and confirm scripts stay disabled until explicitly trusted.
- Toggle per-request script disabling and confirm scripts are skipped.

## Collections, History, And Storage

- Create collections, folders, and requests from the sidebar and request panel.
- Save new requests, update existing requests, and Save As from an existing request.
- Run a collection with default continue-on-failure behavior, then run with stop-on-failure enabled.
- Confirm Collection Runner options for delay between requests and multiple iterations, including summary counts for total runs, passed, failed, skipped, stopped, and duration.
- Stop a collection run during an active request and during an inter-request delay.
- Rerun failed requests only.
- Confirm runner results save to history only when each request has Save to history enabled.
- Pin, unpin, delete, and filter history using `status:`, `method:`, `host:`, and `pinned:` tokens.
- Confirm History groups entries under Pinned, Today, Yesterday, This Week, and Older; empty groups stay hidden, group rows do not reopen requests, and leaf rows still reopen requests.
- Open History Settings from the History view title bar and confirm VS Code Settings searches for `tessra.historyMaxItems`.
- Set `tessra.historyMaxItems` low enough to confirm non-pinned pruning while pinned entries are preserved.
- Switch `tessra.workspaceProfile`, create a custom profile, and confirm collections, history, environments, default headers, and saved tabs are isolated.
- Corrupt one storage JSON file in a disposable profile and confirm Tessra creates a `.corrupt-*` backup, warns, and falls back to defaults.

## Response Experience

- Verify response body modes: Raw, Pretty, JSON tree, XML path view, Cookies, Headers, Tests, and HTML Preview.
- Confirm HTML preview blocks external scripts, styles, images, iframes, embeds, media, refresh meta tags, base tags, consecutive event attributes, SVG external links and animated URL changes, and HTML background/ping URLs, while preserving static content, embedded images, and fragment links (automated: `24-html-preview.spec.ts`).
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
- Confirm cURL import handles compact flags such as `-XPOST`, bundled no-effect flags such as `-skL`, hyphen-prefixed data such as `-d '-1'`, and malformed header warnings without losing the request.
- Import OpenAPI paths such as `/users/{userId}` and confirm they become `/users/{{userId}}`.
- Generate code for `fetch`, `axios`, and `Java HttpURLConnection`.

## Workspace Backup / Restore

- Create at least one collection.
- Create at least one environment.
- Set an active environment.
- Save at least one workspace default header.
- Run `Tessra: Export Workspace Backup`.
- Confirm the backup JSON includes `collections`, `environments`, `activeEnvironmentId`, `defaultHeaders`, and workspace `variables`.
- Change some existing workspace data.
- Run `Tessra: Import Workspace Backup`.
- Confirm the replace warning appears before import.
- Confirm collections, environments, active environment, and default headers are restored after import.
- Confirm a pre-import backup is created under `globalStorage/backups`.
- Confirm request history and open tabs / tab state are not restored by Workspace Backup / Restore v1.
- Confirm backup files are treated as secret-bearing artifacts before sharing or attaching them anywhere.
- Try importing a backup with an invalid `app` or unsupported `schemaVersion` and confirm Tessra shows an error without replacing existing data.

## WebSocket

- Connect to `ws://` and `wss://` endpoints. Prefer `wss://ws.ifelse.io` for public echo smoke tests.
- Confirm `{{variable}}` URLs that resolve to `ws://` or `wss://` switch to WebSocket mode, and URLs that resolve to `http://` or `https://` stay in HTTP mode.
- Send text messages from the Body tab composer.
- Confirm inbound and outbound messages are logged in order.
- Confirm manual disconnect logs `Disconnected by user`; remote or idle closes log code, reason, and `wasClean`.
- Keep WebSocket keepalive off by default, then enable it with a short interval and confirm periodic app-level ping messages appear while connected.
- Disconnect, close the tab, and reconnect with keepalive enabled to confirm only one interval is active and `Keepalive stopped` is logged during cleanup.
- Confirm binary frames render as base64 with byte counts.
- Confirm large incoming frames/messages are rejected at the configured WebSocket size limits.
- Disconnect manually and close an active WebSocket tab.

## Localization And Themes

- Switch `tessra.displayLanguage` between `en`, `ko`, and `ja`; confirm panel labels, prompts, notifications, and the in-app guide update without losing request state.
- Switch `tessra.requestPanelTheme` across `default`, `minimal-cool`, `product`, and `bold-color`; confirm layout/spacing/status-strip structure stay identical and only accent/method/surface/border tokens change.
- Confirm dense layouts remain usable at narrow panel widths and short panel heights.

## Final Checks

- Run `npm test`.
- Run `npm run typecheck`.
- Run `npm run ci`.
- Run `npm run build`.
- Run `git diff --check`.
- Review `README.md`, `README.ko.md`, `AGENTS.md`, and `CLAUDE.md` whenever a user-visible behavior or setting changed.
