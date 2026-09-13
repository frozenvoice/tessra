# Tessra — 프로젝트 규칙

## 프로젝트 개요
Tessra는 VS Code 안에서 동작하는 offline-first API 클라이언트 확장이다.

핵심 목표는 Thunder Client 스타일의 빠른 요청 워크플로를 로그인, 클라우드 의존성, 유료 제한 없이 로컬 환경에서 제공하는 것이다. 모든 데이터는 로컬에 저장되고, 네트워크 호출은 사용자가 명시적으로 보낸 API 요청에서만 발생한다.

## 핵심 원칙
- 외부 서비스 의존 금지: 텔레메트리, 업데이트 체크, 인증 서버 호출 없음
- 로컬 우선 저장: VS Code `globalStorage` 아래 JSON 파일 사용, 필요 시 워크스페이스 프로필로 분리
- 의존성 최소화: 런타임은 `esbuild` 번들 결과와 Node.js 내장 모듈 중심
- 보안 기본값 유지: HTTPS 인증서 검증은 기본적으로 활성화
- 문서 동기화 필수: 사용자에게 보이는 기능이나 설정을 바꾸면 `README.md`, `README.ko.md`, `AGENTS.md`, `CLAUDE.md`를 함께 검토하고 필요한 내용을 반영한다

## 기술 스택
- TypeScript (`strict` mode)
- VS Code Extension API (`^1.74.0`)
- Webview 기반 요청 패널 UI
- TreeView 기반 사이드바 (`Collections`, `Environments`, `History`)
- Node.js 내장 `http` / `https` / `net` / `tls`
- esbuild
- vsce
- Mocha

## 코딩 규칙
- 파일명은 camelCase, 클래스/프로바이더는 PascalCase
- 인터페이스 이름에 `I` 접두사 사용 금지
- 사용자에게 보이는 실패는 `try/catch` 후 `showErrorMessage` 또는 webview 메시지로 처리
- 비동기는 `async/await` 우선
- Webview ↔ Extension 통신은 `postMessage` 기반으로 유지
- Webview에서 외부 리소스 로딩 금지
- 아이콘은 VS Code 내장 codicon 또는 인라인 SVG 사용
- 코드 주석과 커밋 메시지는 한국어를 기본으로 한다
- 요청 패널 시각 계약은 `DESIGN.md` Quiet Instrument를 따른다 (pill wall / soft-card / Send success-green 재도입 금지)

## 현재 프로젝트 구조
```text
tessra/
├── docs/
│   └── manual-e2e-checklist.md
│   └── testing.md
├── src/
│   ├── extension.ts
│   ├── models/
│   │   └── types.ts
│   ├── panels/
│   │   ├── GuidePanel.ts
│   │   ├── RequestPanel.ts
│   │   └── requestPanel/
│   │       ├── CollectionRunner.ts
│   │       ├── RequestExecutor.ts
│   │       ├── WebSocketManager.ts
│   │       ├── messages.ts
│   │       ├── requestPanelHtml.ts
│   │       ├── requestPanelStyles.ts
│   │       ├── requestPanelMarkup.ts
│   │       ├── requestPanelClientScript.ts
│   │       ├── requestPanelBodyClientScript.ts
│   │       ├── requestPanelResponseClientScript.ts
│   │       ├── requestPanelRunnerClientScript.ts
│   │       ├── requestPanelEnvironmentClientScript.ts
│   │       ├── requestPanelDefaultHeadersClientScript.ts
│   │       ├── requestPanelStatusClientScript.ts
│   │       ├── requestPanelWebSocketClientScript.ts
│   │       ├── requestPanelAuthClientScript.ts
│   │       ├── requestPanelScriptsClientScript.ts
│   │       ├── requestPanelSettingsClientScript.ts
│   │       ├── requestPanelPathVariablesClientScript.ts
│   │       └── requestUtils.ts
│   ├── providers/
│   │   ├── CollectionTreeProvider.ts
│   │   ├── EnvironmentTreeProvider.ts
│   │   └── HistoryTreeProvider.ts
│   ├── services/
│   │   ├── AuthService.ts
│   │   ├── BodyConversionService.ts
│   │   ├── CodegenService.ts
│   │   ├── CurlService.ts
│   │   ├── DotEnvService.ts
│   │   ├── HttpService.ts
│   │   ├── ImportExportService.ts
│   │   ├── LocalizationService.ts
│   │   ├── RequestBodyService.ts
│   │   ├── RequestExportService.ts
│   │   ├── ResponseCompareService.ts
│   │   ├── ScriptRunner.ts
│   │   ├── ScriptUtilities.ts
│   │   ├── StorageService.ts
│   │   ├── VariableService.ts
│   │   ├── PathVariableService.ts
│   │   └── WebSocketService.ts
│   ├── test/
│   │   └── unit/
│   └── webview/
│       ├── hljs.ts
│       └── bodyConversion.ts
├── package.json
├── README.md
├── README.ko.md
├── DESIGN.md
├── PRODUCT.md
├── AGENTS.md
└── CLAUDE.md
```

## 현재 구현 상태

### 완료된 기능
1. 멀티 탭 요청 편집기
2. HTTP 요청 전송, 취소, 응답 표시
3. Collections / folders / requests CRUD와 실행
4. Environments CRUD와 재귀적 `{{variable}}` 치환, Postman Environment JSON / `.env` import 진입점
4a. Path Variables: URL path의 full-segment `{{variable}}`를 Request-local로 override (Environment fallback / Reset; query·headers·body·auth에는 영향 없음)
5. History 저장, pin, filter, 날짜 그룹화, 자동 정리와 보존 개수 설정 진입점
6. 인증: Basic, Bearer, API Key
7. Body 타입: JSON(요청 Body mirror 오버레이 구문 강조, textarea 입력원 유지), XML(동일 오버레이 XML 강조), form-urlencoded, form-data, binary, raw
7a. Body 타입 변경 시 비어 있지 않은 바디에 대해 Convert / Keep text / Cancel 확인(자동 변환 없음). 변환은 원자적 undo(타입+내용). 중첩 JSON→form 거절, form-data file→JSON 거절, Binary 자동 변환 없음
8. Pre-request / Test scripts (`pm`, `env`, `test`, `expect`, `assert` 내장 지원, Tessra Script utilities: SHA-256/HMAC-SHA256/Base64/UUID v4/unix·unixMs, 설정 가능한 script timeout, Scripts 한 줄 도움말 + Guide 링크, 편집기별 예제 삽입, import된 스크립트는 명시적으로 신뢰 처리하기 전까지 기본 비활성화)
9. OpenAPI path parameter placeholder 변환, OpenAPI / Postman collection/environment import/export, Tessra workspace backup export/import
10. cURL import / copy as cURL
11. 코드 생성: `fetch`, `axios`, `Java HttpURLConnection`
12. 응답 비교: `Raw`, `Normalized`, `Pretty`, ignore headers / ignore JSON paths
13. 요청별 Settings 탭: timeout, redirects, TLS override, 안전 기본값이 있는 max response size, retries, stop after headers, save to history, skip default headers, disable scripts, 전역 script timeout 설정
14. HTML preview, JSON tree, XML format options, 응답 시간/요청·수신 시각 메타데이터, richer empty states, 요청 변경 요약, 변수 사용처, 변수 자동완성, Quiet Instrument 상태 스트립(Tessra brand accent + 작은 테서랙트 마크 on Env와 활성 env `N vars`, Scripts/History on·off cue, Defaults/`Used N`, 위험 설정 경고; Env 세그먼트로 변수 편집기 토글)과 on-demand 변수 편집기, 활성 요청 편집 탭 재클릭 접기/펼치기, Body editor undo/redo 안정화, 응답 빠른 복사, 고급 필터 UX, 상단 상태 배지 linked focus/highlight
15. `tessra.displayLanguage` 설정 기반 UI 언어 선택 (Tessra 패널/알림/인앱 가이드 대상, 기본 영어, 현재 `en`/`ko`/`ja`, 설정/명령 레이블은 VS Code locale 유지)
16. `tessra.requestPanelTheme` 설정과 Command Palette 기반 요청 패널 테마 프리셋 선택 (`default`, `minimal-cool`, `product`, `bold-color` — Quiet Instrument 공유 레이아웃 위 색상/토큰 스킨만)
17. `tessra.workspaceProfile` 설정 기반 워크스페이스 로컬 저장 프로필 분리와 현재 프로필 표시 (`default`는 메인 작업용, 사용자 지정 프로필은 프로젝트/실험 분리용)
18. 컬렉션 러너 per-run request selection(기본 전체 선택, CollectionItem.id 기준), delay / iterations / stop-on-failure 옵션, 실패 요청만 재실행, 요청별 history 저장 설정을 따른 실행 결과 저장, active request / retry delay / runner delay 중단
19. WebSocket `ws://` / `wss://` 연결과 `{{variable}}` 치환 후 URL 기준 모드 감지, 텍스트 메시지 전송, frame/message size limit, 선택형 protocol-level ping keepalive, 수신/전송/close 진단 로그, binary frame base64 표시
20. gzip / deflate / Brotli 응답 자동 해제와 cURL import warning / edge flag 보강

### 현재 품질 기준
1. 요청 패널 UI는 탭, 주요 액션, 행 삭제 버튼, 응답 액션 메뉴가 키보드 접근과 명확한 포커스 상태를 유지해야 한다.
2. 수동 E2E 범위는 `docs/manual-e2e-checklist.md`를 기준으로 확장·관리한다. 핵심 클릭 경로는 `npm run test:e2e` UI 자동화로도 검증한다 (`docs/testing.md`). stable UI E2E는 **23개**(Collection Runner 2개 + WebSocket 1개 + Environment autosave 1개 + Default Headers save/apply 1개 + Auth Bearer 1개 + Scripts template 1개 + Settings editor 1개 + Path Variables 1개 + Request More narrow geometry 1개 + Path Variable occurrence resolution UI 1개 + Body scroll ownership 1개 + 응답 키보드 탐색 1개 + 즉시 닫기 초안 보존 1개 + 실행 환경·프로필 격리 1개 포함)를 유지한다. GitHub Actions e2e job은 전체 suite 전에 `npm run test:e2e:ui-regressions`(#18/#19/#20) critical UI regression contracts를 별도 named step으로 실행한다.
3. UI 품질 원칙: (1) DOM visible만으로 layout PASS 금지 (2) popup/menu는 viewport geometry 검증 (3) variable warning은 occurrence resolution 기준 (4) scrollable editor는 scroll owner 수 + wheel interaction 검증 (5) Request Panel layout은 narrow-width와 short-height BrowserWindow에서 검증.
4. 요청 패널 시각 계약은 `DESIGN.md` Quiet Instrument를 따른다 (pill wall / soft-card / Send success-green 재도입 금지).
5. Request Panel UI를 바꾸면 관련 `data-testid`와 `e2e/specs/*`를 함께 갱신한다. Collection Runner UI를 바꾸면 `e2e/specs/runner/*`도 함께 갱신한다. production backdoor(`window.__tessraTest` 등)는 넣지 않는다.

## 빌드 & 테스트
```bash
npm run typecheck
npm run ci
npm run build
npm run watch
npm test
npm run test:e2e
npm run package
```

단위 테스트는 `npm test`, 실제 VS Code UI E2E는 `npm run test:e2e`다. 수동 시각 QA는 `docs/manual-e2e-checklist.md`를 기준으로 수행한다. 릴리스 전에는 같은 문서의 1.2.2 smoke도 확인한다.

## 저장 데이터
모든 데이터는 VS Code `globalStorage` 아래 JSON 파일로 저장된다. 기본 프로필은 루트에 저장되고, 사용자 지정 프로필은 `profiles/<profile-name>/` 아래 같은 파일 구조로 분리된다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`
- `profiles/<profile-name>/...`

Tessra 저장소가 비어 있는 첫 활성화 시에는 이전 Arc Client 저장소(`arc.arc-client`, `arc-client`)의 기존 데이터 파일과 프로필을 새 `tessra.tessra` 저장소로 복사한다. 새 저장소에 데이터가 이미 있으면 덮어쓰기 방지를 위해 마이그레이션하지 않는다.

저장된 JSON 파일을 파싱할 수 없으면 원본 옆에 `.corrupt-*` 백업을 남기고 경고를 표시한 뒤, 해당 파일이 다시 저장될 때까지 기본값을 사용한다.

## 주의사항
- 실행 컨텍스트는 프로필·환경·세대를 고정한다. 스크립트의 변경분(set/unset)만 원래 환경에 병합하고, 같은 키의 동시 수정은 보존·경고한다. 변경 없는 스크립트는 환경 파일을 쓰지 않는다.
- 프로필 변경/패널 종료 시 HTTP(Body 준비·재시도 포함)·러너·WebSocket을 취소하고 이전 세대의 메시지·응답을 폐기한다. HTTP 전송은 리다이렉트를 포함해 http/https만 허용하며 러너의 WS 실행은 미지원이다.
- 스크립트 입출력은 JSON 경계이며 호스트 객체·함수를 VM에 전달하지 않는다. Node VM을 OS 보안 샌드박스로 주장하지 않는다 (`docs/script-security.md`).
- 일반 저장 파일도 구조 검증을 수행한다. 잘못된 원본의 백업·경고와 메모리 기본값 사용을 분리하고, 복구 목적으로 빈 데이터를 자동 저장하지 않는다.
- 기존 기능을 건드릴 때는 webview 파싱 오류와 상태 복원 흐름을 가장 먼저 확인한다
- `package.json`의 `engines.vscode` 버전은 임의로 올리지 않는다
- 보안 관련 기본값은 안전한 쪽을 유지하고, 완화 옵션은 opt-in으로 둔다
- 문서는 실제 코드 기준으로 유지하고, 기능 추가/변경 시 같은 턴에 반영한다
