# Tessra Marketplace Screenshot Guide

이 가이드는 VS Code Marketplace README와 갤러리 이미지용 스크린샷을 빠르게 찍기 위한 촬영 순서이다. 데모 데이터는 아래 파일을 기준으로 한다.

- `demo/marketplace/demo-collection.postman_collection.json`
- `demo/marketplace/demo-environment.postman_environment.json`

## 촬영 전 확인

- 컬렉션 이름: `Tessra Demo Collection`
- 환경 이름: `Tessra Demo Environment`
- 활성 환경: `Tessra Demo Environment`
- 사용 변수: `baseUrl`, `echoUrl`, `htmlUrl`, `xmlUrl`, `wsBaseUrl`, `apiKey`, `bearerToken`
- 권장 레이아웃: 왼쪽 Tessra 사이드바에 `Collections`, `Environments`, `History`가 보이고, 오른쪽에는 요청 패널이 넓게 보이도록 둔다.
- 환경 활성화 방법: `Environments` 뷰에서 `Tessra Demo Environment`를 우클릭한 뒤 `Set Active` / `활성으로 설정`을 선택하거나, 상태 표시줄의 환경 항목에서 `Tessra: Switch Environment` / `Tessra: 환경 전환`으로 선택한다.
- README 권장 이미지 경로:
  - `images/screenshot-main.png`
  - `images/screenshot-request-compose.png`
  - `images/screenshot-html-preview.png`
  - `images/screenshot-history.png`

## 1. 메인 대표샷

- 추천 제목: `Local API client for collections, environments, and responses`
- README 권장 위치: 첫 번째 이미지
- 파일명: `images/screenshot-main.png`
- 열 요청: `Tessra Demo Collection` > `01. Basics` > `GET Users List`
- 활성 환경: `Tessra Demo Environment`
- 요청 탭: `Params` 또는 기본 요청 편집 화면
- 응답 탭: `Body`
- 촬영 전 동작:
  1. `GET Users List`를 연다.
  2. URL이 `{{baseUrl}}/users?_limit=5`로 보이는지 확인한다.
  3. 요청을 보낸다.
  4. 응답 상태 `200`과 JSON 응답 본문이 보이도록 둔다.
- 같이 보여야 할 UI 요소:
  - 왼쪽 `Collections` 트리에 `Tessra Demo Collection`
  - 왼쪽 `Environments` 트리에 활성화된 `Tessra Demo Environment`
  - 상단 요청 탭, `GET` 메서드, `Send` 버튼, 변수 기반 URL
  - 응답 메타데이터의 상태/시간/크기와 JSON 응답 본문

## 2. 요청 작성샷

- 추천 제목: `Compose POST requests with JSON bodies and variables`
- README 권장 위치: 두 번째 이미지
- 파일명: `images/screenshot-request-compose.png`
- 열 요청: `Tessra Demo Collection` > `02. JSON Body` > `POST Create Post`
- 활성 환경: `Tessra Demo Environment`
- 요청 탭: `Body`
- 응답 탭: 선택 사항. 작성 화면을 강조하려면 응답 영역보다 요청 편집 영역이 더 많이 보이게 둔다.
- 촬영 전 동작:
  1. `POST Create Post`를 연다.
  2. 요청 편집 탭에서 `Body`를 선택한다.
  3. Body 타입이 JSON/raw 계열로 보이고 아래 예시가 보이도록 둔다.

```json
{
  "title": "Hello from Tessra",
  "body": "This request is used for marketplace screenshots.",
  "userId": 1,
  "tags": ["demo", "marketplace", "tessra"]
}
```

- 같이 보여야 할 UI 요소:
  - `POST` 메서드와 `{{baseUrl}}/posts` URL
  - `Body` 탭이 선택된 상태
  - JSON body 예시
  - 가능하면 `Headers` 요약이나 헤더 탭의 `Content-Type: application/json`, `X-API-Key: {{apiKey}}`
  - 활성 환경 또는 변수 미리보기 힌트가 보이면 좋다.

## 3. HTML Preview 샷

- 추천 제목: `Preview HTML responses safely inside VS Code`
- README 권장 위치: 세 번째 이미지
- 파일명: `images/screenshot-html-preview.png`
- 열 요청: `Tessra Demo Collection` > `04. Preview & XML` > `GET Example HTML`
- 활성 환경: `Tessra Demo Environment`
- 요청 탭: 기본 요청 편집 화면
- 응답 탭: `Preview`
- 촬영 전 동작:
  1. `GET Example HTML`을 연다.
  2. URL이 `{{htmlUrl}}`로 보이는지 확인한다.
  3. 요청을 보낸다.
  4. 응답 영역에서 `Preview` 탭을 선택한다.
- 같이 보여야 할 UI 요소:
  - `GET` 메서드와 `{{htmlUrl}}` URL
  - 응답 상태 `200`
  - `Preview` 탭이 선택된 상태
  - `Offline HTML Preview` / `오프라인 HTML 미리보기` 영역과 정적 HTML 스냅샷

## 4. Collection Runner 또는 History 샷

- 추천 제목: `Run collections and revisit request history`
- README 권장 위치: 네 번째 이미지
- 파일명: `images/screenshot-history.png`
- 우선 추천: Collection Runner
- 대체 추천: History

### Collection Runner 촬영

- 열 대상: `Collections` > `Tessra Demo Collection`
- 활성 환경: `Tessra Demo Environment`
- 촬영 전 동작:
  1. `Tessra Demo Collection`을 우클릭한다.
  2. `Run All Requests` / `모든 요청 실행`을 선택한다.
  3. 실행 오버레이가 완료되면 진행률, 성공/실패 카운트, 요청별 결과 행이 보이도록 둔다.
- 같이 보여야 할 UI 요소:
  - 왼쪽 컬렉션 트리
  - Collection Runner 오버레이
  - 실행된 요청 목록, 상태 코드, 실행 시간
  - 실패 요청만 재실행 버튼이 보이면 함께 담는다.

### History 대체 촬영

- 열 대상: 왼쪽 `History` 뷰
- 활성 환경: `Tessra Demo Environment`
- 촬영 전 동작:
  1. `GET Users List`, `POST Create Post`, `GET Example HTML`을 한 번씩 보낸다.
  2. 왼쪽 `History` 뷰를 연다.
  3. 최근 요청들이 메서드, 상태 코드, URL과 함께 보이도록 둔다.
- 같이 보여야 할 UI 요소:
  - `History` 뷰의 최근 요청 목록
  - 요청 패널의 선택된 요청과 응답
  - 가능하면 필터 버튼과 pin 상태를 함께 보이게 둔다.

## README 배치 순서

1. `images/screenshot-main.png`
2. `images/screenshot-request-compose.png`
3. `images/screenshot-html-preview.png`
4. `images/screenshot-history.png`
