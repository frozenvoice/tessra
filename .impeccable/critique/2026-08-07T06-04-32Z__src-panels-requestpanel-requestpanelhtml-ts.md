---
target: request panel Quiet Instrument
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-07T06-04-32Z
slug: src-panels-requestpanel-requestpanelhtml-ts
---
Method: dual-agent (A: 09bdbb1f-9e1f-4d2e-a2c5-b1f4452a247f · B: 2c8d5adc-b1da-43d0-9b5b-785d96cdc96f)

# Critique: Tessra Request Panel (Quiet Instrument 이후)

**Target:** `src/panels/requestPanel/requestPanelHtml.ts`  
**Mode:** Operate (VS Code Webview API client)  
**Evidence:** Assessment A (design review) + Assessment B (CLI detector / source residue); browser overlay unavailable (VS Code Webview)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Send Again 보조 `200 OK` + response sticky가 이중 상태 |
| 2 | Match System / Real World | 3 | API 어휘는 맞음; Scripts helper / UPPERCASE kicker는 대시보드 톤 |
| 3 | User Control and Freedom | 3 | Env 배지가 URL 위 프라임 공간을 항상 점유 |
| 4 | Consistency and Standards | 2 | Headers는 조용한 one-liner, Scripts는 helper-card 극장; Env 이중 표기 |
| 5 | Error Prevention | 3 | 가드레일은 대체로 양호; 상태 중복이 해석 오류 유발 |
| 6 | Recognition Rather Than Recall | 2 | meta가 strip / 상단 배지 / Scripts로 분할되어 위치 기억 부담 |
| 7 | Flexibility and Efficiency | 3 | 파워 패스는 있으나 Primary Path를 meta가 방해 |
| 8 | Aesthetic and Minimalist Design | 2 | Primary Path 깨짐; Scripts 카드 벽; Env 배지 과시 |
| 9 | Error Recovery | 3 | dirty confirm / cancel 등 회복 경로 유지 |
| 10 | Help and Documentation | 2 | Scripts 도움이 항상 펼쳐진 helper-card / chip / stepper로 과잉 |
| **Total** | | **26/40** | **Acceptable** (+2 from prior 24/40) |

## Design Specificity Verdict

**Partial Quiet Instrument.** Compose 경로는 개선됐다: flat chrome, status strip, DEFAULT HEADERS one-liner, response가 success green을 소유하고 empty는 flat, Send fill은 blue를 유지한다. 하지만 계약은 아직 불완전하다 — Env 배지가 URL 위에서 compose를 압도하고, Env가 strip에 중복되며, Scripts는 helper-card 극장으로 남았다. 로고만 바꾸면 다른 API 도구 webview로 읽히는 구간이 여전히 Scripts와 Env 상단에 있다.

**LLM assessment (A):** Quiet Instrument 방향으로 한 걸음 전진. Status strip과 Headers one-liner, One Success Owner(응답 green / Send blue)는 Tessra Operate 정체성에 가깝다. 잔여 대시보드 언어는 Env badge(radius 8px), Scripts `script-helper-card` / chips / stepper, UPPERCASE kicker(`DEFAULT HEADERS` / `SCRIPT HELPERS`)다. Primary Path Rule이 Env·Scripts 때문에 깨진다.

**Deterministic scan (B):** `detect.mjs` exit 2, **finding_count=446** (warnings 3, advisories 443). Ignore file 없음.  
Warnings:
- `border-accent-on-rounded` ×1 — `.req-tab` — **FALSE POSITIVE** (active-tab underline)
- `layout-transition` ×1 — `.runner-bar-fill` width
- `design-system-font` ×1 — SFMono preview sandbox — **FALSE POSITIVE** (chrome/preview)

Advisories: `design-system-color` ×343 (hljs + fallbacks 대부분 FP), `font-size` ×65, `radius` ×35. Pill/bounce/999 rules: **0 hits** (이전 bounce/999 잔재 제거는 A와 일치).

**SOURCE_RESIDUE (B → A 교차검증):** no 999/bounce; `script-helper-card` 잔존; env badge radius 8px; Send fill not green; orbit/streak neutralized; Send Again secondary status는 스크린샷으로 확인. Advisory noise로 점수 변경하지 않음 — 26/40 유지.

**Visual overlays:** 없음. VS Code Webview라 localhost HTML injection / browser detect 스킵. 스크린샷 + 소스가 visual fallback.

## Overall Impression

Quiet Instrument 리디자인은 **성공 색·Headers·flat chrome**에서 이겼고, **Env 위계·Scripts 도움 극장·이중 상태**에서 아직 진다. 가장 큰 기회는 새 기능이 아니라 Primary Path 회복: Method → URL → Send → Response가 Env 배지와 Scripts 카드 벽보다 항상 위에 있어야 한다. +2점은 의미 있는 전진이지만 Acceptable 밴드에 머문다.

## What's Working

1. **Status strip** — Environment · vars · defaults · preflight를 한 줄로 모으려는 의도가 읽힌다. 이전 topline chip 산개보다 Quiet Instrument에 가깝다.
2. **DEFAULT HEADERS one-liner** — nested banner/card 극장에서 빠져 편집 캔버스가 올라왔다. Headers quiet 패턴은 계약에 부합.
3. **One Success Owner (부분 성공)** — response가 success green을 소유하고, empty는 flat, Send fill은 blue. orbit/streak/bounce/999 제거와 함께 compose 톤이 정리됐다.

## Priority Issues

### [P0] Env editor/badge가 URL 위에서 compose를 압도
- **What:** Environment 배지/에디터가 Method·URL 행보다 위에 있어 프라임 공간을 점유하고, status strip에도 Env가 다시 나타난다 (dual Environment).
- **Why it matters:** Primary Path Rule·“Never: Multiple Environment appearances”·status strip은 URL을 앞서지 않는다는 계약을 동시에 위반. 매 전송마다 스캔 세금.
- **Fix:** Env는 strip-only로 내리거나, 상단을 plain demoted text로 강등. 배지/ pill 언어 제거. 한 곳만 소유.
- **Suggested command:** `$impeccable layout` → `$impeccable quieter`

### [P1] Send Again 보조 `200 OK`가 response와 이중 상태
- **What:** Send Again 근처에 secondary `200 OK`(또는 동급 상태)가 남고, response sticky도 상태를 소유한다.
- **Why it matters:** One Success Owner Rule 위반. Visibility는 풍부해 보이지만 신뢰 가능한 단일 소스가 없다.
- **Fix:** 보조 상태 제거, 또는 시간만 남기기. `200 OK`는 response sticky 단독.
- **Suggested command:** `$impeccable clarify` → `$impeccable quieter`

### [P1] Scripts helper cards / chips / stepper 극장
- **What:** Headers는 one-liner로 조용해졌는데 Scripts는 `script-helper-card`, chips, stepper로 벽처럼 펼쳐져 있다 (Consistency 붕괴 + Help overbuild).
- **Why it matters:** Aesthetic/Minimalist·Help 점수를 끌어내리고, Scripts 탭이 도움말 대시보드처럼 느껴진다. 실제 스크립트 편집이 2순위.
- **Fix:** collapsed one-liner, flat checklist, 또는 Guide-only로 증류. 카드/칩/스테퍼 제거.
- **Suggested command:** `$impeccable distill` → `$impeccable quieter`

### [P2] UPPERCASE kickers (`DEFAULT HEADERS` / `SCRIPT HELPERS`)
- **What:** No Kicker Rule을 위반하는 대시보드 orthography가 섹션 라벨에 남음.
- **Why it matters:** VS Code 네이티브 리듬을 깨고 Headers/Scripts quiet 의도를 상쇄.
- **Fix:** `Defaults`, `Script helpers` 등 조용한 sentence/case 라벨.
- **Suggested command:** `$impeccable typeset` → `$impeccable quieter`

### [P2] Meta progressive disclosure 미완 / leftover scale hover
- **What:** meta가 아직 항상 노출에 가깝고, scale hover 잔여가 polish를 해친다.
- **Why it matters:** Progressive disclosure 실패가 cognitive load를 높임; Operate 도구에 불필요한 motion.
- **Fix:** hover/expand로 세부 숨김; hover scale 제거.
- **Suggested command:** `$impeccable polish`

## Persona Red Flags

**Alex (Power User):** Send→Body 리듬은 나아졌지만 Env 배지와 Scripts 카드 벽을 매번 스캔해야 함. 이중 `200 OK`는 “어디가 진짜 상태인가”를 강제. 불필요한 확인 비용.

**Jordan (First-Timer):** Scripts helper theater는 친절해 보이지만 편집보다 가이드가 먼저 보여 다음 행동이 흐려짐. Env가 두 곳에 있으면 “어느 걸 바꿔야 하지?”로 멈춤.

**Sam (Accessibility):** 이중 상태 발표(Send Again + response)는 스크린 리더에 중복 피드백. Env 배지 vs strip 중복도 같은 정보 두 번. Scripts 카드 스택은 탭 순서를 길게 만듦.

**Tessra API Worker (PRODUCT/DESIGN):** Quiet Instrument·Primary Path·One Success Owner를 약속했는데 Env 상단 배지와 Scripts 카드가 에디터-네이티브 속도를 깎는다.

## Cognitive Load

**Checklist failures: 6/8 — high (critical fix needed)**

실패한 항목(A 기준):
- Single focus — Env·Scripts·이중 상태가 compose/response와 경쟁
- Visual hierarchy — Env badge가 URL 위
- One thing at a time — status가 Send Again + response에 분할
- Progressive disclosure — Scripts help / meta 상시 노출
- Grouping / Consistency — Headers quiet vs Scripts carded
- Recognition — meta 위치 분할

통과에 가까운 항목: Chunking(개선된 strip/one-liner), Minimal choices(메소드/탭은 도메인 고유).

Working-memory 압력: Env 이중 표기, Scripts helper 옵션 벽, dual 200 OK.

## Emotional Journey

열림 → flat chrome / status strip에 안도 → URL 위 Env 배지에서 한 번 걸림 → Headers one-liner에 다시 신뢰 → Scripts 탭에서 도움말 극장으로 감정 골 → Send 후 response green은 맞지만 Send Again 보조 상태가 피크를 분산. Peak는 response body여야 하는데 End가 Scripts/Env meta로 새는 느낌.

## Contract Gaps (Quiet Instrument)

| Contract | Status |
|----------|--------|
| Primary Path Rule | **Broken** — Env above URL |
| Dual Environment | **Broken** — badge + strip |
| One Success Owner | **Partial** — response owns green / Send blue OK; Send Again secondary 200 OK remains |
| Scripts cards | **Broken** — `script-helper-card` theater |
| No Kicker Rule | **Broken** — `DEFAULT HEADERS` / `SCRIPT HELPERS` |
| Pill/badge Env | **Broken** — env badge radius 8px (999는 제거됨) |

## Detector Summary

| Signal | Result |
|--------|--------|
| CLI exit | 2 |
| Findings | 446 (3 warnings, 443 advisories) |
| Ignore | absent |
| Pill/bounce/999 | **0** — Quiet Instrument motion cleanup corroborated |
| Browser detect | **Skipped** (VS Code webview; no injectable page) |

**False positives (명시):**
1. `border-accent-on-rounded` on `.req-tab` — active underline
2. `design-system-font` SFMono sandbox — preview chrome
3. 대량 `design-system-color` / 다수 `font-size`·`radius` advisories — hljs·fallback·임베디드 CSS 노이즈; **점수에 반영하지 않음**

**Real corroboration:** `script-helper-card` 잔존, env badge 8px, layout-transition on runner bar, Send not green, bounce/999 부재.

## Minor Observations

- Meta progressive disclosure가 strip까지는 왔으나 상단 Env 에디터와 불완전 공존
- Leftover scale hover — Operate에 불필요
- Headers quiet vs Scripts loud 패턴 불일치가 학습 비용
- Response empty flat 처리는 유지할 것

## Questions to Consider

1. Environment는 (A) strip-only / (B) 상단 plain demoted text / (C) 배지 유지 중 어디가 의도인가?
2. Send Again 보조 상태는 (A) 제거 / (B) 시간만 / (C) `200 OK` 유지?
3. Scripts 도움은 (A) collapsed one-liner / (B) flat checklist / (C) Guide only?
