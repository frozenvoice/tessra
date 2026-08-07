# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are developers and API workers who stay inside VS Code and need a Thunder Client-style request workflow without accounts, cloud sync, or paid gates around everyday features.

Their job is to compose, send, inspect, and iterate on HTTP and WebSocket requests quickly, keep collections / environments / history on the local machine, and move work between machines with explicit import/export or workspace backup rather than automatic sync.

## Product Purpose

Tessra is a local-first API client that runs as a VS Code extension. It exists so everyday API testing stays fast, private, and offline-capable inside the editor.

Success means a user can open Tessra, send a real request, read a useful response, save or rerun work through collections and history, and never be forced through login, telemetry, or cloud dependency to do so.

## Positioning

Tessra’s durable difference is an offline-first VS Code API client with no login, no cloud sync, no telemetry, and no paywalled core request workflow. Data lives in local JSON under VS Code `globalStorage`, and network traffic happens only when the user explicitly sends an API request.

Neighboring tools may offer richer cloud collaboration or broader protocol coverage; Tessra does not compete by becoming a sync platform.

## Operating Context

- Hosted inside VS Code via Activity Bar TreeViews (`Collections`, `Environments`, `History`) and a Webview request panel
- Typical rituals: compose a request, resolve `{{variables}}`, send or connect, inspect Body / Headers / Cookies / Tests / Preview, save into a collection, rerun history, run a collection with optional delay / iterations / stop-on-failure
- Import / export paths include cURL, OpenAPI, Postman collection/environment, Tessra JSON, and Tessra workspace backup
- Workspace profiles isolate local storage for different projects or experiments; environments model `local` / `staging` / `prod` inside one profile
- Manual validation happens in the Extension Development Host (`F5`) against `docs/manual-e2e-checklist.md`

## Capabilities and Constraints

Confirmed capabilities:
- HTTP methods `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Multi-tab request editor; Body types `none`, `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- JSON/XML Body syntax highlighting via mirror/overlay (textarea remains the input source; WebSocket composer stays plain)
- Safe Body type conversion on type change with non-empty content: Convert / Keep text / Cancel (structural pairs only; nested form, form-data files, and Binary invent/convert blocked)
- Auth: none, Basic, Bearer, API Key (header/query)
- Environments with recursive `{{variable}}` resolution; request substitution uses the active environment
- Quiet Instrument request panel: Method → URL → Send primary path, quiet status strip, theme presets as color/token skins only
- Collections, folders, history pin/filter/prune, collection runner, response compare, codegen (`fetch`, `axios`, Java `HttpURLConnection`)
- WebSocket `ws://` / `wss://` connect, text send, frame/message limits, optional protocol ping keepalive
- Display language (`en` / `ko` / `ja`) and request panel theme presets
- Workspace backup schemaVersion `1` (collections, environments, active environment, default headers, workspace variables; not history or open tabs)

Hard constraints future work must preserve:
- No login, cloud sync, telemetry, update-check network, or other background product network calls
- No external CDN / remote resource loading in the Webview
- Runtime stays dependency-light: esbuild bundle plus Node built-ins (`http` / `https` / `net` / `tls`)
- Security defaults stay safe (TLS verification on; insecure TLS and script trust are opt-in)
- `engines.vscode` is not raised casually
- Workspace `variables.json` may be preserved in backups, but request `{{variable}}` resolution remains active-environment-driven unless product scope explicitly changes

Explicitly undecided / out of current product scope unless later confirmed:
- Cookie jar, GraphQL mode, CLI, Git sync, `.env` linking, HAR import, `.http` import/export, Monaco Body editor

## Brand Commitments

- Product name: **Tessra**
- Publisher / extension id: `frozenvoice.tessra`
- Positioning language already in use: “local-first”, “offline-first”, “No login. No cloud sync. No paywalled core workflows.”
- UI voice stays practical and concise; Tessra panel copy follows `tessra.displayLanguage`, while VS Code settings/command titles follow VS Code locale
- Existing visual assets: activity bar icon `images/tessra-activitybar.svg`, Marketplace icon `images/icon.png`, remote screenshot set linked from README

## Evidence on Hand

- Product docs: `README.md`, `README.ko.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`
- Manual QA: `docs/manual-e2e-checklist.md`
- Release notes: `docs/release-notes-1.0.x.md`
- Implementation anchors: `src/panels/RequestPanel.ts`, `src/panels/requestPanel/requestPanelHtml.ts`, services under `src/services/`
- Screenshots referenced from README (hosted under `frozenvoice/frozenvoice-assets`); do not invent customers, benchmarks, pricing, or testimonials

## Product Principles

1. **Local ownership first** — data, privacy, and control stay on the user’s machine.
2. **Explicit network only** — the product never phones home; only user-sent API traffic leaves the machine.
3. **Everyday workflows stay free of gates** — login, sync, and paywalls must not block core request work.
4. **Safe defaults, opt-in risk** — TLS, script trust, insecure overrides, and size limits bias toward safety.
5. **Editor-native speed** — keyboard flows, focused request/response loops, and VS Code-native patterns beat dashboard spectacle.

## Accessibility & Inclusion

No separate WCAG certification target is confirmed. Preserve the existing product bar: request panel tabs, primary actions, row delete controls, and response action menus remain keyboard reachable with visible focus, and dense layouts stay usable at narrow panel widths.
