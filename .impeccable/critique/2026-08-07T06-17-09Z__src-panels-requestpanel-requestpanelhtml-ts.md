---
target: Tessra Request Panel
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-07T06-17-09Z
slug: src-panels-requestpanel-requestpanelhtml-ts
---
Method: dual-agent (A: d2fd39c8-38c1-4d72-9cdf-1a65800ae453 · B: 34fb735c-84c7-497d-9f29-f821962b5d3f)

# Design Critique — Tessra Request Panel

**Target:** `src/panels/requestPanel/requestPanelHtml.ts`  
**Mode:** Operate (VS Code Webview)  
**North Star:** Quiet Instrument  
**Prior:** 26/40 Acceptable (2026-08-07T06-04-32Z); earlier 24/40 (2026-08-07T05-01-47Z)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Send Again secondary가 `200 OK`를 응답 sticky와 동시에 표시 |
| 2 | Match System / Real World | 3 | API 어휘는 자연스러움; Scripts helper·UPPERCASE 킥커는 대시보드 톤 |
| 3 | User Control and Freedom | 3 | Cancel/undo/dirty confirm 양호; Env가 Primary Path를 상시 점유 |
| 4 | Consistency and Standards | 2 | Headers one-liner vs Scripts helper-card 극장; 이중 Environment |
| 5 | Error Prevention | 3 | Dirty confirm·TLS·미해결 변수 strip 있음; 이중 상태 표기로 오독 위험 |
| 6 | Recognition Rather Than Recall | 2 | Meta가 `#envEditor` / status strip / Scripts shell에 분산 |
| 7 | Flexibility and Efficiency | 3 | Enter·Ctrl/Cmd+Enter·overflow 양호; Primary Path 스캔 비용 잔존 |
| 8 | Aesthetic and Minimalist Design | 2 | Env-above-URL, Scripts cards/chips/stepper, badge radius — north star 미달 |
| 9 | Error Recovery | 3 | Stop·retry·dirty discard·canceled-with-response 경로 유지 |
| 10 | Help and Documentation | 2 | Scripts help가 상시 극장형; progressive editor-native help 아님 |
| **Total** | | **26/40** | **Acceptable** |

---

## Design Specificity Verdict

**LLM assessment:** Quiet Instrument 방향은 부분적으로만 인코딩됨. Status strip, DEFAULT HEADERS one-liner, Send fill의 action-blue 유지, response sticky의 success green 독점(의도), VARIABLE USAGE compose 카드 강등, empty orbit 중화는 Tessra Operate 문법에 가깝다. 그러나 `#envEditor`/`.env-badge`가 Method→URL→Send 위에 있고 strip과 Env가 중복되며, Scripts는 `.script-helper-shell` / chips / 4-stage stepper / helper-card 극장을 유지하고, CSS `text-transform:uppercase`로 DEFAULT HEADERS / SCRIPT HELPERS 킥커가 살아 있다. 로고만 바꾸면 다른 API 클라이언트 webview로 읽히는 구간이 남아 **authored direction, incomplete encoding**.

**Deterministic scan:** `detect.mjs --json` exit 2, **446 findings** (quality 445 · slop 1). 규칙: `design-system-color` 343, `design-system-font-size` 65, `design-system-radius` 35, warnings 3 (`border-accent-on-rounded` `.req-tab` L44, `layout-transition` `.runner-bar-fill` L746, `design-system-font` SFMono L275). Quiet Instrument 금지(pills / uppercase kickers / bounce / nested cards)는 detector가 거의 못 잡음 — **점수에 반영하지 않음**. 실질 계약 위반은 Assessment A 소스 검증이 권위.

**False positives / noise:** hljs·JSON tree 색, VS Code token fallback hex, method brand colors, dense 10–12px UI, SFMono preview, progress bar width transition. design-system-* advisory 대부분 = DESIGN.md 마케팅 토큰 vs webview 호스트 불일치.

**Visual overlays:** 없음. VS Code webview에 안정적 localhost 뷰가 없어 browser injection/live-server 스킵. Fallback = CLI detector + source.

---

## Overall Impression

Quiet Instrument 부분 리디자인의 이득(Headers one-liner, strip, Send blue, sticky success 의도)은 이미 26점에 반영되어 있다. **알려진 계약 갭 5개는 소스상 모두 STILL BROKEN**이라 점수를 올리지 않는다. 가장 큰 기회: Env를 strip 단일 소유로 내리고, Send secondary에서 status를 제거하며, Scripts help를 Headers와 같은 one-liner/Guide 수준으로 distill.

---

## What's Working

1. **Status strip topology** — Env · Vars · Defaults · Profile 세그먼트, strip 아래 inline expand. Surface brief region 2와 정합.
2. **DEFAULT HEADERS one-liner** — `.default-headers-oneline` · Manage; kv-row가 주 편집면. Nested Headers card 금지는 대체로 준수.
3. **Success owner 부분 준수** — Send fill이 success-green으로 점령되지 않음; VARIABLE USAGE 영구 compose 카드 강등; empty orbit/`send-streak` 중화.

---

## Priority Issues

### [P0] Env editor/badge가 Method → URL → Send 위에 잔존
- **Why:** Primary Path와 “meta는 status strip only” 계약을 깨뜨림. 매 전송마다 스캔 세금.
- **Evidence:** DOM `#envEditor` → `#mainContent`; paint에 envLine + url-bar.
- **Fix:** `#envEditor`를 URL 위에서 제거/강등. Env는 strip expand만.
- **Suggested command:** `$impeccable layout` → `$impeccable quieter`

### [P1] Send Again secondary가 `200 OK` 표시
- **Why:** One Success Owner — success는 response sticky만. 이중 표기는 신뢰 분열.
- **Evidence:** `renderPrimaryActionButton` success 시 `secondary = status + statusText`.
- **Fix:** success 시 secondary 비우기 또는 non-status 힌트만.
- **Suggested command:** `$impeccable clarify` → `$impeccable quieter`

### [P1] Scripts helper-card / chips / stepper 극장
- **Why:** Headers one-liner와 일관성 붕괴; Aesthetic·Help 점수 저하.
- **Evidence:** `renderScriptHelpers` — shell, chip, stepper(4), helper-card; collapsed에도 chip row.
- **Fix:** Collapsed one-liner 또는 Guide 전용; cards/chips/stepper 제거.
- **Suggested command:** `$impeccable distill` → `$impeccable quieter`

### [P2] UPPERCASE kickers (DEFAULT HEADERS / SCRIPT HELPERS)
- **Why:** No Kicker Rule — i18n은 sentence case여도 CSS uppercase가 대시보드 톤.
- **Evidence:** `.default-headers-banner-title`, `.script-helper-label`에 `text-transform:uppercase`.
- **Fix:** transform 제거; quiet label.
- **Suggested command:** `$impeccable typeset` → `$impeccable quieter`

### [P2] Dual Environment (badge + strip)
- **Why:** DESIGN “Never: Multiple Environment appearances.”
- **Evidence:** `.env-badge` / `#envEditorName` + strip `Environment: …`.
- **Fix:** strip 단일 소유; always-visible badge row 삭제.
- **Suggested command:** `$impeccable layout`

---

## Cognitive Load

**Checklist failures: 6/8 → high**  
Fail: Single focus, Grouping, Visual hierarchy, One thing at a time, Minimal choices, Working memory, Progressive disclosure (실질 다수 실패; Chunking만 명확 PASS).  
>4 options: request editor tabs 6; Scripts expanded = stepper+cards+chips+insert wall.

---

## Persona Red Flags

**Alex (Power User):** Enter-to-send·overflow는 좋으나 Env badge + Scripts 극장·이중 `200 OK`가 send→inspect 루프를 늦춤.

**Jordan (First-Timer):** badge vs strip Env 소유권 혼란; Scripts 탭이 textarea보다 help 대시보드를 먼저 보여줌.

**Sam (Accessibility):** Env·success 이중 고지; Scripts focus order가 shell→chips→stages→cards→textarea로 길어짐. `:focus-visible` 자체는 양호.

---

## Contract Gap Verification

| Gap | Status |
|-----|--------|
| Env badge/editor above URL | **STILL BROKEN** |
| Dual Environment | **STILL BROKEN** |
| Send Again secondary `200 OK` | **STILL BROKEN** |
| Scripts helper theater | **STILL BROKEN** |
| UPPERCASE kickers | **STILL BROKEN** (visual via CSS) |
| DEFAULT HEADERS nested card | FIXED / mostly |
| Permanent VARIABLE USAGE card | FIXED |
| Send fill success-green | FIXED |

---

## Minor Observations

- `.env-badge` radius 8px — soft badge 잔존.
- Settings `.settings-card` + uppercase group titles.
- Empty-state card payload는 CSS `display:none` — CSS 회귀 시 재출몰 위험.
- Detector: `.req-tab` accent-on-rounded, empty/preview large radius advisories — soft; scores unchanged by hljs noise.

---

## Questions to Consider

1. Env가 한 번만 나타날 수 있다면, 왜 `#envEditor`가 tabs 직후 첫 픽셀을 차지하고 strip도 Env를 말하는가?
2. Response sticky가 sole success owner라면 Send Again의 `200 OK` secondary는 어떤 일을 sticky가 못 하는가?
3. Headers는 one-liner를 얻었는데 Scripts는 왜 4-stage stepper + card grid를 textarea 앞에 두는가?
4. Tabs 직후 viewport가 Method · URL · Send만이면 Quiet Instrument에 더 가까워지지 않는가?

---

## Detector Summary (Assessment B)

- Exit 2 · 446 findings · ignore.md 없음
- Warnings 3; advisories 443 (대부분 design-system-*)
- Browser/overlay/live-server: skipped (VS Code webview)
- FP: hljs, VS Code fallbacks, method colors — **do not change score**
- QI bans mostly undetected by CLI (source review authoritative)
