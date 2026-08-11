# Tessra

VS Code 안에서 동작하는 로컬 우선 API 클라이언트입니다.

로그인도 없고, 클라우드 동기화도 없고, 핵심 기능을 잠가두는 유료 장벽도 없습니다.

[English README](./README.md)

Tessra는 계정, 동기화, 요금제 제약 없이 VS Code 안에서 빠르게 요청을 만들고 실행하려는 개발자를 위한 확장입니다. 모든 데이터는 로컬에 남고, 네트워크 호출은 사용자가 직접 보내는 API 요청에서만 발생합니다.

## 1.0.12에서 달라진 점

- Collection Runner에서 실행 전에 포함할 요청을 선택할 수 있습니다
- 기본은 전체 선택이며, 이번 실행에서만 제외할 요청을 체크 해제합니다 (선택은 저장되지 않음)
- 선택 건수와 함께 delay, iterations, stop-on-failure, Stop, history, Rerun Failed 동작을 유지합니다
- 로컬 우선 원칙 유지: 로그인 없음, 클라우드 동기화 없음, 텔레메트리 없음

## 스크린샷

### 메인 워크스페이스
컬렉션, 환경, 변수, 히스토리, 응답 뷰어를 한 로컬 워크스페이스에서 다룹니다.

![Tessra 메인 워크스페이스](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-main.png)

### 요청 작성
파라미터, 헤더, JSON 바디, 인증, 스크립트, 환경 변수를 함께 구성합니다.

![Tessra 요청 작성](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-request-compose.png)

### HTML 미리보기
정적 HTML 응답을 VS Code 안에서 안전하게 미리 봅니다.

![Tessra HTML 미리보기](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-html-preview.png)

### 히스토리와 컬렉션 러너
요청 히스토리를 날짜별로 묶고 상태 요약과 함께 컬렉션을 실행합니다.

![Tessra 히스토리와 러너](https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/images/screenshot-history.png)

## 왜 Tessra인가요?

- 오프라인 우선 워크플로
- 로그인 불필요
- 클라우드 의존성 없음
- 로컬 JSON 저장
- cURL / OpenAPI / Postman import / export 지원
- Scripts, collections, environments, response compare, code generation 지원
- WebSocket `ws://` / `wss://` 연결, 메시지 송수신, 안전 제한, keepalive 워크플로 지원
- VS Code Webview + TreeView 기반
- Node.js 내장 `http` / `https` / `net` / `tls` 사용

## 기능

### 요청 작성
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집기와 탭 고정
- 활성 요청 편집 탭을 다시 클릭해 탭 바는 유지한 채 본문을 접거나 다시 펼치기
- 요청 전송이나 요청 편집 탭 전환 후에도 Body 편집 실행 취소/다시 실행 동작을 안정적으로 유지
- URL 입력창에서 `Enter`로 바로 전송
- `Ctrl+Enter` / macOS에서는 `Cmd+Enter` 전송
- 마지막 정상 응답을 유지한 채 진행 중 요청 취소
- 요청 단계 피드백, 빈 상태 화면, 응답 상태 피드백, 정돈된 액션 버튼 UI
- 환경(`N vars`), Defaults, 요청 `Used N`, Scripts/History on·off, 위험 설정을 보여주는 Quiet 상태 스트립; Environment 세그먼트(또는 스트립 확장 / Environments 뷰)에서 변수 편집기를 연다
- 전송 전 미해결 `{{variable}}`을 알려주는 프리플라이트 경고
- 관련 탭으로 바로 이동하고, 연결된 카드에 포커스와 잠깐의 하이라이트를 주는 클릭형 상태 배지
- 저장하거나 보내기 전에 어느 영역이 바뀌었는지 보여주는 요청 변경 칩
- 상태 스트립 `Used N` / Vars로 여는 Variable Usage disclosure — `{{variable}}`이 URL / 헤더 / 바디 / 인증 / 스크립트 어디에 쓰였는지 표시
- 인증값과 민감한 key/value 입력 마스킹 및 reveal 버튼
- 헤더 / 파라미터 일괄 붙여넣기
- 샘플 요청 불러오기, 가이드 열기, 환경 전환, URL 포커스 같은 빈 상태 퀵 액션

### WebSocket
- raw URL 또는 `{{variable}}` 치환 후 URL이 `ws://` / `wss://`로 시작하면 WebSocket 탭으로 감지
- 연결 handshake에 headers, query params, auth, 워크스페이스 default headers, 환경 변수, TLS override 설정 적용
- 기본 액션 버튼으로 연결 / 연결 해제, Body 탭은 전송할 텍스트 메시지 작성기로 사용
- 전송 / 수신 / close 진단 메시지를 WebSocket 로그로 표시하고, 수신한 binary frame은 base64로 표시
- WebSocket frame/message size limit으로 과도하게 큰 text/binary 메시지로부터 확장을 보호
- 요청별 protocol-level ping keepalive 옵션 제공. 기본값은 꺼짐
- 공개 echo 스모크 테스트에는 `wss://ws.ifelse.io`를 권장
- 공개 echo 서버는 가용성이나 idle timeout 정책이 바뀔 수 있음. `1006`으로 닫히면 다른 endpoint를 시도하거나 서버가 ping/pong을 지원할 때 keepalive를 켜서 확인

### 요청별 Settings 탭
- 탭별 timeout
- redirect follow 여부
- history 저장 여부
- TLS override: `Default`, `Strict`, `Insecure`
- 대용량 응답 보호를 위한 안전한 기본값이 적용된 최대 응답 크기 제한
- retry count / retry delay
- headers까지만 받고 종료
- default headers 건너뛰기
- scripts 비활성화
- 안전성이나 동작이 바뀌는 옵션에 대한 위험도 강조 표시
- 의미 있는 정적 HTML이 있으면 Preview를 자동으로 열기

### Body 타입
- `none`
- `json` (요청 Body는 textarea를 입력원으로 유지한 채 mirror 오버레이로 구문 강조)
- `xml` (동일 mirror 오버레이로 XML 구문 강조)
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`
- 필드/파일 개수 요약, 파일 칩, 텍스트/파일 구분이 강화된 form-data UX
- Body 타입이 바뀌고 내용이 비어 있지 않을 안전한 변환 확인(Convert / Keep text / Cancel). 자동 변환 없음. 중첩 form 변환·파일 form-data·Binary 파일 생성은 거절

### 인증
- No Auth
- Basic Auth
- Bearer Token
- API Key (`header`, `query`)

### 환경 변수
- Environment CRUD
- 활성 환경 전환
- `{{variable}}` 치환
- 중첩된 `{{variable}}`도 재귀적으로 치환하고, 미해결/순환 참조는 전송 전에 알려줌
- URL / Headers / Body / Auth / Scripts / 기타 편집 가능한 텍스트 입력에서 변수 자동완성
- URL / Headers / Params / Body / Auth / 파일 경로까지 치환
- Environments 제목 영역의 `Import Environment`로 Postman Environment JSON 또는 `.env` 파일 가져오기
- collections / history / environments / default headers / saved tabs를 분리하는 워크스페이스 로컬 저장 프로필

### Collections / History
- Collection / folder / request CRUD
- Drag & Drop 정렬
- Duplicate / Save As
- Run All Requests
- 실행 전에 포함할 요청을 선택할 수 있으며, 기본은 전체 선택이고 이번 실행에만 적용됩니다
- 현재 요청 강조와 재시도 대기 상태를 보여주는 컬렉션 러너 상태 표시
- 요청 사이 지연, 반복 실행, 실패 시 중지를 설정할 수 있는 컬렉션 러너 옵션
- Runner Stop은 진행 중 요청, 재시도 대기, 요청 사이 지연을 함께 중단
- 컬렉션 러너 결과에서 실패한 요청만 다시 실행
- 각 요청의 history 저장 설정이 켜져 있으면 컬렉션 러너 실행도 history에 저장
- `method:` / `host:` / `type:` 토큰을 지원하는 Collection 필터
- `status:` / `method:` / `host:` / `pinned:` 토큰을 지원하는 History 필터
- 실행 시점 스냅샷과 timing metadata 기반 history 저장
- 고정 항목은 유지하면서 `tessra.historyMaxItems` 기준 자동 정리
- History view 제목 영역의 History Settings 액션으로 보존 개수 설정 바로 열기
- 메서드/호스트 요약, 컬렉션/폴더 개수를 보여주는 더 촘촘한 사이드바 정보 밀도

### 응답 뷰어
- Body / Headers / Cookies / Tests 탭과, 의미 있는 정적 HTML이 있을 때만 표시되는 Preview 탭
- 동적인 HTML 페이지는 Body 탭에 남고, HTTP/HTTPS 원본 페이지는 `URL 열기` 액션으로 열 수 있음
- 읽기 좋은 응답 시간과 요청/수신 시각을 응답 메타데이터에 표시
- Pin / Compare를 항상 노출하는 sticky 응답 요약과 `⋯`의 복사·저장·Mode 유틸
- 활성 환경(`N vars`), 스크립트/히스토리 on·off, 기본헤더·요청 `Used N`, 위험 설정(TLS 비보안, 기본헤더 건너뜀 등)을 한눈에 구분하는 상태 스트립; Environment 세그먼트로 변수 편집기 토글; 워크스페이스 프로필은 스트립 확장 영역에 유지
- 이전 / 다음 이동, 대소문자 구분, 정규식 옵션을 갖춘 응답 본문 검색
- JSON 트리 뷰어
- XML `Pretty`, `Compact`, `Inline Children` 포맷
- Content-Type 기반 문법 강조
- gzip, deflate, Brotli 응답 자동 해제
- resolved URL, status line, raw headers, body를 바로 복사하는 빠른 액션
- 응답 본문 저장
- `Raw`, `Normalized`, `Pretty` 모드 응답 비교
- 비교 활성/비기본 Mode·Metadata를 작은 문맥 텍스트로 표시 (칩 월 없음)
- ignore headers / ignore JSON paths 기반 비교 설정
- 본문 줄 수와 changed / left-only / right-only 개수를 요약하는 비교 요약

### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- SHA-256, HMAC-SHA256, Base64, UUID v4, Unix timestamp용 Script utilities
- import로 들어온 스크립트는 요청 탭에서 명시적으로 신뢰 처리하기 전까지 비활성화 유지
- `tessra.scriptTimeoutMs` 설정으로 script 실행 제한 시간을 조정 가능
- script logs / test 결과 표시
- pass / fail / log 요약 배지와 첫 실패 강조
- Scripts 한 줄 흐름 안내(`환경 → 사전 요청 → 전송 → 테스트`)와 가이드 열기, 각 스크립트 편집기의 예제 삽입 버튼

예시:

```js
const body = pm.response.json();
pm.environment.set("sessionKey", String(body.key));
```

그다음 2번 요청에서 `{{sessionKey}}`를 사용하면 됩니다.

### Import / Export
- 흔한 축약 flag를 처리하고 지원하지 않거나 잘못된 옵션은 경고로 알려주는 cURL import
- Copy as cURL
- OpenAPI import
- `/users/{userId}` 같은 OpenAPI path parameter는 `/users/{{userId}}` 형태의 Tessra placeholder로 가져오기
- Tessra JSON collection import
- 컬렉션, 환경, 기본 헤더, 변수, 활성 환경 상태를 묶은 Tessra 워크스페이스 백업 export / import
- Postman collection import / export
- Postman environment import / export
- `.env` 파일을 Tessra Environment로 가져오기. 한 번만 복사되며, 로컬에만 저장되고, 원본 파일을 수정하거나 자동으로 활성 환경으로 바꾸지 않습니다.

#### Workspace Backup / Restore

Command Palette에서 `Tessra: Export Workspace Backup`과 `Tessra: Import Workspace Backup`을 실행해 Tessra 워크스페이스를 다른 PC로 옮길 수 있습니다. 워크스페이스 백업에는 컬렉션, 환경, 활성 환경, 워크스페이스 기본 헤더, 워크스페이스 변수가 포함됩니다.

워크스페이스 변수는 Tessra 백업에 보존되지만, 요청 전송 시 `{{variable}}` 치환은 활성 환경의 변수를 기준으로 동작합니다.

가져오기는 현재 활성 프로필의 데이터를 백업 내용으로 교체합니다. merge import가 아닙니다. 복원하기 전 기존 데이터는 `globalStorage/backups/tessra-preimport-YYYYMMDD-HHmmss.tessra-backup.json` 위치에 자동으로 사전 백업됩니다.

Workspace Backup / Restore v1에는 요청 히스토리와 열린 탭 / 탭 상태가 포함되지 않습니다. 백업 파일에는 토큰, API 키, Authorization 헤더, 환경 값 같은 민감정보가 들어갈 수 있으니 안전한 위치에 보관하고 public repo, 공유 폴더, 이슈 첨부파일 등에 올리지 마세요.

### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

## 설치

Tessra는 VS Code Marketplace에서 설치하세요. 오프라인 환경에서는 다운로드한 `.vsix` 파일을 **Extensions: Install from VSIX...**로 설치할 수 있습니다.

## 빠른 시작

1. Activity Bar에서 Tessra 열기
2. `Tessra: New Request` 실행 또는 `+` 클릭
3. 메서드와 URL 입력
4. params, headers, body, auth, scripts, request settings 입력
5. `Send` 클릭 또는 `Enter`
6. OpenAPI JSON 파일을 컬렉션으로 가져오려면 Command Palette에서 `Tessra: Import OpenAPI` 실행

환경 변수 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 인앱 가이드

VS Code 안에서 사용자 가이드를 보려면 `Tessra: Open Guide`를 실행하세요.

## 확장 설정

### `tessra.historyMaxItems`
- 타입: `number`
- 기본값: `500`
- 최소값: `50`
- 최대값: `5000`
- history에 유지할 non-pinned 항목의 최대 수
- pinned 항목은 유지되므로 전체 history 개수는 이 제한을 초과할 수 있음
- History view 제목 영역의 `Tessra: 히스토리 설정 열기`에서 바로 열 수 있음

### `tessra.allowInsecureCertificates`
- 타입: `boolean`
- 기본값: `false`
- 명시적으로 켠 경우에만 HTTPS 인증서 검증 비활성화
- 자체 서명 인증서를 쓰는 로컬 개발 환경용

### `tessra.scriptTimeoutMs`
- 타입: `number`
- 기본값: `3000`
- 최소값: `100`
- 최대값: `30000`
- pre-request/test script와 collection runner 내부 script 실행에 적용되는 제한 시간

### `tessra.displayLanguage`
- 타입: `string`
- 기본값: `en`
- 지원 값: `en`, `ko`, `ja`
- Tessra 패널, 프롬프트, 알림, 인앱 가이드 언어를 제어
- 인앱 가이드는 해당 언어 가이드 파일이 있을 때 현지화되고, 없으면 영어 가이드로 폴백
- VS Code locale은 Tessra 설정 레이블과 Command Palette 명령 이름에는 계속 반영됨
- 이 설정은 VS Code locale과 별개로 Tessra UI 자체만 바꿈
- Command Palette에서 `Tessra: Change Display Language`로도 바로 변경 가능

### `tessra.requestPanelTheme`
- 타입: `string`
- 기본값: `default`
- 지원 값: `default`, `minimal-cool`, `product`, `bold-color`
- Tessra 요청 패널 webview의 색상/토큰 스킨 (Quiet Instrument 레이아웃 공유)
- 프리셋은 액센트·메서드 색 강도·표면 틴트·테두리 대비만 바꾸며, 간격·radius·컴포넌트 구조는 바꾸지 않음
- Command Palette에서 `Tessra: Change Request Panel Theme`로도 바로 변경 가능

### `tessra.workspaceProfile`
- 타입: `string`
- 기본값: `default`
- collections / history / environments / default headers / saved tabs에 사용할 로컬 저장 프로필을 전환
- Command Palette에서 `Tessra: Change Workspace Profile`로 빠르게 전환하거나 새 프로필 생성 가능
- `default`는 평소 메인 작업용으로 두고, 다른 프로젝트나 import 실험, 임시 테스트가 기존 데이터와 섞이면 안 될 때 새 프로필을 만드는 것을 추천
- 기준을 단순하게 잡으면 좋습니다. 서로 다른 프로젝트/작업 흐름은 프로필로, 같은 프로젝트 안의 `local` / `staging` / `prod` 차이는 환경으로 나누면 가장 덜 헷갈립니다

## 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
- `Enter`: URL 입력창에서 요청 전송
- `Ctrl+Enter`: 요청 전송
- `Ctrl+S` / macOS에서는 `Cmd+S`: 현재 요청 저장
- `Ctrl+Shift+S` / macOS에서는 `Cmd+Shift+S`: 다른 이름으로 저장
- `Ctrl+F` / macOS에서는 `Cmd+F`: 응답 검색 포커스
- `Alt+1..6`: 요청 탭 전환
- `Alt+Shift+1..5`: 응답 탭 전환

macOS에서는 `Cmd`를 사용합니다.

## 로컬 저장 위치

모든 데이터는 VS Code `globalStorage` 아래 JSON 파일로 저장됩니다. 기본 프로필은 루트에 저장되고, 사용자 지정 워크스페이스 프로필은 `profiles/<프로필명>/` 아래 같은 파일 구조로 분리 저장됩니다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `variables.json`
- `tab-state.json`

저장된 JSON 파일을 파싱할 수 없으면 Tessra는 원본 옆에 `.corrupt-*` 백업을 남기고 경고를 표시한 뒤, 해당 파일이 다시 저장될 때까지 기본값을 사용합니다.

일반적인 경로:

- Windows: `%APPDATA%\Code\User\globalStorage\tessra.tessra\`
- macOS: `~/Library/Application Support/Code/User/globalStorage/tessra.tessra/`
- Linux: `~/.config/Code/User/globalStorage/tessra.tessra/`

## 원칙

- 텔레메트리 없음
- 로그인 없음
- 클라우드 동기화 없음
- Webview 외부 CDN 금지
- 로컬 우선 데이터 소유권
