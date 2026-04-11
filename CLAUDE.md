# Arc Client 프로젝트 메모

## 프로젝트 요약
Arc Client는 VS Code 안에서 동작하는 offline-first REST API 클라이언트다.

- 로그인 없음
- 클라우드 의존성 없음
- 텔레메트리 없음
- 모든 데이터는 로컬 JSON 파일 저장
- 실제 네트워크 호출은 사용자가 직접 보내는 API 요청만 허용

## 개발 원칙
- 외부 서비스 연동을 새로 추가하지 않는다.
- 런타임 의존성은 최소화한다.
- 요청 전송은 Node.js 내장 `http` / `https` 모듈을 우선 사용한다.
- Webview는 외부 CDN 없이 번들된 리소스만 사용한다.
- 코드 주석과 커밋 메시지는 한국어를 우선한다.

## 현재 구현 상태 (2026-04-11 기준)

### 완료된 기능

#### 요청 작성 / 전송
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집
- 요청 타임아웃 설정
- 전송 중 취소
- 요청별 응답 보기

#### Body 타입
- `none`
- `json`
- `xml`
- `form-urlencoded`
- `form-data`
- `binary`
- `raw`

#### 인증
- No Auth
- Basic Auth
- Bearer Token
- API Key (`header`, `query`)

#### 환경변수
- 환경 CRUD
- 활성 환경 전환
- `{{변수}}` 치환
- URL / Headers / Params / Body / Auth / 파일 경로 치환

#### Collections
- 컬렉션 / 폴더 / 요청 CRUD
- Duplicate / Save As
- Drag & Drop 정렬
- 필터
- Run All Requests

#### History
- 자동 저장
- pin / unpin
- 필터
- `arc-client.historyMaxItems` 기반 자동 정리
- 실행 시점 스냅샷 저장

#### Response 뷰어
- Body / Headers / Cookies / Tests
- JSON 트리
- Content-Type 기반 문법 강조
- 응답 본문 저장
- 응답 비교

#### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- 환경변수 수정 반영
- 로그 및 테스트 결과 표시

#### Import / Export
- cURL import
- Copy as cURL
- Arc JSON collection import
- Postman collection import / export
- Postman environment import / export

#### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

#### 보안 / 설정
- HTTPS 인증서 검증은 기본적으로 활성화
- `arc-client.allowInsecureCertificates = false`가 기본값
- 필요한 경우에만 자체 서명 인증서 허용 가능

## 현재 프로젝트 구조
```text
src/
├── extension.ts
├── models/
│   └── types.ts
├── panels/
│   ├── GuidePanel.ts
│   └── RequestPanel.ts
├── providers/
│   ├── CollectionTreeProvider.ts
│   ├── EnvironmentTreeProvider.ts
│   └── HistoryTreeProvider.ts
├── services/
│   ├── AuthService.ts
│   ├── CodegenService.ts
│   ├── CurlService.ts
│   ├── HttpService.ts
│   ├── ImportExportService.ts
│   ├── RequestBodyService.ts
│   ├── ScriptRunner.ts
│   ├── StorageService.ts
│   └── VariableService.ts
├── test/
│   └── unit/
└── webview/
    └── hljs.ts
```

## 저장 구조
VS Code `globalStorage` 아래 JSON 파일 사용:

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

## 아직 남아 있는 큰 작업
- WebSocket 지원
- UI 폴리싱
- 단축키 및 사용성 추가 개선
- 회귀 테스트 확대

## 빌드 / 테스트
```bash
npm run build
npm run watch
npm test
npx vsce package
```

개발 검증은 VS Code `F5`로 Extension Development Host를 띄워 진행한다.

## 메모
- `engines.vscode` 버전은 임의 변경하지 않는다.
- 문서 업데이트 시 실제 코드 기준으로 맞춘다.
- 저장소 목표는 "로그인 없는 오프라인 REST 클라이언트"를 유지하는 것이다.
