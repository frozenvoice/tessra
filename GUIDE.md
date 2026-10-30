# Tessra Guide

Tessra is a local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

## Quick start

1. Open Tessra from the Activity Bar.
2. Run `Tessra: New Request` or click `+`.
3. Choose an HTTP method and enter a URL.
4. Use the request tabs for params, headers, body, auth, scripts, or settings.
5. Click `Send`, or press `Enter` in the URL field / `Ctrl+Enter` (`Cmd+Enter` on macOS).

Example variable usage:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## Build requests

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Request tabs: `Params`, `Headers`, `Body`, `Auth`, `Scripts`, `Settings`
- Multi-tab editing with pinned tabs
- `Enter` in the URL field or `Ctrl+Enter` / `Cmd+Enter` sends the active request
- The status strip under the URL bar shows the active environment variable count, scripts, history saving, applied default headers, risk overrides, and referenced request variables
- Click the Environment segment to edit its variables, or to pick an environment when none is active
- Click the request-variable segment (including unresolved-variable warnings) to open variable-usage details for the current request
- Expand the status strip for workspace profile, environment switching, Default Headers, and more detail
- Sensitive auth values stay masked until you reveal them
- You can bulk-paste headers or query params instead of adding them one row at a time
- Tessra warns about unresolved or circular `{{variables}}` before you send

## Body

- Body types: `none`, `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- JSON and XML bodies keep a lightweight textarea editor with syntax highlighting
- Body undo/redo continues to work after Send and after switching request tabs
- When switching a non-empty Body between supported formats, Tessra can offer a safe conversion with `Convert` / `Keep text` / `Cancel`
- Unsupported or ambiguous conversions (nested structures, file form-data, inventing Binary) are rejected, and the original body is kept

## Response workspace

- Response summary shows status, duration, size, content type, and the resolved URL
- Tabs: `Body`, `Cookies`, `Headers`, `Tests`, plus `Preview` when the response contains meaningful static HTML
- Dynamic HTML pages stay in `Body`; use `Open URL` for HTTP/HTTPS resolved pages
- `Pin` and `Compare` stay visible on the response summary
- Copy, Copy URL, Save, Copy Status, Copy Headers, and related utilities live in the `⋯` menu
- Search the response body with next/previous navigation, case-sensitive mode, and regex mode
- JSON supports Tree and Raw views
- XML formatting: `Pretty`, `Compact`, `Inline Children`, plus an XPath helper
- Content-Type based syntax highlighting
- Automatic gzip, deflate, and Brotli decoding
- Compare with `Raw`, `Normalized`, and `Pretty` modes; optionally include a metadata summary

## Collections, runner, and history

- Create collections, folders, and saved requests
- Drag and drop to organize items
- Run All Requests opens a setup screen where every request starts selected; uncheck requests to exclude them from that run only
- Selection uses stable request ids, keeps the original collection order, and resets to all selected the next time you open the runner
- Optional delay, iterations, and stop-on-failure still apply to the selected requests
- The runner shows the active request, progress, and passed / failed / skipped counts; excluded requests are not counted as skipped
- Use Stop to cancel the active request, retry waits, and inter-request delays
- Rerun failed requests only from the runner summary
- Runner results are written to history only when each request has Save to history enabled
- History supports grouping, filtering, pinning, and retention via `tessra.historyMaxItems` (pinned entries are preserved)

## Environments and variables

- Create, edit, activate, and delete environments
- Request `{{variable}}` resolution uses the active environment
- Nested `{{variables}}` resolve recursively; unresolved and circular references are reported before send
- When the URL path contains a full-segment placeholder such as `/users/{{userId}}`, Path Variables appear under the URL bar
- Path Variables use Environment values by default; Override keeps a request-local value, and Reset returns to the Environment fallback without changing the Environment itself
- URL warnings follow the same occurrence-level rule: a Request-local path value is not marked missing, but the same name in query, headers, body, or auth can still be unresolved
- Path overrides apply only to matching path segments — not query, headers, body, or auth — and they also apply to WebSocket URLs and Collection Runner / cURL / codegen resolution
- Variable autocomplete works in URL, headers, body, auth, scripts, and other editable fields
- The environment count (`N vars`) is the active environment size; the request-variable count (`Request vars N`) is the number of unique variable names referenced by this request
- Workspace variables can be preserved in backups, but request resolution still follows the active environment
- Import `.env` / `.env.*` / `*.env` files with `Tessra: Import Environment` as a one-time local copy; Tessra does not modify the source file or auto-activate the imported environment

## Secret variables

- In environment or workspace-variable editors, choose `Protect` explicitly; existing variables are not automatically classified. `Set` enters or replaces a protected value in VS Code's password input, `Reveal` temporarily displays it, and `Delete` removes the selected variable and its exact secret references.
- Confirmed values use VS Code SecretStorage; JSON keeps stable profile/environment/variable IDs and references. Renaming a variable does not change its identity. The Webview receives masks and value-presence metadata by default; profile changes and panel closure clear revealed values.
- Protection verifies SecretStorage before removing the current plaintext. If interrupted or unavailable, the original remains in a blocked pending conversion: use `Retry` to finish or `Cancel` to return to plaintext. Missing or unavailable secrets stop execution before Send.
- New environment/workspace exports contain protected references only. Imported or restored protected variables require `Set`, including when restored on the same computer. Existing backups, exports, and plaintext variables are not scanned or deleted. Workspace variables remain backup-only; requests use the active environment.
- Generated request previews, code, request history, errors, and script logs mask known resolved secret values or preserve variable references. Actual requests and received responses, including server echoes, remain unchanged. Trusted scripts can read environment secrets at runtime; arbitrary transformed values cannot be reliably detected, and the VM is not an OS sandbox.
- See [Secret variable storage and exposure boundaries](docs/secret-variables.md) for recovery and export details.

## Workspace profiles

- `default` is the everyday local storage space
- Create another profile when a different project, imported spec, or experiment should stay separate
- Profiles separate collections, history, environments, default headers, workspace variables, and saved tabs
- Use profiles for different projects or workflows; use environments for `local`, `staging`, and `prod` inside one project
- Switch or create profiles with `Tessra: Change Workspace Profile`
- The current profile is available from the status strip expand details

## Workspace backup and restore

- Use `Tessra: Export Workspace Backup` and `Tessra: Import Workspace Backup`
- A backup includes collections, environments, the active environment, default headers, and workspace variables
- History and open tabs / tab state are not included
- Import replaces data in the current profile; it does not merge
- Before import, Tessra writes an automatic pre-import backup
- Backup files may contain tokens, API keys, and other secrets — store them securely

## Server-Sent Events (SSE)

- A `text/event-stream` response shows events as they arrive. `Events` shows event data and standard `event`, `id`, and `retry` fields; these fields do not enable automatic reconnect or replay. Event content is displayed as text, without assuming a vendor JSON format.
- Use `Stop` during reception. The response distinguishes receiving, completed, stopped, timeout, and error states and keeps received partial data. Profile changes, panel closure, and Runner Stop cancel the stream and discard late updates from that execution.
- The overall request timeout and response-size limit still apply. Choose timeout `0` explicitly for a stream without a deadline; streaming does not silently disable limits or TLS checks. Once streaming has started, Tessra does not automatically retry, reconnect, or resend a POST.
- UTF-8 chunk boundaries, BOM, CR/LF/CRLF, multiple `data` lines, comments, and blank-line event boundaries are handled incrementally. An unfinished final event is not invented on EOF; transport errors remain errors.
- Event size, pending input, retained events, and Raw bytes are bounded. Truncation or dropped events are shown explicitly. `Raw` becomes available after the stream ends and copy/save contains only its retained prefix; the screen is updated in batches.
- See [SSE reception and limits](docs/sse.md) for the current limits and cancellation behavior.

## WebSocket

- Enter a `ws://` or `wss://` URL (raw or after `{{variable}}` resolution) to switch into WebSocket mode
- Use Connect / Disconnect as the primary action
- The Body tab is the outgoing text message composer
- Inbound, outbound, and close diagnostics appear in the WebSocket message log
- Inbound binary frames are shown as base64
- Frame and message size limits protect the editor from oversized payloads
- Optional protocol-level ping keepalive is available in Settings and is off by default

## Scripts

- Pre-request scripts run before send; test scripts run after the response
- Flow: Environment → Pre-request → Send → Tests
- Supported Postman-like APIs include `pm.test`, `pm.expect`, and `pm.environment`
- Tessra Script utilities (not Postman-official `pm.crypto`): `pm.crypto.sha256(value)`, `pm.crypto.hmacSha256(message, secret)` (lowercase hex), `pm.encoding.base64Encode` / `base64Decode` (UTF-8 ↔ standard Base64), `pm.uuid()` (UUID v4), `pm.time.unix()` (seconds), `pm.time.unixMs()` (milliseconds)
- Hash/encode helpers accept string/number/boolean/bigint/null/undefined; pass `JSON.stringify(...)` for objects
- Example: `pm.environment.set("signature", pm.crypto.hmacSha256(pm.environment.get("payload") || "", pm.environment.get("secret") || ""));`
- Insertable examples and Open Guide are available from the Scripts tab
- Imported scripts stay disabled until you explicitly trust them in the request tab
- Script variable changes apply to the starting environment; concurrent edits to the same key are kept with a warning. Profile changes cancel active work.
- Scripts do not receive host objects/functions. The VM is not an OS sandbox: run only scripts you understand and trust.
- Script timeout is controlled by `tessra.scriptTimeoutMs`
- Script logs and pass/fail test results appear in the response Tests tab

## Request settings

- Timeout
- Max response size
- Retry count and retry delay
- TLS: `Default`, `Strict`, `Insecure`
- Follow redirects
- Stop after headers
- Save to history
- Skip default headers
- Disable scripts
- Open Default Headers from the Headers tab banner or status strip details
- Non-default safety or behavior options appear as status strip warnings or indicators

## Import and export

- Import cURL and Copy as cURL
- Import OpenAPI; path parameters such as `{userId}` become `{{userId}}`
- Import Tessra collections
- Import / export Postman collections and environments
- Import `.env` files as Tessra Environments (one-time copy; no sync, watcher, or write-back)
- Export / import Tessra Workspace Backup

## Display language and theme

- Use `Tessra: Change Display Language` for `English`, `Korean`, or `Japanese`
- Tessra panels, prompts, notifications, and this guide follow that setting
- VS Code Settings labels and Command Palette titles still follow the VS Code locale
- Use `Tessra: Change Request Panel Theme` to switch color/token skins (`default`, `minimal-cool`, `product`, `bold-color`)
- Theme presets change accent and surface tokens only; they do not change the panel layout

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close the current tab
- `Enter`: Send from the URL field
- `Ctrl+Enter`: Send request
- `Ctrl+S`: Save the current request
- `Ctrl+Shift+S`: Save As
- `Ctrl+F`: Focus response find
- `Alt+1` … `Alt+6`: Switch request tabs
- `Alt+Shift+1` … `Alt+Shift+5`: Switch response tabs

On macOS, use `Cmd` instead of `Ctrl`.

## Local storage

Requests and metadata are stored locally in VS Code `globalStorage` JSON files. Confirmed protected-variable values are stored separately in VS Code SecretStorage; JSON retains their references. The default profile stores files at the root; other profiles use encoded directories under `profiles/`.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

If a JSON file cannot be parsed, Tessra keeps a `.corrupt-*` backup beside it, warns you, and falls back to defaults for that file.

Tessra only makes network calls when you explicitly send a request or open a WebSocket connection.
