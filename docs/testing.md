# Tessra Testing

## Layers

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | Fast logic, localization, HTML contracts, CollectionRunner selection math |
| UI E2E | `npm run test:e2e` | Real VS Code Electron + Tessra webview click paths / discoverability |
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
npm run test:e2e         # stable VS Code UI E2E (excludes flaky Collection Runner tree-menu specs)
npm run test:e2e:runner  # Collection Runner UI specs (known flaky on Windows context menus — see below)
npm run test:e2e:all     # every UI E2E spec including runner
npm run test:e2e:ci      # CI stable suite
npm run test:all         # unit + stable E2E
```

`npm run ci` stays unit/typecheck/build only. GitHub Actions runs `test:e2e:ci` in a separate job.

### Collection Runner E2E status

Opening **Run All Requests** requires the VS Code Collections tree context menu. Under Playwright + Electron on Windows this path is intermittently broken (menu appears / click registers, but `configureCollectionRun` does not reliably reach the webview). Specs live in `e2e/specs/runner/` and can pass in isolation, but they are not yet part of the default green gate.

Next step to stabilize: investigate VS Code context-menu action invocation under automation (or a first-party Tessra UI entry point that does not rely on the workbench context menu).

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

## Stable selectors

Prefer `data-testid` (locale-independent). Do not bind E2E to nth-child CSS or English-only labels.

Core ids include: `request-url`, `send-request`, `stop-request`, `status-environment`, `status-variable-usage`, `environment-disclosure`, `variable-usage-disclosure`, `request-body-editor`, `body-type`, `response-status`, `response-pin`, `response-compare`, `response-overflow`, `runner-selected-count`, `runner-start`, `runner-stop`.

## Failure diagnostics

On failure, artifacts land in `e2e/.artifacts/` (screenshot + meta including fixture request log). CI uploads that folder.

## VS Code version strategy

Pin a known-good desktop version with `VSCODE_E2E_VERSION` (default `1.99.3`). Do not float on daily `stable` for this suite. Multi-version matrices are out of scope for the foundation.

## Adding a new E2E

1. Keep production behavior unchanged; add inert `data-testid` / aria only if needed.
2. Put specs under `e2e/specs/`.
3. Reuse `e2e/helpers/*` and the local fixture server.
4. Use condition-based waits (`expect` / `waitFor` / server request log). No arbitrary `sleep(5000)`.
5. Update this doc and mark automated rows in `docs/manual-e2e-checklist.md` when a manual item is covered.

## Bundle hygiene

`e2e/**`, `.vscode-test/**`, and artifacts are excluded from the VSIX via `.vscodeignore`. E2E deps are `devDependencies` only.
