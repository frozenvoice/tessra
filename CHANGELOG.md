# Changelog

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
