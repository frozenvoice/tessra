---
version: 1
slug: "src-panels-requestpanel-requestpanelhtml-ts"
primary_target: "src/panels/requestPanel/requestPanelHtml.ts"
related_targets: ["src/panels/RequestPanel.ts"]
---

# Surface brief: Request Panel

## Mode
**Operate** - VS Code Webview API client. Task completion (compose -> send/connect -> inspect -> iterate) outranks expression.

## Selected direction
**The Quiet Instrument** - full visual-world replacement. Current `requestPanelHtml.ts` look is anti-reference. Shared layout/spacing/hierarchy; theme presets = color/token variation only.

## Job
Developers and API workers inside VS Code compose HTTP/WebSocket requests, resolve `{{variables}}`, send or connect, inspect responses, and iterate without leaving the editor - local-first, no login/cloud/telemetry.

## Outcome
Primary path Method -> URL -> Send -> Request editing -> Response is visually dominant. Meta never competes. After Send, response gets more space without hiding request edits. Success status lives only in the response sticky summary.

## Scope
- **In:** Full request panel visual/IA redesign (tabs, status strip, URL row, request editor, adaptive split, response chrome, empty/loading/error/WS presentation).
- **Preserved contracts:** Features, data flow, `postMessage` protocol, keyboard (incl. Ctrl/Cmd+Enter), Body undo/redo, Collection Runner, WebSocket, env vars, response viewer tabs, i18n, theme preset *setting*, a11y focus on tabs/primary actions/row delete/response menus.
- **Out / anti-goals:** Polishing old pills/cards/glows; four preset layouts; airy SaaS density; inventing product claims; changing storage/network principles; new protocols (GraphQL, cookie jar, etc.) unless separately confirmed.

## Structure (regions)
1. Tab bar
2. Status strip (Env / vars / defaults / preflight; hover/expand)
3. URL action row (Method / URL / Send + overflow)
4. Request editor tabs + canvas (HEADERS: `DEFAULT HEADERS · N · Manage` one-liner)
5. Adaptive split (compose vs post-send; user ratio persists)
6. Response sticky summary (sole success primary)
7. Response tabs + body; Compare/Mode in overflow

## Hierarchy principles (must encode)
1. Strongest hierarchy: Method -> URL -> Send -> Request editing -> Response
2. One quiet status strip; success only in response summary
3. Conditional response-first; request never painfully folded; split persists
4. VS Code-native quieter: flat, thin dividers, compact toolbars, small radius, theme tokens
5. Default headers one-liner; kv-rows primary
6. Variable usage contextual / disclosure - not permanent card
7. Compare/Mode/infrequent -> overflow/secondary
8. Theme presets = tokens only on one structure
9. Compact editor density
10. Preserve all functional contracts

## Anti-patterns (ban)
999px pills; nested cards; big rounded rects; shadows/glow/bounce; dashboard uppercase kickers; decorative empty orbits; duplicate success green; icon-tile spam; always-on VARIABLE USAGE / Compare / Mode chrome; DEFAULT HEADERS nested card.

## States
Empty (short teach + one action); composing; sending/connecting (cancel); success/error/canceled; dirty confirm; WebSocket connecting/open/closed/error; compare active (then emphasize compare UI); narrow width (collapse secondary first).

## Resolved decisions
- **Status strip:** one quiet line by default; short info via `title` tooltip; click expands a compact **inline** panel under the strip (no floating popover).
- **Split:** reuse existing `requestSplitHeightPx` / `manualHeight`; user-adjusted ratio always wins; response-first uses `is-response-emphasis` CSS when locked; auto ratio only when no stored/manual preference.
- **Overflow:** request ⋯ = Save / Save As / cURL / Codegen; response ⋯ = Compare / Mode / pin / copy helpers / infrequent actions; compare active shows quiet indicator near primary.
- **Resolved URL:** secondary selectable one-line text under summary; truncates mid-width; folds away at narrow widths.
