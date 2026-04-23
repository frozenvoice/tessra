# Tessra 프로젝트 메모

## 제품 정체성
Tessra는 VS Code 안에서 동작하는 local-first REST API 클라이언트다.

- 로그인 없음
- 클라우드 동기화 없음
- 텔레메트리 없음
- 사용자가 직접 보내는 API 요청 외의 네트워크 호출 없음
- 모든 데이터는 로컬 JSON 파일로 저장

## 현재 구현 범위 (2026-04-11 기준)

### 요청 작성 / 전송
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 멀티 탭 요청 편집기
- URL 입력창 `Enter` 전송
- `Ctrl+Enter` / `Cmd+Enter` 전송
- 진행 중 요청 취소
- 요청 상태 표시와 응답 상태 애니메이션

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
- URL / Headers / Params / Body / Auth / 파일 경로 치환

### Collections / History
- Collection / folder / request CRUD
- Duplicate / Save As
- Drag & Drop 정렬
- method / host / type / status / pinned 토큰 필터
- Run All Requests
- 컬렉션 러너에서 실패한 요청만 재실행
- History pin / filter / prune
- 실행 시점 스냅샷과 timing metadata 기반 history 저장
- 더 촘촘한 사이드바 설명 정보와 컬렉션 / 폴더 개수 표시

### Response Viewer
- Body / Headers / Cookies / Tests / Preview
- JSON tree viewer
- XML format options: `Pretty`, `Compact`, `Inline Children`
- Content-Type 기반 하이라이트
- 응답 본문 저장
- 응답 비교: `Raw`, `Normalized`, `Pretty`
- ignore headers / ignore JSON paths 비교 설정
- resolved URL / status / raw headers 빠른 복사
- 읽기 좋은 응답 시간과 요청/수신 시각 메타데이터 표시
- 활성 환경 / 현재 프로필 / 기본 헤더 / 스크립트 / 히스토리 동작 상태 배지와 linked focus 이동
- 응답 검색, 요청 변경 요약, 변수 사용처, richer empty states
- 테스트 pass / fail / log 요약과 첫 실패 강조

### Environment UX
- URL / Headers / Body / Auth / Scripts 등 편집 가능한 텍스트 입력에서 `{{variable}}` 자동완성

### Scripts
- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- 로그와 테스트 결과 표시
- 응답값을 환경 변수로 저장해 다음 요청에 넘기는 접이식 stepper 도움말과 삽입 버튼

### Import / Export
- cURL import
- Copy as cURL
- OpenAPI import
- Tessra JSON collection import
- Postman collection import / export
- Postman environment import / export

### 코드 생성
- `fetch`
- `axios`
- `Java HttpURLConnection`

### 요청별 Settings 탭
- timeout
- follow redirects
- save to history
- TLS override
- max response size
- retry count / retry delay
- stop after headers
- skip default headers
- disable scripts

### UI 언어
- `tessra.displayLanguage` 설정으로 Tessra 패널/프롬프트/알림/인앱 가이드 언어 선택
- 기본값은 영어
- 현재 유지 중인 표시 언어는 `en`, `ko`, `ja`
- Tessra UI 자체는 VS Code locale과 분리되어 동작
- 설정 레이블과 Command Palette 명령 이름은 VS Code locale을 계속 따름

### 요청 패널 테마
- `tessra.requestPanelTheme` 설정으로 요청 패널 webview 테마 프리셋 전환
- 지원 프리셋: `default`, `minimal-cool`, `product`, `bold-color`
- Command Palette에서 `Tessra: Change Request Panel Theme` 제공
- 열린 요청 패널에서도 즉시 테마가 반영되도록 유지

### 워크스페이스 프로필
- `tessra.workspaceProfile` 설정으로 로컬 저장 프로필 전환
- collections / history / environments / default headers / saved tabs를 프로필별로 분리
- Command Palette에서 `Tessra: Change Workspace Profile` 제공
- 요청 패널 상단 상태 배지에 현재 프로필 표시
- `default`는 메인 작업용으로 두고, 다른 프로젝트나 import 실험이 기존 작업과 섞이면 안 될 때 새 프로필을 만드는 방향을 권장

### OpenAPI import 사용
- Command Palette에서 `Tessra: Import OpenAPI` 실행
- OpenAPI JSON 파일을 선택하면 paths, methods, base URL 예시를 컬렉션과 환경으로 변환

## 현재 구조 메모
- 사용자 요청 패널 UI는 `src/panels/RequestPanel.ts`의 webview 문자열 안에 들어 있다
- highlight.js 관련 리소스는 `src/webview/hljs.ts`에서 관리한다
- HTTP 요청 실행은 `src/services/HttpService.ts`
- storage는 `src/services/StorageService.ts`
- scripts는 `src/services/ScriptRunner.ts`
- import/export는 `src/services/ImportExportService.ts`
- compare는 `src/services/ResponseCompareService.ts`
- 로컬 저장 분리와 Arc Client → Tessra 데이터 마이그레이션은 `src/services/StorageService.ts`

## 남은 큰 작업
- WebSocket 지원
- 더 많은 수동 E2E 검증
- UI/UX 디테일 추가 보강

## 빌드 / 테스트
```bash
npm run build
npm run watch
npm test
npx vsce package
```

## 작업 원칙 메모
- 기존 기능 회귀가 가장 큰 리스크라서, webview 문자열 수정 후에는 반드시 파싱/빌드/테스트를 확인한다
- 사용자에게 보이는 기능이 바뀌면 README와 내부 문서도 같은 턴에 갱신한다
- 보안 관련 기본값은 안전한 쪽으로 유지한다
- 오프라인 우선 원칙을 깨는 기능은 추가하지 않는다
