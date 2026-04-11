# Arc Client

The local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

[한국어 문서 보기](./README.ko.md)

Arc Client is built for developers who want a fast Thunder Client-style workflow inside VS Code without accounts, sync requirements, or pricing gates around everyday features. Data stays on the machine, and network traffic only happens when the user explicitly sends an API request.

## Why Arc Client

- Offline-first workflow
- No login required
- No cloud dependency
- Local JSON storage only
- cURL and Postman import/export
- Scripts, collections, environments, and code generation
- Built on VS Code Webview + TreeView
- Uses Node.js built-in `http` / `https`

## Features

### Request editing
- HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Multi-tab request editor
- Request timeout per tab
- Cancel in-flight requests
- Params / Headers / Auth / Scripts / Settings tabs

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
- History pinning and filtering
- History pruning via `arc-client.historyMaxItems`

### Response viewer
- Body / Headers / Cookies / Tests tabs
- JSON tree viewer
- Content-Type based syntax highlighting
- Save response body to file
- Compare responses

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
4. Fill in params, headers, body, auth, or scripts
5. Click `Send` or press `Ctrl+Enter`

Example variable usage:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## Screenshots

Store Marketplace screenshots in [images/marketplace](/E:/Dev/GitHub/arc-client/images/marketplace).

Recommended file names:

- `screenshot-01-request-workflow.png`
- `screenshot-02-collections-environments-history.png`
- `screenshot-03-scripts-and-tests.png`
- `screenshot-04-import-flow.png`
- `screenshot-05-code-generation.png`

Suggested capture order:

1. Multi-tab request workflow
2. Collections, environments, and history
3. Scripts and test results
4. cURL / Postman import flow
5. Code generation output

Add images here after capturing them:

```md
![Multi-tab request workflow](./images/marketplace/screenshot-01-request-workflow.png)
![Collections, environments, and history](./images/marketplace/screenshot-02-collections-environments-history.png)
![Scripts and test results](./images/marketplace/screenshot-03-scripts-and-tests.png)
```

## Settings

### `arc-client.historyMaxItems`
- Type: `number`
- Default: `100`
- Maximum number of history entries to keep

### `arc-client.allowInsecureCertificates`
- Type: `boolean`
- Default: `false`
- Disables HTTPS certificate validation only when explicitly enabled
- Intended for self-signed local development environments

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close current tab
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
