# History / Webview / 홍보 카메라 검증 기록 — 2026-10-05

대상 저장소는 `frozenvoice/tessra`, 비교 기준은 `609c91c7e4faddb0a05b292ce7972015ab22a86a`다. 작업 시작 시 `main`과 `origin/main`이 이 커밋으로 일치했고 작업 트리는 깨끗했다. 모든 시험은 임시 합성 저장소와 로컬 fixture를 사용했다.

## 변경 범위

- History: 파일 경로별 snapshot/count를 재사용한다. 매 조회에서 device/inode/size/mtime/ctime metadata를 확인하고 변경·삭제·복원 시 다시 읽는다. snapshot은 중첩 객체까지 동결하며, 수정용 `getHistory()`는 독립 복사본을 반환한다. 손상 파일의 백업·경고·쓰기 차단과 동기 임시 파일+rename을 유지한다. 저장 성공 후에만 새 snapshot을 공개한다. TreeProvider의 count 전달을 이용해 설명 갱신 중복을 제거했다.
- Webview: HTML Preview의 정제·차단 자원 집계·본문 판별·렌더링 경계를 일반 browser TypeScript로 분리했다. `dist/htmlPreview.js`를 현재 Webview의 `asWebviewUri`와 nonce로 로딩하며, 별도 browser 타입 검사와 esbuild build/watch를 연결했다. 단일 패널 재사용·프로필/초안 흐름·독립 표시 언어·Body conversion·hljs는 유지한다.
- Promo: URL/Runner 카메라의 확대와 위치를 조정하고 실제 Help/Runner/Total bounds를 기록하는 캡처 및 geometry 검사를 추가했다. 새 미디어는 무시되는 로컬 `.capture/preview/`에만 생성한다. `frozenvoice-assets`, 공개 미디어, 최상위 README 미디어 링크는 변경하지 않는다.

## 동일 합성 fixture 측정

Windows 10.0.26300 x64, Node 24.12.0 / npm 11.6.2. `scripts/history-benchmark.cjs`를 기준/수정 코드에 동일하게 실행했다. 초기 500개, 요청 body 1 KiB, 100회 연속 완료, 3회 반복이다. 실제 extension 활성화 콜백·`RequestPanel.saveToHistory`·StorageService·TreeProvider를 최소 VS Code API fixture와 실제 임시 파일시스템으로 실행했다.

활성화와 초기 조회는 양쪽 모두 측정 구간 밖이다. 수정 후 cold 조회가 파일을 한 번 읽고 재사용하는 동작은 별도 단위 테스트로 확인했다. 아래 수치는 warm 완료/저장/refresh 경로의 횟수이며 네트워크·Electron UI·실제 사용자 환경 성능을 뜻하지 않는다.

| 100회 완료당 항목 | 기준 | 수정 후 |
| --- | ---: | ---: |
| history 파일 읽기 | 700 | 0 |
| history JSON parse | 700 | 0 |
| history metadata stat | 0 | 500 |
| 임시 파일 write / rename | 100 / 100 | 100 / 100 |
| Tree 변경 event | 100 | 100 |
| History 설명 갱신 | 200 | 100 |
| 경과 시간 3회 (ms) | 4102.224 / 5687.040 / 4263.889 | 2416.563 / 2754.866 / 2868.511 |
| 중앙값 (ms) | 4263.889 | 2754.866 |

중앙값은 이 합성 측정에서 약 35.4% 감소했다. 외부 변경이 있는 조회는 metadata 검사 뒤 파일을 다시 읽고 파싱하며, 매 완료의 영속 저장 횟수는 줄이지 않았다. 일반 사용 경로에 watcher나 저장 debounce를 추가하지 않았다.

## 검증 결과

| 환경 / 검사 | 결과 |
| --- | --- |
| Windows `npm run ci` | extension/browser/test 타입 검사, 단위 534개, esbuild 4개 번들 통과 |
| History 집중 검사 | 신규 15개와 기존 회귀를 합쳐 51개 통과 |
| HTML Preview 집중 검사 | 관련 단위 97개 통과, 실제 browser 모듈 실행 포함 |
| 로컬 VSIX 생성 / archive 검사 | vsce 4.0.0으로 생성. extension/htmlPreview/bodyConversion/hljs 4개 번들의 SHA-256이 빌드 결과와 일치. src/e2e/demo/scripts/tmp/개발 config 제외 확인 |
| Windows 설치 VSIX HTML Preview E2E #24 | 진단 코드를 제거한 최종 상태에서 `TESSRA_E2E_VSIX=tmp/tessra-validated.vsix`, `--retries=0`: 1개 통과 (19.6초). 로컬 URI/nonce/CSP와 실제 정제·렌더링 검증 |
| Windows 전체 UI E2E, `--retries=0` | 4.6분: 기존 24개 통과. 신규 #25는 GET `/echo`가 404를 반환하는 fixture 사용 오류로 실패하여 수정 후 별도 재검증 |
| Windows 신규 History E2E #25 | fixture/UI 경로 수정 후 `--retries=0`: 1개 통과 (11.3초). E2E 옵션·helper·spec의 별도 TypeScript 검사도 통과 |

첫 통합 시도는 extension 타입 검사에서 공유 BodyConversionService의 DOM 타입이 빠진 오류를 발견했다. 기존에는 highlight.js 타입의 DOM 참조에 우연히 의존했다. extension config에 DOM lib를 명시한 뒤 위 통합 검사가 통과했다. browser config는 계속 `types: []`로 Node globals와 분리한다.

`npm run package`의 npx 도구 설치는 캐시 잠금 오류(`ECOMPROMISED`)가 발생했고 재시도도 멈췄다. 해당 npx 프로세스만 종료한 뒤 다운로드된 vsce 4.0.0 CLI를 직접 실행해 동일한 `package --no-rewrite-relative-links -o tmp/tessra-validated.vsix` 옵션과 prepublish build로 생성했다. 저장소 의존성·lockfile은 변경하지 않았다.

첫 설치 VSIX E2E는 응답 상태 대기 중 timeout이 발생했고 실패 화면에는 빈 URL이 보였다. 초기화/입력 경합 가능성을 조사했지만 원인을 확정하지 못했다. 읽기 전용 진단 관찰을 넣은 재실행과 이를 완전히 제거한 최종 재실행이 모두 통과했다. 기대값 완화, 고정 sleep, production test backdoor, 추측에 따른 readiness 변경은 하지 않았다.

신규 History E2E의 두 번째 요청은 POST 전용 `/echo` 대신 GET 200을 지원하는 `/headers`로 수정했다. Pin/Unpin도 context menu 항목이 아니라 실제 tree row의 inline 버튼을 사용하도록 테스트 경로를 수정했다. Windows OS native 삭제 확인창은 Playwright DOM 밖이므로 해당 테스트의 임시 user settings만 `window.dialogStyle=custom`으로 지정해 실제 VS Code Delete 확인창을 조작한다. 성공 응답 표시 시점의 즉시 디스크 저장, 순서, pin/unpin, pinned 필터, pinned 보존 삭제 기대는 그대로 유지한다. 제품 코드는 이 실패 때문에 변경하지 않았다.

제품 코드가 추가로 바뀌지 않아 이미 통과한 기존 24개 전체 suite는 반복하지 않았다. 실패했던 신규 #25만 최종 코드로 재검증했다.

## 홍보 카메라 비교

현재 README가 참조하는 WebP를 읽기 전용으로 확인했다. 원본은 1280×720, 659 frames, 43.999초이며, 12.533초의 Help와 31초의 Run: Demo API / Total에서 왼쪽 글자 잘림을 확인했다.

위에서 검증한 동일 VSIX를 `PROMO_VSIX`로 재사용해 격리된 VS Code와 로컬 API를 녹화했다. 캡처 테스트는 43.3초, 전체 실행은 48.2초에 통과했다. 같은 새 footage에 기준/수정 카메라를 적용한 결과는 다음과 같다 (1920×1080 composition 좌표).

| 실제 UI label | 이전 카메라 왼쪽 잘림 | 수정 카메라 왼쪽 여백 | 수정 후 모든 방향 잘림 |
| --- | ---: | ---: | ---: |
| Help | 25.57 px | 6.23 px | 0 px |
| Run: Demo API | 11.56 px | 11.84 px | 0 px |
| Total | 11.56 px | 11.84 px | 0 px |

실제 캡처에서 기록한 label bounds를 composition의 변환 후 좌표에 투영해 검사했고, 대표 PNG에서 전체 글자가 보이는 것도 확인했다. 최종 source crop은 x=350..1600으로, Help/Runner/Total 앞 여백을 남기면서 Terminal·사이드바의 잘린 끝글자도 제외한다.

최종 파일은 ignored 로컬 `demo/promo/.capture/preview/tessra-promo-preview.mp4`다. 45.000초, 1280×720, 15fps, 675 frames, H.264 + AAC 48 kHz stereo, 3,177,253 bytes를 ffprobe로 확인했다. 최종 MP4에서 Help/Runner 프레임을 다시 추출해 시각 확인했다. `node --check`와 promo diff 검사도 통과했다.

검증 자료는 같은 로컬 preview 폴더의 `camera-geometry.json`, `before/geometry.json`, `stills/encoded-help.png`, `stills/encoded-runner.png`에 있다. 생성 미디어는 커밋하지 않았다.

## 범위와 한계

- 로컬 Ubuntu/WSL 환경은 없었다. 이 문서는 Windows 로컬 검증 기록이며 Ubuntu/Windows CI 결과는 최종 커밋에 연결된 GitHub Actions 실행 결과와 구분한다.
- 단위 테스트는 파일 교체·삭제·복구·손상·프로필 전환·저장 실패를 격리된 저장소에서 검증한다. 실제 UI의 History E2E는 연속 완료·핀·필터·삭제 흐름을 검증한다.
- HTML Preview의 영어 실제 Webview E2E와 모듈 수준 한국어/일본어 locale 입력 검증을 구분한다. 모든 OS·테마·언어 조합의 수동 smoke를 수행한 것은 아니다.
- 공개 홍보 영상에는 기존 잘림이 남는다. 로컬 preview 검토 후 별도의 미디어 배포와 README 링크 교체가 필요하며, 이번 작업에서는 릴리스·배포하지 않는다.
