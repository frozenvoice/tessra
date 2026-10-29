# Manual E2E Checklist

Use this checklist in the VS Code Extension Development Host after `npm run build` or `npm run watch`.

Automated UI coverage for core click paths lives in `npm run test:e2e` (see `docs/testing.md`). Keep this file for visual / OS / Marketplace QA that automation does not replace.

## Automated (UI E2E)

Covered by `e2e/specs/*` against a real VS Code Electron host + localhost fixture server:

- Basic Send (`/users` JSON response)
- URL / Params canonical serialization (single `_limit`, duplicate `tag` keys)
- Environment disclosure (status strip → variable editor)
- Variable Usage from the request-variable segment
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
- HTML Preview local bundle/nonce CSP and hostile HTML sanitization (`e2e/specs/24-html-preview.spec.ts`)
- History consecutive completions, pin/unpin, pinned filter, and clear preserving pinned entries (`e2e/specs/25-history-sync.spec.ts`)
- Response EUC-KR/Shift_JIS/gzip/BOM decoding, invalid/unsupported warnings, and tab/pin preservation (`e2e/specs/26-response-charset.spec.ts`)
- Total network deadline while body chunks arrive or retry waits, plus Stop/late-response cleanup (`e2e/specs/27-network-deadline.spec.ts`)
- Clear context labels/column headings, JSON fold keyboard controls/copy bytes, and EN/KO/JA narrow layouts (`e2e/specs/28-ui-clarity.spec.ts`)
- Critical UI regression gate (`npm run test:e2e:ui-regressions` → #18/#19/#20)

Unusual OS / display-scaling context-menu behavior can still be spot-checked manually; the stable suite covers the keyboard context-menu path (see `docs/testing.md`).

## Manual remaining

- Visual quality, theme skins, long-text clipping
- Marketplace screenshots
- Unusual OS / display scaling behavior
- Deep Guide locale reading pass
- WebSocket edge cases / Backup / full application restart restore
- Dirty-close dialog and request-tab context menu keyboard behavior across OS/display settings
- Script trust prompts and error wording; see `docs/script-security.md` for execution limits

## Secret variables smoke

Use synthetic values in an isolated profile and a local fixture only. Final integrated automated coverage is recorded in [the dated validation record](ui-secrets-sse-validation-2026-10-05.md).

- Protect a plain environment variable. Confirm metadata/masked state, native Set value input, and explicit Reveal/Hide; rename the variable/environment and confirm the same secret identity remains usable.
- Switch profiles or close the panel while Reveal/Set is active. Confirm revealed text is cleared, native input closes, and delayed results cannot appear in the next profile.
- Simulate unavailable SecretStorage in the unit fixture: pending protection retains the original for Retry/Cancel, appears masked, and blocks execution; missing imported values also block requests that need them.
- Inspect current JSON after confirmed protection and new workspace/Postman exports: secret values must be absent. Import/restore must ask for values rather than treating a mask string as the value. Check earlier copies separately; this feature does not delete them.
- Delete one exact secret variable with a duplicate name. Confirm other IDs remain; restoring that deleted reference is missing. Check Workspace variables stay outside active-environment request substitution.
- Send to a local echo endpoint. Verify actual wire bytes contain the synthetic value, while app-generated request metadata/code/history/logs are masked or preserve references. A server echo remains visible as response data.
- Run EN/KO/JA with keyboard-only controls and a narrow panel. Check labels, focus, reveal lifecycle, and manual screen-reader speech output.

## SSE smoke

Use the local fixture server in an isolated VS Code host; do not use paid streams or real tokens. Final automated results remain in [the dated validation record](ui-secrets-sse-validation-2026-10-05.md).

- Receive a slow event stream and confirm events appear before EOF. Switch Events/Raw with keyboard controls; Raw copy/save is available at terminal state and represents the bounded retained prefix.
- Check split UTF-8/BOM, CR/LF/CRLF, multiline data, event/id/retry, comments, and unfinished EOF. Confirm HTML-looking/vendor JSON event data stays text and `retry` causes no automatic reconnect.
- Exercise one oversized event/line, pending buffer limits, event retention, and Raw truncation. Confirm explicit loss notices and subsequent complete events; no invented completion of a partial block.
- Stop, expire the existing deadline, switch profiles, close the panel, and use Runner Stop. Confirm partial Aborted/Timeout/Error states and closed fixture sockets; late events must not enter a new run.
- Set timeout=0 explicitly for a long stream, then Stop. Check finite deadlines and response-size limits remain active when enabled.
- With retry enabled, serve a stream that starts with HTTP 500 or POST and then fails. Confirm a single request and no automatic resend after stream start.
- Repeat ordinary HTTP charset/binary, History cache, TLS and redirect credential regressions. Proxy behavior is only checked when reproducible with a local fixture and isolated host.

## 1.2.8 Smoke (~8 min)

Cross-origin API Key redirects and WebSocket handshake limits. Run this pass on the packaged VSIX before Marketplace publish, with local fixtures and synthetic keys only.

- Install the 1.2.8 VSIX and send a normal GET; confirm status, headers, and body render as before.
- Set Auth → API Key (header) with a custom name such as `X-Team-Key` and enable Settings → Follow redirects. Redirect to the same origin and confirm the echo endpoint receives the header; redirect from `localhost` to `127.0.0.1` (or another port) and confirm it does not. In a chain that returns to the original origin, confirm the header is not sent again.
- Repeat the cross-origin case from Collection Runner and confirm the same result.
- Connect to a local WebSocket echo server, send a text message, and disconnect; confirm the log shows send, receive, and close as before.
- Against a local server that never finishes its upgrade response, connect with timeout `0` and confirm the handshake fails after about 30 seconds; with timeout `3`, confirm it fails after about 3 seconds. Set a WebSocket header value to a `{{variable}}` whose value contains a line break, and confirm the connection fails before reaching the server.
- Receive a slow SSE stream, press Stop, and confirm the state shows Stopped with the partial response retained and the fixture socket closed.
- Inspect the VSIX contents (`npx vsce ls`) and confirm no `.kilo`, `demo`, or test output is included.

## 1.2.7 Smoke (~3 min)

README demo media only. Run this pass on the packaged VSIX before Marketplace publish.

- Install the 1.2.7 VSIX and send a normal GET; confirm status, headers, and body render as before.
- Open the extension page in VS Code's Extensions view; confirm the animated demo loops without a click and shows the 20-second cut, including the server-sent events scene.
- Select the demo or "Watch the full demo with sound" and confirm the full video with sound opens.
- Inspect the VSIX contents (`npx vsce ls`) and confirm no `.kilo`, `demo`, or test output is included.

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
- Spot-check Quiet Instrument primary path (Method → URL → Send), status strip environment/request-variable segments, one Body Convert/Keep/Cancel path, and Workspace Backup export validation (`schemaVersion` 1).

## 1.0.10 Smoke (~10–15 min)

Quiet Instrument layout and Body workflows. Keep as a deeper regression pass when touching request-panel chrome.

- Confirm Method → URL → Send reads as the primary path; infrequent actions sit in overflow; no pill-wall meta chrome.
- Confirm the status strip shows the environment variable count, applied default headers, referenced request variables, scripts/history-saving cues, and risk overrides; Env shows Tessra accent + tiny tesseract mark; click Environment to toggle the variable editor; click the request-variable segment to toggle Variable Usage in strip disclosure; expand disclosure for workspace profile / details.
- Toggle environment (or none); confirm strip updates and `{{variable}}` resolution still works.
- Toggle script availability and Save to history; confirm strip cues update.
- Confirm the applied default-header count and skipped-header state appear correctly; enable TLS insecure and confirm a warning segment.
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
- Confirm the request panel status strip shows the active environment and its defined variable count, separate from the unique variable names referenced by the request; the variable editor opens from the Environment segment (keyboard Enter/Space), strip expand, or Environments view (not a permanent collapsed card above the compose path).
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
- Complete requests consecutively and confirm persisted entries and sidebar counts agree; clear history while preserving pinned entries, then unpin and clear the remainder (automated: `25-history-sync.spec.ts`, pinned filter and clear path).
- Confirm History groups entries under Pinned, Today, Yesterday, This Week, and Older; empty groups stay hidden, group rows do not reopen requests, and leaf rows still reopen requests.
- Open History Settings from the History view title bar and confirm VS Code Settings searches for `tessra.historyMaxItems`.
- Set `tessra.historyMaxItems` low enough to confirm non-pinned pruning while pinned entries are preserved.
- Switch `tessra.workspaceProfile`, create a custom profile, and confirm collections, history, environments, default headers, and saved tabs are isolated.
- Corrupt one storage JSON file in a disposable profile and confirm Tessra creates a `.corrupt-*` backup, warns, and falls back to defaults.
- In a disposable profile, replace, delete, restore, and corrupt `history.json`, then refresh/read History. Confirm stale entries disappear, recovered content reloads, and corrupt originals remain write-protected (automated at storage/provider level).

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

- Run `npm run ci` once after changes converge (typecheck, unit tests, build).
- Run the relevant actual VS Code E2E suite against that build; follow `docs/testing.md`.
- Run `git diff --check`.
- Review `README.md`, `README.ko.md`, `AGENTS.md`, and `CLAUDE.md` whenever a user-visible behavior or setting changed.
