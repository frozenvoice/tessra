---
target: request panel Quiet Instrument Settings/WS cleanup
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-07T06-38-16Z
slug: src-panels-requestpanel-requestpanelhtml-ts
---
# Critique: Tessra Request Panel (Quiet Instrument Settings/WS cleanup)

**Method:** dual-agent (A: 74034e35-faab-4fe3-9c38-4a0a6623ce31 · B: 70bbb95f-e180-47be-a231-032cce080085)
**North Star:** Quiet Instrument
**Prior:** 30/40 Strong (2026-08-07T06-30-02Z)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strip/WS label strong; error/canceled may still echo beside sticky |
| 2 | Match System / Real World | 4 | API vocabulary; Settings/WS now flat instrument, not SaaS soft-card |
| 3 | User Control and Freedom | 3 | Cancel/undo/dirty strong; on-demand env editor displaces path when open |
| 4 | Consistency and Standards | 4 | Settings/WS match Headers/Scripts divider grammar |
| 5 | Error Prevention | 3 | Dirty/TLS/unresolved vars; success no longer competes on Send |
| 6 | Recognition Rather Than Recall | 3 | Meta on strip; Compare/Mode still overflow-buried |
| 7 | Flexibility and Efficiency | 3 | Keyboard/overflow good; six equal request tabs tax scan |
| 8 | Aesthetic and Minimalist Design | 4 | Soft-card/glow/uppercase chrome cleared; empty-state theater removed |
| 9 | Error Recovery | 3 | Stop/retry/dirty discard intact |
| 10 | Help and Documentation | 3 | Scripts one-liner + Guide; Settings dense once opened |
| **Total** | | **33/40** | **Good** (+3 from prior 30/40) |

## Design Specificity Verdict

**LLM assessment (A):** Authored for Tessra Quiet Instrument on primary and secondary paths. Method→URL→Send, one status strip, Headers/Scripts one-liners, flat Settings/WS divider rows, empty-state as title+copy+CTAs. Remaining least-specific bits are naming residue (`settings-card`) and six equal request-editor tabs.

**Deterministic scan (B):** detect.mjs exit 2 · **375 findings** (warning 3 · advisory 372). Top: design-system-color 294, font-size 58, radius 20 — treated as FP for VS Code webview. Non-FP QI signals: border-accent-on-rounded L44, layout-transition L700, design-system-font L277. Browser/overlay skipped (VS Code webview).

## Overall Impression

Prior P1 Settings soft-card and WS glow chrome are FIXED in source. Score moves 30→33. Biggest remaining opportunity is structural scan tax (six equal request tabs), not soft-chrome dialect.

## What's Working

1. Settings flattened to divider field groups; toggle soft-cards/streaks/hover glow removed.
2. WebSocket summary/messages match HTTP sticky/flat vocabulary; status-dot glow gone; status label sentence-case.
3. Empty-state emits title+copy+CTAs only (no card/kicker/orbit markup); residual uppercase chrome cleared while method codes stay uppercase.

## Priority Issues

### [P2] Six equal request-editor tabs
- Why: largest Operate scan tax after soft-chrome cleanup
- Fix: Params | Headers | Body | More (Auth/Scripts/Settings)
- Suggested: `$impeccable distill` → `$impeccable shape`

### [P3] Legacy visually-hidden chip/preflight hooks
- Why: duplicate meta model noise under aria-hidden
- Fix: retire once strip-native linked-focus is complete
- Suggested: `$impeccable harden`

### [P3] Class-name / cascade residue (`settings-card`, `script-card`, base+QI duplicates)
- Why: visuals match QI; names invite CSS-hide theater regressions
- Fix: rename to row/group semantics or collapse duplicate rule blocks
- Suggested: `$impeccable polish`

### [P3] Residual celebration motion (`perfect-badge` glow; unused hover-scale definitions)
- Why: off-dialect flourishes remain even if hover is overridden
- Fix: mute or gate behind prefers-reduced-motion
- Suggested: `$impeccable quieter`

## Persona Red Flags

**Alex:** Settings no longer a soft-card slog; still wants fewer top-level tabs and faster Compare/Mode.
**Jordan:** Env ownership clear; empty-state cleaner; six equal tabs still feel like a required tour.
**Sam:** focus-visible good; dual Env announce when editor open; celebration/ripple without reduced-motion remains mild risk.

## Contract Gap Verification

| Gap | Status |
|-----|--------|
| Env badge/editor above URL | **FIXED** (prior) |
| Dual Environment | **FIXED** (prior) |
| Send Again secondary 2xx | **FIXED** (prior) |
| Scripts helper theater | **FIXED** (prior) |
| UPPERCASE kickers (named compose) | **FIXED** (prior) |
| Settings soft-card / hover shadow | **FIXED** (this pass) |
| WS soft radius / glow | **FIXED** (this pass) |
| Residual uppercase chrome | **FIXED** (this pass) |
| Empty-state card markup CSS-hide | **FIXED** (this pass) |

## Minor Observations

- `settings-card` / `script-card` class names remain though CSS flat
- Product theme token-only — good
- Detector noise should not move score
- HTML Preview rounded cards are response-document chrome, out of this pass

## Questions to Consider

1. If Auth/Scripts/Settings lived under More, would Settings’ flat rows feel like Headers?
2. Is retiring visually-hidden chip hooks the last honesty pass, or still load-bearing for linked-focus?
3. Should Send Again carry a non-status hint (e.g. last duration) without success green?
