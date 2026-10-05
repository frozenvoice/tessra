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
