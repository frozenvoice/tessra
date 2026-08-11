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
- The status strip under the URL bar shows the active Environment (`N vars`), Scripts, History on/off, Defaults, risk overrides, and request `Used N`
- Click the Environment segment to edit its variables, or to pick an environment when none is active
- Click `Used N` (or unresolved Vars) to open variable-usage details for the current request
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
- Variable autocomplete works in URL, headers, body, auth, scripts, and other editable fields
- Environment `N vars` is the active environment size; request `Used N` is how many variables this request uses
- Workspace variables can be preserved in backups, but request resolution still follows the active environment
- Import `.env` / `.env.*` / `*.env` files with `Tessra: Import Environment` as a one-time local copy; Tessra does not modify the source file or auto-activate the imported environment

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
- Supported APIs include `pm.test`, `pm.expect`, and `pm.environment`
- Insertable examples and Open Guide are available from the Scripts tab
- Imported scripts stay disabled until you explicitly trust them in the request tab
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

All Tessra data is stored locally in VS Code `globalStorage` JSON files. The default profile stores files at the root; other profiles use `profiles/<name>/`.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

If a JSON file cannot be parsed, Tessra keeps a `.corrupt-*` backup beside it, warns you, and falls back to defaults for that file.

Tessra only makes network calls when you explicitly send a request or open a WebSocket connection.
