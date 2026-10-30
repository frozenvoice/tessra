---
name: Tessra
description: Local-first VS Code API client — quiet editor instrument, not a dashboard
colors:
  vscode-fg: "var(--vscode-foreground)"
  vscode-fg-muted: "var(--vscode-descriptionForeground)"
  vscode-bg-editor: "var(--vscode-editor-background)"
  vscode-bg-sidebar: "var(--vscode-sideBar-background)"
  vscode-bg-input: "var(--vscode-input-background)"
  vscode-border: "var(--vscode-panel-border)"
  vscode-focus: "var(--vscode-focusBorder)"
  vscode-button: "var(--vscode-button-background)"
  vscode-button-fg: "var(--vscode-button-foreground)"
  vscode-button-hover: "var(--vscode-button-hoverBackground)"
  vscode-list-active: "var(--vscode-list-activeSelectionBackground)"
  vscode-error: "var(--vscode-errorForeground)"
  vscode-warning: "var(--vscode-editorWarning-foreground)"
  brand-blue: "var(--vscode-charts-blue, #3794ff)"
  brand-violet: "var(--vscode-charts-purple, #b180d7)"
  brand-accent: "color-mix(blue→violet via --tessra-brand)"
  method-get: "#4EC94E"
  method-post: "#E5C07B"
  method-put: "#61AFEF"
  method-patch: "#D19A66"
  method-delete: "#E06C75"
  method-meta: "#ABB2BF"
  method-ws: "#4EC9B0"
  status-success: "#4EC94E"
  status-error: "#E06C75"
  status-warn: "#D19A66"
  status-info: "#61AFEF"
typography:
  ui:
    fontFamily: "var(--vscode-font-family)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  editor:
    fontFamily: "var(--vscode-editor-font-family, Consolas, 'Courier New', monospace)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "var(--vscode-font-family)"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  title:
    fontFamily: "var(--vscode-font-family)"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  none: "0"
  xs: "2px"
  sm: "3px"
  md: "4px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.vscode-button}"
    textColor: "{colors.vscode-button-fg}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.vscode-button-hover}"
    textColor: "{colors.vscode-button-fg}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "28px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.vscode-fg}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
    height: "28px"
  input-field:
    backgroundColor: "{colors.vscode-bg-input}"
    textColor: "{colors.vscode-fg}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
    height: "28px"
  status-strip:
    backgroundColor: "{colors.vscode-bg-editor}"
    textColor: "{colors.vscode-fg-muted}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
    height: "22px"
  method-badge:
    backgroundColor: "transparent"
    textColor: "{colors.method-get}"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
    height: "24px"
---

# Design System: Tessra

## Overview

**Creative North Star: "The Quiet Instrument"**

Tessra’s visual world is an **Operate** surface inside a VS Code Webview: a precise local API instrument that disappears into Method → URL → Send → edit → inspect. It is not a marketing dashboard, not a SaaS console, and not a clone of stock VS Code chrome. Identity lives in method color discipline, a thin Tessra signature accent (icon blue→violet), dense editor rhythm, and quiet local-first cues — never in pill walls, nested cards, glow, or bounce.

**Quiet Instrument is the final request-panel contract.** The previous pill/chip/card grammar is anti-reference and must not be restored. Preserve every functional contract (features, messages, keyboard, Body undo/redo, Collection Runner, WebSocket, environments, response viewer) while keeping this visual grammar. Theme presets (`default`, `minimal-cool`, `product`, `bold-color`) remain as **color/token variation only** on one shared layout, spacing scale, and hierarchy. Do not invent layout forks to preserve old preset looks.

This system encodes the shipped request panel world for agents working on Tessra UI. Claims stay within PRODUCT.md: local-first, offline-first, no login, no cloud sync, no telemetry, no paywalled core workflows. No fabricated customers, benchmarks, or brand mythology.

**Key Characteristics:**
- Strongest hierarchy always: Method → URL → Send → Request editing → Response
- One quiet status strip for meta; success primary only in the response summary
- Conditional response-first split after Send; request remains instantly editable
- VS Code theme tokens + restrained Tessra brand accent; flat surfaces, thin dividers, compact toolbars
- Compact editor density; progressive disclosure for defaults, variables, compare/mode
- Tessra identity via method colors, signature brand accent on status-strip context, and a tiny tesseract mark — not dashboard spectacle

## Colors

Restrained palette anchored to **VS Code theme tokens**. Tessra does not ship a fixed marketing palette for the request panel; it inherits the host theme and adds a small semantic + method + brand vocabulary.

### Primary
- **Host Action Blue** (`var(--vscode-button-background)` / focus via `var(--vscode-focusBorder)`): Send / Connect and other primary actions. Flat fill, no gradient streak, no success-green takeover after send.

### Brand signature
- **Tessra Accent** (`--tessra-brand` / `--tessra-accent`): icon DNA blue→violet via `color-mix` of `--vscode-charts-blue` + `--vscode-charts-purple` (preset hue/chroma may shift slightly). Use only for brand/context: status-strip Environment, tiny tesseract mark, limited selected/focus cues (request-editor tab underline, runner active row, compare active, response-emphasis edge).
- **Never** paint Send, method badges, response success/error/warning, all tabs, all borders, Settings controls, or full backgrounds with brand accent. Must stay distinct from Method PUT sky-blue and semantic green/red/amber.

### Secondary
- **Method Spectrum** (GET `#4EC94E`, POST `#E5C07B`, PUT `#61AFEF`, PATCH `#D19A66`, DELETE `#E06C75`, HEAD/OPTIONS `#ABB2BF`, WS `#4EC9B0`): durable method cue on badges and active request-tab underlines. Tint lightly; do not flood large surfaces. Not the brand accent.

### Neutral
- **Editor Surface** (`var(--vscode-editor-background)`): Primary work canvas (URL, body editors, response body).
- **Chrome Surface** (`var(--vscode-sideBar-background)` / tab header tokens): Tab bar and quiet tool strips.
- **Foreground / Muted** (`var(--vscode-foreground)` / `var(--vscode-descriptionForeground)`): Primary vs secondary text.
- **Divider** (`var(--vscode-panel-border)`): Thin separators and the request/response split — not cards.

### Semantic
- **Success** (`#4EC94E` or host charts green): **Only** the response sticky summary (and WebSocket open when that is the state). Never Send button fill, never duplicate Live Response badge + Send Again green.
- **Error / Warning / Info**: Host error/warning tokens plus restrained info blue for preflight hints inside the status strip — muted until expanded.

### Theme presets (token variation only)
Presets may shift surface tint, border softness, accent chroma, and method badge intensity. They **must not** change region topology, density, radius scale, hierarchy, or component vocabulary.

**The One Success Owner Rule.** Success green has a single primary owner: the response sticky summary. Send stays action-blue (or Connect equivalent). Meta chips never compete as co-primary status.

**The Host Token Rule.** Prefer VS Code CSS variables over hard-coded greys. Tessra-specific hex is reserved for method spectrum and a minimal semantic set that must remain legible across themes.

## Typography

**UI Font:** `var(--vscode-font-family)`  
**Editor / Mono Font:** `var(--vscode-editor-font-family)`  
**Label Font:** same UI family at 11px / semibold

**Character:** Editor-native, practical, compact. One family for chrome; mono for URL, bodies, headers, code. No display faces, no dashboard uppercase kickers with wide letter-spacing.

### Hierarchy
- **Title** (600, 13px): Tab names, sticky response status line primary segment (`200 OK`).
- **Body / UI** (400, 13px): Controls, kv rows, menus, most labels.
- **Editor** (400, 13px mono): URL, JSON/XML/raw bodies, header values, resolved URL.
- **Label** (600, 11px): Status strip segments, secondary meta (`DEFAULT HEADERS · 2 applied`). Sentence case or compact all-caps only when matching VS Code section labels — never marketing kicker tracking.

**The No Kicker Rule.** Do not use dashboard orthography (`VARIABLE USAGE`, wide `letter-spacing`, uppercase section theater). Prefer quiet labels: `Env`, `Vars`, `Defaults`, or inline contextual hints.

## Layout

Operate topology for the request panel (and sibling dense tools):

1. **Tab bar** — open requests; method color on active underline / badge only.
2. **Status strip** — one quiet row: Environment · variable resolution · default headers · preflight. Details via hover/tooltip/expand. Never outranks URL row.
3. **URL action row** — Method · URL · Send (primary). Infrequent actions in overflow (`…`).
4. **Request editor** — PARAMS / HEADERS / BODY / AUTH / SCRIPTS / SETTINGS + canvas. HEADERS: default-headers one-liner above kv-rows.
5. **Adaptive split** — user-resizable; ratio persists. Compose-focused while editing; response emphasized after Send; return request space instantly when editing again. Request must not fold into a painful Body/Header → resend path.
6. **Response sticky summary** — sole success primary (`status · time · size · type` + resolved URL as secondary text, not a pill button).
7. **Response tabs + body** — Body-first; Pin / Compare always visible on the sticky summary as compact ghost icons; Mode / metadata in overflow or compact contextual text.

**Density:** Compact, scannable editor density — not airy SaaS whitespace. Prefer `{spacing.xs}`–`{spacing.md}` inside tool rows; avoid 12–20px card padding stacks.

**Narrow panels:** Collapse secondary chrome first; keep Method/URL/Send and the active editor/response body usable.

**The Primary Path Rule.** Meta (env, variable usage, default headers, compare, mode, profile) must never visually outrank Method → URL → Send → Request editing → Response.

## Elevation & Depth

**Flat by default.** Depth comes from tonal layering (editor vs chrome), 1px dividers, and clear active/focus states — not shadows, glows, hover lift, or nested cards.

### Shadow Vocabulary
- **None at rest.** No ambient card shadows, CTA glows, or tab drop shadows.
- **Menus / dialogs only:** Host-like lightweight menu shadow if required for overlap clarity (`0 2px 8px` class), never on static panels.

**The Flat Surface Rule.** If removing a border, shadow, background, or radius does not hurt interaction or understanding, remove it.

## Shapes

- **Radius:** `2–4px` (`xs`/`sm`/`md`). Ban `999px` pills and 12–20px rounded rects for chrome.
- **Dividers:** 1px `var(--vscode-panel-border)` between major regions and the request/response split.
- **Controls:** Compact toolbars; rectangular/ghost icon buttons with visible focus rings (`var(--vscode-focusBorder)`).
- **Badges:** Small method badges with tiny radius or underline emphasis — not capsule spam.

## Components

### Buttons
- **Shape:** `{rounded.sm}` (3px), height ~28px, flat.
- **Primary (Send/Connect):** Host button colors; solid fill; no gradient, streak, glow, bounce, or success-green state takeover.
- **Secondary / Ghost:** Transparent or subtle border; used for Manage, overflow triggers, row actions.
- **Focus:** Visible focus ring; keyboard parity for tabs, primary actions, row delete, response menus.

### Status strip (signature)
- **Character:** One quiet editor-native strip — VS Code status-line weight with a Tessra signature — not a chip wall.
- **Brand cue:** Environment segment uses restrained brand accent + optional tiny tesseract glyph (same wireframe as Activity Bar / Marketplace icon). Scripts/History keep check/dot hierarchy; Defaults/Vars stay muted; risk stays warning/error semantic.
- **Default:** Muted text segments separated by middots or thin rules (`Env: staging · Vars ok · Defaults 2 · Preflight`).
- **Disclosure:** Hover/tooltip for resolution detail; expand for editable env summary / manage links.
- **Never:** Height increase, large badges, bg on all segments, pill wall, Multiple Environment appearances, Live Response co-primary, or permanent VARIABLE USAGE card. Strip must stay weaker than the URL row.

### Method + URL row
- Method control + URL field + Send own the first visual weight after tabs.
- Secondary: pin, codegen, copy-as-curl, etc. → overflow/`…` or compact icon cluster with tooltips — not equal-weight pills.

### Default headers summary
- **Default one line:** `DEFAULT HEADERS · N applied · Manage` (or localized equivalent).
- Expand reveals applied names; **kv-rows remain the primary edit canvas**.
- **Ban:** Nested DEFAULT HEADERS card inside HEADERS with applied pills + note blocks competing with `+ Add Header`.

### Variable usage
- Contextual near the field that uses `{{vars}}` (URL / body / header), and/or status-strip hover disclosure.
- **Ban:** Permanent large VARIABLE USAGE card above the compose path.

### Tabs
- Two consistent tab systems max (request editor tabs; response viewer tabs). Shared underline/active pattern; no third pill-tab dialect.
- Active state via contrast + underline (method color allowed on request tabs).

### Inputs / kv rows
- Flat input background; 2px radius; dense rows; editor font for values.
- Bulk actions sit as compact toolbar links, not inside nested cards.

### Response sticky summary
- Sole owner of success/error emphasis after a completed request.
- Resolved URL: selectable secondary text, not a large rounded “button” chip.
- Pin / Compare: always-visible compact ghost icons on the summary (no pill wall). Mode / include-metadata stay in `⋯`; non-default mode or active compare may show compact contextual text (e.g. `Normalized`, `Metadata`).

### Cards / containers
- **Default: no cards.** Sections use spacing + dividers.
- Settings/script areas: flat field groups, not `.settings-card` / `.script-card` theater with hover lift.

### Empty / loading / error / WebSocket
- **Empty:** Short instructional copy + one next action; no orbit gradients or decorative empty-state cards.
- **Loading:** Quiet progress on Send/Cancel and/or response region; no bounce badge-pop choreography.
- **Error:** Response summary + body/message; recoverable cancel paths preserved.
- **WebSocket:** Connection state in summary/status (dot + short label ok); Body tab as message composer; frame log as dense list — same flat vocabulary.

## Do's and Don'ts

### Do:
- **Do** keep Method → URL → Send → Request editing → Response as the permanent visual hierarchy.
- **Do** use one status strip with progressive disclosure for Environment, variable resolution, default headers, and preflight.
- **Do** put success emphasis only on the response sticky summary.
- **Do** keep a user-adjustable request/response split with persisted ratio; emphasize response after Send without trapping request edits.
- **Do** render DEFAULT HEADERS as a one-line summary; keep header kv-rows primary.
- **Do** treat theme presets as token/color skins on one structure.
- **Do** preserve all functional contracts while replacing visual grammar.
- **Do** prefer VS Code tokens, thin dividers, compact density, and visible focus.

### Don't:
- **Don't** polish the old pill/chip/card grammar — it is anti-reference.
- **Don't** ship `border-radius: 999px` pill spam, nested cards, big rounded rects, shadows, glows, bounce easings, or hover `translateY` lift on chrome.
- **Don't** use dashboard uppercase kickers or decorative empty-state orbits.
- **Don't** duplicate success green on Send, Live Response, and response summary.
- **Don't** bury Pin / Compare as overflow-only; Mode and other infrequent utilities stay in `⋯`.
- **Don't** invent four preset layouts or compromise Quiet Instrument to preserve old preset looks.
- **Don't** add airy SaaS whitespace that fights scannable editor density.
- **Don't** invent brand claims beyond PRODUCT.md (no fake testimonials, sync features, or cloud positioning).
