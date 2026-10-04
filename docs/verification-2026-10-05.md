# Windows·HTML 미리보기·의존성 검증 (2026-10-05)

기준 HEAD는 `c407d4a861e4fa43af3f1c7653c2c4fe3dff7cea`이며 시작 시 `main` 작업 트리는 깨끗했다. 제품 버전과 VS Code engine은 변경하지 않았다.

## Windows와 줄바꿈

과거의 “440개 통과·4개 실패, 원인은 CRLF”는 재현된 사실로 사용하지 않았다. 같은 SHA의 [Ubuntu CI 원본 로그](https://github.com/frozenvoice/tessra/actions/runs/36805345402/job/110188326436)에서 `npm test`와 508개 통과를 확인하고, 수정 전 Windows에서도 같은 명령을 실행했다.

| 환경 / 실행 | 결과 |
| --- | --- |
| Windows x64 10.0.26300, Node 24.12.0 / `npm test` | 508 passing, 실패 0 |
| 동일 SHA Ubuntu CI, Node 22.23.2 / `npm test` | 508 passing, 실패 0 |
| Windows, LF 소스 읽기 모사 / `npm test` | 508 passing |
| Windows, CRLF 소스 읽기 모사 첫 실행 / `npm test` | 505 passing, 스크립트 실행 관련 3 failing |
| Windows, 관련 소스 계약·Runner·실행 컨텍스트 132개 / LF와 CRLF 각각 | 각각 132 passing |

Windows 체크아웃은 `core.autocrlf=true`지만 파일별 LF/CRLF/mixed가 섞여 있었다. 모사는 `fs.readFileSync`가 반환하는 `src/**/*.ts` 문자열(테스트 소스 제외)만 메모리에서 LF 또는 CRLF로 바꿨다. 원본 파일, 의도적인 CRLF fixture, HTTP 데이터와 직렬화 결과는 바꾸지 않았다. 컴파일 단계에서 변환된 파일은 0개, Mocha의 소스 계약 읽기에서는 28개였다. 이 실험은 별도 Ubuntu 실행이나 새 CRLF 체크아웃의 결과가 아니다.

CRLF 실험 첫 실행의 실패는 소스 문자열 비교가 아니라 100ms VM 제한을 쓰는 Runner 1개와 환경 변경 2개였다. Runner 오류는 기대한 사용자 스크립트 timeout 대신 `Script runtime initialization failed`였다. bootstrap에도 같은 시간 제한을 적용하며, 실행 실패 시 환경 변경을 저장하지 않는 코드 경로와 일치한다. 해당 runtime은 줄바꿈 hook이 바꾸지 않는 compiled JS를 실행했다. 당시 전체 실행은 56초였고 후속 LF 실행은 7초였다. 관련 132개가 두 모드에서 모두 통과했으므로 **CRLF 인과관계는 확인되지 않았으며**, 시간 제한과 실행 부하의 영향을 의심할 수 있을 뿐 확정하지 않았다. 소스 읽기 정규화나 `.gitattributes` 변경을 추가하지 않았다.

Node 버전은 Windows와 기존 Ubuntu CI가 다르다. 원래 보고의 정확한 SHA·명령·실패 목록은 확인되지 않았으므로 과거 실행 자체를 재현했다고 주장하지 않는다.

## 구현

- 기존 Ubuntu unit 및 critical UI/full E2E job을 유지하고 Windows에는 Node 22의 `npm ci` → `npm test` job만 추가했다. npm cache와 PR/브랜치별 이전 실행 취소를 사용한다. 소스 밖 가이드·locale JSON·E2E 설정도 unit이 읽으므로 경로 필터를 추가하지 않았다.
- HTML의 위험 태그 제거, `Array.from(el.attributes)`를 통한 연속 이벤트 속성 제거, nonce CSP는 이미 있었다. 외부 `xlink:href`, `background`, `ping` 속성의 정제·차단 집계 누락은 새 회귀 테스트로 재현했다. 원본은 2 passing / 2 failing, 해당 수정 후 4 passing이었다. `ping`은 여러 URL을 담을 수 있어 항상 제거한다.
- 실제 Windows VS Code 1.99.3에서 SVG `set`과 `animate`가 정제 후에도 살아남아 fragment 링크의 `href.animVal`을 외부 주소로 바꾸는 결함도 각각 재현했다. 외부 링크를 클릭하지 않고 DOM의 실제 애니메이션 값을 관찰했다. 확인된 두 태그만 기존 제거 목록에 추가했다.
- 기존 정적 미리보기 구조를 유지하고 sandbox iframe으로 전환하지 않았다. README 두 언어판과 CLAUDE.md의 기존 기능 설명을 검토했으며, 테스트 가이드와 수동 체크리스트를 갱신했다.

## 의존성

기본 실행 환경의 `npm_config_offline=true`에서 나온 audit 0건은 폐기했다. 실제 npm registry advisory 요청의 HTTP 200과 종료 코드를 확인한 결과, 전체 경고는 **8건에서 4건(high 1, moderate 2, low 1)**으로 줄었고 `--omit=dev`는 0건이었다.

`package.json`의 기존 범위를 유지하며 lockfile의 5개 패키지 노드만 갱신했다. `npm ci --no-audit --no-fund`, brace 확장/중첩 입력 처리, Mocha 형식 YAML 읽기를 검증했다.

| 패키지 | 변경 / 공식 근거 | 실제 사용 경로 |
| --- | --- | --- |
| brace-expansion | 2.0.3 → 2.1.7, [최신 중첩 확장 DoS 공지](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | Mocha의 glob 의존성 |
| js-yaml | 4.1.1 → 4.3.2, [merge 처리 DoS 공지](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh) | Mocha CLI 설정 읽기; 제품 런타임 YAML import 없음 |
| Playwright/test/core | 1.52.0 → 1.55.1, [공식 보안 수정 릴리스](https://github.com/microsoft/playwright/releases/tag/v1.55.1) | E2E의 Electron 제어. 취약한 macOS browser installer는 현재 실행하지 않지만 기존 선언 범위 안 수정 버전을 적용 |

남은 경고는 [esbuild 개발 서버](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), [diff의 parsePatch/applyPatch](https://github.com/kpdecker/jsdiff/security/advisories/GHSA-73rr-hh4g-fpgx), [serialize-javascript의 비신뢰 객체 직렬화 후 실행](https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-5c6j-r48x-rmvq) 및 이를 사용하는 Mocha의 상위 집계다. 현재 esbuild는 build/watch만, Mocha는 serial과 createPatch/diffWordsWithSpace를 사용한다. major upgrade나 강제 override를 적용하지 않았으며, 개발 의존성이라는 이유로 취약점이 없다고 판단하지 않는다. glob 설치 deprecation도 남는다.

Windows E2E의 Node 24 `DEP0190` 경고는 [Playwright의 Electron launcher](https://github.com/microsoft/playwright/blob/v1.55.1/packages/playwright-core/src/server/electron/electron.ts)가 `shell: true`와 인수 배열로 spawn하는 경로다. [Node 공식 문서](https://nodejs.org/docs/latest-v24.x/api/deprecations.html#dep0190-passing-args-to-nodechild_process-execfilespawn-with-shell-option-true)와 대조했다. 현재 인수는 고정된 VS Code 실행 파일, 로컬 저장소·임시 경로와 상수이며 API 응답이나 요청 스크립트가 들어가는 경로는 확인되지 않았다. 경고를 숨기거나 별도 도구 major upgrade를 추가하지 않았다.

## 검증 범위

수정된 작업 트리는 실제 Windows x64 / Node 24.12.0에서 검증했다.

- `npm run ci`: 타입 검사와 **512개 단위 테스트 통과**. 이어지는 build는 샌드박스의 esbuild `spawn EPERM`으로 중단됐다. 허용된 실행 환경에서 **build 단계만** 다시 실행하여 성공했다. 전체 단위 suite를 불필요하게 반복하지 않았다.
- `npm run test:e2e -- --retries=0`: VS Code **1.99.3**, **24 passed (2.6분)**. 새 HTML 정제·SMIL·nonce CSP·외부 요청 없음·내장 이미지 렌더링·fragment 링크, 기존 critical UI와 Runner까지 포함한다. Playwright worker의 sandbox `spawn EPERM`은 focused 재현 과정에서 확인했으므로 최종 실행은 허용된 환경에서 격리된 임시 프로필과 로컬 fixture로 수행했다.
- 새 HTML E2E를 작성하는 과정에서는 `_vscodeApiScript`까지 Tessra nonce를 요구하던 테스트 가정 오류를 발견했다. 설치된 VS Code가 CSP meta 앞에 주입하는 해당 bootstrap ID만 검사에서 제외하고, Tessra script들의 nonce 및 실제 무nonce inline script 차단 검증은 유지했다.
- CI YAML 파싱과 기존 Ubuntu job 구조 동일성, `git diff --check`를 확인했다. 패키지 선언 범위·VS Code engine·CRLF fixture·HTTP/직렬화 테스트를 유지하고 생성 산출물은 변경 목록에 포함하지 않았다.

기존 Ubuntu CI는 기준 SHA의 unit 508개, critical UI 3개, full E2E 23개가 통과했다. 수정된 작업 트리의 새 Ubuntu/Windows GitHub Actions는 실행하지 않았다. Marketplace 배포는 수행하지 않았다.
