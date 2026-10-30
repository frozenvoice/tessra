# HTTP charset / 전체 네트워크 deadline 검증 — 2026-10-05

## 기준과 범위

시작 시 `frozenvoice/tessra`의 로컬 `main`과 fetch한 `origin/main`은 모두 `15963eaddbe1709cd49bb002cf321e96c44b12ec`였으며 작업 트리는 깨끗했다. 기존 Node http/https 전송을 유지하고 charset 처리와 전체 네트워크 예산을 각각 분리했다. history 캐시 경합 수정 파일과 테스트에는 변경이 없다.

## Charset 재현과 수정

기준 커밋의 실제 HttpService를 격리된 테스트 출력 디렉터리에서 같은 로컬 서버로 실행했다. EUC-KR `b0a1b3aa`가 `가나` 대신 `����`로 반환되고, 손상 텍스트의 원문/경고가 없으며, XML BOM이 해독되지 않는 세 테스트가 실패했다. 바이너리 회귀는 통과했다.

수정은 압축 해제된 바이트에 내장 TextDecoder를 적용한다. 지원 charset·BOM·XML 선언 정책은 [인코딩 가이드](http-response-encoding.md)에 정리했다. 잘못된 바이트와 미지원 charset은 HTTP 응답 상태를 유지하며 경고와 원문 base64를 제공한다. 문자 수와 무관하게 응답 size는 바이트 수다. EUC-KR/Shift_JIS는 실제 고정 바이트를 사용하고, 멀티바이트를 1바이트씩 나누는 응답, gzip, BOM, XML 선언, malformed 입력, 바이너리를 검증했다.

TextDecoder는 다음 실제 런타임 각각에서 고정 바이트/alias 7개 probe를 `fatal: true`로 통과했다: 테스트 Node 24.12.0, VS Code 1.99.3의 Electron 34.3.2 / Node 20.18.3, 최소 지원 VS Code 1.74.0의 Electron 19.1.8 / Node 16.14.2. VS Code probe는 해당 Electron의 Node 모드이며 최소 버전 UI 실행을 의미하지 않는다.

## Deadline 재현과 수정

기존 구현에 적용한 첫 deadline 회귀 묶음은 2 passing / 11 failing이었다. 연결/업로드 대기·계속 도착하는 본문·끝나지 않는 리다이렉트가 전체 예산 없이 지속됐고, 이전 시도의 idle callback이 다음 요청을 취소할 수 있었다. 동기 압축 해제 후 만료도 정상 응답으로 완료됐다. 테스트 자체의 별도 안전 타이머가 이 실패 실행을 종료했다.

HttpService의 직접 호출은 자체 단조 deadline을 만들고, RequestExecutor와 CollectionRunner는 첫 전송부터 모든 retry에 같은 RequestDeadline을 전달한다. 리다이렉트·DNS·연결/TLS·업로드·본문 및 retry wait가 공유 예산에 포함된다. Body 준비/전후 스크립트/러너 항목 사이 대기는 제외하고 각 항목·반복은 새 예산을 갖는다. `timeout=0`은 무제한이며 남은 예산 0은 즉시 terminal timeout이다.

타이머/진행 중 스트림을 종료하고 종료 상태와 시도 ID로 늦은 콜백을 차단한다. 정상 완료 직전에도 deadline을 확인한다. Node의 소수 타이머 절삭을 피하기 위해 남은 retry wait를 올림한다. 러너가 timeout을 반환하면 직전 response와 history response는 null로 정리한다. 일반 스크립트 실패 정책은 유지했다.

제어 시계·전송은 99ms 정상 완료 / 100ms 만료, 소수 남은 예산, 업로드, redirect chain, 무제한, 늦은 Stop/오류, 동기 압축 해제 중 만료 및 timer cleanup을 검증한다. 실제 로컬 소켓은 지속 body/redirect, 지연 DNS callback, 지연 TLS handshake와 socket cleanup을 검증한다. 요청 전후 script 및 프로필/패널 종료는 기존 lifecycle 테스트와 새 caller 회귀로 확인한다.

## 실행 결과

로컬 Windows x64 / Node 24.12.0에서 실행했다. 모든 HTTP endpoint는 임시 로컬 fixture이며 실제 사용자 데이터나 프록시 자격 증명을 사용하지 않았다.

| 검사 | 결과 |
| --- | --- |
| 독립 출력의 charset decoder/UI/HTTP 집중 compile + Mocha | 최초 18개 통과; 후속 BOM/quote/chunk 보강은 전체 gate에서 검증 |
| 독립 출력의 HTTP deadline/기존 HTTP/headers-only compile + Mocha | 46개 통과; 후속 headers-only/idle timer 보강은 전체 gate에서 검증 |
| caller/lifecycle 집중 compile + Mocha | 46개 통과; 후속 Runner response/history 보강은 Runner 26개와 전체 gate에서 검증 |
| E2E #26/#27 TypeScript noEmit | 통과 |
| `npm run ci` | extension/browser/test 타입 검사, 전체 unit 595 passing, build 통과 |
| `npm run test:e2e -- --retries=0` | Windows VS Code 1.99.3에서 27 passed (4.6m), 재시도 없음 |
| `git diff --check` | 통과 |

기존 TLS 검증 옵션, 교차 origin 민감 헤더 제거, headers-only 종료, 압축 전후 크기 제한, HTML 정제/CSP, 프로필 격리와 history 테스트를 유지했다. lint 스크립트는 없으며 추가하거나 실행하지 않았다.

## 실제 측정값과 제한

최종 로컬 `npm run ci`의 실제 소켓 fixture에서 150ms 예산 만료를 관찰한 시간은 지속 본문 **152.274ms**, 지속 리다이렉트 **151.576ms**였다. 두 경우 모두 종료 후 socket 0개와 network attempt 1회를 확인했다. 합성 로컬 실행 1회의 관찰이며 실제 서비스의 성능이나 엄격한 실시간 보장을 의미하지 않는다.

타이머는 동기 JS/압축 해제를 선점하지 못한다. 만료 시점의 처리가 이벤트 루프에 의해 지연될 수 있으며 완료 시 만료를 다시 검사한다. 임의 인코딩 추정·프록시 구현·쿠키 저장소·DNS/TLS 시간 분해 UI는 추가하지 않았다. 최소 VS Code 버전 전체 UI, macOS, 회사 프록시 및 외부 서비스는 실행하지 않았다. 원격 CI의 Windows/Ubuntu 및 전체 UI 결과는 해당 커밋의 Actions 실행에서 별도로 확인한다.
