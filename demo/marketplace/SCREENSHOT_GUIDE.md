# Tessra Marketplace Screenshot Guide

이 가이드는 VS Code Marketplace README와 갤러리 이미지용 스크린샷을 빠르게 찍기 위한 촬영 순서이다. 데모 데이터는 아래 파일을 기준으로 한다.

- `demo/marketplace/demo-collection.postman_collection.json`
- `demo/marketplace/demo-environment.postman_environment.json`

1.0.10 Quiet Instrument **풀 갤러리 Replace** 스테이징/승인/업로드 절차는 `tmp/marketplace-screenshots/README.md`를 본다.

**Replace (4/4):** `screenshot-main.png`, `screenshot-request-compose.png`, `screenshot-html-preview.png`, `screenshot-history.png`

PNG는 사용자 승인 후에만 `frozenvoice-assets`의 `tessra/images/`에 동일 파일명으로 덮어쓴다. README raw URL은 변경하지 않는다.

## 촬영 전 확인

- 컬렉션 이름: `Tessra Demo Collection`
- 환경 이름: `Tessra Demo Environment`
- 활성 환경: `Tessra Demo Environment`
- 사용 변수: `baseUrl`, `echoUrl`, `htmlUrl`, `xmlUrl`, `wsBaseUrl`, `apiKey`, `bearerToken`
- Quiet Instrument: Method → URL → Send 우선, status strip에 Env(`N vars`) / Defaults / Used N / Scripts·History cue (pill wall·soft-card·Send success-green 재도입 금지)
- **네 장 동일:** VS Code theme, 창 크기, zoom, Quiet Instrument UI, Demo Collection / Environment
- 권장 레이아웃: 왼쪽 Tessra 사이드바에 `Collections`, `Environments`, `History`가 보이고, 오른쪽에는 요청 패널이 넓게 보이도록 둔다. 터미널·디버그·토스트는 숨긴다.
- 환경 활성화: Environments에서 `Tessra Demo Environment` → Set Active / `활성으로 설정`, 또는 `Tessra: Switch Environment`
- 스테이징 출력: `tmp/marketplace-screenshots/screenshot-*.png` (gitignore)
- remote 업로드 경로 (`frozenvoice-assets`):
  - `tessra/images/screenshot-main.png`
  - `tessra/images/screenshot-request-compose.png`
  - `tessra/images/screenshot-html-preview.png`
  - `tessra/images/screenshot-history.png`

## 1. 메인 대표샷 (Replace)

- 추천 제목: `Local API client for collections, environments, and responses`
- README 권장 위치: 첫 번째 이미지
- 파일명: `images/screenshot-main.png` → 스테이징 `screenshot-main.png`
- 열 요청: `Tessra Demo Collection` > `01. Basics` > `GET Users List`
- 활성 환경: `Tessra Demo Environment`
- 요청 탭: `Params` 또는 기본 요청 편집 화면
- 응답 탭: `Body`

### 클릭 시퀀스

1. `GET Users List`를 연다.
2. URL이 `{{baseUrl}}/users?_limit=5`인지 확인한다.
3. Quiet Instrument status strip(Env `N vars` 등)이 보이게 둔다.
4. Send → 응답 `200` + JSON body.
5. crop → `tmp/marketplace-screenshots/screenshot-main.png`

### Must be visible

- 사이드바 Collections / Environments / History + Tessra Demo Collection
- Method / URL / Send + status strip
- 응답 요약 `200`과 JSON 본문

### Avoid

- 구형 pill wall / success-green Send / Settings·Guide 영웅 / 토스트·터미널

## 2. 요청 작성샷 (Replace)

- 추천 제목: `Compose POST requests with JSON bodies and variables`
- README 권장 위치: 두 번째 이미지
- 파일명: `images/screenshot-request-compose.png`
- 열 요청: `Tessra Demo Collection` > `02. JSON Body` > `POST Create Post`
- 요청 탭: `Body`

### 클릭 시퀀스

1. `POST Create Post`를 연다.
2. Body 탭을 선택한다 (JSON + syntax highlight).
3. URL `{{baseUrl}}/posts`, 아래 payload 확인. **타입 변경하지 않음** (Convert 다이얼로그 금지).

```json
{
  "title": "Tessra demo",
  "body": "Local-first API testing",
  "userId": 1
}
```

4. 요청 Body 영역이 영웅이 되도록 분할을 잡는다.
5. crop → `tmp/marketplace-screenshots/screenshot-request-compose.png`

### Must be visible

- `POST`, `{{baseUrl}}/posts`, JSON highlight Body, Quiet Instrument strip

### Avoid

- Convert / Keep text / Cancel 모달, 구형 empty-state 카드 영웅

## 3. HTML Preview 샷 (Replace)

- 추천 제목: `Preview HTML responses safely inside VS Code`
- README 권장 위치: 세 번째 이미지
- 파일명: `images/screenshot-html-preview.png`
- 열 요청: `Tessra Demo Collection` > `04. Preview & XML` > `GET Example HTML`
- URL: `{{htmlUrl}}` → `https://httpbin.io/html`
- 응답 탭: `Preview`

### 클릭 시퀀스

1. `GET Example HTML`을 연다.
2. URL이 `{{htmlUrl}}`인지 확인한다.
3. Send → `200`.
4. 응답 영역에서 `Preview` 탭을 선택한다 (Offline HTML Preview).
5. Quiet Instrument chrome이 Preview 주변에 보이게 프레임 → `tmp/marketplace-screenshots/screenshot-html-preview.png`

### Must be visible

- Preview 탭 + HTML 스냅샷
- Quiet Instrument Method/URL/Send 또는 status strip (구형 pill UI 아님)
- public HTML demo endpoint

### Avoid

- 구형 Request Panel chrome, Preview 미선택(raw only), Settings/Guide/토스트

## 4. History 샷 (Replace)

- 추천 제목: `Run collections and revisit request history`
- README 권장 위치: 네 번째 이미지
- 파일명: `images/screenshot-history.png`
- **우선:** History 사이드바 (Today/날짜 그룹 + 여러 GET/POST)
- **허용:** Quiet Instrument Collection Runner 오버레이 (구형 Runner 금지). History가 영웅.

### History 촬영 (권장)

1. `GET Users List`, `GET Posts with Query`, `POST Create Post`, `GET Example HTML`을 각각 Send해 History를 채운다 (필요 시 Echo GET/POST 추가).
2. 왼쪽 `History` 뷰를 연다.
3. `Today`(또는 날짜 그룹) 아래 여러 demo 항목이 보이게 사이드바를 넓힌다.
4. 오른쪽에 Quiet Instrument 요청 패널이 보여도 되나 History가 주인공.
5. crop → `tmp/marketplace-screenshots/screenshot-history.png`

### Collection Runner (선택, Quiet Instrument만)

1. `Tessra Demo Collection` 우클릭 → `Run All Requests`.
2. 완료 요약·요청별 결과가 Quiet Instrument chrome으로 보이게 둔다.
3. History 목록 또는 Runner 결과가 읽히도록 프레임한다 (구형 디자인 금지).

### Must be visible

- History Today/그룹 + 여러 GET/POST (메서드·상태·URL 힌트)
- Quiet Instrument (패널 또는 Runner)

### Avoid

- 빈 History, 사내/민감 URL, 구형 Request Panel·구형 Runner 지배

## README 배치 순서

1. `images/screenshot-main.png`
2. `images/screenshot-request-compose.png`
3. `images/screenshot-html-preview.png`
4. `images/screenshot-history.png`

## Capture status

- Auto-capture: 불가 — Extension Development Host에서 수동 F5 촬영.
- 업로드: 승인 후 `frozenvoice-assets/tessra/images/`에 네 장 모두 동일 파일명 덮어쓰기. Tessra README URL·assets remote는 이 가이드 작업에서 수정하지 않는다.
