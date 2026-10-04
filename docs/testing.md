# Tessra Testing

## Layers

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit | `npm test` | Fast logic, localization, HTML contracts, CollectionRunner selection math |
| UI E2E | `npm run test:e2e` | Real VS Code Electron + Tessra webview click paths / discoverability (**25 tests in 24 files**, including Collection Runner, WebSocket, Environment autosave, Default Headers save/apply, Auth Bearer, Scripts, Settings, Path Variables, narrow geometry, Body scroll ownership, keyboard navigation, immediate draft preservation, execution context isolation, HTML preview bundle/sanitization/CSP, and History updates) |
| Manual | `docs/manual-e2e-checklist.md` | Visual quality, themes, OS quirks, Marketplace screenshots |

Unit tests remain valuable. UI E2E does **not** replace them.

## UI E2E prerequisites

- Node 22+ (`@vscode/test-electron` requires Node 22; all CI jobs use Node 22)
- Built extension: `npm run build`
- First run downloads a pinned VS Code desktop build via `@vscode/test-electron` (default `1.99.3`, override with `VSCODE_E2E_VERSION`)
- Windows local and Linux CI (xvfb) are supported

## Commands

```bash
npm test                 # unit only (also used by npm run ci)
npm run test:e2e         # stable VS Code UI E2E (25 tests in 24 files)
npm run test:e2e:ui-regressions  # critical UI contracts (#18/#19/#20): narrow geometry + path occurrence resolution + body scroll ownership
npm run test:e2e:runner  # focused Collection Runner suite (2 specs; same paths as stable)
npm run test:e2e:all     # stable suite then focused runner suite
npm run test:e2e:ci      # CI stable suite
npm run test:all         # unit + stable E2E
```

`npm run ci` stays unit/typecheck/build only. GitHub Actions e2e job runs `test:e2e:ui-regressions` (named critical UI regression contracts) then `test:e2e:ci`.

`npm run typecheck` checks the extension, browser modules, and unit tests separately. `tsconfig.webview.json` supplies DOM types with no ambient Node globals; the extension config also explicitly supplies DOM types for the shared Body conversion service's optional browser parser. `npm run build` and watch include `dist/htmlPreview.js` alongside the extension, Body conversion, and highlight.js bundles.

CI also runs `npm test` on Windows. All jobs cache npm downloads; concurrency cancels older runs for the same PR or branch. Push and pull-request triggers have no path filter because unit tests also read guides, localization JSON, and E2E configuration/helpers/specs outside `src/`.

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

Specs can supply `test.use({ userSettings: { ... } })` to seed settings before VS Code launches; defaults stay unchanged for other specs. History #25 uses `window.dialogStyle: 'custom'` so Windows Delete confirmation runs through the real VS Code dialog DOM instead of an OS-native modal.

### Installed VSIX smoke

Set `TESSRA_E2E_VSIX` to an existing local VSIX to run the same specs against an installed extension. The harness installs it into each test's temporary extensions directory and omits `--extensionDevelopmentPath` and `--disable-extensions`. The default development-host mode is unchanged. This checks packaged asset loading, not just the files in the checkout.

```powershell
New-Item -ItemType Directory -Force tmp | Out-Null
npm run package -- -o tmp/tessra-smoke.vsix
$env:TESSRA_E2E_VSIX = (Resolve-Path tmp/tessra-smoke.vsix).Path
npm run test:e2e -- e2e/specs/24-html-preview.spec.ts --retries=0
Remove-Item Env:TESSRA_E2E_VSIX
```

Inspect the VSIX archive for `dist/extension.js`, `dist/htmlPreview.js`, `dist/bodyConversion.js`, and `dist/hljs.js`. Development sources, browser/test configs, benchmark scripts, E2E files, and promo assets must remain excluded. The preview spec checks the new bundle's webview URI and nonce and exercises its real sanitizer/rendering path.

## Local fixture server

E2E never calls public demo APIs. A Node `http` server binds `127.0.0.1` on a random port and serves deterministic `/users`, `/echo`, `/html`, `/xml`, `/headers`, `/status/500`, `/slow`, `/large`.

Request logs are asserted from the same process.

WebSocket E2E (#11) starts a separate local echo fixture (`e2e/fixtures/websocketServer.ts`) on `127.0.0.1` with a random port. It uses Node built-ins only (HTTP Upgrade + text echo + close) and never calls public WebSocket endpoints.

Environment autosave E2E (#12) edits a seeded variable, waits for the Auto-saved indicator, asserts `environments.json` under the temp user-data dir, reopens the disclosure, and checks Status `N vars` after adding a variable.

Default Headers E2E (#13) opens the editor via Headers banner Manage, adds a deterministic header, clicks explicit Save (not autosave), asserts `default-headers.json`, reopens for persistence, Sends to local `/headers`, and checks the applied request header.

Auth Bearer E2E (#14) opens the Auth tab, selects Bearer, fills a deterministic token (password-masked by default), toggles Reveal/Hide (password ↔ text), Sends to local `/headers`, and checks `Authorization: Bearer …` on the fixture request.

Scripts template E2E (#15) opens the Scripts tab, clicks pre-request/test template buttons, asserts representative template fragments and append-not-overwrite behavior, and checks the request dirty-dot.

Settings editor E2E (#16) opens the Settings tab, asserts HTTP transport/behavior controls and absent WebSocket keepalive controls, changes representative values, checks dirty-dot, roundtrips via another request tab, flips the URL to `ws://` to assert keepalive controls, and checks keepalive values after a second tab roundtrip (no TLS/retry/WS connect runtime).

Path Variables E2E (#17) fills `{{baseUrl}}/mz-chat/{{customerId}}/customer.do`, asserts only `customerId` appears under Path Variables, Overrides to `1111` and Sends, verifies Environment `customerId` stays `9000`, Resets to env fallback `9000`, then switches to an unregistered path variable and Sends `2222`.

Request More narrow geometry E2E (#18) forces a ~430–500px Request Webview width, asserts Method/URL/Send/More stay visible with Send+More adjacent (no left-orphan More), opens Request overflow, and asserts menu `getBoundingClientRect()` stays inside the webview viewport with padding (not merely `.toBeVisible()`).

Path Variable resolution UI E2E (#19) uses Environment-missing `dsgIdn` with Request-local Path Variables `1111`, asserts path occurrence is not unresolved/red and preview source/value is Request/`1111`, Sends `/mz-chat/1111/customer.do`, then adds `?echo={{dsgIdn}}` and asserts path stays resolved while query stays unresolved (occurrence-level, not name-global).

Body scroll ownership E2E (#20) loads a long JSON body, forces short BrowserWindow + Playwright viewport heights, asserts text Body hierarchy has exactly one vertically scrollable owner (textarea), wheels content and checks outer panel stays at `scrollTop=0` with highlight mirror sync, then JSON→Raw→JSON and Form Data class cleanup.

Response keyboard E2E (#21) checks roving tabindex, Arrow/Home/End navigation, selected states, and actual focus. Draft preservation E2E (#22) closes and reopens the VS Code request editor immediately after editing, before its disk-save debounce.

Execution context E2E (#23) holds a real HTTP response in the local `/held` fixture, switches environments, and checks the new environment remains unchanged. It then switches profiles while another response is held and confirms late completion cannot populate the new profile's history or restored tabs. The fixture controls response completion; production code has no test backdoor.

HTML preview E2E (#24) serves hostile and ordinary markup from a local fixture. It checks the local `htmlPreview.js` asset URI/nonce, dangerous tags, consecutive event attributes, external HTML/SVG URLs (including SMIL animated links), the blocked-asset count, and nonce CSP enforcement in the real webview while preserving static content, rendered embedded images, and fragment links. Unit tests import the actual browser module and execute sanitizer, payload, localization, and preview DOM synchronization behavior against DOM fixtures.

History E2E (#25) completes two local HTTP requests, checks disk history and sidebar counts, pins an entry, applies a pinned filter, clears unpinned entries, then unpins and clears the remainder.

### Execution and data regression tests

`scriptUtilities.test.ts` runs the real `ScriptRunner` in both pre-request and test phases. It covers SHA-256/HMAC known vectors, Unicode and block boundaries, primitive coercion, invalid inputs, Base64 padding/whitespace, UUID pool format/exhaustion, and Unix timestamps. Expected hashes and encodings come from Node built-ins in the test process only; no host utility functions are passed into the script realm.

`executionLifecycle.test.ts` combines the real storage merge and RequestPanel execution-context methods with deferred HTTP/body preparation. It checks zero environment writes for empty scripts, changes applied to the original environment, set/unset conflicts preserving newer user edits, zero sends after cancellation during preparation, and zero history/UI writes from obsolete executions. Collection Runner has corresponding reset, empty-script, and WebSocket rejection tests.

Storage validation tests load syntactically valid but malformed nested data from temporary files and assert original bytes, corrupt backups, and in-memory fallback behavior. Conversion tests execute generated fetch code with real FormData and compare multipart/auth/file semantics; transport tests assert unsupported initial and redirect protocols make no target connection. Script boundary tests cover constructor chains, errors, dynamic compilation, result serialization, and timeout behavior. These tests do not establish an OS security sandbox; see [script security limits](script-security.md).

`historyStorage.test.ts` and `historyTreeProvider.test.ts` exercise path-specific snapshots, nested ownership, external replacement/deletion/recovery, profile changes, corrupt-file protection, atomic-save failure, pinned pruning, filtering/sorting, and consistent count notifications. Deterministic filesystem tests replace history immediately after the local atomic rename (before save returns) and immediately after save returns, covering valid data, invalid JSON, and invalid structure. They check external-entry preservation on the next completion, corrupt backups/write blocking/recovery, and unchanged snapshot reuse without additional reads/parses. Successful saves invalidate the cache; the next read validates disk contents once. History saves remain synchronous; no pending debounce queue needs flushing.

Run `node scripts/history-benchmark.cjs` for a repeatable synthetic comparison. It drives the real extension activation callbacks, RequestPanel history save, StorageService, and HistoryTreeProvider using a minimal VS Code API fixture and an isolated temporary store. Defaults are 500 entries with 1 KiB request bodies, 100 completions per run, and three runs. `TESSRA_BENCH_ITEMS`, `TESSRA_BENCH_COMPLETIONS`, and `TESSRA_BENCH_RUNS` override these dimensions. Initialization/cold reads are outside the measured loop. Compare the same script and fixture on both revisions with no concurrent CPU-heavy jobs; report reads, parses, metadata checks, atomic writes/renames, notifications, and elapsed-time range/median. This measures the synthetic persistence/refresh path, not network or real Electron UI performance.

### Critical UI regression quality principles

1. UI element가 DOM상 visible인 것만으로 layout PASS 처리하지 않는다.
2. popup/menu는 viewport geometry를 검증한다.
3. variable warning은 source 존재 여부가 아니라 실제 occurrence resolution을 검증한다.
4. scrollable editor는 실제 scroll owner 수와 wheel interaction을 검증한다.
5. Request Panel layout 변경은 narrow-width와 short-height 실제 BrowserWindow에서 검증한다.

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
6. When changing Collection Runner UI, update `e2e/specs/runner/*` and keep the stable suite at **25 tests** (or intentionally adjust the count here).
7. Layout / variable-resolution / scroll-ownership regressions that users can see immediately should also stay in `npm run test:e2e:ui-regressions` (#18/#19/#20).

### Native file dialogs (`.env` import)

`Tessra: Import Environment` uses the OS / VS Code open dialog. Automating that path under Playwright + Electron is flaky and must not introduce production backdoors. Cover `.env` import with unit tests (`DotEnvService`) plus the 1.0.13 manual smoke checklist instead of forcing a CI E2E.

## Draft and script regressions

The close-editor E2E verifies the restored value after filling the URL and immediately using the native close shortcut. It does not require the whole Playwright/workbench round trip to finish within one second. Unit tests hold the disk timer, verify that the latest draft is already in webview state and host messages, and exercise real panel disposal before any debounce callback. Panel tests also cover direct profile changes, delayed/missing flush acknowledgements, late replies, and storage write failures.

Script regression tests execute the real `ScriptRunner`, compare malformed UTF-8 output against Node Buffer for 1,806 byte sequences, and compare deep assertion outcomes against Node assertions. Storage tests verify that automatic history recording and ordinary saves cannot replace unreadable originals, and that incomplete pre-import backups stop replacement before any store is changed.

## Bundle hygiene

`e2e/**`, `.vscode-test/**`, and artifacts are excluded from the VSIX via `.vscodeignore`. E2E deps are `devDependencies` only.
