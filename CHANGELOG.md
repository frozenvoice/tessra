# Changelog

## 1.2.8

### Fixed

- Custom header-based API Key credentials are removed on cross-origin HTTP redirects in both request tabs and Collection Runner. Same-origin redirects retain them, and a later return to the original origin does not reattach them.
- WebSocket handshakes limit upgrade response headers to 16 KiB and apply one total handshake deadline (the request timeout, or 30 seconds when the timeout is `0`), so a server that never finishes or keeps dripping its upgrade response cannot hold the connection open. Final request header names and values are validated before a socket is opened; invalid names and control characters are rejected.

### Reliability

- Mid-test UI E2E captures use Electron `capturePage` instead of a CDP screenshot, which on Windows could silently drop the next webview click (such as SSE Stop). The Command Palette helper reopens the palette when a late webview focus closes it.
- Update development tools (esbuild 0.28, mocha 12, Playwright 1.64). Extension bundles are rebuilt with the new esbuild; no runtime dependency changes.

### Docs

- The extension manifest links to the public GitHub repository, homepage, and issue tracker.
- The README's local storage paths name the actual folder, `globalStorage/frozenvoice.tessra/`, instead of `tessra.tessra`.
- Add a security policy with private vulnerability reporting and contribution guidelines to the repository.

## 1.2.7

### Docs

- The README demo is a new 20-second cut recorded in VS Code: send a request, switch environments, run a collection and rerun only the failed request, and watch server-sent events stream in.

### Also included (listed after release)

The 1.2.7 entry originally said it had no extension code changes. The 1.2.7 package was built from a tree that already contained these changes since 1.2.6:

- Incremental `text/event-stream` (SSE) responses with Events/Raw views, Receiving/Completed/Aborted/Timeout/Error states, retained partial data, and explicit line, buffer, event, and Raw limits. No automatic reconnect or resend after a stream starts. See [SSE](docs/sse.md).
- Explicit secret variables: Protect, Set value, temporary Reveal, and Delete for environment and workspace variables, with confirmed values in VS Code SecretStorage and reference-only exports. See [Secret variables](docs/secret-variables.md).
- Text response charset decoding (including EUC-KR and Shift_JIS) with translated warnings and the original bytes kept for unsupported charsets or invalid bytes. See [HTTP response encoding](docs/http-response-encoding.md).
- One total network deadline per request across DNS, connection/TLS, upload, response body, redirects, retries, and retry waits.
- History reuses validated snapshots and counts, and no longer pairs freshly saved in-memory content with a file replaced externally right after the save.
- HTML Preview sanitization moved to a type-checked browser module with stricter hostile-HTML handling.
- Clearer request panel wording and table, JSON, and sidebar readability.

## 1.2.6

### Fixed

- "Stop after headers" requests now close the response stream once the headers are returned, instead of draining the body in the background. Endless or very large bodies no longer keep the socket open after the result is shown.

## 1.2.5

### Docs

- The README and Marketplace page open with a looping animated demo that plays without a click; the full video with sound moves to the Screenshots section. The Marketplace strips `muted` from `<video>`, so browsers never autoplayed it.

## 1.2.4

### Fixed

- Script assertion failures show the actual and expected values again (for example `Expected 1 to strictly equal 2.`), with cycle-safe, length-limited summaries built inside the script realm.

### Docs

- The README demo video autoplays muted and loops; controls stay available to unmute.

## 1.2.3

### Docs

- Add a demo video recorded in VS Code to the top of the README and Marketplace page.

### Fixed

- Fix realm Base64 whitespace handling and malformed UTF-8 byte consumption; preserve replacement-character decoding without timeout loops.
- Restore script equality checks for built-in values, enumerable symbols, sparse arrays, and cyclic structures, plus Object.is equality and NaN array inclusion. Unsupported opaque deep comparisons fail explicitly.
- Block saves after incomplete storage reads and refuse incomplete workspace backups. Confirm profile-switch flushes only after matching acknowledgements are saved, and keep cached drafts in their original profile on direct configuration changes.
- Pin HTTP and collection execution to the starting profile and environment. Merge only script-changed variables, preserve concurrent edits with a warning, and reject late results after profile switches or panel disposal.
- Honor cancellation during request body preparation and restrict HTTP transports and redirects to HTTP/HTTPS. Collection Runner reports unsupported WebSocket requests before sending.
- Remove host objects/functions from script VM input, disable dynamic code generation, and serialize results/errors inside timed VM evaluation. Document the remaining same-process isolation limits.
- Validate stored JSON structure as well as syntax while preserving corrupt originals and backups.
- Preserve authentication/custom headers in generated multipart fetch code, form/binary semantics in cURL, and equals signs/spaces in Postman form export. Invalid form encoding returns a conversion error.
- Preserve the latest request draft when closing the editor before its disk-save debounce, and add keyboard navigation and accessibility semantics to response tabs and request-tab menus/dialogs.

### Reliability

- Align CI with the test tools' Node 22 requirement. Replace the close-editor E2E wall-clock gate with deterministic pre-debounce unit checks and real close/reopen verification.
- Avoid sending the full draft twice for a single URL input event while retaining immediate draft preservation.
- Add execution lifecycle, storage corruption/conflict, script boundary, transport protocol, and conversion roundtrip regressions.
- Expand stable VS Code UI coverage to 23 tests, including response keyboard navigation, immediate draft preservation, and environment/profile execution isolation.

## 1.2.2

### Fixed

- URL variable warnings now follow occurrence-level resolution: a Request-local Path Variable value clears the red underline for that path segment even when the key is missing from the Environment.
- The same name in query, headers, body, or auth stays unresolved unless Environment (or that field's own resolution) can fill it.
- JSON / XML / Raw Body editors no longer show a ghost or double vertical scrollbar; the textarea is the single scroll owner, including on short windows.
- Clearing a request-local Path Variable now removes the override, restoring Environment fallback or unresolved state instead of treating an empty value as resolved.

### Reliability

- Expanded stable VS Code UI E2E coverage to 20 specs, including Path Variable occurrence-resolution UI and Body scroll-ownership contracts.
- GitHub Actions now runs `test:e2e:ui-regressions` (#18/#19/#20) as a named critical UI gate before the full stable suite.

## 1.2.1

### Fixed

- Fixed Request More (`...`) layout on narrow Request Webview widths so Send and More stay grouped instead of leaving More orphaned on the left.
- Request and Response More menus now use viewport-safe placement so the full menu stays inside the Webview and remains clickable.

### Reliability

- Expanded stable VS Code UI E2E coverage with geometry assertions for narrow More menu placement (stable suite now 18 specs).

## 1.2.0

### Added

- Added Path Variables under the URL bar for full path-segment `{{variable}}` placeholders.
- Environment values remain the default fallback; Override keeps a request-local value, and Reset / Clear returns to Environment fallback or an unresolved editable state.
- Path variables missing from the Environment can be entered directly on the request.
- Request-local overrides apply only to matching URL path segments, so same-named query, header, body, and auth variables stay unchanged.
- Saved path overrides are applied consistently for Send, Collection Runner, WebSocket URLs, and request export (cURL / codegen).

### Reliability / Compatibility

- Existing 1.1.1 request data remains backward compatible; Path Variables are optional.
- Path Variables never rewrite the Environment itself or the raw URL template.
- Expanded deterministic VS Code UI E2E coverage (stable suite now 17 specs).

## 1.1.1

- Refreshed the extension Details README so the top highlights no longer present the old 1.0.12 section as the latest release.
- Replaced version-specific README highlights with version-neutral recent highlights to prevent stale release labeling.
- No runtime, request, or storage behavior changes.

## 1.1.0

### User-facing

- Fixed Auth sensitive-field Reveal / Hide so Basic password, Bearer token, and API Key value can be shown and hidden again.

### Reliability / Engineering

- Split the Request Panel webview client into subsystem source modules (Body, Response, Runner, Environment, Default Headers, Status, WebSocket, Auth, Scripts, Settings) without changing runtime CSP or request/storage schemas.
- Expanded deterministic VS Code UI E2E coverage for those request-panel flows (stable suite now 16 specs).
- No storage or request schema migration; existing local data remains compatible.

## 1.0.14

- Added Tessra Script utilities for SHA-256 and HMAC-SHA256.
- Added UTF-8 Base64 encode/decode helpers, UUID v4 generation, and Unix timestamp helpers.
- Script utilities are available in both pre-request and test scripts without exposing Node.js runtime APIs to the sandbox.

## 1.0.13

- Added `.env` file import for Tessra Environments.
- Supports common quoted values, comments, `export` prefixes, duplicate keys, and malformed-line warnings.
- `.env` imports are local one-time copies and do not modify the source file or automatically activate the imported environment.

## 1.0.12

- Added per-run request selection to the Collection Runner.
- Collection runs now start with all requests selected and let you exclude individual requests before execution.
- Added selected-request counts while preserving delay, iterations, stop-on-failure, cancellation, history, and rerun-failed behavior.
- Excluded requests are omitted from the run (not counted as skipped) and selection is not persisted between runs.

## 1.0.11

- Updated the in-app Guide (`GUIDE.md` / `GUIDE.ko.md` / `GUIDE.ja.md`) for the current Request Panel UI: status strip, Pin/Compare + `⋯` overflow, Body conversion, Workspace Backup/Restore, WebSocket, runner options, shortcuts, and local storage files.
- Added Guide content-parity checks so English/Korean/Japanese stay aligned and pre-redesign chip/toolbar wording does not return.
- Fixed URL/Params double serialization that could duplicate query keys when building the final request URL.
- Restored Response Pin / Compare discoverability on the sticky response summary (utilities remain in `⋯`).
- Excluded `tmp/` and other staging artifacts from VSIX packaging.

## 1.0.10

- Redesigned the Request Panel to **The Quiet Instrument**: compact editor-native hierarchy with Method → URL → Send as the primary path, overflow menus for infrequent actions, default-headers one-liner, and response-first emphasis without overwriting a user-locked split ratio.
- Kept Response Pin / Compare as always-visible compact ghost actions on the sticky summary (Copy / Save / Mode / metadata stay in `⋯`; compact contextual cues for mode/metadata when relevant).
- Replaced the old topline chip wall with a quiet status strip that surfaces environment (`N vars` with Tessra signature accent + tiny tesseract mark), Defaults, request `Used N`, Scripts/History on·off cues, and risk overrides (TLS insecure, defaults skipped, redirects, headers-only); Environment opens the variable editor; `Used N` / Vars toggles Variable Usage in strip disclosure; workspace profile stays in strip expand.
- Simplified Scripts help to a one-line Guide link, flattened Settings/WebSocket chrome to divider field groups, and kept Send on host action colors (no success-green takeover).
- Hardened host-theme token usage, visible focus rings, narrow-width status-strip collapse, and `prefers-reduced-motion` animation gating.
- Added JSON and XML Body syntax highlighting via a flat mirror/overlay behind the real Body textarea (highlight.js tokens, VS Code editor/debug token colors; WebSocket composer stays plain; large bodies fall back to plain text) while preserving lightweight editing and undo/redo.
- Added safe Body type conversion when switching types with non-empty content: Convert / Keep text / Cancel (no auto-convert). Supported structural pairs include JSON↔XML, JSON↔form-urlencoded, JSON↔form-data (text fields), JSON/XML↔raw, and clear-to/from none. Nested JSON→form, form-data file fields, and Binary invent/convert paths are rejected; failed conversions keep the original body; Convert is an atomic undo of type + content.

## 1.0.9

- Fixed duplicate Webview event listener registration during repeated request panel renders.
- Added CI/typecheck workflow for build and test validation.
- Updated manual E2E checklist for recent backup, runner, variable, script, cURL, and Body editor workflows.
- Clarified workspace variable backup behavior in documentation.

## 1.0.8

- Fixed Body editor undo/redo behavior so edits can be reverted after sending requests or switching tabs.
- Improved keyboard handling for Body editor undo/redo shortcuts.
- Added regression coverage for Body editor state preservation.

## 1.0.7

- Added Collection Runner options for request delay, iterations, and stop-on-failure behavior.
- Improved Collection Runner cancellation for active requests, retry waits, and inter-request delays.
- Improved runner result summaries for repeated and stopped runs.

## 1.0.6

- Added recursive variable resolution for nested variables across request values.
- Improved OpenAPI import so path parameters are converted into Tessra variable placeholders.
- Added configurable script timeout settings for pre-request and test scripts.

## 1.0.5

- Improved cURL import compatibility for compact short options such as `-XPOST` and bundled flags such as `-skL`.
- Fixed cURL import handling for hyphen-prefixed data values such as `-d '-1'`.
- Improved cURL import warnings for malformed or partially ignored options.

## 1.0.4

- Fixed HTTP Stop behavior so in-flight requests are actually canceled and late canceled responses cannot overwrite newer runs.
- Added WebSocket frame/message size limits and improved protocol-level keepalive cleanup.
- Added automatic gzip/deflate/Brotli response decompression.
- Added safer default response size handling for large responses.
- Improved cURL import compatibility and warnings for unsupported or malformed flags.

## 1.0.3

- Added Tessra Workspace Backup / Restore commands for exporting and restoring collections, environments, active environment, default headers, and workspace variables.
- Added automatic pre-import backups before restoring workspace data.
- Added validation and safety checks for Tessra workspace backup files.
- Improved Import / Export command discoverability and sidebar menu consistency.
- Updated documentation for backup and restore workflows.

## 1.0.2

- Fixed WebSocket mode detection for URLs resolved from environment variables.
- Added WebSocket close diagnostics with close code, reason, and clean-close status.
- Fixed a Webview rendering crash when request data contained non-string values.
- Added optional WebSocket keep-alive messages for idle connections.

## 1.0.1

- Cleaned up Marketplace README links.

## 1.0.0

- Initial public release of Tessra.
