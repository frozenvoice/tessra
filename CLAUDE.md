# Tessra 프로젝트 메모

## 제품 정체성
Tessra는 VS Code 안에서 동작하는 local-first API 클라이언트다.

- 로그인 없음
- 클라우드 동기화 없음
- 텔레메트리 없음
- 사용자가 직접 보내는 API 요청 외의 네트워크 호출 없음
- 요청·metadata는 로컬 JSON, 확인된 비밀 변수 값은 VS Code SecretStorage에 저장

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
- 명시적인 비밀 보호/값 설정/값 보기/삭제: 확인된 값은 ExtensionContext.secrets, JSON에는 안정적인 프로필·환경·변수·참조 ID와 metadata만 저장한다. pending 변환 원문은 복구를 위해 남기되 실행·새 export는 차단/참조 처리한다. 확인 후 현재 평문을 제거하고 실패 시 재시도/명시적 취소를 제공한다 (`docs/secret-variables.md`).
- 기존 평문을 자동 분류/삭제하지 않으며 과거 사본을 검색하지 않는다. Workspace 변수도 보호/편집 가능하지만 백업 보존 용도이며 요청 치환에 섞지 않는다.
- Webview 기본 전달은 마스킹/존재 상태다. Set은 native password 입력, Reveal은 명시적 scope/세대 권한과 일시적 화면 표시이며 프로필 전환/패널 종료 때 해제한다. 필요한 값 미설정/키체인 오류는 전송 전에 실패한다.

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
- text/event-stream 증분 Events/Raw 표시: Receiving/Completed/Aborted/Timeout/Error를 구분하고 부분 수신을 보존한다. UTF-8 chunk/BOM, CR/LF/CRLF, 빈 줄, 여러 data, event/id/retry/comment를 처리하며 불완전 EOF 블록은 완성하지 않는다 (`docs/sse.md`).
- SSE의 행/이벤트 256 KiB·대기 512 KiB·보관 500개/2 MiB·Raw prefix 1 MiB 상한과 유실/잘림을 표시하며 묶음 갱신한다. 이벤트는 텍스트이고 vendor JSON/HTML/명령으로 실행하지 않는다. 자동 재연결/스트림 시작 후 retry/POST 재전송은 없으며 HTTP 500 SSE도 그대로다.
- 스트리밍에서 timeout/응답 제한/TLS/교차 origin 자격 증명 제거를 몰래 해제하지 않는다. timeout=0은 명시적 사용자 선택이며 Stop/profile change/panel close/Runner Stop은 transport·timer·subscription을 정리하고 늦은 실행 데이터를 거부한다. Raw 복사/저장은 종료된 보관 prefix에 한정한다.
- JSON tree viewer
- XML format options: `Pretty`, `Compact`, `Inline Children`
- Content-Type 기반 하이라이트
- gzip / deflate / Brotli 응답 자동 해제
- 압축 해제 후 내장 TextDecoder로 Content-Type charset을 해독한다. XML은 BOM을 우선하며 일반 텍스트·JSON은 명시 charset을 우선한다. 미지원 charset·잘못된 바이트는 네트워크 실패 대신 번역된 경고와 원문 base64를 유지한다 (`docs/http-response-encoding.md`).
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
- 활성 환경(`N vars`)·스크립트·히스토리 저장·기본 헤더·요청 변수·위험 설정은 상태 스트립에서 구분된다. 기본 헤더 수는 실제 적용할 활성 헤더, 요청 변수 수는 참조한 고유 변수이며 tooltip에서 의미/이름을 설명한다. Environment 세그먼트(또는 Environments 뷰)에서 환경 변수 편집기를 연다.

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
- 보호 변수의 workspace/Postman 환경 export는 참조만 포함하고 import/restore는 새 참조로 값 입력 필요 상태를 만든다. 앱이 생성하는 history/요청 metadata/코드/진단/스크립트 로그는 알려진 값과 일반 인코딩을 마스킹 또는 변수 참조로 보존한다. 실제 통신/서버 응답은 변경하지 않으며 신뢰된 script의 임의 변환/서버 echo를 완전히 검출한다는 보장은 없다.

### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

### 요청별 Settings 탭
- timeout은 첫 네트워크 시도부터 DNS·연결/TLS·업로드·응답 본문·리다이렉트·재시도 대기 전체에 하나의 단조 deadline을 적용한다. 0은 무제한이고 만료는 재시도하지 않는다. Body 준비·전/후 스크립트와 러너 항목 사이 대기는 제외하며 각 항목은 독립 예산을 쓴다.
- follow redirects
- 헤더 인증은 실제 적용한 헤더명 metadata로 사용자 지정 API Key 이름도 보호한다. 같은 origin에서는 유지하며 교차 origin에서 제거한 뒤 원래 origin으로 돌아와도 재부착하지 않는다.
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
- upgrade 응답 헤더 16KiB 및 전체 handshake deadline(요청 timeout 또는 기본 30초), 최종 요청 헤더 이름·값의 transport 생성 전 검증 유지
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
- Webview HTML은 `requestPanelHtml.ts`가 CSP/URI/i18n을 조립하고, CSS는 `requestPanelStyles.ts`, shell markup은 `requestPanelMarkup.ts`, inline client JS는 `requestPanelClientScript.ts`와 기능별 fragment에 둔다. HTML Preview의 정제·외부 자원 집계·정적 본문 판별·DOM 렌더링은 `src/webview/htmlPreview.ts`의 browser 모듈이며, `htmlPreviewEntry.ts`를 `dist/htmlPreview.js`로 번들한다. 자산은 현재 Webview의 URI와 nonce로 main inline script 전에 로딩한다.
- HTTP 실행은 `src/panels/requestPanel/RequestExecutor.ts`, 컬렉션 러너는 `src/panels/requestPanel/CollectionRunner.ts`, WebSocket 세션 관리는 `src/panels/requestPanel/WebSocketManager.ts`가 담당한다
- highlight.js 관련 리소스는 `src/webview/hljs.ts`에서 관리한다
- Body 타입 변환은 `src/services/BodyConversionService.ts`, webview 노출은 `src/webview/bodyConversion.ts` (`dist/bodyConversion.js`)
- 요청 패널 시각 계약은 `DESIGN.md` Quiet Instrument; 제품 범위는 `PRODUCT.md`
- HTTP 요청 실행은 `src/services/HttpService.ts`
- WebSocket 프레임/handshake 처리는 Node.js 내장 `net` / `tls` 기반 `src/services/WebSocketService.ts`에서 담당한다
- storage는 `src/services/StorageService.ts`. History는 파일 경로별 immutable snapshot과 count를 재사용하며 매 조회에서 metadata로 외부 변경·삭제·복원을 확인한다. 수정용 `getHistory()`는 중첩 복사본을 반환한다. 저장은 요청 완료 시 동기식 임시 파일+rename을 유지하며 성공 후 캐시를 무효화한다. 다음 조회에서 실제 파일을 읽고 검증한 snapshot을 생성하며, 저장했던 메모리 내용에 외부 교체 파일의 metadata를 연결하지 않는다.
- scripts는 `src/services/ScriptRunner.ts`
- import/export는 `src/services/ImportExportService.ts`
- compare는 `src/services/ResponseCompareService.ts`
- 로컬 저장 분리와 Arc Client → Tessra 데이터 마이그레이션은 `src/services/StorageService.ts`
- 저장 JSON 파싱/구조 검증 실패 시 원본 보존과 백업 복사, 경고, 해당 파일 쓰기 차단을 함께 유지한다

## 품질 기준
- 요청 패널 UI는 탭, 주요 액션, 행 삭제 버튼, 응답 액션 메뉴의 키보드 접근성과 포커스 표시를 유지한다
- 수동 E2E 검증 범위는 `docs/manual-e2e-checklist.md` 기준으로 관리한다 (릴리스 전 최신 버전 Smoke 섹션 포함). stable UI E2E는 `npm run test:e2e` 기준 **33개 / 30파일**이며 Collection Runner, WebSocket, 환경·헤더·Auth·Scripts·Settings·Path Variables, 좁은 패널 geometry, Body scroll ownership, 응답 키보드 탐색, 초안 보존, 실행 환경·프로필 격리, HTML Preview 자산·정제·CSP, History 연속 완료·핀·필터·삭제, 응답 charset·경고, 전체 네트워크 deadline을 포함한다. 수동 전체 CI는 `test:e2e:ui-regressions`(#18/#19/#20) critical UI regression contracts를 전체 suite 전에 별도 step으로 실행한다.
- UI 품질 원칙: DOM visible만으로 layout PASS 금지, popup/menu viewport geometry 검증, variable warning은 occurrence resolution 기준, scrollable editor는 scroll owner 수 + wheel interaction 검증, Request Panel layout은 narrow-width/short-height BrowserWindow에서 검증.
- Quiet Instrument 계약: pill wall / soft-card / Send success-green 재도입 금지

## 빌드 / 테스트
`typecheck`는 extension, browser(`tsconfig.webview.json`, DOM/no Node globals), unit test를 각각 검사한다. 로컬 설치 VSIX smoke와 합성 History benchmark 절차, 변경별 회귀 선택은 `docs/testing.md`를 따른다.

```bash
npm run ci               # typecheck → npm test → build; E2E·패키징·게시 없음
npm run typecheck        # 필요한 검사만 개별 실행할 때
npm test                 # pretest에서 단위 테스트 컴파일 후 Mocha
npm run watch            # 개발 중 증분 번들 빌드
npm run build            # 필요한 최종 production build를 한 번 수행
npm run test:e2e -- e2e/specs/21-accessibility-and-draft.spec.ts  # 최신 빌드로 해당 회귀
npm run package          # 명시적 VSIX 생성; vscode:prepublish의 build 포함
```

- 일반 코드 작업은 변경에 필요한 로컬 typecheck·단위 테스트·build 후 완료한다. `npm run ci`의 기존 범위는 유지하며 실행한 검사를 중복 수행하거나 완료 보고에서 별도 검사처럼 중복 계산하지 않는다. `npm test`의 `pretest` 외에 개발 검사가 전체 E2E·VSIX 생성·게시로 이어지는 pre/post lifecycle은 없다. E2E 명령에는 자동 build가 없다.
- 개발 중에는 `watch`의 최신 빌드를 관련 E2E에 활용하고 최종 build가 필요하면 소스 변경 수렴 후 한 번 실행한다. F5의 build prelaunch task와 `package`의 build lifecycle도 중복 계획에 포함한다.
- UI/Webview·저장/복원·프로세스/실행 변경에는 관련 단위 회귀와 영향을 받는 실제 VS Code 경로를 선택한다. Runner 변경은 관련 Runner spec을 포함한다. 문서만 수정하면 경로·명령·diff를 확인하고 제품 build/E2E는 요구하지 않는다. 무관한 내부 변경마다 전체 VS Code E2E를 요구하지 않는다.
- 원격 `.github/workflows/ci.yml`은 `AGENTS.md`의 수동 실행 정책을 따른다. 기존·신규 workflow의 시작은 `workflow_dispatch`만 허용하고 `workflow_call`은 명시적 수동 root에서만 도달해야 한다. 자동 이벤트·Git hook·스크립트·에이전트 설정의 자동 dispatch는 금지한다. 일반 작업 완료에는 관련 로컬 검증을 수행하고 원격 CI로 대체하지 않는다. 공개 전에도 실제 dispatch·watch·rerun에는 사용자의 해당 원격 실행에 대한 명시적 요청이 필요하다. 승인된 전체 검증은 Linux `unit`, Windows `unit-windows`, Linux `e2e`를 모두 수행하며 미충족 공개 게이트는 그대로 보고한다.
- 완료 보고는 실제 로컬 명령·결과, 부분/전체 검증 범위와 미실행 항목을 구분한다. 수동 전체 CI는 Marketplace 게시를 수행하지 않는다. 공개 전 최종 버전 변경을 포함한 동일 SHA의 세 job 성공과 패키징 VSIX 일치는 `docs/releasing.md` 절차로 확인한다.

## 작업 원칙 메모
- 기존 기능 회귀가 가장 큰 리스크라서, webview 문자열 수정 후에는 반드시 파싱/빌드/테스트를 확인한다
- 사용자에게 보이는 기능이 바뀌면 README와 내부 문서도 같은 턴에 갱신한다
- 보안 관련 기본값은 안전한 쪽으로 유지한다
- 오프라인 우선 원칙을 깨는 기능은 추가하지 않는다

## 검증 산출물 정리

- 검증·실험용 빌드, 스테이징, 캡처 출력을 작업이나 재시도마다 새 이름의 폴더로 만들지 않는다(예: `.vscode-test-<작업명>`, `dist-<작업명>`, 실행마다 새 E2E artifacts 폴더). 기본 출력 위치를 재사용하고, 격리가 꼭 필요하면 고정된 폴더 하나를 덮어쓴다.
- 이번 작업에서 만든 임시 빌드·스테이징·캡처 폴더는 완료 보고 전에 삭제한다. 다른 작업이나 실행 중인 프로세스의 출력은 건드리지 않는다.
- 근거로 남길 것은 로그·요약·최소 파일로 줄인다. 1GB 이상이 남으면 경로와 크기를 완료 보고에 적는다.
