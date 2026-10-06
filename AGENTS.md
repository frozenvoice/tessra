# Tessra — 프로젝트 규칙

VS Code 안에서 동작하는 offline-first HTTP/WebSocket API 클라이언트다. 제품 범위는 `PRODUCT.md`, 요청 패널 시각 계약은 `DESIGN.md`를 따른다.

## 기본 제약과 구조

- 확장 런타임의 네트워크는 사용자가 시작한 API 요청·WebSocket 작업으로 제한한다. 텔레메트리, 업데이트 체크, 로그인, 클라우드 동기화 의존성을 추가하지 않는다.
- 런타임 의존성은 Node.js 내장 모듈과 esbuild 번들 중심으로 최소화한다. Webview 외부 리소스/CDN 로딩을 금지하고 아이콘은 codicon 또는 인라인 SVG를 사용한다.
- TLS 검증과 응답 크기·스크립트 시간 제한의 안전 기본값을 유지하며, 보안 완화는 opt-in으로 둔다. `package.json`의 `engines.vscode`를 임의로 올리지 않는다.
- `src/extension.ts`는 활성화·명령, `src/panels/RequestPanel.ts`는 요청 패널 조율, `src/providers/`는 TreeView, `src/services/`는 전송·저장·스크립트 로직을 담당한다.
- `src/panels/requestPanel/`의 실행 흐름과 Webview 조립을 구분한다. HTML 조립, styles, markup, client script 조각의 분리를 유지하고 Extension ↔ Webview 통신은 `postMessage`를 사용한다.
- 클래스 파일은 PascalCase, 유틸리티·Webview 조각은 camelCase인 기존 관례를 따른다. 인터페이스에 `I` 접두사를 붙이지 않는다. 코드 주석과 커밋 메시지는 한국어를 기본으로 한다.
- 사용자에게 보이는 실패는 처리하여 VS Code 알림 또는 Webview 메시지로 전달한다.

## 저장·실행 계약

- 저장 루트는 `context.globalStorageUri`다. 기본 프로필은 루트, 사용자 프로필은 `profiles/` 아래 인코딩된 디렉터리로 분리한다. 프로필 경로는 `StorageService`의 경로 처리를 따른다.
- Arc Client 저장소(`arc.arc-client`, `arc-client`) 마이그레이션은 대상 루트에 `collections.json`, `environments.json`, `history.json` 중 하나라도 있으면 건너뛴다. 복사 시 기존 대상 파일을 덮어쓰거나 symbolic link를 따라가지 않는다.
- 저장 JSON은 파싱·구조를 검증한다. 실패 시 원본을 보존하고 `.corrupt-*` 백업을 시도하며 경고한다. 메모리 기본값으로 원본을 덮어쓰지 않고 해당 파일 저장과 불완전한 workspace backup export/import를 차단한다. 손상 history 기록은 건너뛰되 HTTP 응답은 유지한다. 원본 복구/별도 보관 후 재로드·정상 읽기로 보호를 해제한다.
- Workspace backup 복원은 활성 프로필 교체이며 merge가 아니다. 교체 전에 사전 백업을 저장한다. 현재 백업 범위는 collections, environments, active environment, default headers, workspace variables이며 history와 tab state는 제외한다.
- 실행은 시작 시점의 프로필·환경·세대를 고정한다. 스크립트의 set/unset 변경분만 원래 환경에 병합하고 같은 키의 동시 수정은 보존·경고한다. 변경 없는 스크립트는 환경 파일을 쓰지 않는다.
- 프로필 변경/패널 종료 시 HTTP(Body 준비·재시도 포함)·러너·WebSocket을 취소하고 이전 세대의 메시지·응답을 폐기한다. HTTP는 리다이렉트까지 http/https만 허용하며 러너의 WebSocket 실행은 지원하지 않는다.
- 정상 프로필 전환은 요청 ID가 일치하는 flush 응답을 실제 디스크에 저장한 뒤에만 진행한다. 지연/실패 시 전환을 중단한다. 설정 직접 변경/패널 종료 시에도 캐시된 초안은 원래 프로필에 저장한다.
- 요청 변수 치환은 활성 환경 기준이다. `variables.json`의 workspace variables를 요청 치환에 섞지 않는다. Path Variables의 request-local override는 URL path의 full-segment `{{variable}}`에만 적용하고 환경 fallback을 유지한다.
- Import된 스크립트는 명시적 신뢰 전까지 비활성화한다. 스크립트 입출력은 JSON 경계로 유지하고 호스트 객체·함수를 VM에 전달하지 않는다. Node VM을 OS 보안 샌드박스로 설명하지 않는다 (`docs/script-security.md`).

## 요청 패널 변경

- `DESIGN.md`의 Quiet Instrument를 유지한다. pill wall / soft-card / Send success-green을 재도입하지 않는다. 테마 프리셋은 공유 레이아웃 위 색상·토큰만 바꾼다.
- 탭·주요 액션·행 삭제·응답 메뉴의 키보드 접근과 포커스 표시를 유지한다. Webview 문자열 변경 시 파싱 오류와 상태 복원·초안 보존을 확인한다.
- DOM visible만으로 layout 통과를 판단하지 않는다. 좁은 너비·낮은 높이에서 popup/menu의 viewport geometry, editor의 scroll owner 수와 wheel 동작을 확인한다. 변수 경고는 각 사용 위치의 실제 치환 결과를 기준으로 한다.
- JSON/XML Body의 textarea 입력원과 mirror 강조 구조를 유지한다. 비어 있지 않은 Body 타입 변경은 Convert / Keep text / Cancel을 거치며 타입+내용을 함께 undo한다. 중첩 JSON→form, form-data file→JSON, Binary 자동 변환은 허용하지 않는다.
- UI 변경은 관련 `data-testid` 및 `e2e/specs/` 계약에 반영한다. Runner 변경은 `e2e/specs/runner/`도 확인한다. `window.__tessraTest` 같은 production 테스트 backdoor를 넣지 않는다.
- 패널·알림·가이드는 `tessra.displayLanguage`, 설정·명령 레이블은 VS Code locale을 따른다.

## 개발·검증·패키징

명령의 원본은 `package.json`, 실행 환경·E2E 준비는 `docs/testing.md`와 `.github/workflows/ci.yml`이다.

| 목적 | 명령과 포함 범위 |
| --- | --- |
| 의존성 설치 | `npm ci` |
| 로컬 코드 변경 통합 검증 | `npm run ci` = `npm run typecheck` → `npm test` → `npm run build` (E2E·패키징·게시 없음) |
| 타입 검사 | `npm run typecheck` (`tsc --noEmit`) |
| 단위 테스트 | `npm test` (pretest에서 테스트 컴파일 후 Mocha 실행) |
| 빌드 / 개발 | `npm run build` / `npm run watch`; F5는 build 후 Extension Development Host 실행 |
| 실제 VS Code UI E2E | 최신 빌드 준비 후 `npm run test:e2e` (Runner 포함, 자동 build 없음) |
| 핵심 UI 회귀 검사 | `npm run test:e2e:ui-regressions` |
| 수동 원격 전체 검증 | `.github/workflows/ci.yml`의 `workflow_dispatch`: Linux `unit`, Windows `unit-windows`, Linux `e2e` 모두 실행 |
| VSIX 생성 | `npm run package` (`vscode:prepublish`를 통해 build 포함) |

- 별도 lint 스크립트는 없다. `ci`에 포함된 검사를 별도 완료 단계로 중복 나열하지 않는다. `test:e2e:all`은 stable suite에 포함된 Runner를 다시 실행하므로 기본 검증 명령으로 사용하지 않는다.
- 일반 작업은 변경에 필요한 로컬 typecheck·단위 테스트·build와 관련 회귀 검증 후 완료 보고한다. 원격 CI dispatch·완료 대기·watch·자동 rerun은 필수 완료 조건이 아니다. push/PR에서는 원격 빌드·테스트를 실행하지 않는다. 원격 전체 검증은 명시적 수동 요청 또는 릴리스 공개 전만 수행한다.
- UI/Webview·상태 저장/복원·프로세스 실행 변경은 관련 단위 테스트와 해당 E2E spec을 선택한다. UI layout 변경은 핵심 UI regression을 포함한다. 무관한 내부 변경마다 전체 VS Code E2E를 요구하지 않으며, E2E를 릴리스 전으로만 미뤄 변경 동작 검증을 생략하지 않는다. 수동 전체 CI의 핵심 UI regression 별도 단계와 전체 E2E 단계는 유지한다. E2E는 격리된 임시 프로필·로컬 fixture를 사용하며 Linux 실행은 `docs/testing.md`의 xvfb 절차를 따른다.
- 개발 중에는 `npm run watch`의 증분 빌드를 활용한다. 최신 빌드를 재사용하고 같은 검사·전체 빌드를 중복 실행하지 않는다. `npm test`는 `pretest`에서 테스트를 컴파일하며 E2E 명령은 자동 build하지 않는다. `package`만 `vscode:prepublish` build에 연결되며 일반 개발 완료에 VSIX 생성·게시를 요구하지 않는다.
- 완료 보고는 로컬 부분 검증과 원격 전체 검증을 구분하고 실제 명령·결과·미실행 항목을 명시한다. 로컬 성공을 Windows/Linux 원격 전체 성공으로 표현하지 않는다.
- 게시 자동화는 없다. 공개 전에는 `docs/releasing.md`에 따라 버전 변경을 포함한 최종 SHA의 수동 CI에서 `unit`·`unit-windows`·`e2e` 및 두 E2E 단계 성공을 확인하고, 그 SHA와 VSIX manifest/번들 일치를 확인한 뒤 검증한 동일 VSIX를 수동 게시한다. 수동 전체 CI 자체는 게시하지 않는다.
- 수동 시각 QA 및 릴리스 smoke는 `docs/manual-e2e-checklist.md`의 해당 체크리스트를 따른다. 문서만 변경한 경우에는 경로·명령·diff를 검증하며 제품 빌드/E2E를 요구하지 않는다.
- `dist/`, `*.vsix`, `.vscode-test/`, E2E artifacts는 생성 산출물이다. 직접 수정·커밋하지 않는다. 패키징 변경 시 `.vscodeignore`의 개발·테스트 파일 제외와 필요한 `dist/` 포함을 확인한다.

## 검증 산출물 정리

- 검증·실험용 빌드, 스테이징, 캡처 출력을 작업이나 재시도마다 새 이름의 폴더로 만들지 않는다(예: `.vscode-test-<작업명>`, `dist-<작업명>`, 실행마다 새 E2E artifacts 폴더). 기본 출력 위치를 재사용하고, 격리가 꼭 필요하면 고정된 폴더 하나를 덮어쓴다.
- 이번 작업에서 만든 임시 빌드·스테이징·캡처 폴더는 완료 보고 전에 삭제한다. 다른 작업이나 실행 중인 프로세스의 출력은 건드리지 않는다.
- 근거로 남길 것은 로그·요약·최소 파일로 줄인다. 1GB 이상이 남으면 경로와 크기를 완료 보고에 적는다.

## 문서 동기화

사용자 기능·설정 변경 시 `README.md`, `README.ko.md`, `CLAUDE.md`와 관련 가이드를 검토하고 영향 있는 문서를 함께 갱신한다. `AGENTS.md`에는 지속적으로 필요한 프로젝트 규칙의 변경만 반영한다.
