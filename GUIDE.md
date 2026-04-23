# Tessra Guide

Tessra is a local-first REST API client for VS Code.

No login. No cloud sync. No paywalled core workflows.

## Quick start

1. Open Tessra from the Activity Bar.
2. Run `Tessra: New Request` or click `+`.
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
- The top summary chips show the current environment, auth mode, default-header usage, scripts, and history behavior
- Sensitive auth values stay masked until you reveal them
- You can bulk-paste headers or query params instead of adding them one row at a time
- Tessra warns about unresolved `{{variables}}` before you send

## Response workspace

- Tabs: `Body`, `Headers`, `Cookies`, `Tests`, plus `Preview` when the response contains meaningful static HTML
- Dynamic HTML pages stay in `Body`, and you can use `Open URL` to jump to HTTP/HTTPS resolved pages
- Response metadata shows readable durations plus requested and received timestamps
- A sticky response toolbar keeps search, compare, copy, and save actions visible
- Search within the response body with next/previous navigation, case-sensitive mode, and regex mode
- JSON tree viewer
- XML formatting: `Pretty`, `Compact`, `Inline Children`
- Save or copy the response body
- Compare responses with `Raw`, `Normalized`, and `Pretty` modes
- Compare state chips show the active mode, metadata-summary usage, and pinned-response readiness

## Collections, history, and environments

- Create collections, folders, and saved requests
- Drag and drop to organize requests
- Run an entire collection
- Collection runs show the active request, current attempt, and retry countdowns
- Store request history as executed snapshots with timing metadata
- Switch active environments and use `{{variables}}` across the request

## Workspace profiles

- `default` is the main local storage space for your everyday Tessra work
- Create another profile when a different project, imported spec, or experiment should not mix with your current collections and history
- Profiles split collections, history, environments, default headers, and saved tabs
- A practical rule:
  - Use profiles for different projects or workflows
  - Use environments for `local`, `staging`, and `prod` inside one project
- Use `Tessra: Change Workspace Profile` to switch or create profiles
- The request header shows the current profile, and the `default` profile chip explains what it means when you hover it

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
- Settings that change safety or behavior are visually highlighted
- Automatically opens Preview when the response contains meaningful static HTML

## Display language

- Use `Tessra: Change Display Language` to switch between `English`, `Korean`, and `Japanese`.
- Tessra uses its own display-language setting for panels, prompts, notifications, and the in-app guide.
- VS Code Settings labels and Command Palette titles still follow the VS Code locale.

## Keyboard shortcuts

- `Ctrl+T`: New request tab
- `Ctrl+W`: Close the current tab
- `Enter`: Send from the URL field
- `Ctrl+Enter`: Send request

On macOS, use `Cmd` instead of `Ctrl`.

## Local storage

All Tessra data is stored locally in VS Code `globalStorage` JSON files.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Tessra only makes network calls when you explicitly send an API request.
