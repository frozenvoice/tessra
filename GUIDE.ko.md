# Tessra 가이드

Tessra는 VS Code용 로컬 우선 REST API 클라이언트입니다.

로그인, 클라우드 동기화, 유료 제한 없이 핵심 워크플로를 사용할 수 있습니다.

## 빠른 시작

1. Activity Bar에서 Tessra를 엽니다.
2. `Tessra: New Request`를 실행하거나 `+`를 클릭합니다.
3. HTTP 메서드를 고르고 URL을 입력합니다.
4. params, headers, body, auth, scripts, request settings를 채웁니다.
5. `Send`를 클릭하거나 URL 입력창에서 `Enter`를 누릅니다.

환경 변수 사용 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 요청 작성

- 메서드: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Body 타입: `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- 인증: No Auth, Basic, Bearer Token, API Key
- 고정 탭이 있는 멀티 탭 편집
- URL 입력창에서 `Enter`를 누르면 활성 요청을 보냅니다.
- 상단 요약 칩은 현재 환경, 인증 방식, 기본 헤더 사용, 스크립트, 히스토리 동작을 보여줍니다.
- 민감한 인증 값은 reveal 버튼을 누르기 전까지 마스킹됩니다.
- 헤더나 쿼리 파라미터를 한 줄씩 추가하지 않고 일괄 붙여넣을 수 있습니다.
- 전송 전 미해결 `{{variables}}`가 있으면 Tessra가 경고합니다.

## 응답 작업 공간

- 탭: `Body`, `Headers`, `Cookies`, `Tests`, 그리고 의미 있는 정적 HTML이 있을 때 표시되는 `Preview`
- 동적 HTML 페이지는 `Body`에 남기고, HTTP/HTTPS로 해석된 페이지는 `Open URL`로 열 수 있습니다.
- 응답 메타데이터는 읽기 쉬운 duration과 요청/수신 시각을 보여줍니다.
- 고정 응답 툴바에서 검색, 비교, 복사, 저장 액션을 계속 사용할 수 있습니다.
- 응답 본문 검색은 다음/이전 이동, 대소문자 구분, 정규식 모드를 지원합니다.
- JSON tree viewer
- XML format: `Pretty`, `Compact`, `Inline Children`
- 응답 본문 저장 또는 복사
- `Raw`, `Normalized`, `Pretty` 모드 응답 비교
- 비교 상태 칩은 현재 모드, 메타데이터 요약 사용 여부, 고정 응답 준비 상태를 보여줍니다.

## 컬렉션, 히스토리, 환경

- 컬렉션, 폴더, 저장된 요청 생성
- Drag and drop으로 요청 정리
- 컬렉션 전체 실행
- 컬렉션 실행은 활성 요청, 현재 시도 횟수, 재시도 카운트다운을 보여줍니다.
- 실행된 스냅샷과 timing metadata를 히스토리에 저장
- 활성 환경 전환과 요청 전체의 `{{variables}}` 치환

## 워크스페이스 프로필

- `default`는 평소 Tessra 작업을 위한 기본 로컬 저장 공간입니다.
- 다른 프로젝트, 가져온 spec, 실험을 현재 컬렉션과 히스토리와 섞고 싶지 않을 때 새 프로필을 만듭니다.
- 프로필은 collections, history, environments, default headers, saved tabs를 분리합니다.
- 실용적인 기준:
  - 서로 다른 프로젝트나 작업 흐름은 프로필로 분리합니다.
  - 같은 프로젝트 안의 `local`, `staging`, `prod`는 환경으로 분리합니다.
- `Tessra: Change Workspace Profile`로 프로필을 전환하거나 만들 수 있습니다.
- 요청 헤더에는 현재 프로필이 표시되고, `default` 프로필 칩에 hover하면 의미를 설명합니다.

## Scripts

- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs와 test 결과 표시

## 요청별 Settings

- Timeout
- Follow redirects
- Save to history
- 요청 툴바나 Headers 탭 배너에서 `Default Headers` 열기
- TLS override
- 최대 응답 크기
- Retry count와 retry delay
- Stop after headers
- Skip default headers
- Disable scripts
- 안전성이나 동작을 바꾸는 설정은 시각적으로 강조됩니다.
- 응답에 의미 있는 정적 HTML이 있으면 Preview를 자동으로 엽니다.

## 표시 언어

- `Tessra: Change Display Language`로 `English`, `Korean`, `Japanese` 사이를 전환할 수 있습니다.
- Tessra는 패널, 프롬프트, 알림, 인앱 가이드에 자체 표시 언어 설정을 사용합니다.
- VS Code Settings 레이블과 Command Palette 제목은 계속 VS Code locale을 따릅니다.

## 키보드 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
- `Enter`: URL 입력창에서 전송
- `Ctrl+Enter`: 요청 전송

macOS에서는 `Ctrl` 대신 `Cmd`를 사용합니다.

## 로컬 저장

모든 Tessra 데이터는 VS Code `globalStorage` 아래 JSON 파일로 로컬 저장됩니다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Tessra는 사용자가 명시적으로 API 요청을 보낼 때만 네트워크를 사용합니다.
