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
- cURL / Postman import / export 지원
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
- HTML 응답 시 Preview 기본 열기

### Body 타입
- `none`
- `json`
- `xml`
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`

### 인증
- No Auth
- Basic Auth
- Bearer Token
- API Key (`header`, `query`)

### 환경 변수
- Environment CRUD
- 활성 환경 전환
- `{{variable}}` 치환
- URL / Headers / Params / Body / Auth / 파일 경로까지 치환

### Collections / History
- Collection / folder / request CRUD
- Drag & Drop 정렬
- Duplicate / Save As
- Run All Requests
- History pin / filter
- 실행 시점 스냅샷 기반 history 저장
- `arc-client.historyMaxItems` 기준 자동 정리

### 응답 뷰어
- Body / Headers / Cookies / Tests / Preview 탭
- JSON 트리 뷰어
- XML `Pretty`, `Compact`, `Inline Children` 포맷
- Content-Type 기반 문법 강조
- 응답 본문 저장
- `Raw`, `Normalized`, `Pretty` 모드 응답 비교
- ignore headers / ignore JSON paths 기반 비교 설정

### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs / test 결과 표시

### Import / Export
- cURL import
- Copy as cURL
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

환경 변수 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 스크린샷

마켓용 스크린샷은 [images/marketplace](/E:/Dev/GitHub/arc-client/images/marketplace)에 두는 것을 권장합니다.

추천 파일명:

- `screenshot-01-request-workflow.png`
- `screenshot-02-collections-environments-history.png`
- `screenshot-03-scripts-and-tests.png`
- `screenshot-04-import-flow.png`
- `screenshot-05-code-generation.png`

추천 촬영 순서:

1. 멀티 탭 요청 작성과 응답 확인
2. Collections / environments / history 사이드바
3. scripts와 test 결과
4. cURL / Postman import 흐름
5. 코드 생성 결과

README에는 아래처럼 추가하면 됩니다.

```md
![Multi-tab request workflow](./images/marketplace/screenshot-01-request-workflow.png)
![Collections, environments, and history](./images/marketplace/screenshot-02-collections-environments-history.png)
![Scripts and test results](./images/marketplace/screenshot-03-scripts-and-tests.png)
```

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
- 가이드는 해당 언어 README가 있을 때만 현지화되고, 없으면 영어 README로 폴백
- 이제 VS Code locale은 Arc Client UI를 직접 바꾸지 않음
- Command Palette에서 `Arc: Change Display Language`로도 바로 변경 가능

## 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
- `Enter`: URL 입력창에서 요청 전송
- `Ctrl+Enter`: 요청 전송

macOS에서는 `Cmd`를 사용합니다.

## 로컬 저장 위치

모든 데이터는 VS Code `globalStorage` 아래 JSON 파일로 저장됩니다.

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
