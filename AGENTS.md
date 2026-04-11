# Arc Client - 프로젝트 규칙

## 프로젝트 개요
Offline-first VS Code REST API 클라이언트 확장.

Thunder Client의 핵심 사용성을 로그인이나 유료 제한 없이 로컬 환경에서 구현한다. 모든 데이터는 사용자 PC에만 저장되며, 네트워크 호출은 사용자가 직접 보내는 API 요청에만 사용된다.

## 핵심 원칙
- 외부 네트워크 호출 금지: 텔레메트리, 업데이트 체크, 인증 서버 호출 없음
- 로컬 저장 우선: VS Code `globalStorage` 아래 JSON 파일 기반 저장
- 의존성 최소화: 런타임은 Node.js 내장 `http` / `https` 중심, 빌드는 `esbuild`
- 오프라인 우선: 로그인, 계정, 클라우드 동기화 없이 동작
- 한국어 주석: 코드 주석과 커밋 메시지는 한국어로 작성

## 기술 스택
- TypeScript (`strict` mode)
- VS Code Extension API (최소 `1.74.0`)
- Webview 패널 기반 요청 UI
- TreeView 기반 사이드바 (`Collections`, `Environments`, `History`)
- Node.js 내장 `http` / `https`
- esbuild
- vsce
- Mocha

## 코딩 규칙
- 파일명: camelCase (서비스, 모델), PascalCase (클래스, 프로바이더)
- 인터페이스에 `I` 접두사 사용 금지
- 에러 처리는 `try/catch` 우선
- 사용자에게 보이는 실패는 `vscode.window.showErrorMessage`로 알림
- 비동기는 `async/await` 사용, Promise chain 지양
- Webview ↔ Extension 통신은 `postMessage` 기반, 메시지 타입은 enum으로 관리
- Webview에서 외부 리소스 로딩 금지
- 모든 아이콘은 VS Code 내장 codicon 사용

## 현재 프로젝트 구조
```text
arc-client/
├── src/
│   ├── extension.ts
│   ├── models/
│   │   └── types.ts
│   ├── panels/
│   │   ├── GuidePanel.ts
│   │   └── RequestPanel.ts
│   ├── providers/
│   │   ├── CollectionTreeProvider.ts
│   │   ├── EnvironmentTreeProvider.ts
│   │   └── HistoryTreeProvider.ts
│   ├── services/
│   │   ├── AuthService.ts
│   │   ├── CodegenService.ts
│   │   ├── CurlService.ts
│   │   ├── HttpService.ts
│   │   ├── ImportExportService.ts
│   │   ├── RequestBodyService.ts
│   │   ├── ScriptRunner.ts
│   │   ├── StorageService.ts
│   │   └── VariableService.ts
│   ├── test/
│   │   └── unit/
│   └── webview/
│       └── hljs.ts
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── .vscodeignore
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## 현재 구현 상태

### 완료된 기능
1. 스캐폴딩 및 VS Code 확장 등록
2. Webview 요청 패널과 멀티 탭 UI
3. HTTP 요청 전송 및 취소
4. Collections CRUD, 폴더, 정렬, 필터, 컬렉션 실행
5. Environments CRUD, 활성 환경 전환, `{{변수}}` 치환
6. History 저장, pin, 필터, 자동 정리
7. 인증: Basic, Bearer, API Key
8. Body 타입: JSON, XML, form-urlencoded, form-data, binary, raw
9. Pre-request / Test 스크립트
10. Import / Export: Arc JSON import, Postman collection/environment import/export, cURL import/export
11. 코드 생성: fetch, axios, Java HttpURLConnection
12. 응답 뷰어: body, headers, cookies, tests, 저장, 비교

### 남은 큰 항목
1. WebSocket 지원
2. UI 폴리싱 및 추가 단축키
3. 엣지케이스 보강과 회귀 테스트 확대

## 빌드 & 테스트
```bash
npm run build
npm run watch
npm test
npx vsce package
```

VS Code에서 `F5`로 Extension Development Host를 실행해 수동 검증한다.

## 저장 데이터
모든 데이터는 VS Code `globalStorage` 아래 JSON 파일로 저장한다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

## 주의사항
- 기존 코드 수정 전 영향 범위를 먼저 확인할 것
- `package.json`의 `engines.vscode` 버전은 임의로 올리지 말 것
- 요청 보안 설정은 기본적으로 안전한 값 유지
- 문서 업데이트 시 실제 코드 구조와 설정 키를 기준으로 작성할 것
