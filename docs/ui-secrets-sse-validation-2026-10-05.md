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

최종 통합 gate는 SSE 단계가 합쳐진 작업 트리에서 기록한다. 이 단계의 실제 secret E2E와 집중 검증은 통과했다.
