# Tessra 프로젝트 메모

## 제품 정체성
Tessra는 VS Code 안에서 동작하는 local-first API 클라이언트다.

- 로그인 없음
- 클라우드 동기화 없음
- 텔레메트리 없음
- 사용자가 직접 보내는 API 요청 외의 네트워크 호출 없음
- 모든 데이터는 로컬 JSON 파일로 저장

## 현재 구현 범위

### 요청 작성 / 전송
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집기
- 활성 요청 편집 탭 재클릭으로 해당 본문 접기 / 다시 펼치기
- 요청 전송이나 요청 편집 탭 전환 후에도 Body 편집 undo/redo 상태 유지
- URL 입력창 `Enter` 전송
- `Ctrl+Enter` / `Cmd+Enter` 전송
- 진행 중 요청 취소
- 요청 상태 표시와 응답 상태 애니메이션
- `ws://` / `wss://` WebSocket 탭 자동 감지, 연결 / 연결 해제, 텍스트 메시지 전송, frame/message size limit, 선택형 protocol-level ping keepalive

### Body 타입
- `none`
- `json` (요청 Body mirror/overlay 구문 강조; textarea가 유일한 입력원, WebSocket composer는 plain)
- `xml` (동일 overlay로 XML 구문 강조)
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`
- 비어 있지 않은 Body에서 타입 변경 시 Convert / Keep text / Cancel (자동 변환 없음; `BodyConversionService` 기반 구조 변환; Binary/중첩 form/file form-data는 안전하게 거절)

### 인증
- No Auth
- Basic Auth
- Bearer Token
- API Key (`header`, `query`)

### 환경 변수
- Environment CRUD
- 활성 환경 전환
- 재귀적 `{{variable}}` 치환
- URL / Headers / Params / Body / Auth / 파일 경로 치환
- Path Variables: URL path의 full-segment `{{variable}}` Request-local override (Environment fallback / Reset; query·headers·body·auth 비영향)
- Environments 제목 영역의 `Import Environment`로 Postman Environment JSON 또는 `.env` 파일 가져오기 (일회성 로컬 복사, 자동 active 전환 없음)

### Collections / History
- Collection / folder / request CRUD
- Duplicate / Save As
- Drag & Drop 정렬
- method / host / type / status / pinned 토큰 필터
- Run All Requests
- 컬렉션 러너 delay / iterations / stop-on-failure 옵션
- 컬렉션 러너에서 실패한 요청만 재실행
- 컬렉션 러너 실행 결과는 각 요청의 history 저장 설정이 켜져 있으면 history에 저장
- History pin / filter / 날짜 그룹화 / prune, 보존 개수 설정 진입점
- 실행 시점 스냅샷과 timing metadata 기반 history 저장
- 더 촘촘한 사이드바 설명 정보와 컬렉션 / 폴더 개수 표시

### Response Viewer
- Body / Headers / Cookies / Tests / Preview
- JSON tree viewer
- XML format options: `Pretty`, `Compact`, `Inline Children`
- Content-Type 기반 하이라이트
- gzip / deflate / Brotli 응답 자동 해제
- 안전 기본값이 있는 max response size 제한
- 응답 본문 저장
- 응답 비교: `Raw`, `Normalized`, `Pretty`
- ignore headers / ignore JSON paths 비교 설정
- resolved URL / status / raw headers 빠른 복사
- 읽기 좋은 응답 시간과 요청/수신 시각 메타데이터 표시
- 활성 환경 / 현재 프로필 / 기본 헤더 / 스크립트 / 히스토리 동작 상태 배지와 linked focus 이동
- 응답 검색, 요청 변경 요약, 변수 사용처, richer empty states
- 테스트 pass / fail / log 요약과 첫 실패 강조

### Environment UX
- URL / Headers / Body / Auth / Scripts 등 편집 가능한 텍스트 입력에서 `{{variable}}` 자동완성
- 활성 환경(`N vars`)·Scripts/History on·off·Defaults/`Used N`·위험 설정은 상태 스트립에서 한눈에 구분되며, Env에는 Tessra 시그니처 액센트와 작은 테서랙트 마크가 붙고, Environment 세그먼트(또는 스트립 확장/Environments 뷰)에서 환경 변수 편집기를 연다

### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- Tessra Script utilities: `pm.crypto.sha256` / `hmacSha256`, `pm.encoding.base64Encode` / `base64Decode`, `pm.uuid`, `pm.time.unix` / `unixMs` (JSON 입출력, VM 내부 API, 호스트 객체·함수 미노출; OS 샌드박스 보장은 아님: `docs/script-security.md`)
- `tessra.scriptTimeoutMs` 기반 실행 제한 시간
- import로 들어온 스크립트는 요청 탭에서 신뢰 처리하기 전까지 기본 비활성화
- 실행 당시 프로필·환경·세대를 고정하며 스크립트의 set/unset 변경분만 저장한다. 같은 키의 동시 수정은 보존하고 경고하며, 변경 없는 실행은 환경 파일을 쓰지 않는다.
- 프로필 변경/패널 종료 시 Body 준비·전송·재시도·러너·WebSocket을 취소하고 이전 결과를 폐기한다. HTTP/리다이렉트는 http/https만 허용하며 러너 WS 항목은 미지원 오류로 처리한다.
- 일반 저장 JSON의 파싱/구조 검증이 실패하면 원본의 `.corrupt-*` 백업 복사를 시도하고 경고한다. 메모리 기본값을 사용하되 해당 파일의 저장과 불완전한 workspace backup 생성을 차단한다. 손상 history의 추가 저장은 건너뛰고 HTTP 응답은 유지한다. 원본 복구 또는 별도 보관 후 재로드/정상 읽기로 보호를 해제한다.
- 프로필 변경 전 flush는 요청 ID가 일치하는 응답의 디스크 저장 후에만 성공한다. 지연/실패 시 정상 변경 명령을 중단한다. 직접 설정 변경과 패널 종료에서도 캐시된 초안은 원래 프로필에 저장한다.
- 로그와 테스트 결과 표시
- Scripts 탭 한 줄 흐름 안내와 Guide 링크, 각 스크립트 편집기의 예제 삽입 버튼

### Import / Export
- warning을 포함한 cURL import
- Copy as cURL
- OpenAPI import와 path parameter placeholder 변환
- Tessra JSON collection import
- Tessra workspace backup export / import
- Postman collection import / export
- Postman environment import / export

### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

### 요청별 Settings 탭
- timeout
- follow redirects
- save to history
- TLS override
- 안전 기본값이 있는 max response size
- retry count / retry delay
- stop after headers
- skip default headers
- disable scripts

### WebSocket
- raw URL 또는 `{{variable}}` 치환 후 URL 기준으로 WebSocket 탭 감지
- handshake에 headers, query params, auth, default headers, 환경 변수, TLS override 적용
- Body 탭을 전송 메시지 작성기로 사용
- frame/message size limit 적용
- 기본 OFF인 protocol-level ping keepalive 옵션 제공
- 수신 / 전송 / close 진단 메시지 로그 표시
- 수신 binary frame은 base64로 표시

### UI 언어
- `tessra.displayLanguage` 설정으로 Tessra 패널/프롬프트/알림/인앱 가이드 언어 선택
- 기본값은 영어
- 현재 유지 중인 표시 언어는 `en`, `ko`, `ja`
- Tessra UI 자체는 VS Code locale과 분리되어 동작
- 설정 레이블과 Command Palette 명령 이름은 VS Code locale을 계속 따름

### 요청 패널 테마
- `tessra.requestPanelTheme` 설정으로 요청 패널 webview 테마 프리셋 전환
- 지원 프리셋: `default`, `minimal-cool`, `product`, `bold-color`
- 프리셋은 Quiet Instrument 레이아웃/간격/구조를 공유하며 액센트·메서드 강도·표면 틴트·테두리 대비(색상/토큰)만 변경
- Command Palette에서 `Tessra: Change Request Panel Theme` 제공
- 열린 요청 패널에서도 즉시 테마가 반영되도록 유지

### 워크스페이스 프로필
- `tessra.workspaceProfile` 설정으로 로컬 저장 프로필 전환
- collections / history / environments / default headers / saved tabs를 프로필별로 분리
- Command Palette에서 `Tessra: Change Workspace Profile` 제공
- 요청 패널 상태 스트립 확장 영역에 현재 프로필 표시
- `default`는 메인 작업용으로 두고, 다른 프로젝트나 import 실험이 기존 작업과 섞이면 안 될 때 새 프로필을 만드는 방향을 권장

### OpenAPI import 사용
- Command Palette에서 `Tessra: Import OpenAPI` 실행
- OpenAPI JSON 파일을 선택하면 paths, methods, base URL 예시를 컬렉션과 환경으로 변환하고, `/users/{userId}` 같은 path parameter는 `/users/{{userId}}` 형태로 가져온다

## 현재 구조 메모
- 요청 패널 오케스트레이션은 `src/panels/RequestPanel.ts`에 있다
- Webview HTML은 `requestPanelHtml.ts`가 CSP/URI/i18n을 조립하고, CSS는 `requestPanelStyles.ts`, shell markup은 `requestPanelMarkup.ts`, inline client JS는 `requestPanelClientScript.ts`(+ Body fragment `requestPanelBodyClientScript.ts`, Response Viewer fragment `requestPanelResponseClientScript.ts`, Collection Runner fragment `requestPanelRunnerClientScript.ts`, Environment Editor fragment `requestPanelEnvironmentClientScript.ts`, Default Headers Editor fragment `requestPanelDefaultHeadersClientScript.ts`, Status Strip fragment `requestPanelStatusClientScript.ts`, WebSocket fragment `requestPanelWebSocketClientScript.ts`, Auth Editor fragment `requestPanelAuthClientScript.ts`, Scripts Editor fragment `requestPanelScriptsClientScript.ts`, Settings Editor fragment `requestPanelSettingsClientScript.ts`, Path Variables fragment `requestPanelPathVariablesClientScript.ts`)에 둔다 (source split; runtime asset/CSP 변경 없음)
- HTTP 실행은 `src/panels/requestPanel/RequestExecutor.ts`, 컬렉션 러너는 `src/panels/requestPanel/CollectionRunner.ts`, WebSocket 세션 관리는 `src/panels/requestPanel/WebSocketManager.ts`가 담당한다
- highlight.js 관련 리소스는 `src/webview/hljs.ts`에서 관리한다
- Body 타입 변환은 `src/services/BodyConversionService.ts`, webview 노출은 `src/webview/bodyConversion.ts` (`dist/bodyConversion.js`)
- 요청 패널 시각 계약은 `DESIGN.md` Quiet Instrument; 제품 범위는 `PRODUCT.md`
- HTTP 요청 실행은 `src/services/HttpService.ts`
- WebSocket 프레임/handshake 처리는 Node.js 내장 `net` / `tls` 기반 `src/services/WebSocketService.ts`에서 담당한다
- storage는 `src/services/StorageService.ts`
- scripts는 `src/services/ScriptRunner.ts`
- import/export는 `src/services/ImportExportService.ts`
- compare는 `src/services/ResponseCompareService.ts`
- 로컬 저장 분리와 Arc Client → Tessra 데이터 마이그레이션은 `src/services/StorageService.ts`
- 저장 JSON 파싱/구조 검증 실패 시 원본 보존과 백업 복사, 경고, 해당 파일 쓰기 차단을 함께 유지한다

## 품질 기준
- 요청 패널 UI는 탭, 주요 액션, 행 삭제 버튼, 응답 액션 메뉴의 키보드 접근성과 포커스 표시를 유지한다
- 수동 E2E 검증 범위는 `docs/manual-e2e-checklist.md` 기준으로 관리한다 (릴리스 전 최신 버전 Smoke 섹션 포함). stable UI E2E는 `npm run test:e2e` 기준 **23개**(Collection Runner + WebSocket + Environment autosave + Default Headers save/apply + Auth Bearer + Scripts template + Settings editor + Path Variables + Request More narrow geometry + Path Variable occurrence resolution UI + Body scroll ownership + 응답 키보드 탐색 + 즉시 닫기 초안 보존 + 실행 환경·프로필 격리 포함)다. CI는 `test:e2e:ui-regressions`(#18/#19/#20) critical UI regression contracts를 전체 suite 전에 별도 step으로 실행한다.
- UI 품질 원칙: DOM visible만으로 layout PASS 금지, popup/menu viewport geometry 검증, variable warning은 occurrence resolution 기준, scrollable editor는 scroll owner 수 + wheel interaction 검증, Request Panel layout은 narrow-width/short-height BrowserWindow에서 검증.
- Quiet Instrument 계약: pill wall / soft-card / Send success-green 재도입 금지

## 빌드 / 테스트
```bash
npm run typecheck
npm run ci
npm run build
npm run watch
npm test
npm run package
```

## 작업 원칙 메모
- 기존 기능 회귀가 가장 큰 리스크라서, webview 문자열 수정 후에는 반드시 파싱/빌드/테스트를 확인한다
- 사용자에게 보이는 기능이 바뀌면 README와 내부 문서도 같은 턴에 갱신한다
- 보안 관련 기본값은 안전한 쪽으로 유지한다
- 오프라인 우선 원칙을 깨는 기능은 추가하지 않는다
