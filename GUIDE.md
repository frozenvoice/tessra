# Arc Client Guide

Arc Client is a local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

## Quick start

1. Open Arc Client from the Activity Bar.
2. Run `Arc: New Request` or click `+`.
3. Choose an HTTP method and enter a URL.
4. Fill in params, headers, body, auth, scripts, or request settings.
5. Click `Send` or press `Enter` in the URL field.

Example variable usage:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## Build requests

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Body types: `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- Auth: No Auth, Basic, Bearer Token, API Key
- Multi-tab editing with pinned tabs
- `Enter` in the URL field sends the active request

## Response workspace

- Tabs: `Body`, `Headers`, `Cookies`, `Tests`, plus `Preview` when the response contains meaningful static HTML
- Dynamic HTML pages stay in `Body`, and you can use `Open URL` to jump to the resolved page
- JSON tree viewer
- XML formatting: `Pretty`, `Compact`, `Inline Children`
- Save or copy the response body
- Compare responses with `Raw`, `Normalized`, and `Pretty` modes

## Collections, history, and environments

- Create collections, folders, and saved requests
- Drag and drop to organize requests
- Run an entire collection
- Store request history as executed snapshots
- Switch active environments and use `{{variables}}` across the request

## Scripts

- Pre-request scripts
- Test scripts
- `pm.test`, `pm.expect`, and `pm.environment`
- Script logs and test result output

## Request settings

- Timeout
- Follow redirects
- Save to history
- Open `Default Headers` from the request toolbar or the Headers tab banner
- TLS override
- Maximum response size
- Retry count and retry delay
- Stop after headers
- Skip default headers
- Disable scripts
- Automatically opens Preview when the response contains meaningful static HTML

## Display language

- Use `Arc: Change Display Language` to switch between `English`, `Korean`, and `Japanese`.
- Arc Client uses its own display-language setting and does not follow the VS Code locale automatically.

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close the current tab
- `Enter`: Send from the URL field
- `Ctrl+Enter`: Send request

On macOS, use `Cmd` instead of `Ctrl`.

## Local storage

All Arc Client data is stored locally in VS Code `globalStorage` JSON files.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Arc Client only makes network calls when you explicitly send an API request.
