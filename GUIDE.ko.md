# Tessra 가이드

Tessra는 VS Code용 로컬 우선 REST API 클라이언트입니다.

로그인, 클라우드 동기화, 유료 제한 없이 핵심 워크플로를 사용할 수 있습니다.

## 빠른 시작

1. Activity Bar에서 Tessra를 엽니다.
2. `Tessra: New Request`를 실행하거나 `+`를 클릭합니다.
3. HTTP 메서드를 고르고 URL을 입력합니다.
4. 요청 탭에서 params, headers, body, auth, scripts, settings를 채웁니다.
5. `Send`를 클릭하거나, URL 입력창에서 `Enter` / `Ctrl+Enter`(`Cmd+Enter` on macOS)를 누릅니다.

환경 변수 사용 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 요청 작성

- 메서드: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 요청 탭: `Params`, `Headers`, `Body`, `Auth`, `Scripts`, `Settings`
- 고정 탭이 있는 멀티 탭 편집
- URL 입력창의 `Enter` 또는 `Ctrl+Enter` / `Cmd+Enter`로 활성 요청을 보냅니다.
- URL 아래 status strip에는 활성 Environment(`변수 N개`), Scripts, History on/off, Defaults, risk override, 요청 `사용 N`이 표시됩니다.
- Environment 세그먼트를 클릭하면 변수 편집이 열리고, 활성 환경이 없으면 환경을 고를 수 있습니다.
- `사용 N`(또는 미해결 Vars)을 클릭하면 현재 요청의 변수 사용처를 볼 수 있습니다.
- status strip을 펼치면 workspace profile, 환경 전환, Default Headers, 추가 상세를 확인할 수 있습니다.
- 민감한 인증 값은 reveal 하기 전까지 마스킹됩니다.
- 헤더나 쿼리 파라미터를 한 줄씩 추가하지 않고 일괄 붙여넣을 수 있습니다.
- 전송 전 미해결 또는 순환 `{{variables}}`가 있으면 Tessra가 경고합니다.

## Body

- Body 타입: `none`, `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- JSON/XML Body는 textarea 편집을 유지하면서 syntax highlighting을 제공합니다.
- Body undo/redo는 Send 이후와 요청 탭 전환 이후에도 동작합니다.
- 비어 있지 않은 Body를 지원되는 형식 사이에서 바꿀 때 Tessra가 안전한 변환을 제안할 수 있습니다. `변환` / `텍스트 유지` / 취소 중에서 고릅니다.
- 지원되지 않거나 모호한 변환(중첩 구조, file form-data, Binary 자동 생성)은 거부되며 원본 Body가 유지됩니다.

## 응답 작업 공간

- 응답 요약에는 status, duration, size, content type, resolved URL이 표시됩니다.
- 탭: `Body`, `Cookies`, `Headers`, `Tests`, 의미 있는 정적 HTML이 있을 때 `Preview`
- 동적 HTML은 `Body`에 남고, HTTP/HTTPS로 해석된 페이지는 `Open URL`로 열 수 있습니다.
- `Pin`과 `Compare`는 응답 요약에 계속 보입니다.
- Copy, Copy URL, Save, Copy Status, Copy Headers 등 유틸리티는 `⋯` 메뉴에 있습니다.
- 응답 본문 검색은 다음/이전 이동, 대소문자 구분, 정규식 모드를 지원합니다.
- JSON은 Tree와 Raw 뷰를 지원합니다.
- XML format: `Pretty`, `Compact`, `Inline Children`, 그리고 XPath helper
- Content-Type 기반 syntax highlighting
- gzip, deflate, Brotli 응답 자동 디코딩
- Compare는 `Raw`, `Normalized`, `Pretty` 모드를 지원하며 metadata summary를 포함할 수 있습니다.

## 컬렉션, 러너, 히스토리

- 컬렉션, 폴더, 저장된 요청 생성
- Drag and drop으로 항목 정리
- Run All Requests는 설정 화면을 열고, 기본적으로 모든 요청이 선택된 상태에서 이번 실행에서 빼둘 요청만 체크 해제할 수 있습니다.
- 선택은 안정적인 request id를 쓰고 원본 순서를 유지하며, 다음에 Runner를 열면 다시 전체 선택으로 초기화됩니다.
- delay, iterations, stop-on-failure는 선택된 요청에만 적용됩니다.
- 러너는 활성 요청, 진행 상태, passed / failed / skipped 요약을 보여주며, 실행 전 제외한 요청은 skipped로 세지 않습니다.
- Stop으로 활성 요청, retry 대기, 요청 간 delay를 취소할 수 있습니다.
- 러너 요약에서 실패한 요청만 다시 실행할 수 있습니다.
- 각 요청의 Save to history가 켜져 있을 때만 러너 결과가 히스토리에 저장됩니다.
- 히스토리는 그룹핑, 필터, pin, `tessra.historyMaxItems` 보존(고정 항목 유지)을 지원합니다.

## 환경과 변수

- Environment CRUD와 활성 환경 전환
- 요청 `{{variable}}` 해석은 활성 environment를 기준으로 합니다.
- 중첩 `{{variables}}`는 재귀 해석되며, 미해결/순환 참조는 전송 전에 보고됩니다.
- URL path에 `/users/{{userId}}`처럼 segment 전체가 placeholder이면 URL 아래에 Path Variables가 나타납니다.
- Path Variables는 기본적으로 Environment 값을 쓰고, Override로 요청 로컬 값을 두며, Reset하면 Environment로 돌아가고 Environment 자체는 바뀌지 않습니다.
- URL 경고도 같은 occurrence 규칙을 따릅니다. Request-local path 값은 missing으로 표시되지 않고, 같은 이름이 query / headers / body / auth에 있으면 Environment에 없을 때 unresolved로 남을 수 있습니다.
- Path override는 해당 path segment에만 적용되며 query / headers / body / auth에는 영향을 주지 않습니다. WebSocket URL과 Collection Runner / cURL / codegen 해석에도 동일하게 적용됩니다.
- URL, headers, body, auth, scripts 등 입력 필드에서 변수 autocomplete를 사용할 수 있습니다.
- Environment `변수 N개`는 활성 환경의 변수 수이고, 요청 `사용 N`은 현재 요청이 쓰는 변수 수입니다.
- workspace variables는 백업에 보존될 수 있지만, 요청 해석은 여전히 활성 environment를 따릅니다.
- `Tessra: Import Environment`로 `.env` / `.env.*` / `*.env` 파일을 한 번만 로컬 Environment로 가져옵니다. 원본 파일을 수정하지 않으며, 가져온 환경을 자동으로 활성으로 바꾸지 않습니다.

## 워크스페이스 프로필

- `default`는 평소 Tessra 작업을 위한 기본 로컬 저장 공간입니다.
- 다른 프로젝트, 가져온 spec, 실험을 섞고 싶지 않을 때 새 프로필을 만듭니다.
- 프로필은 collections, history, environments, default headers, workspace variables, saved tabs를 분리합니다.
- 서로 다른 프로젝트/작업 흐름은 프로필로, 같은 프로젝트의 `local` / `staging` / `prod`는 environment로 나눕니다.
- `Tessra: Change Workspace Profile`로 프로필을 전환하거나 만들 수 있습니다.
- 현재 프로필은 status strip을 펼친 상세에서 확인할 수 있습니다.

## 워크스페이스 백업 / 복원

- `Tessra: Export Workspace Backup`와 `Tessra: Import Workspace Backup`를 사용합니다.
- 백업에는 collections, environments, active environment, default headers, workspace variables가 포함됩니다.
- history와 open tabs / tab state는 포함되지 않습니다.
- import는 현재 프로필 데이터를 교체하며 merge가 아닙니다.
- import 전에 Tessra가 pre-import backup을 자동으로 만듭니다.
- 백업 파일에는 token, API key 등 민감정보가 들어갈 수 있으니 안전하게 보관하세요.

## WebSocket

- `ws://` 또는 `wss://` URL(원문 또는 `{{variable}}` 해석 후)을 입력하면 WebSocket 모드로 전환됩니다.
- 주 액션으로 Connect / Disconnect를 사용합니다.
- Body 탭이 나가는 텍스트 메시지 작성기입니다.
- inbound / outbound / close 진단은 WebSocket message log에 표시됩니다.
- inbound binary frame은 base64로 표시됩니다.
- frame/message size limit로 과도한 페이로드를 막습니다.
- Settings의 optional ping keepalive는 기본값이 off입니다.

## Scripts

- Pre-request script는 전송 전, Test script는 응답 후에 실행됩니다.
- 흐름: Environment → Pre-request → Send → Tests
- Postman 유사 API: `pm.test`, `pm.expect`, `pm.environment`
- Tessra Script utilities(Postman 공식 `pm.crypto` 아님): `pm.crypto.sha256(value)`, `pm.crypto.hmacSha256(message, secret)`(소문자 hex), `pm.encoding.base64Encode` / `base64Decode`(UTF-8 ↔ 표준 Base64), `pm.uuid()`(UUID v4), `pm.time.unix()`(초), `pm.time.unixMs()`(밀리초)
- hash/encode 입력은 string/number/boolean/bigint/null/undefined; 객체는 `JSON.stringify(...)`를 사용합니다.
- 예: `pm.environment.set("signature", pm.crypto.hmacSha256(pm.environment.get("payload") || "", pm.environment.get("secret") || ""));`
- Scripts 탭에서 예제 삽입과 Open Guide를 사용할 수 있습니다.
- 가져온 스크립트는 요청 탭에서 신뢰하기 전까지 비활성입니다.
- 스크립트 변수 변경은 시작 환경에만 적용하며, 같은 키의 동시 편집은 보존하고 경고합니다. 프로필 변경은 진행 중 실행을 취소합니다.
- 스크립트에 호스트 객체·함수를 전달하지 않습니다. VM은 OS 샌드박스가 아니므로 내용을 이해하고 신뢰하는 스크립트만 실행하세요.
- 스크립트 timeout은 `tessra.scriptTimeoutMs`로 설정합니다.
- script logs와 pass/fail 결과는 응답 Tests 탭에 표시됩니다.

## 요청별 Settings

- Timeout
- Max response size
- Retry count와 retry delay
- TLS: `Default`, `Strict`, `Insecure`
- Follow redirects
- Stop after headers
- Save to history
- Skip default headers
- Disable scripts
- Default Headers는 Headers 탭 배너 또는 status strip 상세에서 엽니다.
- 안전성이나 동작을 바꾸는 비기본 설정은 status strip 경고/표시로 드러납니다.

## Import / Export

- cURL import와 Copy as cURL
- OpenAPI import; `{userId}` 같은 path parameter는 `{{userId}}`로 가져옵니다.
- Tessra collection import
- Postman collection / environment import·export
- `.env` 파일을 Tessra Environment로 가져오기 (일회성 복사; sync/watcher/원본 쓰기 없음)
- Tessra Workspace Backup export·import

## 표시 언어와 테마

- `Tessra: Change Display Language`로 `English`, `Korean`, `Japanese`를 전환합니다.
- Tessra 패널, 프롬프트, 알림, 이 가이드는 해당 설정을 따릅니다.
- VS Code Settings 레이블과 Command Palette 제목은 VS Code locale을 따릅니다.
- `Tessra: Change Request Panel Theme`로 color/token skin(`default`, `minimal-cool`, `product`, `bold-color`)을 바꿉니다.
- 테마 preset은 accent와 surface token만 바꾸며 패널 레이아웃은 바꾸지 않습니다.

## 키보드 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
- `Enter`: URL 입력창에서 전송
- `Ctrl+Enter`: 요청 전송
- `Ctrl+S`: 현재 요청 저장
- `Ctrl+Shift+S`: Save As
- `Ctrl+F`: 응답 검색 포커스
- `Alt+1` … `Alt+6`: 요청 탭 전환
- `Alt+Shift+1` … `Alt+Shift+5`: 응답 탭 전환

macOS에서는 `Ctrl` 대신 `Cmd`를 사용합니다.

## 로컬 저장

모든 Tessra 데이터는 VS Code `globalStorage` JSON 파일로 로컬 저장됩니다. default 프로필은 루트에, 다른 프로필은 `profiles/<name>/`에 같은 파일을 둡니다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

JSON을 파싱할 수 없으면 Tessra는 옆의 `.corrupt-*` 백업을 남기고 경고한 뒤 해당 파일은 기본값으로 동작합니다.

Tessra는 사용자가 명시적으로 요청을 보내거나 WebSocket을 연결할 때만 네트워크를 사용합니다.
