# History 저장 후 snapshot 경합 검증 — 2026-10-05

## 기준과 원인

- 저장소 `frozenvoice/tessra`, 브랜치 `main`. 시작 시 fetch한 `origin/main`과 로컬 HEAD는 모두 `ec84c429c3911c42f11971c91c1d8b3918aeaf2f`였고 작업 트리는 깨끗했다.
- 기존 `saveHistory()`는 로컬 B를 atomic rename으로 저장한 뒤 조회한 fingerprint에 메모리 B snapshot을 연결했다. rename과 stat 사이에 외부 C가 교체되면 C의 fingerprint와 B의 내용이 결합됐다.
- 실제 임시 파일에서 로컬 rename 완료 직후 외부 파일을 rename하는 동기 hook으로 재현했다. sleep이나 가짜 파일 내용/stat 결과는 사용하지 않았다.
- 제품 코드 수정 전 회귀 실행에서 정상 외부 entry `external-c`가 다음 완료 저장 후 사라졌고, invalid JSON/invalid structure 두 경우 모두 stale `local-b`가 반환됐다. 이 세 회귀가 실패했다. save 반환 후 교체와 변경 없는 캐시 재사용은 기존 코드에서도 통과했다.

## 수정

`StorageService.saveHistory()`의 성공 후 fingerprint 조회와 메모리 snapshot 재등록을 제거했다. 입력 구조 검증, 동기 임시 파일+rename 저장, 실패한 저장의 기존 cache 보존은 유지한다. 성공하면 cache를 삭제하고 다음 조회가 실제 파일을 읽어 normalize/손상 검사를 수행한다. 기존 읽기 전후 fingerprint 일치 검사로 cache를 등록하고 이후 변경 없는 조회에서 재사용한다.

JSON 형식, 마이그레이션, 공개 메서드, UX는 바꾸지 않았다. `getHistory()`의 중첩 mutable copy와 `HistorySnapshot`의 중첩 freeze는 기존 테스트로 계속 검증한다. 캐시 계약 설명만 `CLAUDE.md`와 `docs/testing.md`에 동기화했다.

## 회귀 테스트

`src/test/unit/historyStorage.test.ts`에 7개를 추가했다.

1. 로컬 rename 직후와 save 반환 직후 정상 C로 교체하는 2개: 다음 snapshot/copy가 C를 반환하고 다음 로컬 entry D 저장 후 C의 고유 entry와 D가 함께 남아야 한다.
2. 위 두 시점에 invalid JSON/invalid structure로 교체하는 4개: stale 내용 대신 손상을 감지하고, warning 1회와 원본과 같은 `.corrupt-*` 백업, 직접 저장 차단, 자동 history 추가 건너뛰기, 손상 원본 보존 및 정상 복구 후 저장 재개를 확인한다.
3. 변경 없는 연속 snapshot 조회 1개: 동일 객체를 재사용하며 추가 read/parse가 0회여야 한다.

기존 연속 완료 I/O 테스트는 요청한 새 계약을 단계별로 검사한다. cold read 1회, 매 저장 뒤 첫 read 1회, 그 사이 반복 snapshot/copy 조회 0회다. 기존 저장 직후 disk 내용, 소유권, 프로필, pin/prune, 실패한 atomic 저장 등의 검사는 유지했다.

## 실행한 로컬 검증

환경: Windows x64, Node `v24.12.0`, VS Code E2E `1.99.3`. 격리된 합성 임시 저장소와 로컬 HTTP fixture만 사용했다.

| 명령 | 결과 |
| --- | --- |
| `npm run pretest` | 테스트 TypeScript compile 통과 |
| `node node_modules/mocha/bin/mocha.js dist/test/test/unit/historyStorage.test.js --timeout 10000 --grep 'replacement\|replaced\|identical snapshot'` | 제품 수정 전 5 passing / 3 failing; 실제 경합 재현 |
| `node node_modules/mocha/bin/mocha.js dist/test/test/unit/historyStorage.test.js dist/test/test/unit/historyTreeProvider.test.js --timeout 10000` | 수정 후 history 22 passing |
| `npm run ci` | extension/browser/test 타입 검사, 전체 unit 541 passing, build 통과 |
| `npm run test:e2e -- e2e/specs/25-history-sync.spec.ts --retries=0` | 1 passed (11.5s); 연속 완료·pin·filter·clear 실제 UI |
| `npm run lint` | 실행 시 `Missing script: "lint"`. 저장소/CI에 lint 설정이나 단계가 없어 미실행으로 분류 |
| `git diff --check` | 통과 |

## 동일 fixture benchmark

명령은 수정 전/후 모두 기존 `node scripts/history-benchmark.cjs`이며 스크립트는 변경하지 않았다. 초기 500개 history, 요청 Body 1 KiB, 완료 100회, 각 3회 측정이다. 초기화/cold read는 측정 구간 밖이다. 두 측정 동안 다른 build/test/E2E는 실행하지 않았다.

| 지표 (완료 100회) | 수정 전 | 수정 후 |
| --- | ---: | ---: |
| 실제 history 읽기 | 0 | 100 |
| JSON parse | 0 | 100 |
| fingerprint stat | 500 | 500 |
| atomic write / rename | 100 / 100 | 100 / 100 |
| description 갱신 / tree event | 100 / 100 | 100 / 100 |
| 실행 1 (ms) | 931.021 | 1748.634 |
| 실행 2 (ms) | 947.817 | 2019.976 |
| 실행 3 (ms) | 1114.425 | 1927.430 |
| 중앙값 (ms) | 947.817 | 1927.430 |

이번 수정으로 저장 후 첫 조회의 디스크 검증 비용이 추가됐다. 변경 없는 반복 조회의 cache 재사용은 유지된다. 수치는 VS Code API fixture를 사용한 실제 저장/refresh 경로의 합성 측정이며 실제 Electron UI·네트워크 성능을 뜻하지 않는다.

## 검증 한계

로컬 전체 UI suite와 Ubuntu 실행은 이 로컬 검증에 포함하지 않았다. 원격 CI의 Windows/Ubuntu unit, Ubuntu 핵심 UI 및 전체 E2E 결과는 해당 커밋의 Actions 실행에서 별도로 확인한다. lint 도구는 추가하지 않았다. 별도 VSIX 재패키징은 하지 않았다.

이 수정은 저장 후 서로 다른 파일 버전의 내용과 fingerprint를 결합하는 cache 결함을 없앤다. 모든 read-modify-write 구간에 다중 프로세스 lock/트랜잭션을 추가하는 변경은 아니며, 임의 시점에 동시에 쓰는 writer 사이의 일반적인 충돌 해결을 보장하지 않는다.
