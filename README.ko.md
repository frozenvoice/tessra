# Arc Client

VS Code 안에서 동작하는 로컬 우선 REST API 클라이언트입니다.

로그인도 없고, 클라우드 동기화도 없고, 핵심 기능을 잠가두는 유료 장벽도 없습니다.

[English README](./README.md)

Arc Client는 계정, 동기화, 요금제 제약 없이 VS Code 안에서 빠르게 요청을 만들고 실행하려는 개발자를 위한 확장입니다. 모든 데이터는 로컬에 남고, 네트워크 호출은 사용자가 직접 보내는 API 요청에서만 발생합니다.

## 왜 Arc Client인가요?

- 오프라인 우선 워크플로
- 로그인 불필요
- 클라우드 의존성 없음
- 로컬 JSON 저장
- cURL / OpenAPI / Postman import / export 지원
- Scripts, collections, environments, response compare, code generation 지원
- VS Code Webview + TreeView 기반
- Node.js 내장 `http` / `https` 사용

## 기능

### 요청 작성
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집기와 탭 고정
- URL 입력창에서 `Enter`로 바로 전송
- `Ctrl+Enter` / macOS에서는 `Cmd+Enter` 전송
- 마지막 정상 응답을 유지한 채 진행 중 요청 취소
- 요청 상태 스트립, 빈 상태 화면, 응답 상태 피드백, 정돈된 액션 버튼 UI
- 환경, 인증, 기본 헤더, 스크립트, 히스토리 동작을 한눈에 보여주는 상단 상태 배지
- 전송 전 미해결 `{{variable}}`을 알려주는 프리플라이트 경고
- 관련 탭으로 바로 이동할 수 있는 클릭형 상태 배지
- 저장하거나 보내기 전에 어느 영역이 바뀌었는지 보여주는 요청 변경 칩
- `{{variable}}`이 URL / 헤더 / 바디 / 인증 / 스크립트 어디에 쓰였는지 보여주는 변수 사용처 카드
- 인증값과 민감한 key/value 입력 마스킹 및 reveal 버튼
- 헤더 / 파라미터 일괄 붙여넣기
- 샘플 요청 불러오기, 가이드 열기, 환경 전환, URL 포커스 같은 빈 상태 퀵 액션

### 요청별 Settings 탭
- 탭별 timeout
- redirect follow 여부
- history 저장 여부
- TLS override: `Default`, `Strict`, `Insecure`
- 최대 응답 크기 제한
- retry count / retry delay
- headers까지만 받고 종료
- default headers 건너뛰기
- scripts 비활성화
- 안전성이나 동작이 바뀌는 옵션에 대한 위험도 강조 표시
- 의미 있는 정적 HTML이 있으면 Preview를 자동으로 열기

### Body 타입
- `none`
- `json`
- `xml`
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`
- 필드/파일 개수 요약, 파일 칩, 텍스트/파일 구분이 강화된 form-data UX

### 인증
- No Auth
- Basic Auth
- Bearer Token
- API Key (`header`, `query`)

### 환경 변수
- Environment CRUD
- 활성 환경 전환
- `{{variable}}` 치환
- URL / Headers / Body / Auth / Scripts / 기타 편집 가능한 텍스트 입력에서 변수 자동완성
- URL / Headers / Params / Body / Auth / 파일 경로까지 치환
- collections / history / environments / default headers / saved tabs를 분리하는 워크스페이스 로컬 저장 프로필

### Collections / History
- Collection / folder / request CRUD
- Drag & Drop 정렬
- Duplicate / Save As
- Run All Requests
- 현재 요청 강조와 재시도 대기 상태를 보여주는 컬렉션 러너 상태 표시
- 컬렉션 러너 결과에서 실패한 요청만 다시 실행
- `method:` / `host:` / `type:` 토큰을 지원하는 Collection 필터
- `status:` / `method:` / `host:` / `pinned:` 토큰을 지원하는 History 필터
- 실행 시점 스냅샷 기반 history 저장
- `arc-client.historyMaxItems` 기준 자동 정리
- 메서드/호스트 요약, 컬렉션/폴더 개수를 보여주는 더 촘촘한 사이드바 정보 밀도

### 응답 뷰어
- Body / Headers / Cookies / Tests 탭과, 의미 있는 정적 HTML이 있을 때만 표시되는 Preview 탭
- 동적인 HTML 페이지는 Body 탭에 남고, 대신 `URL 열기` 액션을 사용할 수 있음
- 검색 / 비교 / 저장 액션이 따라오는 sticky 응답 툴바
- 활성 환경, 현재 프로필, 기본 헤더, 스크립트, 히스토리 동작을 보여주는 상단 상태 배지
- 이전 / 다음 이동, 대소문자 구분, 정규식 옵션을 갖춘 응답 본문 검색
- JSON 트리 뷰어
- XML `Pretty`, `Compact`, `Inline Children` 포맷
- Content-Type 기반 문법 강조
- resolved URL, status line, raw headers, body를 바로 복사하는 빠른 액션
- 응답 본문 저장
- `Raw`, `Normalized`, `Pretty` 모드 응답 비교
- 현재 비교 모드, 메타데이터 요약 사용 여부, pin 준비 상태를 보여주는 비교 상태 배지
- ignore headers / ignore JSON paths 기반 비교 설정
- 본문 줄 수와 changed / left-only / right-only 개수를 요약하는 비교 요약

### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs / test 결과 표시
- pass / fail / log 요약 배지와 첫 실패 강조

### Import / Export
- cURL import
- Copy as cURL
- OpenAPI import
- Arc JSON collection import
- Postman collection import / export
- Postman environment import / export

### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

## 설치

```bash
npm install
npm run build
npx vsce package
```

그 다음 VS Code에서:

1. `Extensions` 열기
2. 우측 상단 `...` 클릭
3. `Install from VSIX...` 선택
4. 생성된 `.vsix` 파일 선택

## 빠른 시작

1. Activity Bar에서 Arc Client 열기
2. `Arc: New Request` 실행 또는 `+` 클릭
3. 메서드와 URL 입력
4. params, headers, body, auth, scripts, request settings 입력
5. `Send` 클릭 또는 `Enter`
6. OpenAPI JSON 파일을 컬렉션으로 가져오려면 Command Palette에서 `Arc: Import OpenAPI` 실행

환경 변수 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 인앱 가이드

VS Code 안에서 사용자 가이드를 보려면 `Arc: Open Guide`를 실행하세요.

## 확장 설정

### `arc-client.historyMaxItems`
- 타입: `number`
- 기본값: `100`
- history에 유지할 최대 항목 수

### `arc-client.allowInsecureCertificates`
- 타입: `boolean`
- 기본값: `false`
- 명시적으로 켠 경우에만 HTTPS 인증서 검증 비활성화
- 자체 서명 인증서를 쓰는 로컬 개발 환경용

### `arc-client.displayLanguage`
- 타입: `string`
- 기본값: `en`
- 지원 값: `en`, `ko`, `ja`
- Arc Client 패널, 프롬프트, 알림 언어를 제어
- 인앱 가이드는 해당 언어 가이드 파일이 있을 때 현지화되고, 없으면 영어 가이드로 폴백
- 이제 VS Code locale은 Arc Client UI를 직접 바꾸지 않음
- Command Palette에서 `Arc: Change Display Language`로도 바로 변경 가능

### `arc-client.workspaceProfile`
- 타입: `string`
- 기본값: `default`
- collections / history / environments / default headers / saved tabs에 사용할 로컬 저장 프로필을 전환
- Command Palette에서 `Arc: Change Workspace Profile`로 빠르게 전환하거나 새 프로필 생성 가능
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
- `tab-state.json`

일반적인 경로:

- Windows: `%APPDATA%\Code\User\globalStorage\arc.arc-client\`
- macOS: `~/Library/Application Support/Code/User/globalStorage/arc.arc-client/`
- Linux: `~/.config/Code/User/globalStorage/arc.arc-client/`

## 개발

```bash
npm run build
npm run watch
npm test
npx vsce package
```

VS Code에서 `F5`로 Extension Development Host를 띄워 확인합니다.

## 기술 스택

- TypeScript (`strict`)
- VS Code Extension API (`^1.74.0`)
- Node.js 내장 `http` / `https`
- Webview + TreeView
- esbuild
- Mocha

## 원칙

- 텔레메트리 없음
- 로그인 없음
- 클라우드 동기화 없음
- Webview 외부 CDN 금지
- 로컬 우선 데이터 소유권
