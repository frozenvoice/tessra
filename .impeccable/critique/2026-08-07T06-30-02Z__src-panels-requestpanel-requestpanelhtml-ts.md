---
target: request panel Quiet Instrument contract alignment
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-07T06-30-02Z
slug: src-panels-requestpanel-requestpanelhtml-ts
---
# Critique: Tessra Request Panel (Quiet Instrument contract alignment)

**Method:** dual-agent (A: 301e558c-e05b-437a-a11e-c5a2e5c0e36a · B: 313ad0d8-d2e2-42e8-9f20-51175ac142c2)
**North Star:** Quiet Instrument
**Prior:** 26/40 Acceptable (2026-08-07T06-17-09Z)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 2xx no longer on Send; error/canceled/WS may still echo beside sticky |
| 2 | Match System / Real World | 3 | API vocabulary solid; Settings soft-card dialect still SaaS |
| 3 | User Control and Freedom | 3 | Cancel/undo/dirty strong; on-demand env editor shoves path when open |
| 4 | Consistency and Standards | 3 | Headers/Scripts help aligned; Settings cards diverge |
| 5 | Error Prevention | 3 | Dirty/TLS/unresolved vars; success no longer competes on Send |
| 6 | Recognition Rather Than Recall | 3 | Meta on strip; Compare/Mode buried |
| 7 | Flexibility and Efficiency | 3 | Keyboard/overflow good; six request tabs tax scan |
| 8 | Aesthetic and Minimalist Design | 3 | Contract gaps cleared; Settings/WS soft chrome remains |
| 9 | Error Recovery | 3 | Stop/retry/dirty discard intact |
| 10 | Help and Documentation | 3 | Scripts one-liner + Guide |
| **Total** | | **30/40** | **Strong** (+4 from prior 26/40) |

## Design Specificity Verdict

**LLM assessment (A):** Authored for Tessra Quiet Instrument on the primary path. Method→URL→Send, one status strip, Headers/Scripts one-liners, sole success on sticky summary. Settings/WS soft-card pockets still partially interchangeable.

**Deterministic scan (B):** detect.mjs exit 2 · **403 findings** (quality 402 · slop 1). Warnings 3: border-accent-on-rounded L44, layout-transition L706, design-system-font L275. Advisories dominated by design-system-color/font-size/radius — treated as FP for VS Code webview. QI bans not emitted by CLI; source review authoritative for contract gaps. Browser/overlay skipped (VS Code webview).

## Overall Impression

Five known contract gaps are FIXED in source. Score moves Acceptable→Strong. Biggest remaining opportunity is flattening Settings/WebSocket soft-card residue — not reopening Env/Send/Scripts decisions.

## What's Working

1. Status strip sole always-on Environment/meta owner; env editor on-demand.
2. One Success Owner: Send action-blue; sticky owns statusText on success.
3. Scripts help distilled to one-liner + Open Guide; DEFAULT HEADERS / compose kickers sentence-case.

## Priority Issues

### [P1] Settings soft-card dialect
- Why: anti-reference card/shadow theater on densest secondary surface
- Fix: flatten settings-toggle/card to divider + fields
- Suggested: `$impeccable quieter` → `$impeccable distill`

### [P1] WebSocket soft rounded / glow chrome
- Why: fights flat instrument when WS is the job
- Fix: match HTTP sticky/flat vocabulary
- Suggested: `$impeccable quieter` → `$impeccable layout`

### [P2] Residual uppercase outside named kickers
- Why: WS/response/runner/formdata labels still dashboard-toned
- Fix: sentence-case chrome labels; keep method codes as data
- Suggested: `$impeccable typeset`

### [P2] Empty-state card markup CSS-hidden
- Why: cascade regression can revive theater
- Fix: stop emitting card grid markup
- Suggested: `$impeccable distill`

### [P3] Legacy visually-hidden chip/preflight hooks
- Why: duplicate meta model noise
- Fix: retire once strip-native linked-focus is complete
- Suggested: `$impeccable harden`

## Persona Red Flags

**Alex:** send→inspect faster; Settings card wall still slows deep config.
**Jordan:** Env ownership clear; six equal tabs still look like a tour wall.
**Sam:** focus-visible good; dual Env announce when editor open; response action scale hover motion-hostile.

## Contract Gap Verification

| Gap | Status |
|-----|--------|
| Env badge/editor above URL | **FIXED** |
| Dual Environment | **FIXED** |
| Send Again secondary 2xx | **FIXED** |
| Scripts helper theater | **FIXED** |
| UPPERCASE kickers (named compose) | **FIXED** |

## Minor Observations

- .script-card class name remains though CSS flat
- Product theme token-only — good
- Detector noise should not move score

## Questions to Consider

1. If Settings looked like Headers (rows + one-liners), would soft toggles be missed?
2. Should WebSocket inherit HTTP sticky-summary grammar?
3. Collapse request editor tabs to Params | Headers | Body | More?
4. Should Send Again carry a non-status hint (e.g. last duration) without success green?
