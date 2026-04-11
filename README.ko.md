# Arc Client

VS Code 안에서 쓰는 로컬 우선 REST API 클라이언트입니다.

로그인도 없고, 클라우드 동기화도 없고, 핵심 기능에 유료 장벽도 없습니다.

[English README](./README.md)

Arc Client는 Thunder Client 스타일의 빠른 워크플로를 VS Code 안에서 그대로 쓰고 싶은 개발자를 위한 확장입니다. 텔레메트리, 로그인, 클라우드 동기화 없이 로컬 JSON 저장만으로 동작하며, 실제 네트워크 호출은 사용자가 직접 보내는 API 요청에만 한정됩니다.

## 핵심 특징

### 요청 편집
- 지원 메서드: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집
- 탭별 타임아웃 설정
- 전송 중 요청 취소
- Params / Headers / Auth / Scripts / Settings 탭

### 바디 타입
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
- API Key
  - Header 추가
  - Query parameter 추가

### 환경변수
- 환경 CRUD
- 활성 환경 전환
- `{{variable}}` 치환
- URL, 헤더, 파라미터, 바디, 인증, 파일 경로까지 치환 지원

### 컬렉션 / 히스토리
- 컬렉션 / 폴더 / 요청 CRUD
- Drag & Drop 정렬
- Duplicate / Save As
- Run All Requests
- 히스토리 pin / filter
- `arc-client.historyMaxItems` 기반 자동 정리

### 응답 뷰어
- Body / Headers / Cookies / Tests 탭
- JSON 트리 보기
- Content-Type 기반 문법 강조
- 응답 본문 저장
- 응답 비교

### 스크립트
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- 스크립트 로그 및 테스트 결과 표시

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

VS Code에서:

1. `Extensions` 열기
2. 우측 상단 `...`
3. `Install from VSIX...`
4. 생성된 `.vsix` 파일 선택

## 빠른 시작

1. Activity Bar에서 Arc Client 열기
2. `Arc: New Request` 실행 또는 `+` 버튼 클릭
3. 메서드와 URL 입력
4. 필요한 탭에서 요청 정보 입력
5. `Send` 또는 `Ctrl+Enter`

환경변수 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 스크린샷

마켓용 스크린샷은 [images/marketplace](/E:/Dev/GitHub/arc-client/images/marketplace)에 두는 걸 권장합니다.

추천 파일명:

- `screenshot-01-request-workflow.png`
- `screenshot-02-collections-environments-history.png`
- `screenshot-03-scripts-and-tests.png`
- `screenshot-04-import-flow.png`
- `screenshot-05-code-generation.png`

추천 촬영 순서:

1. 멀티 탭 요청 작성과 응답 확인
2. 컬렉션 / 환경 / 히스토리 사이드바
3. 스크립트와 테스트 결과
4. cURL / Postman 가져오기 흐름
5. 코드 생성 결과

캡처한 뒤에는 README에 아래처럼 추가하면 됩니다.

```md
![Multi-tab request workflow](./images/marketplace/screenshot-01-request-workflow.png)
![Collections, environments, and history](./images/marketplace/screenshot-02-collections-environments-history.png)
![Scripts and test results](./images/marketplace/screenshot-03-scripts-and-tests.png)
```

## 설정

### `arc-client.historyMaxItems`
- 타입: `number`
- 기본값: `100`
- 히스토리 최대 보관 개수

### `arc-client.allowInsecureCertificates`
- 타입: `boolean`
- 기본값: `false`
- 명시적으로 켠 경우에만 HTTPS 인증서 검증 비활성화
- 자체 서명 인증서를 쓰는 로컬 개발 환경용 옵션

## 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
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

VS Code에서 `F5`로 Extension Development Host를 실행해 확인합니다.

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
- Webview에서 외부 CDN 사용 금지
- 데이터는 로컬 우선
