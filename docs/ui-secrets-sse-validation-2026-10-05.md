# UI / 비밀 변수 / SSE 검증 — 2026-10-05

시작 시 `frozenvoice/tessra`의 HEAD와 fetch한 `origin/main`은 `05a39a4d1473116d1aaf1d5f26faf58fc78d6b67`이었다. 작업 트리는 깨끗했고 루트 AGENTS.md, PRODUCT.md와 DESIGN.md를 적용했다.

## UI 정리

History는 현재 요청의 프로필 로컬 기록 여부, Defaults는 실제 적용할 활성 기본 헤더 수, Used는 요청이 참조하는 고유 변수 수였다. 문구와 tooltip을 각각 히스토리 저장, 기본 헤더, 요청 변수로 명확히 했다. Params/Headers는 기존 명시적 Add와 빈 key 제외를 유지하고 머리글·입력의 접근 가능한 이름을 추가했다. 자동 빈 행이나 Description 스키마는 추가하지 않았다.

JSON 토큰의 과도한 flex 간격을 줄이고 펼치기/접기를 native button과 chevron으로 표시한다. Enter/Space/좌우 화살표와 aria-expanded를 제공하고 원문 응답 및 base64 저장 경로는 유지했다. 이름에 HTTP 메서드가 이미 있으면 사이드바 설명에서 중복을 생략한다. History는 상태 숫자·성공/리다이렉트/오류 문구·아이콘과 소요 시간(ms)을 사용하며 임의 시간 임계치를 오류로 분류하지 않는다.

실제 Windows VS Code 1.99.3 Webview에서 신규 #28 1개와 기존 #18/#20/#21/#22 4개가 통과했다. 관련 단위 112개, 최종 UI behavior 5개, build 및 diff check가 통과했다. shared build/test 출력은 한 담당자만 사용했다.

변경 전후 실제 창 캡처는 생성 산출물 `e2e/.artifacts/ui-clarity/`에 있다:

- `before-params.png`, `before-headers.png`, `before-json-sidebar.png`
- `after-params.png`, `after-headers.png`, `after-json-sidebar.png`
- `after-narrow.png`, `after-ko.png`, `after-ja.png`

좁은 화면 geometry·키보드·접근성 metadata·언어를 확인했다. 실제 NVDA/JAWS 음성 출력은 실행하지 않았다.

## 비밀 변수

환경/Workspace 변수의 명시적인 Protect·Set value·Reveal·Delete를 추가한다. 기존 변수의 자동 분류는 하지 않는다. 확인된 실제 값은 VS Code SecretStorage에 보관하고 JSON에는 안정적인 프로필·환경·변수·참조 ID와 metadata를 저장한다. 변환은 복구 표식 저장 → 키체인 저장/읽기 검증 → CAS 참조 전환 순서다. 실패/중단 시 원문은 pending 상태에 남고 실행은 차단되며 재시도/명시적 취소로 복구한다. 새 백업/환경 export는 pending 원문까지 제거하고 참조만 보존한다.

집중 테스트는 키체인 오류/변환 중단·CAS 충돌, 프로필/환경/변수 ID 분리, 중복 이름과 이름 변경, 실제 StorageService JSON/백업, scope token과 늦은 Reveal 폐기, preflight metadata, HTTP/Runner/WebSocket 실행 경계를 포함한다. 전체 단위 테스트에서도 통과했다. 실제 Windows VS Code #29 E2E는 Protect·native password Set·이름 변경·실제 localhost 전송 바이트·masked cURL·history/tab JSON·참조-only 백업·Reveal 닫기·workspace 편집 명령을 통과했다.

실제 화면 `e2e/.artifacts/secret-variables/workspace-variables.png`를 확인했다. 실제 통신 바이트와 서버 echo/일반 응답은 변경하지 않는다. 신뢰된 스크립트는 실행 시 비밀값을 읽을 수 있으며 임의 변환을 모두 검출할 수 없다. 과거 백업·export·history 사본의 자동 삭제나 OS 샌드박스는 보장하지 않는다. 자세한 경계는 [비밀 변수와 복구](secret-variables.md)에 기록했다.

## SSE

text/event-stream은 일반 HTTP charset/binary 경로와 구분해 UTF-8 증분 파싱과 Events/Raw 표시를 추가한다. 수신 중 이벤트를 묶음 전달하며 Receiving/Completed/Aborted/Timeout/Error와 부분 수신을 구분한다. 불완전한 마지막 블록은 임의 완성하지 않는다. event/id/retry/comment를 vendor JSON 가정 없이 처리하며 받은 내용은 텍스트로 렌더링한다.

행/이벤트 256 KiB, 파서 대기 512 KiB, 보관 500개/2 MiB, Raw prefix 1 MiB 상한과 유실/잘림을 표시한다. 기존 deadline/응답 제한/TLS/교차 origin 자격 증명 제거를 유지하고 timeout=0은 사용자의 명시적 선택이다. 스트림 시작 후 POST/HTTP 500를 포함해 자동 retry/재연결하지 않는다. Stop·timeout·프로필 변경·패널 종료·Runner Stop 뒤 이전 세대 이벤트를 폐기하고 transport/timer/subscription을 정리한다.

SSE parser 23개와 transport 27개 집중 테스트가 통과했고 HTTP charset/deadline 회귀를 유지했다. 실제 #30 E2E 3개는 UTF-8 분할·inert HTML·불완전 EOF·HTTP 500 POST 무재시도·느린 중간 표시·Stop·deadline·보관 상한·transport error·프로필 전환을 통과했다. Runner #09는 650개 수신/500개 보관, Stop의 부분 상태, 단일 POST, history 무증가와 소켓/timer 정리를 통과했다. 실제 `e2e/.artifacts/sse-streaming/receiving.png`, `stopped-partial.png`, `runner-receiving.png`, `runner-stopped-partial.png`를 확인했다. Copy/Save는 기존 응답 도구 모음 스타일을 공유한다. 실제 NVDA/JAWS, macOS, 회사 proxy, 유료 API는 미검증이다. 새 proxy 계층을 추가하지 않는다. [SSE 사용과 제한](sse.md)에 사용자 동작과 보관 경계를 기록했다.

## 최종 통합 결과

Windows VS Code 1.99.3, Node 24.12.0 환경에서 `npm run ci`가 typecheck → 758개 단위 테스트 → build 전체를 통과했다. 최신 번들로 `npm run test:e2e` stable 33개(30파일, Runner 포함)가 3분에 통과했다. 캡처 QA에서 발견한 SSE Copy/Save 스타일 누락을 수정한 뒤 build와 관련 #30 E2E 3개를 다시 확인했다. 생성된 번들·VSIX·E2E artifacts는 커밋하지 않는다.

UI 정리, 비밀 변수, SSE를 각각 별도 커밋으로 보관하고 일반 push한다. 릴리스나 버전 변경은 포함하지 않는다. 원격 CI의 최종 상태는 GitHub Actions의 해당 HEAD 실행과 완료 보고에서 확인한다.
