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

## 현재 구현 상태 (2026-04-07 기준)

### ✅ 완료된 기능

#### HTTP 요청
- GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS 메서드 지원
- Node.js 내장 http/https 모듈로 요청 전송 (외부 의존성 없음)
- 요청별 타임아웃 설정 (0 = 무제한)
- 요청 중 취소 (Stop 버튼)
- self-signed 인증서 허용 (`rejectUnauthorized: false`)
- 바이너리 응답 처리 (Base64 인코딩)

#### Body 타입
- none, json, xml, form (form-urlencoded), raw
- Body 타입 변경 시 Content-Type 자동 설정

#### 인증 (Auth)
- None, Basic Auth, Bearer Token, API Key
- API Key: header 또는 query parameter 추가 위치 선택
- 모든 인증 필드에 {{변수}} 치환 지원

#### 컬렉션 (Collections)
- 컬렉션 CRUD (생성, 이름변경, 삭제)
- 폴더 계층 구조 (다단계 중첩)
- 요청 저장, 복제(Duplicate), Save As (다른 컬렉션으로 복사)
- 드래그 & 드롭 (순서 변경, 폴더 간 이동, 순환 참조 방지)
- 컬렉션/폴더 일괄 실행 (Run All Requests) — 순차 실행, 진행률 표시, 중단 가능
- 필터 검색 (이름, URL, 메서드 기준)
- Collapse All

#### 환경변수 (Environments)
- 환경 CRUD (생성, 이름변경, 삭제)
- 변수 편집 (인라인 에디터, key-value)
- 활성 환경 설정/해제, Quick Picker로 전환
- 상태바에 활성 환경 이름 표시
- {{변수}} 치환: URL, 헤더, 파라미터, Body, 인증 필드 전체 적용
- 미해결 변수 감지 및 경고 (빨간 물결 밑줄 + 에러 메시지)
- 드래그 & 드롭 순서 변경

#### 기본 헤더 (Default Headers)
- 전역 기본 헤더 편집 (기본값: User-Agent, Accept)
- 요청 헤더가 기본 헤더를 오버라이드 (대소문자 무시 매칭)

#### 히스토리 (History)
- 요청 자동 저장
- Pin/Unpin (고정된 항목은 자동 정리에서 제외)
- 최대 보관 개수 설정 (`arc-client.historyMaxItems`, 기본 100)
- 필터 검색 (메서드, URL, 상태코드)
- 드래그 & 드롭 순서 변경
- 개별 삭제, 전체 삭제 (pinned 항목 보호)

#### Import/Export
- cURL 임포트 (bash, Windows cmd 형식 자동 감지)
- cURL 복사 (Copy as cURL) — bash 형식 생성
- 컬렉션 JSON 임포트 (유효성 검사, ID 자동 재생성)

#### 응답 표시 (Response)
- 상태 코드 컬러 배지 (2xx 초록, 3xx 노랑, 4xx/5xx 빨강)
- 응답 시간 (ms), 응답 크기 (bytes) 표시
- 응답 Body: JSON 포맷팅 + 구문 강조 (highlight.js), XML/HTML 감지
- JSON 트리 뷰 (접기/펼치기)
- 응답 헤더 테이블
- 쿠키 파싱 및 표시 (Set-Cookie → 개별 쿠키 분리)
- 요청 헤더 표시 (변수 치환 후 실제 전송된 헤더)
- 응답 Body 복사, 파일로 저장 (Content-Type 기반 확장자 추론)
- 응답 비교 (Diff): Pin Response로 최대 2개 저장 → Compare로 VS Code diff 에디터 비교
- 빠른 비교: 응답 영역 우클릭 → "Compare with Last Response"로 직전 응답과 즉시 비교

#### Webview UI
- 멀티탭 인터페이스 (Ctrl+T 새 탭, Ctrl+W 닫기)
- 탭 컨텍스트 메뉴 (Pin/Unpin, Duplicate, Close Others)
- 탭 상태 영구 저장 (확장 재시작 시 복원)
- 요청 영역 탭: Headers, Params, Body, Auth, Settings
- 응답 영역 탭: Body, Headers, Cookies
- 요청/응답 분할 영역 드래그 구분선으로 크기 조절
- 전송 버튼 애니메이션 (ripple, 로딩 프로그레스)
- 상태 배지 애니메이션 (성공 pop, 실패 shake, 4xx/5xx 화면 플래시)
- VS Code 테마 자동 적용 (CSS 변수 기반)

#### 서비스
- **StorageService**: globalStorage JSON 파일 기반 (collections, history, environments, active-environment, default-headers, tab-state)
- **HttpService**: Node.js http/https, 바이너리 감지, 타임아웃, 취소
- **VariableService**: {{변수}} 패턴 매칭 및 치환
- **CurlService**: cURL 파싱 (메서드, 헤더, Body, 쿠키, 인증 추출) 및 생성

#### 기타
- 가이드 페이지 (Arc: Open Guide)
- Webview Serializer (패널 복원)
- retainContextWhenHidden (숨겨도 상태 유지)

### ❌ 미구현 기능

- **스크립트**: pre-request & test 스크립트 (ScriptRunner.ts 파일 구조만 존재)
- **코드 생성**: cURL 외 fetch, axios, Java HttpURLConnection 등
- **WebSocket 지원**
- **컬렉션 Export**: JSON 파일로 내보내기 (Import만 구현)
- **Postman 형식 Import**: 현재 자체 JSON 형식만 지원
- **form-data (multipart)**: form-urlencoded만 지원, multipart/form-data 미구현
- **binary Body**: 파일 첨부 Body 타입
- **GraphQL 지원**
- **프록시 설정**
- **응답 압축 처리** (gzip 등)

## 구현 순서 (단계별 로드맵)
1. ~~스캐폴딩: package.json, tsconfig, esbuild, 기본 extension.ts~~
2. ~~Webview 패널: 요청 입력 + 전송 + 응답 표시~~
3. ~~HTTP 서비스: Node.js http/https로 실제 요청 전송~~
4. ~~컬렉션: TreeView + CRUD + 로컬 저장~~
5. ~~환경변수: 변수 관리 + {{변수}} 치환~~
6. ~~히스토리: 자동 저장 + 드래그앤드롭 정렬~~
7. ~~인증: Basic, Bearer, API Key~~
8. Body 타입: ~~JSON, form-urlencoded, XML, raw~~ / **미완: form-data(multipart), binary**
9. 스크립트: pre-request & test
10. Import/Export: ~~cURL import/export~~ / **미완: Postman import, 컬렉션 export, 백업**
11. 코드 생성: ~~cURL~~ / **미완: fetch, axios, Java HttpURLConnection**
12. WebSocket 지원
13. ~~UI 폴리싱, 단축키~~ (지속 개선 중)

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

## 중요 규칙
- 새 기능 추가 시 기존 기능이 깨지지 않았는지 반드시 확인
- 이벤트 핸들러(클릭, 더블클릭 등) 변경 시 기존 바인딩 유지 확인
- 수정 후 관련 기능 목록 체크리스트 출력