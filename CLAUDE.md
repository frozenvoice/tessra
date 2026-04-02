# Arc Client — 프로젝트 규칙

## 프로젝트 개요
Offline-first VS Code REST API 클라이언트 확장.
Thunder Client의 기능을 로그인/유료제한 없이 완전 오프라인으로 구현한다. No login required, no cloud dependency.

## 핵심 원칙
- **외부 네트워크 호출 절대 금지**: 텔레메트리, 업데이트 체크, 인증 서버 호출 없음. HTTP 요청은 오직 사용자가 명시적으로 보내는 API 호출만.
- **모든 데이터 로컬 저장**: VS Code globalStorage + workspaceStorage 활용, JSON 파일 기반.
- **의존성 최소화**: 런타임 node_modules 없이 esbuild로 번들링. Node.js 내장 http/https 모듈만 사용.
- **한국어 주석**: 코드 주석과 커밋 메시지는 한국어로 작성.

## 기술 스택
- TypeScript (strict mode)
- VS Code Extension API (최소 1.74.0)
- Webview (HTML/CSS/JS) — 요청 패널 UI
- TreeView — 사이드바 (컬렉션, 환경변수, 히스토리)
- esbuild — 번들링
- vsce — VSIX 패키징

## 코딩 규칙
- 파일명: camelCase (서비스, 모델), PascalCase (클래스/프로바이더)
- 인터페이스 접두사 I 안 붙임 (예: Request, Collection, Environment)
- 에러 처리: try-catch 필수, 사용자에게 vscode.window.showErrorMessage로 알림
- 비동기: async/await 사용, Promise chain 지양
- Webview ↔ Extension 통신: postMessage 기반, 메시지 타입을 enum으로 관리

## 프로젝트 구조
```
arc-client/
├── src/
│   ├── extension.ts              # 확장 활성화/비활성화
│   ├── providers/                # TreeView 프로바이더
│   │   ├── CollectionTreeProvider.ts
│   │   ├── EnvironmentTreeProvider.ts
│   │   └── HistoryTreeProvider.ts
│   ├── panels/
│   │   └── RequestPanel.ts       # Webview 패널 관리
│   ├── services/
│   │   ├── HttpService.ts        # HTTP 요청 실행 (Node.js http/https)
│   │   ├── StorageService.ts     # JSON 파일 읽기/쓰기
│   │   ├── VariableService.ts    # {{변수}} 치환
│   │   ├── ScriptRunner.ts       # pre-request & test 스크립트
│   │   └── ImportExportService.ts
│   ├── models/
│   │   └── types.ts              # 타입 정의
│   └── webview/
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── .vscodeignore
├── CLAUDE.md
└── README.md
```

## 구현 순서 (단계별)
1. 스캐폴딩: package.json, tsconfig, esbuild, 기본 extension.ts
2. Webview 패널: 요청 입력 + 전송 + 응답 표시 (기본 GET만)
3. HTTP 서비스: Node.js http/https로 실제 요청 전송
4. 컬렉션: TreeView + CRUD + 로컬 저장
5. 환경변수: 변수 관리 + {{변수}} 치환
6. 히스토리: 자동 저장 + 드래그앤드롭 정렬
7. 인증: Basic, Bearer, API Key
8. Body 타입: JSON, form-data, form-urlencoded, XML, raw, binary
9. 스크립트: pre-request & test
10. Import/Export: Postman, cURL, 백업
11. 코드 생성: cURL, fetch, axios, Java HttpURLConnection
12. WebSocket 지원
13. UI 폴리싱, 단축키, 엣지케이스

## 빌드 & 테스트
```bash
npm run build          # esbuild 번들링
npm run watch          # 개발 중 자동 빌드
npx vsce package       # VSIX 생성
# F5로 Extension Development Host 실행하여 테스트
```

## 주의사항
- 기존 코드 수정 시 반드시 영향 범위 확인 후 진행
- Webview에서 외부 리소스 로딩 금지 (CDN 등)
- 모든 아이콘은 VS Code 내장 codicon 사용
- package.json의 engines.vscode 버전 변경 금지 (오프라인 환경 호환성)
