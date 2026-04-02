# Arc Client

Offline-first VS Code REST API 클라이언트 확장.
No login required, no cloud dependency — 완전 오프라인으로 동작합니다.

- 외부 네트워크 호출 없음 (텔레메트리, 업데이트 체크, 인증 서버 호출 없음)
- All data stored locally (JSON 파일 기반)
- Works without internet connection
- 런타임 외부 의존성 없음 (Node.js 내장 모듈만 사용)

## 설치

```bash
# VSIX 빌드
npm install
npm run build
npx vsce package

# VS Code에서 설치
# Extensions > ... > Install from VSIX > arc-client-x.x.x.vsix
```

## 기능 개요

### HTTP 요청

지원 메서드: `GET` `POST` `PUT` `PATCH` `DELETE` `HEAD` `OPTIONS`

1. 사이드바에서 Arc Client 아이콘 클릭
2. `+` 버튼 또는 `Ctrl+T`로 새 요청 탭 생성
3. 메서드 선택, URL 입력
4. 필요시 Params, Headers, Body, Auth 탭에서 설정
5. `Send` 버튼 또는 `Ctrl+Enter`로 전송

#### 다중 탭

여러 요청을 탭으로 동시에 열어둘 수 있습니다. 각 탭은 독립적인 요청 상태(메서드, URL, 헤더, 바디, 인증, 타임아웃)를 유지합니다.

#### 타임아웃

Send 버튼 옆 숫자 입력란에서 요청별 타임아웃(초)을 설정합니다.

| 값 | 동작 |
|----|------|
| `30` | 기본값. 30초 후 타임아웃 |
| `0` | 타임아웃 없음 (무제한 대기) |
| 임의 값 | 해당 초 후 타임아웃 |

#### 인증 (Auth)

Auth 탭에서 인증 방식을 선택합니다.

| 타입 | 설명 |
|------|------|
| **No Auth** | 인증 없음 |
| **Basic Auth** | Username, Password 입력. Base64 인코딩하여 `Authorization: Basic ...` 헤더 자동 추가 |
| **Bearer Token** | 토큰 입력. `Authorization: Bearer ...` 헤더 자동 추가 |
| **API Key** | Key, Value 입력. Header 또는 Query 파라미터로 추가 위치 선택 |

#### 응답 뷰어

응답 바디는 Content-Type에 따라 자동으로 구문 하이라이팅됩니다.

| Content-Type | 표시 방식 |
|-------------|-----------|
| `application/json` | JSON 트리뷰 (접기/펼치기) + Raw 텍스트 토글 |
| `text/html` | HTML 태그/속성 하이라이팅 |
| `text/xml`, `application/xml` | XML 태그/속성/PI/CDATA 하이라이팅 |
| `text/javascript` | JS 키워드/문자열/숫자/주석 하이라이팅 |
| `text/css` | CSS 선택자/속성/값 하이라이팅 |
| 기타 | Plain text |

JSON 응답일 때:
- **Tree / Raw** 토글로 보기 방식 전환
- **Expand** / **Collapse** 버튼으로 전체 펼치기/접기
- 접힌 노드에 `... 5 keys` / `... 3 items` 요약 표시

응답 메타 바의 **Save** 버튼으로 응답 바디를 파일로 저장할 수 있습니다. Content-Type에 따라 파일 확장자가 자동 추천됩니다.

### 환경변수 (Environments)

환경변수를 사용하면 개발/스테이징/운영 서버를 쉽게 전환할 수 있습니다.

1. Environments 뷰에서 `+` 버튼으로 환경 생성
2. 환경 클릭 → 변수 편집 패널에서 Key-Value 쌍 추가
3. 우클릭 > **Set Active**로 활성 환경 설정
4. URL, 헤더, 바디 등에서 `{{변수명}}` 형태로 사용

```
URL: {{baseUrl}}/api/users
Header: Authorization: Bearer {{token}}
Body: {"env": "{{envName}}"}
```

하단 상태바에 현재 활성 환경이 표시됩니다. 클릭하면 QuickPick으로 빠르게 전환할 수 있습니다.

### Collections

요청을 컬렉션과 폴더로 구조화하여 관리합니다.

- **생성**: 타이틀 바 `+` 버튼 또는 `...` 메뉴 > New Collection
- **폴더**: 컬렉션/폴더 우클릭 > New Folder
- **저장**: 요청 패널의 Save 버튼 → 저장 위치 선택
- **정렬**: 드래그앤드롭으로 요청/폴더 순서 변경, 컬렉션 간 이동
- **검색**: 타이틀 바 검색 아이콘 → 요청 이름, URL, 메서드로 실시간 필터링

우클릭 컨텍스트 메뉴:

| 메뉴 | 대상 | 설명 |
|------|------|------|
| New Folder | 컬렉션, 폴더 | 하위 폴더 생성 |
| Duplicate | 요청, 폴더 | 같은 위치에 "(이름) Copy"로 복제 |
| Save As... | 요청, 폴더 | 다른 컬렉션/폴더로 복사 저장 |
| Copy as cURL | 요청 | cURL 명령어로 클립보드 복사 |
| Rename | 모두 | 이름 변경 |
| Delete | 모두 | 삭제 (확인 대화상자) |

`...` 메뉴 항목:

| 메뉴 | 설명 |
|------|------|
| New Collection | 새 컬렉션 생성 |
| Import Collection | JSON 파일에서 컬렉션 가져오기 |
| Import cURL | cURL 명령어로 요청 가져오기 |
| Collapse All | 모든 컬렉션 접기 |

### History

모든 요청은 자동으로 히스토리에 저장됩니다 (최대 200건).

- 항목 클릭 → 새 탭에 요청 정보 로드
- 드래그앤드롭으로 순서 변경
- 검색 아이콘으로 필터링:
  - URL로 검색: `example.com`
  - 메서드로 검색: `GET`, `POST`
  - 상태코드로 검색: `200`, `404`, `500`
- Clear History 버튼으로 전체 삭제

### cURL

#### Import cURL

Collections 뷰 타이틀 바의 Import 아이콘을 클릭하고 cURL 명령어를 붙여넣습니다.

**bash 형식** (macOS/Linux):
```bash
curl 'https://api.example.com/users' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"test"}'
```

**Windows cmd 형식** (Chrome DevTools > Copy as cURL (cmd)):
```cmd
curl ^"https://api.example.com/data^" ^
  -H ^"Content-Type: application/json^" ^
  --data-raw ^"^{^\^"key^\^":^\^"value^\^"^}^"
```

두 형식 모두 자동 감지됩니다. 파싱되는 항목:
- 메서드 (`-X`), URL, 헤더 (`-H`), 바디 (`-d`, `--data-raw`)
- 쿠키 (`-b` → Cookie 헤더로 변환)
- 인증 (`-u` → Basic Auth, `Authorization` 헤더 → Bearer/Basic 자동 분류)
- 쿼리 파라미터 (URL에서 자동 추출)

#### Copy as cURL (Export)

두 가지 방법으로 내보낼 수 있습니다:

1. **요청 패널**: URL 바의 `cURL` 버튼 클릭
2. **컬렉션**: 요청 우클릭 > Copy as cURL

### Import Collection

`...` 메뉴 > Import Collection으로 JSON 파일에서 컬렉션을 가져옵니다.

지원 형식:
```json
// 단일 컬렉션
{
  "name": "My API",
  "items": [
    {
      "type": "request",
      "name": "Get Users",
      "request": { "method": "GET", "url": "https://api.example.com/users", ... }
    }
  ]
}

// 여러 컬렉션 (배열)
[
  { "name": "API v1", "items": [...] },
  { "name": "API v2", "items": [...] }
]
```

## 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+T` | 새 요청 탭 생성 |
| `Ctrl+W` | 현재 탭 닫기 |
| `Ctrl+Enter` | 요청 전송 |

macOS에서는 `Ctrl` 대신 `Cmd` 사용.

## 데이터 저장 위치

모든 데이터는 VS Code의 `globalStorage` 디렉토리에 JSON 파일로 저장됩니다.

| 파일 | 내용 |
|------|------|
| `collections.json` | 컬렉션, 폴더, 요청 |
| `history.json` | 요청 히스토리 (최대 200건) |
| `environments.json` | 환경변수 |

경로:
- **Windows**: `%APPDATA%\Code\User\globalStorage\arc.arc-client\`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/arc.arc-client/`
- **Linux**: `~/.config/Code/User/globalStorage/arc.arc-client/`

백업이 필요하면 해당 디렉토리의 JSON 파일을 복사하세요.

## 빌드

```bash
npm run build          # esbuild 번들링
npm run watch          # 개발 중 자동 빌드
npx vsce package       # VSIX 생성
```

디버깅: VS Code에서 `F5`로 Extension Development Host 실행.

## 기술 스택

- TypeScript (strict mode)
- VS Code Extension API (^1.74.0)
- Node.js 내장 `http`/`https` 모듈
- esbuild 번들링
- 외부 런타임 의존성 없음
