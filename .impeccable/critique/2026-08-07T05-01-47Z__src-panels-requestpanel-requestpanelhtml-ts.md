---
target: request panel
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-07T05-01-47Z
slug: src-panels-requestpanel-requestpanelhtml-ts
---
# Critique: Tessra Request Panel

**Target:** `src/panels/requestPanel/requestPanelHtml.ts`
**Mode:** Operate (VS Code Webview API client)
**Evidence:** User screenshot + source CSS/HTML; CLI detector; browser overlay unavailable (VS Code Webview)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Status is rich, but Environment / success are shown 2–3 times |
| 2 | Match System / Real World | 3 | API vocabulary is solid; `VARIABLE USAGE` / `Mode Normalized` read as product jargon |
| 3 | User Control and Freedom | 3 | Send Again / Pin / tabs work; icon-only secondary cluster hides exits |
| 4 | Consistency and Standards | 2 | Three tab systems + pill vs flat vs icon-only controls |
| 5 | Error Prevention | 2 | `Headers: 0` vs DEFAULT HEADERS chips creates false conflict |
| 6 | Recognition Rather Than Recall | 2 | Variable usage helps; chip wall + unlabeled icons force scanning |
| 7 | Flexibility and Efficiency | 3 | Shortcuts/linked chips exist, but chrome slows the default path |
| 8 | Aesthetic and Minimalist Design | 1 | Meta chrome competes equally with compose/inspect work |
| 9 | Error Recovery | 3 | Dirty confirm / cancel paths exist; Compare disabled state is opaque |
| 10 | Help and Documentation | 2 | Help lives as always-on banners instead of progressive disclosure |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** The request panel is half Tessra, half interchangeable AI-dashboard chrome. Product-true bones remain: method + `{{baseUrl}}` URL, PARAMS/HEADERS/BODY/AUTH/SCRIPTS/SETTINGS, split response with `200 OK · 354 ms · 2.7 KB · XML`, resolved URL, and a code-like body. That matches PRODUCT.md’s editor-native API worker ritual.

The surface language fights that identity. `request-status-chip`, `preflight-pill`, `var-usage-card`, `default-headers-banner`, and `compare-chip` all speak in `border-radius:999px` pill dialect. `.settings-card` / `.script-card` / `.empty-state` add 18–20px radius, gradients, hover lift, and shadow. Logo swapped, this could be another AI API-tool webview. It does not yet feel authored as a VS Code-native operate surface.

**Deterministic scan:** `detect.mjs` exit 2, **8 findings** on `requestPanelHtml.ts`:
- `border-accent-on-rounded` ×1 on `.req-tab` — **false positive** (active-tab underline, not decorative card border)
- `bounce-easing` ×6 on send/stop/status/response motion (`btn-bounce`, `send-click`, `stop-slam`, `badge-pop`, `res-slam`)
- `layout-transition` ×1 on `.runner-bar-fill` width transition

Detector did **not** emit pill/nested-card rules for this TS-embedded CSS pass. Screenshot + source review supply that density evidence instead.

**Visual overlays:** None. VS Code Webview has no injectable localhost HTML URL for `detect.js`. Screenshot is the visual fallback.

## Overall Impression

Functionally this is a capable API client. Visually it over-reports status. The biggest opportunity is not new features — it is reclaiming hierarchy so Method → URL → Send → Response Body own the viewport, and meta (environment, defaults, compare, variable usage) becomes progressive, not perpetual.

## What's Working

1. **Send → status → resolved URL → Body** remains a readable Operate loop; `200 OK` / time / size / XML summary is immediately legible.
2. **`{{baseUrl}}` VARIABLE USAGE** and **DEFAULT HEADERS (User-Agent / Accept + Manage)** make local/env substitution real, not decorative.
3. **Sidebar Collections / Environments / History** plus method colors still carry the strongest VS Code-native rhythm.

## Priority Issues

### [P0] Meta band before the URL taxes every send
- **What:** Topline status chips + preflight pills + VARIABLE USAGE form 2–3 meta strips above Method/URL/Send. Environment appears twice; Live Response and Send Again both own success; Default Headers chip duplicates the DEFAULT HEADERS card below.
- **Why it matters:** Primary job (compose / resend) pays a scan tax before every action. Violates PRODUCT principle “Editor-native speed … beat dashboard spectacle.”
- **Fix:** One status line. Success owned by response sticky summary (or Send label), not both. VARIABLE USAGE collapsed/hover by default.
- **Suggested command:** `$impeccable distill` → `$impeccable quieter`

### [P0] DEFAULT HEADERS nested card buries header editing
- **What:** Inside HEADERS, a rounded banner holds title copy, note, APPLIED pills (User-Agent / Accept), and Manage — then `+ Add Header` / Bulk Paste sit outside another nesting level.
- **Why it matters:** Nested containers push the actual kv-row editor down. Header work feels like navigating a dashboard card stack.
- **Fix:** One-line compact summary; kv-rows as the primary canvas.
- **Suggested command:** `$impeccable layout`

### [P1] Success green has three primaries
- **What:** Send Again success gradient/glow, Live Response green dot, and response `200 OK` compete as primary.
- **Why it matters:** Color hierarchy collapses; XML body becomes tertiary.
- **Fix:** Send = action only; status = single owner in response summary.
- **Suggested command:** `$impeccable colorize` (with `$impeccable quieter`)

### [P1] Compare / Mode chips are always-on chrome
- **What:** Compare Normalized (disabled), Mode Normalized, Include metadata summary sit in the same band as BODY / COOKIES / HEADERS / TESTS.
- **Why it matters:** Compare is intermittent; always-on chips steal Body-first attention.
- **Fix:** Move compare/mode into overflow/`…`; emphasize only when ready.
- **Suggested command:** `$impeccable distill`

### [P2] Dashboard orthography vs VS Code chrome
- **What:** 999px pills, 12–20px cards, shadows, hover lift, empty-state orbits, bounce easings (detector confirms motion slop).
- **Why it matters:** Webview feels alien next to TreeView; PRODUCT.md asks for editor-native speed.
- **Fix:** Converge radius/shadow/motion to VS Code control scale; retire marketing empty-state cards.
- **Suggested command:** `$impeccable quieter`

## Persona Red Flags

**Alex (Power User):** Linked-focus chips and Bulk Paste help, but resend still requires scanning the meta band; Compare/Mode chips interrupt Body reading. Keyboard-send → read-body rhythm breaks.

**Jordan (First-Timer):** `Headers: 0` while DEFAULT HEADERS shows User-Agent/Accept reads as contradiction. Live Response / Mode Normalized / Include metadata summary / VARIABLE USAGE land without scaffolding. Icon-only secondary actions invite guess-clicks.

**Tessra API Worker (from PRODUCT.md):** Promised local, explicit-network, editor speed — screenshot behaves like a status-badge dashboard. Variable/default-header/profile facts are needed, but always-on exhibition slows the request/response loop.

## Requested Axes

| Axis | Verdict |
|------|---------|
| Visual hierarchy | Send green + Live Response + response 200 OK are co-primary; XML body is ~3rd |
| Information density | Meta overdense; compose/response code density is fine |
| Spacing rhythm | Dual rhythm: tight kv-rows vs 12–15px card padding |
| Typography | VS Code fonts help; uppercase kickers (`VARIABLE USAGE`, tab letter-spacing) feel dashboard |
| Color hierarchy | Success green overused; link blue + info pills compete |
| Request / response separation | Divider exists; meta chrome blurs the boundary |
| Tabs / controls consistency | Three tab systems; pill / flat / icon-only mix |
| VS Code native feel | Sidebar native; webview rounded/shadowed/alien |
| AI dashboard/card patterns | Strong: 999px pills, nested cards, gradient CTA, empty-state orbits |
| Unnecessary borders / nested containers | DEFAULT HEADERS-in-HEADERS, var-usage card, compare chips |
| Speed blockers | Duplicate Environment, Headers:0 vs default chips, always-on Compare, triple success status |

## Cognitive Load

- Checklist failures (7/8): Single focus; Chunking; Grouping; Visual hierarchy; One thing at a time; Minimal choices; Progressive disclosure
- Working-memory failures: request tabs (6), preflight pills (6), method dropdown (7), topline chip cluster (5+), URL secondary icons (~5), response action + compare chips

## Emotional Journey

Open → familiar API client relief → chip/VARIABLE USAGE/DEFAULT HEADERS scatter attention → Send Again green rewards → trying to read XML when Compare/Mode chips steal the ending. Peak is send success; End is meta UI, not the response body.

## Minor Observations

- Divider grip (3 dots + glow) is decorative for a resize handle
- Request uppercase tabs vs response tab styling mismatch
- Resolved URL as radius-12 pill looks like a button
- Empty-state orbit/gradient cards (CSS) feel template-like on first run
- `btn-send` streak/glow/hover translateY is heavy for Operate tools
- Bounce easings on send/stop/status/response (detector) add motion noise

## Questions to Consider

1. Should Environment / Default Headers / Profile be always-visible chips, or a collapsed status line that expands on demand?
2. Who owns success state — Send Again, or the response summary — if not both?
3. Should DEFAULT HEADERS live as a HEADERS-tab card, or a one-line hint with Manage elsewhere?
4. Ready to hide Compare / Mode Normalized behind overflow for a Body-first response?

## Run Notes (assessment)

- Target slug: `src-panels-requestpanel-requestpanelhtml-ts`
- Ignore list: none (`.impeccable/critique/ignore.md` absent)
- Assessment independence: dual-agent A then B synthesized in parent
- CLI detector: exit 2, 8 findings (1 FP)
- Browser visibility / overlay: skipped — VS Code Webview, no live HTML URL
- Live server: not started
