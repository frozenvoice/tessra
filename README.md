# Arc Client

The local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

[Korean README](./README.ko.md)

Arc Client is built for developers who want a fast Thunder Client-style workflow inside VS Code without accounts, sync requirements, or pricing gates around everyday features. Data stays on the machine, and network traffic only happens when the user explicitly sends an API request.

## Why Arc Client

- Offline-first workflow
- No login required
- No cloud dependency
- Local JSON storage only
- cURL and Postman import/export
- Scripts, collections, environments, response compare, and code generation
- Built on VS Code Webview + TreeView
- Uses Node.js built-in `http` / `https`

## Features

### Request editing
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Multi-tab request editor with pinned tabs
- `Enter` in the URL field sends the request
- `Ctrl+Enter` / `Cmd+Enter` also sends the request
- Cancel in-flight requests without discarding the last good response
- Request stage strip, richer empty states, status-aware response feedback, and polished response actions
- Topline request summary chips for environment, auth, default headers, scripts, and history behavior
- Preflight warnings for unresolved `{{variables}}` before you send
- Clickable status chips that jump to the relevant request area
- Masked auth and sensitive key/value inputs with reveal controls
- Bulk paste for headers and query params

### Request settings
- Timeout per tab
- Follow redirects
- Save to history toggle
- Manage workspace default headers from the request toolbar or Headers tab
- TLS override: `Default`, `Strict`, `Insecure`
- Maximum response size limit
- Retry count and retry delay
- Stop after headers
- Skip default headers
- Disable scripts
- Visual risk highlighting for request-specific settings that change safety or behavior
- Automatically opens Preview when the response contains meaningful static HTML

### Body types
- `none`
- `json`
- `xml`
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`

### Auth
- No Auth
- Basic Auth
- Bearer Token
- API Key in header or query

### Environments
- Environment CRUD
- Active environment switching
- `{{variable}}` resolution
- Variable resolution for URL, headers, params, body, auth, and file paths

### Collections and history
- Collection / folder / request CRUD
- Drag and drop ordering
- Duplicate / Save As
- Run All Requests
- Live collection runner status with active request highlighting and retry countdowns
- History pinning and filtering
- History snapshots store the executed request state
- History pruning via `arc-client.historyMaxItems`

### Response viewer
- Body / Headers / Cookies / Tests tabs, plus Preview when the response contains meaningful static HTML
- Dynamic HTML pages stay in Body while `Open URL` remains available for the resolved page
- Sticky response toolbar for search, compare, and response actions
- Search within the response body with next/previous navigation, case-sensitive mode, and regex mode
- JSON tree viewer
- XML formatting with `Pretty`, `Compact`, and `Inline Children`
- Content-Type based syntax highlighting
- Save response body to file
- Response compare with `Raw`, `Normalized`, and `Pretty` modes
- Compare state chips that surface the active mode, metadata summary usage, and pinned response readiness
- Compare settings with ignored headers and ignored JSON paths

### Scripts
- Pre-request scripts
- Test scripts
- `pm.test`, `pm.expect`, `pm.environment`
- Script logs and test results

### Import / Export
- cURL import
- Copy as cURL
- Arc JSON collection import
- Postman collection import / export
- Postman environment import / export

### Code generation
- `fetch`
- `axios`
- `Java HttpURLConnection`

## Install

```bash
npm install
npm run build
npx vsce package
```

Then in VS Code:

1. Open `Extensions`
2. Click `...`
3. Select `Install from VSIX...`
4. Choose the generated `.vsix` file

## Quick start

1. Open Arc Client from the Activity Bar
2. Run `Arc: New Request` or click `+`
3. Select a method and enter a URL
4. Fill in params, headers, body, auth, scripts, or request settings
5. Click `Send` or press `Enter`

Example variable usage:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## In-app guide

Run `Arc: Open Guide` to open the user guide inside VS Code.

## Extension settings

### `arc-client.historyMaxItems`
- Type: `number`
- Default: `100`
- Maximum number of history entries to keep

### `arc-client.allowInsecureCertificates`
- Type: `boolean`
- Default: `false`
- Disables HTTPS certificate validation only when explicitly enabled
- Intended for self-signed local development environments

### `arc-client.displayLanguage`
- Type: `string`
- Default: `en`
- Supported values: `en`, `ko`, `ja`
- Controls Arc Client panels, prompts, and notifications
- The in-app guide uses localized guide files when available and falls back to English
- VS Code locale does not change Arc Client UI anymore
- You can also run `Arc: Change Display Language` from the Command Palette

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close current tab
- `Enter`: Send request from the URL field
- `Ctrl+Enter`: Send request

On macOS, use `Cmd` instead of `Ctrl`.

## Local storage

All extension data is stored under VS Code `globalStorage` as JSON files:

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Typical locations:

- Windows: `%APPDATA%\Code\User\globalStorage\arc.arc-client\`
- macOS: `~/Library/Application Support/Code/User/globalStorage/arc.arc-client/`
- Linux: `~/.config/Code/User/globalStorage/arc.arc-client/`

## Development

```bash
npm run build
npm run watch
npm test
npx vsce package
```

Use `F5` in VS Code to launch an Extension Development Host.

## Tech stack

- TypeScript (`strict`)
- VS Code Extension API (`^1.74.0`)
- Node.js built-in `http` / `https`
- Webview + TreeView
- esbuild
- Mocha

## Principles

- No telemetry
- No login
- No cloud sync
- No external CDN in Webview
- Local-first data ownership
