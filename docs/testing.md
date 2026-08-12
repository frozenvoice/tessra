# Tessra Testing

## Layers

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | Fast logic, localization, HTML contracts, CollectionRunner selection math |
| UI E2E | `npm run test:e2e` | Real VS Code Electron + Tessra webview click paths / discoverability (**16** stable specs, including Collection Runner, WebSocket, Environment autosave, Default Headers save/apply, Auth Bearer, Scripts template insertion, and Settings editor state) |
| Manual | `docs/manual-e2e-checklist.md` | Visual quality, themes, OS quirks, Marketplace screenshots |

Unit tests remain valuable. UI E2E does **not** replace them.

## UI E2E prerequisites

- Node 20+
- Built extension: `npm run build`
- First run downloads a pinned VS Code desktop build via `@vscode/test-electron` (default `1.99.3`, override with `VSCODE_E2E_VERSION`)
- Windows local and Linux CI (xvfb) are supported

## Commands

```bash
npm test                 # unit only (also used by npm run ci)
npm run test:e2e         # stable VS Code UI E2E (16 specs, includes Collection Runner + WebSocket + Environment autosave + Default Headers + Auth Bearer + Scripts template + Settings editor)
npm run test:e2e:runner  # focused Collection Runner suite (2 specs; same paths as stable)
npm run test:e2e:all     # stable suite then focused runner suite
npm run test:e2e:ci      # CI stable suite
npm run test:all         # unit + stable E2E
```

`npm run ci` stays unit/typecheck/build only. GitHub Actions runs `test:e2e:ci` in a separate job.

Do **not** add a bare `**/runner/**` Playwright `testIgnore` — GitHub Actions absolute paths contain `/home/runner/work/...` and that pattern would drop every stable spec (`No tests found`). Collection Runner specs live under `e2e/specs/runner/` and are part of the default suite.

### Collection Runner E2E

Runner specs exercise the real user path: Tessra Activity Bar → Collections tree → context menu → **Run All Requests** → Runner webview overlay.

Automation strategy (no production backdoors):

- Scope the Collections tree via `.monaco-list[aria-label="Collections"]` (not every workbench monaco list)
- Focus the collection `treeitem` (accessible name may include the `N req` description)
- Open the menu with `Shift+F10` (right-click fallback)
- Activate the command inside the visible `.context-view.monaco-menu-container` with **Enter** (Monaco menus often focus on mouse click without running the action under Electron automation)
- Wait for Runner UI via `data-testid` (`runner-start`, `runner-selected-count`), not CSS-class-only coupling

`npm run test:e2e:runner` remains available for fast local re-runs of the two Runner specs.

## Isolation

Each E2E run uses:

- temporary `--user-data-dir`
- temporary `--extensions-dir`
- temporary workspace
- seeded Tessra `globalStorage` under `frozenvoice.tessra`
- only the extension under development (`--disable-extensions` + `--extensionDevelopmentPath`)

User machine settings / other extensions / real Tessra storage are never reused.

## Local fixture server

E2E never calls public demo APIs. A Node `http` server binds `127.0.0.1` on a random port and serves deterministic `/users`, `/echo`, `/html`, `/xml`, `/headers`, `/status/500`, `/slow`, `/large`.

Request logs are asserted from the same process.

WebSocket E2E (#11) starts a separate local echo fixture (`e2e/fixtures/websocketServer.ts`) on `127.0.0.1` with a random port. It uses Node built-ins only (HTTP Upgrade + text echo + close) and never calls public WebSocket endpoints.

Environment autosave E2E (#12) edits a seeded variable, waits for the Auto-saved indicator, asserts `environments.json` under the temp user-data dir, reopens the disclosure, and checks Status `N vars` after adding a variable.

Default Headers E2E (#13) opens the editor via Headers banner Manage, adds a deterministic header, clicks explicit Save (not autosave), asserts `default-headers.json`, reopens for persistence, Sends to local `/headers`, and checks the applied request header.

Auth Bearer E2E (#14) opens the Auth tab, selects Bearer, fills a deterministic token (password-masked by default), toggles Reveal/Hide (password ↔ text), Sends to local `/headers`, and checks `Authorization: Bearer …` on the fixture request.

Scripts template E2E (#15) opens the Scripts tab, clicks pre-request/test template buttons, asserts representative template fragments and append-not-overwrite behavior, and checks the request dirty-dot.

Settings editor E2E (#16) opens the Settings tab, asserts HTTP transport/behavior controls and absent WebSocket keepalive controls, changes representative values, checks dirty-dot, roundtrips via another request tab, flips the URL to `ws://` to assert keepalive controls, and checks keepalive values after a second tab roundtrip (no TLS/retry/WS connect runtime).

## Stable selectors

Prefer `data-testid` (locale-independent). Do not bind E2E to nth-child CSS or English-only labels.

Core ids include: `request-url`, `send-request`, `stop-request`, `status-environment`, `status-variable-usage`, `environment-disclosure`, `variable-usage-disclosure`, `request-body-editor`, `body-type`, `response-status`, `response-pin`, `response-compare`, `response-overflow`, `runner-selected-count`, `runner-start`, `runner-stop`.

## Failure diagnostics

On failure, artifacts land in `e2e/.artifacts/` (screenshot + meta including fixture request log). CI uploads that folder. Runner context-menu failures also write a scoped diagnostics JSON (visible menu text, focus summary, webview iframe counts) — no secret dumps.

## VS Code version strategy

Pin a known-good desktop version with `VSCODE_E2E_VERSION` (default `1.99.3`). Do not float on daily `stable` for this suite. Multi-version matrices are out of scope for the foundation.

## Adding a new E2E

1. Keep production behavior unchanged; add inert `data-testid` / aria only if needed.
2. Put specs under `e2e/specs/` (Collection Runner under `e2e/specs/runner/`).
3. Reuse `e2e/helpers/*` and the local fixture server.
4. Use condition-based waits (`expect` / `waitFor` / server request log). No arbitrary `sleep(5000)`.
5. Update this doc and mark automated rows in `docs/manual-e2e-checklist.md` when a manual item is covered.
6. When changing Collection Runner UI, update `e2e/specs/runner/*` and keep the stable suite at **16** (or intentionally adjust the count here).

### Native file dialogs (`.env` import)

`Tessra: Import Environment` uses the OS / VS Code open dialog. Automating that path under Playwright + Electron is flaky and must not introduce production backdoors. Cover `.env` import with unit tests (`DotEnvService`) plus the 1.0.13 manual smoke checklist instead of forcing a CI E2E.

## Bundle hygiene

`e2e/**`, `.vscode-test/**`, and artifacts are excluded from the VSIX via `.vscodeignore`. E2E deps are `devDependencies` only.
