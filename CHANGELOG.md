# Changelog

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
