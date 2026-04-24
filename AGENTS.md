# Tessra — 프로젝트 규칙

## 프로젝트 개요
Tessra는 VS Code 안에서 동작하는 offline-first REST API 클라이언트 확장이다.

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
- Node.js 내장 `http` / `https`
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

## 현재 프로젝트 구조
```text
tessra/
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
│   │   ├── ResponseCompareService.ts
│   │   ├── ScriptRunner.ts
│   │   ├── StorageService.ts
│   │   └── VariableService.ts
│   ├── test/
│   │   └── unit/
│   └── webview/
│       └── hljs.ts
├── package.json
├── README.md
├── README.ko.md
├── AGENTS.md
└── CLAUDE.md
```

## 현재 구현 상태

### 완료된 기능
1. 멀티 탭 요청 편집기
2. HTTP 요청 전송, 취소, 응답 표시
3. Collections / folders / requests CRUD와 실행
4. Environments CRUD와 `{{variable}}` 치환
5. History 저장, pin, filter, 자동 정리
6. 인증: Basic, Bearer, API Key
7. Body 타입: JSON, XML, form-urlencoded, form-data, binary, raw
8. Pre-request / Test scripts (`pm`, `env`, `test`, `expect`, `assert` 내장 지원, 접이식 stepper 도움말, 인앱 예제 힌트 포함, import된 스크립트는 명시적으로 신뢰 처리하기 전까지 기본 비활성화)
9. OpenAPI / Postman collection/environment import/export
10. cURL import / copy as cURL
11. 코드 생성: `fetch`, `axios`, `Java HttpURLConnection`
12. 응답 비교: `Raw`, `Normalized`, `Pretty`, ignore headers / ignore JSON paths
13. 요청별 Settings 탭: timeout, redirects, TLS override, max size, retries, stop after headers, save to history, skip default headers, disable scripts
14. HTML preview, JSON tree, XML format options, 응답 시간/요청·수신 시각 메타데이터, richer empty states, 요청 변경 요약, 변수 사용처, 변수 자동완성, 응답 빠른 복사, 고급 필터 UX, 상단 상태 배지 linked focus/highlight
15. `tessra.displayLanguage` 설정 기반 UI 언어 선택 (Tessra 패널/알림/인앱 가이드 대상, 기본 영어, 현재 `en`/`ko`/`ja`, 설정/명령 레이블은 VS Code locale 유지)
16. `tessra.requestPanelTheme` 설정과 Command Palette 기반 요청 패널 테마 프리셋 선택 (`default`, `minimal-cool`, `product`, `bold-color`)
17. `tessra.workspaceProfile` 설정 기반 워크스페이스 로컬 저장 프로필 분리와 현재 프로필 표시 (`default`는 메인 작업용, 사용자 지정 프로필은 프로젝트/실험 분리용)
18. 컬렉션 러너 실패 요청만 재실행, 요청별 history 저장 설정을 따른 실행 결과 저장

### 남아 있는 큰 항목
1. WebSocket 지원
2. 추가 UI 폴리싱과 사용성 디테일 보강
3. 수동 E2E 점검 범위 확대

## 빌드 & 테스트
```bash
npm run build
npm run watch
npm test
npx vsce package
```

수동 검증은 VS Code에서 `F5`로 Extension Development Host를 띄워 수행한다.

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
- 기존 기능을 건드릴 때는 webview 파싱 오류와 상태 복원 흐름을 가장 먼저 확인한다
- `package.json`의 `engines.vscode` 버전은 임의로 올리지 않는다
- 보안 관련 기본값은 안전한 쪽을 유지하고, 완화 옵션은 opt-in으로 둔다
- 문서는 실제 코드 기준으로 유지하고, 기능 추가/변경 시 같은 턴에 반영한다
