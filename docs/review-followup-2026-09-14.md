# 첨부 리뷰 확인 및 수정 결과

기준 커밋: `f9933ad94ff5d34704de415df09129e5efb1fc54`. 첨부 문서와 CI 로그는 검증 대상 자료로 사용했으며, 아래 결과는 현재 로컬 코드와 직접 실행한 테스트에 근거한다. 제품 버전은 `1.2.2`, backup schemaVersion은 `1`, VS Code engine은 `^1.74.0`을 유지했다.

## 확인하고 수정한 항목

| 항목 | 확인 결과와 수정 |
| --- | --- |
| Base64 정규식 | tab/CR/LF 대신 문자 t/r/n과 역슬래시를 지우던 오류를 수정했다. 일반 공백, 개행, `null`/`token` 및 `nnnn` 입력을 실제 ScriptRunner 경로로 검증했다. |
| UTF-8 decoder | 잘린 시퀀스에서 index를 되돌려 반복하던 오류를 수정했다. 후속 바이트 범위를 소비 전에 검사하며, overlong/surrogate/범위 초과 입력도 Buffer의 대체 문자 결과와 대조했다. 총 1,806개 byte sequence를 테스트한다. |
| Assertion | Date/Map/Set/RegExp, 배열 길이·빈 슬롯, symbol 속성, prototype, 순환 구조, typed array/ArrayBuffer, boxed primitive, Error 비교를 보완했다. `equal`은 Object.is, 배열 `include`는 includes 의미를 복원했다. 서로 다른 불투명 객체의 미지원 deep comparison은 명시적으로 실패한다. |
| Microtask timeout | 완료 마커를 Promise 큐에서 제거했다. 시간 제한이 있는 runInContext의 반환을 기준으로 완료를 판단한다. 재귀 microtask와 앞선 예외가 함께 있어도 timeout으로 보고하며 중단된 realm을 다시 평가하지 않는다. |
| 손상 파일 재저장 | 불완전한 읽기의 보호 상태를 유지하고 일반 쓰기를 거절한다. 손상 history에 새 요청을 자동 저장하지 않으며 HTTP 응답은 유지한다. 불완전한 workspace backup 및 pre-import backup도 거절해 일부 파일부터 교체되는 것을 막는다. |
| 프로필/초안 | 정상 전환 명령에 사전 flush가 있다는 첨부 문서의 정정은 맞다. 다만 기존 250ms 무응답 성공 처리를 제거하고, 요청 ID가 맞는 응답의 실제 저장 후 성공하도록 바꿨다. 누락/쓰기 실패/세대 변경은 실패로 처리한다. 직접 설정 변경과 패널 종료에서도 캐시된 초안을 원래 프로필에 저장한다. |
| E2E 시간 조건 | 편집부터 workbench 닫기까지 1초 미만이어야 한다는 머신 속도 조건을 제거했다. native close/reopen 후 값 검증은 유지한다. 별도 unit test는 disk timer를 실행하지 않은 상태의 setState/host draft와 실제 패널 dispose를 확인한다. |
| CI Node | 두 job을 Node 22로 맞췄다. `@vscode/test-electron@3.1.0`의 Node >=22 요구를 만족한다. |
| 초안 입력 비용 | URL input에서 markDirty와 마지막 debouncePersist가 같은 전체 초안을 두 번 전송하는 것을 확인하고 중복 호출을 제거했다. 즉시 보존 경로는 유지한다. |

손상 파일은 읽기만으로 이동/삭제되지 않는다. 백업 복사를 시도하며 실패하면 경고에 표시한다. 원본을 복구하거나 별도 위치에 보관한 후 재로드/정상 읽기를 거치면 저장 보호가 해제된다. 정상 v1 백업의 replace import, pre-import backup, active environment 검증, history/tabState 제외는 유지된다. 오래된 Arc/1.0.x 정상 데이터가 실제로 검증에 실패한다는 사례까지 새로 확인한 것은 아니다.

## 실제 입력 처리 비용

Windows, Node `22.12.0`, VS Code `1.99.3`, 별도 임시 user-data에서 raw Body를 미리 저장하고 URL input 이벤트를 발생시켰다. 초기 두 회를 제외한 10회 표본의 상위 중앙값과 최댓값이다. 같은 webview 안에서 performance.now로 동기 input handler 실행 시간만 측정했으며, IPC 완료·화면 paint·전체 키 입력 체감 지연은 포함하지 않는다. 측정용 임시 spec은 정리했다.

| 데이터 | 중복 제거 전 중앙값 / 최대 | 제거 후 중앙값 / 최대 |
| --- | --- | --- |
| 1 tab × 64KiB | 1.3 / 1.7ms | 0.7 / 1.5ms |
| 10 tabs × 512KiB | 30.3 / 32.3ms | 14.4 / 16.2ms |
| 20 tabs × 1MiB | 120.9 / 126.3ms | 59.4 / 70.4ms |

중복 제거 효과는 확인됐으나 전체 초안 직렬화의 탭 수/Body 크기 비례 비용은 남는다. 변경된 탭만 전달하는 후속 개선에는 webview 복원, host cache, 즉시 종료, 프로필 전환을 함께 다루는 상태 프로토콜 설계가 필요하다. 현재 결과를 대용량 입력 지연의 완전한 해결로 해석하면 안 된다.

## 검증

- 최종 `npm run ci`: typecheck, **495 passing**, build 성공.
- 전체 `npm run test:e2e`: **23 passed**, 재시도 없음 (2.3분).
- 마지막 중복 전송 제거 및 프로필 명령 오류 표시 변경 후 URL/Params, 접근성/즉시 종료, 실행 컨텍스트 E2E 네 개를 각각 3회 반복했다. `--repeat-each=3 --retries=0`: **12 passed** (1.1분). 이는 기존 23개 중 일부의 반복 검증이며 새 unique test 12개가 아니다.
- `git diff --check`: 성공.
- 실제 ScriptRunner에서 수정 전 신규 회귀 테스트 22개가 실패했고, 스크립트 수정 후 해당 suite는 **54 passing**이었다. 실패 테스트 개수는 독립 버그 개수가 아니다.
- 호스트 함수/객체를 VM에 다시 노출하지 않았으며, 외부 서비스 호출 기능을 추가하지 않았다.

## Audit 및 남는 한계

현재 lockfile로 `npm audit --json`을 직접 실행했다. 개발 도구 의존성에 **8건 (high 5, moderate 2, low 1)**이 남으며, `npm audit --omit=dev --json`은 **0건**이다. 지적된 패키지는 Playwright, brace-expansion, js-yaml, Mocha 및 그 하위 diff/serialize-javascript, esbuild다. package/lockfile은 변경하지 않았다. 이 중 Mocha/esbuild의 audit 권장 해결은 선언 범위를 넘는 버전 변경이므로 별도의 도구 업그레이드와 호환성 검증 대상으로 남긴다. devDependency 또는 production-only 0건이라는 이유로 개발/CI 위험이 없다고 판단하지 않는다. 현재 esbuild 설정은 build/watch를 사용하며 serve는 사용하지 않는다.

처리하지 않은 Promise rejection이 호스트의 unhandledRejection 경계로 전파될 수 있다는 기존 한계도 남는다. 전역 listener나 OS 격리 환경을 이번 수정에 추가하지 않았다. 모든 호스트에서 동일한 rejection 결과를 보장하거나 Node VM을 악성 코드용 보안 샌드박스라고 주장하지 않는다. 상세 계약은 [script-security.md](script-security.md)를 따른다.

이번 작업에서 원격 GitHub Actions를 새로 실행하거나 Marketplace publish/VSIX 릴리스를 수행하지 않았다. 로컬 검증 결과를 새 원격 CI 성공 결과로 표현하지 않는다.
