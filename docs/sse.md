# SSE 사용과 제한

HTTP 응답의 Content-Type이 `text/event-stream`이면 Tessra는 서버가 연결을 닫기 전에도 이벤트를 보여준다. **Events**는 완성된 이벤트와 event/id/retry metadata를 표시하며, **Raw**는 종료된 스트림의 보관된 원문 prefix를 표시한다. Raw 복사/저장은 수신 종료 후 제공한다. 특정 LLM vendor의 JSON 형식이나 `[DONE]` 문자열에 별도 의미를 부여하지 않는다.

## 상태와 중단

Receiving은 아직 수신 중이다. 정상 EOF는 Completed, 사용자 Stop은 Aborted, 전체 네트워크 deadline은 Timeout, transport 실패는 Error다. 중단/오류 뒤에도 보관된 완성 이벤트와 Raw prefix를 볼 수 있지만 일반 정상 완료로 표시하지 않는다. 불완전한 마지막 이벤트를 빈 줄이 온 것처럼 완성하지 않으며 정상 EOF와 transport 오류를 구분한다.

Stop, timeout, 프로필 변경, 패널 종료, Runner Stop은 소켓·타이머·구독을 정리한다. 실행 ID/프로필 세대가 바뀐 뒤 지연된 chunk는 새 화면에 섞이지 않는다. History는 요청 단위 완료/실패 기록이고 매 이벤트/chunk마다 저장하지 않는다.

## 파싱과 화면 안전

SSE는 UTF-8로 해독한다. 다중 바이트 chunk 경계와 처음 BOM, CR/LF/CRLF, 빈 줄 경계, 여러 `data` 줄, `event`, `id`, `retry`, comment를 처리한다. `retry`는 서버 metadata이며 자동 재연결을 유발하지 않는다. [표준 event stream 처리](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)를 기준으로 하고 일반 HTTP의 charset/binary 정책과 분리한다.

이벤트 데이터는 불신 텍스트다. HTML-looking data도 textContent로 표시하고 HTML이나 명령으로 실행하지 않는다. 약 50ms 주기 또는 배치 상한에서 묶음 전달하며 매 바이트마다 전체 Webview를 다시 만들지 않는다. Events/Raw는 키보드 이동과 접근 가능한 상태/유실 안내를 제공한다.

## 제한과 유실

| 범위 | 기본 상한 | 표시/보존 동작 |
| --- | --- | --- |
| 한 행 | 256 KiB | 초과한 이벤트 블록을 다음 빈 줄까지 버리고 알림 |
| 한 이벤트 | 256 KiB | 잘린 이벤트를 만들어 전달하지 않고 블록 유실 알림 |
| 파서 대기 문자열 | 512 KiB | 초과한 블록을 버리고 대기 버퍼 정리 |
| 이벤트 보관 | 500개 또는 2 MiB | 오래된 이벤트 퇴출 수 표시 |
| Raw 원문 | 1 MiB prefix | 이후 바이트를 보관하지 않고 잘림 바이트 수 표시 |
| 전달 배치 | 100개 또는 1 MiB | 묶음 flush; 공지 보관/전달도 제한 |

바이트 상한은 UTF-8 기준이다. 파서는 별도로 최대 3바이트의 미완성 UTF-8 decoder 상태를 가질 수 있다. 상한은 전체 응답 허용량과 별개이며, 화면에서 사라진 이벤트/Raw 뒤쪽 바이트를 복원하는 기능은 없다. Raw 저장은 보관된 바이트 prefix를 base64에서 저장하고, Raw 텍스트 복사는 UTF-8 표시 문자열이므로 상한에서 문자 중간이 잘렸을 수 있다. 전체 스트림을 저장했다고 간주하지 않는다.

## 기존 전송 정책

SSE라고 기존 timeout이나 응답 제한을 끄지 않는다. 첫 네트워크 시도부터 DNS·연결/TLS·업로드·리다이렉트·수신까지 전체 deadline이 적용된다. 장기 스트림은 사용자가 Settings에서 `timeout=0`을 명시적으로 선택해야 하며 이는 deadline만 무제한으로 한다. 응답 크기·파서·화면 보관 상한은 유지한다.

TLS 검증, 응답 크기 제한, HTTP/HTTPS 리다이렉트, 교차 origin 자격 증명 제거, 취소 정책을 유지한다. 스트림이 시작되면 HTTP 500이나 POST를 포함해 자동 retry/재전송하지 않는다. 자동 재연결은 없으며 다시 보내려면 사용자가 새 실행을 시작한다. 기존 재시도 설정은 스트림이 시작되기 전의 일반 실패 정책에만 해당한다.

비밀 변수를 써도 실제 통신과 서버가 echo한 이벤트를 몰래 마스킹하지 않는다. [비밀 변수 노출 경계](secret-variables.md)를 따르며 공유 전에 받은 데이터와 Raw 사본을 확인한다. 로컬 fixture/격리 호스트로 검증하고 실제 토큰이나 유료 API는 사용하지 않는다. 결과는 [검증 기록](ui-secrets-sse-validation-2026-10-05.md)에 남긴다.
