# Tessra

The local-first API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

Tessra is built for developers who want a fast Thunder Client-style workflow inside VS Code without accounts, sync requirements, or pricing gates around everyday features. Data stays on the machine, and network traffic only happens when the user explicitly sends an API request.

## What's new in 1.0.10

- Compact, editor-native Request Panel (**Quiet Instrument**): Method → URL → Send first, quieter secondary chrome
- Response summary keeps Pin / Compare always visible; Copy / Save / Mode / metadata stay in `⋯`
- Request execution status strip for environment (`N vars`), Defaults, request `Used N`, Scripts/History, and risk overrides (Tessra signature accent + tiny tesseract mark on Env; click Env to edit variables)
- JSON/XML Body syntax highlighting that keeps the lightweight textarea and undo/redo
- Safe Body type conversion with Convert / Keep text / Cancel (supported structural pairs only)
- Still local-first: no login, no cloud sync, no telemetry

## Screenshots

### Main workspace
Collections, environments, variables, history, and the response viewer in one local workspace.

![Tessra main workspace](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-main.png)

### Compose requests
Build requests with params, headers, JSON bodies, auth, scripts, and environment variables.

![Compose requests in Tessra](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-request-compose.png)

### HTML preview
Preview static HTML responses safely inside VS Code.

![HTML preview in Tessra](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-html-preview.png)

### History and collection runner
Group request history by date and run collections with status summaries.

![History and runner in Tessra](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-history.png)

## Why Tessra

- Offline-first workflow
- No login required
- No cloud dependency
- Local JSON storage only
- cURL, OpenAPI, and Postman import/export
- Scripts, collections, environments, response compare, and code generation
- WebSocket `ws://` / `wss://` connect, message, safety limit, and keepalive workflow
- Built on VS Code Webview + TreeView
- Uses Node.js built-in `http` / `https` / `net` / `tls`

## Features

### Request editing
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Multi-tab request editor with pinned tabs
- Re-click the active request editor tab to collapse or restore its body while keeping the tab bar visible
- Improved Body editor undo/redo behavior after sending requests or switching request editor tabs
- `Enter` in the URL field sends the request
- `Ctrl+Enter` / `Cmd+Enter` also sends the request
- Cancel in-flight requests without discarding the last good response
- Request stage feedback, richer empty states, status-aware response feedback, and polished response actions
- Quiet status strip for environment (`N vars`), Defaults, request `Used N`, Scripts/History on·off, and risk overrides; click the Environment segment (or strip expand / Environments view) to open the variable editor
- Preflight warnings for unresolved `{{variables}}` before you send
- Clickable status chips that jump to the relevant request area, focus it, and briefly highlight the linked card
- Draft change chips that summarize which request sections changed before you save or send
- Variable Usage disclosure (via strip `Used N` / Vars) showing where each `{{variable}}` is used across the request
- Masked auth and sensitive key/value inputs with reveal controls
- Bulk paste for headers and query params
- Empty-state quick actions for a sample request, the guide, environment switching, and URL focus

### WebSocket
- `ws://` and `wss://` tabs are detected from the raw URL or the URL after `{{variables}}` resolve
- Handshake requests use headers, query params, auth, workspace default headers, environment variables, and TLS override settings
- Connect and disconnect from the primary action; the Body tab acts as the outgoing text message composer
- Inbound, outbound, and close diagnostic messages render in a dedicated WebSocket log, with inbound binary frames shown as base64
- WebSocket frame/message size limits protect the extension from oversized text or binary messages
- Optional protocol-level ping keepalive can run at a per-request interval; it is off by default
- For a public echo smoke test, try `wss://ws.ifelse.io`
- Public echo servers can change availability or idle timeout policies; if one closes with code `1006`, try another endpoint or enable keepalive when the server supports ping/pong

### Request settings
- Timeout per tab
- Follow redirects
- Save to history toggle
- Manage workspace default headers from the request toolbar or Headers tab
- TLS override: `Default`, `Strict`, `Insecure`
- Maximum response size limit, with a safer default for large responses
- Retry count and retry delay
- Stop after headers
- Skip default headers
- Disable scripts
- Visual risk highlighting for request-specific settings that change safety or behavior
- Automatically opens Preview when the response contains meaningful static HTML

### Body types
- `none`
- `json` (request Body syntax highlighting via a mirror overlay; textarea stays the input source)
- `xml` (same mirror overlay with XML highlighting)
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`
- Form-data summaries, file chips, and clearer text/file row affordances
- Safe Body type conversion when switching types with non-empty content: Convert / Keep text / Cancel (no auto-convert; nested form payloads and file form-data are rejected; Binary is never invented)

### Auth
- No Auth
- Basic Auth
- Bearer Token
- API Key in header or query

### Environments
- Environment CRUD
- Active environment switching
- `{{variable}}` resolution
- Nested `{{variables}}` resolve recursively, with unresolved and circular references reported before send
- Variable autocomplete in URL, headers, body, auth, scripts, and editable text inputs
- Variable resolution for URL, headers, params, body, auth, and file paths
- `Import Environment` from the Environments title bar for Postman Environment JSON files
- Workspace-local storage profiles for isolating collections, history, environments, default headers, and saved tabs

### Collections and history
- Collection / folder / request CRUD
- Drag and drop ordering
- Duplicate / Save As
- Run All Requests
- Live collection runner status with active request highlighting and retry countdowns
- Runner options for delay between requests, multiple iterations, and stop-on-failure behavior
- Runner Stop cancels active requests, retry waits, and inter-request delays
- Rerun failed requests only from the collection runner summary
- Collection runner executions are saved to history when each request's Save to history setting is enabled
- Collection filtering with `method:`, `host:`, and `type:` tokens
- History pinning and filtering with `status:`, `method:`, `host:`, and `pinned:` tokens
- History snapshots store the executed request state plus timing metadata
- History pruning via `tessra.historyMaxItems`, with pinned entries preserved
- History Settings action from the History view opens the retention setting directly
- Denser sidebar rows with method/host summaries and collection/folder item counts

### Response viewer
- Body / Headers / Cookies / Tests tabs, plus Preview when the response contains meaningful static HTML
- Dynamic HTML pages stay in Body while `Open URL` remains available for HTTP/HTTPS resolved pages
- Readable response durations with requested/received timestamps in the response metadata
- Sticky response toolbar for finding text, compare, and response actions
- Quiet status strip with glanceable editor indicators for the active environment (`N vars`), Scripts/History on·off, Defaults/`Used N` counts, and risk overrides (TLS insecure, defaults skipped, redirects, headers-only); workspace profile lives in strip expand disclosure; Environment segment toggles the inline variable editor
- Find text within the response body with next/previous navigation, case-sensitive mode, and regex mode
- JSON tree viewer
- XML formatting with `Pretty`, `Compact`, and `Inline Children`
- Content-Type based syntax highlighting
- Automatic gzip, deflate, and Brotli response decoding
- Quick copy actions for resolved URL, status line, raw headers, and response body
- Save response body to file
- Response compare with `Raw`, `Normalized`, and `Pretty` modes
- Response summary Pin / Compare ghost actions, with compact contextual mode/metadata cues (no chip wall)
- Compare settings with ignored headers and ignored JSON paths
- Compare summaries with body line counts and changed / left-only / right-only totals

### Scripts
- Pre-request scripts
- Test scripts
- `pm.test`, `pm.expect`, `pm.environment`
- Imported scripts stay disabled until you explicitly trust them in the request tab
- Script execution timeout is configurable with `tessra.scriptTimeoutMs`
- Script logs and test results
- Pass/fail/log summary badges and first-failure highlighting
- Compact Scripts one-liner (`Environment → Pre-request → Send → Tests`) with Open Guide, plus insertable examples on each script editor

Example flow:

```js
const body = pm.response.json();
pm.environment.set("sessionKey", String(body.key));
```

Then use `{{sessionKey}}` in request 2.

### Import / Export
- cURL import handles common compact flags and warns about unsupported or malformed options
- Copy as cURL
- OpenAPI import
- OpenAPI path parameters such as `/users/{userId}` import as Tessra placeholders like `/users/{{userId}}`
- Tessra JSON collection import
- Tessra workspace backup export / import for collections, environments, default headers, variables, and active environment state
- Postman collection import / export
- Postman environment import / export

#### Workspace Backup / Restore

Use `Tessra: Export Workspace Backup` and `Tessra: Import Workspace Backup` from the Command Palette to move a Tessra workspace to another machine. A workspace backup includes collections, environments, the active environment, workspace default headers, and workspace variables.

Workspace variables are preserved in Tessra backups, but request variable resolution is driven by the active environment.

Import replaces data in the current active profile with the backup contents; it is not a merge import. Before restoring, Tessra automatically writes a pre-import backup under `globalStorage/backups/tessra-preimport-YYYYMMDD-HHmmss.tessra-backup.json`.

Workspace Backup / Restore v1 does not include request history or open tabs / tab state. Backup files may contain secrets such as tokens, API keys, Authorization headers, and environment values. Store them securely and avoid uploading them to public repositories, shared folders, or issue attachments.

### Code generation
- `fetch`
- `axios`
- `Java HttpURLConnection`

## Install

Install Tessra from the VS Code Marketplace. For offline environments, install the downloaded `.vsix` with **Extensions: Install from VSIX...**.

## Quick start

1. Open Tessra from the Activity Bar
2. Run `Tessra: New Request` or click `+`
3. Select a method and enter a URL
4. Fill in params, headers, body, auth, scripts, or request settings
5. Click `Send` or press `Enter`
6. Run `Tessra: Import OpenAPI` from the Command Palette to turn an OpenAPI JSON file into a collection

Example variable usage:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## In-app guide

Run `Tessra: Open Guide` to open the user guide inside VS Code.

## Extension settings

### `tessra.historyMaxItems`
- Type: `number`
- Default: `500`
- Minimum: `50`
- Maximum: `5000`
- Maximum number of non-pinned history entries to keep
- Pinned entries are preserved, so total history count may exceed this limit
- You can open this setting from the History view title bar with `Tessra: Open History Settings`

### `tessra.allowInsecureCertificates`
- Type: `boolean`
- Default: `false`
- Disables HTTPS certificate validation only when explicitly enabled
- Intended for self-signed local or internal environments

### `tessra.scriptTimeoutMs`
- Type: `number`
- Default: `3000`
- Minimum: `100`
- Maximum: `30000`
- Timeout used for pre-request and test scripts, including collection runner executions

### `tessra.displayLanguage`
- Type: `string`
- Default: `en`
- Supported values: `en`, `ko`, `ja`
- Controls Tessra panels, prompts, notifications, and the in-app guide
- The in-app guide uses localized guide files when available and falls back to English
- VS Code locale still controls Tessra setting labels and Command Palette titles
- This setting changes the Tessra UI itself, separate from the VS Code locale
- You can also run `Tessra: Change Display Language` from the Command Palette

### `tessra.requestPanelTheme`
- Type: `string`
- Default: `default`
- Supported values: `default`, `minimal-cool`, `product`, `bold-color`
- Color/token skin for the Tessra request panel webview (shared Quiet Instrument layout)
- Presets only change accent color, method color intensity, subtle surface tint, and border contrast — not spacing, radius, or component structure
- You can also run `Tessra: Change Request Panel Theme` from the Command Palette

### `tessra.workspaceProfile`
- Type: `string`
- Default: `default`
- Switches the active local storage profile for collections, history, environments, default headers, and saved tabs
- Use `Tessra: Change Workspace Profile` to switch or create profiles quickly from the Command Palette
- Keep `default` as your everyday workspace, then create a separate profile when another project, imported spec, or experiment should not mix with it
- A good rule of thumb: use profiles for different projects or workflows, and use environments for `local` / `staging` / `prod` inside the same project

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close current tab
- `Enter`: Send request from the URL field
- `Ctrl+Enter`: Send request
- `Ctrl+S` / `Cmd+S`: Save the current request
- `Ctrl+Shift+S` / `Cmd+Shift+S`: Save As
- `Ctrl+F` / `Cmd+F`: Focus response find field
- `Alt+1..6`: Switch request tabs
- `Alt+Shift+1..5`: Switch response tabs

On macOS, use `Cmd` instead of `Ctrl`.

## Local storage

All extension data is stored under VS Code `globalStorage` as JSON files. The default profile stores files at the root, and custom workspace profiles store the same files under `profiles/<profile-name>/`.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

If a stored JSON file cannot be parsed, Tessra keeps a `.corrupt-*` backup beside the original file, warns you, and uses defaults for that file until it is saved again.

Typical locations:

- Windows: `%APPDATA%\Code\User\globalStorage\tessra.tessra\`
- macOS: `~/Library/Application Support/Code/User/globalStorage/tessra.tessra/`
- Linux: `~/.config/Code/User/globalStorage/tessra.tessra/`

## Principles

- No telemetry
- No login
- No cloud sync
- No external CDN in Webview
- Local-first data ownership
