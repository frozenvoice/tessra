# Tessra

The local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

[Korean README](./README.ko.md)

Tessra is built for developers who want a fast Thunder Client-style workflow inside VS Code without accounts, sync requirements, or pricing gates around everyday features. Data stays on the machine, and network traffic only happens when the user explicitly sends an API request.

## Why Tessra

- Offline-first workflow
- No login required
- No cloud dependency
- Local JSON storage only
- cURL, OpenAPI, and Postman import/export
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
- Clickable status chips that jump to the relevant request area, focus it, and briefly highlight the linked card
- Draft change chips that summarize which request sections changed before you save or send
- Variable usage cards that show where each `{{variable}}` is used across the request
- Masked auth and sensitive key/value inputs with reveal controls
- Bulk paste for headers and query params
- Empty-state quick actions for a sample request, the guide, environment switching, and URL focus

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
- Form-data summaries, file chips, and clearer text/file row affordances

### Auth
- No Auth
- Basic Auth
- Bearer Token
- API Key in header or query

### Environments
- Environment CRUD
- Active environment switching
- `{{variable}}` resolution
- Variable autocomplete in URL, headers, body, auth, scripts, and editable text inputs
- Variable resolution for URL, headers, params, body, auth, and file paths
- Workspace-local storage profiles for isolating collections, history, environments, default headers, and saved tabs

### Collections and history
- Collection / folder / request CRUD
- Drag and drop ordering
- Duplicate / Save As
- Run All Requests
- Live collection runner status with active request highlighting and retry countdowns
- Rerun failed requests only from the collection runner summary
- Collection filtering with `method:`, `host:`, and `type:` tokens
- History pinning and filtering with `status:`, `method:`, `host:`, and `pinned:` tokens
- History snapshots store the executed request state
- History pruning via `tessra.historyMaxItems`
- Denser sidebar rows with method/host summaries and collection/folder item counts

### Response viewer
- Body / Headers / Cookies / Tests tabs, plus Preview when the response contains meaningful static HTML
- Dynamic HTML pages stay in Body while `Open URL` remains available for HTTP/HTTPS resolved pages
- Sticky response toolbar for finding text, compare, and response actions
- Topline status chips for the active environment, workspace profile, default headers, scripts, and history behavior
- Find text within the response body with next/previous navigation, case-sensitive mode, and regex mode
- JSON tree viewer
- XML formatting with `Pretty`, `Compact`, and `Inline Children`
- Content-Type based syntax highlighting
- Quick copy actions for resolved URL, status line, raw headers, and response body
- Save response body to file
- Response compare with `Raw`, `Normalized`, and `Pretty` modes
- Compare state chips that surface the active mode, metadata summary usage, and pinned response readiness
- Compare settings with ignored headers and ignored JSON paths
- Compare summaries with body line counts and changed / left-only / right-only totals

### Scripts
- Pre-request scripts
- Test scripts
- `pm.test`, `pm.expect`, `pm.environment`
- Script logs and test results
- Pass/fail/log summary badges and first-failure highlighting
- Collapsible in-app script helper stepper plus insertable examples for chaining request 1 response values into request 2

Example flow:

```js
const body = pm.response.json();
pm.environment.set("sessionKey", String(body.key));
```

Then use `{{sessionKey}}` in request 2.

### Import / Export
- cURL import
- Copy as cURL
- OpenAPI import
- Tessra JSON collection import
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
- Default: `100`
- Maximum number of history entries to keep

### `tessra.allowInsecureCertificates`
- Type: `boolean`
- Default: `false`
- Disables HTTPS certificate validation only when explicitly enabled
- Intended for self-signed local development environments

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
- Controls the visual preset used by the Tessra request panel webview
- Available presets: balanced default polish, minimal cool, stronger product feel, and bolder color accents
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

On first activation after the Tessra rename, if the Tessra storage folder has no existing data, Tessra checks the legacy pre-rename storage folders and copies existing data files into the new `tessra.tessra` folder. If Tessra data already exists, migration is skipped to avoid overwriting local data.

Typical locations:

- Windows: `%APPDATA%\Code\User\globalStorage\tessra.tessra\`
- macOS: `~/Library/Application Support/Code/User/globalStorage/tessra.tessra/`
- Linux: `~/.config/Code/User/globalStorage/tessra.tessra/`

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
