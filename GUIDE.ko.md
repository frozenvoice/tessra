# Tessra 가이드

Tessra는 VS Code 안에서 동작하는 로컬 우선 REST API 클라이언트입니다.

로그인도 없고, 클라우드 동기화도 없고, 핵심 기능을 잠가두는 유료 장벽도 없습니다.

## 빠른 시작

1. Activity Bar에서 Tessra를 엽니다.
2. `Tessra: New Request`를 실행하거나 `+`를 클릭합니다.
3. HTTP 메서드를 고르고 URL을 입력합니다.
4. params, headers, body, auth, scripts, request settings를 채웁니다.
5. `Send`를 누르거나 URL 입력창에서 `Enter`를 누릅니다.

환경 변수 예시:

```text
URL: {{baseUrl}}/users
Header: Authorization: Bearer {{token}}
Body: {"env":"{{envName}}"}
```

## 요청 작성

- 메서드: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- 바디 타입: `json`, `xml`, `form-urlencoded`, `form-data`, `binary`, `raw`
- 인증: No Auth, Basic, Bearer Token, API Key
- 멀티 탭 편집과 탭 고정
- URL 입력창에서 `Enter`로 즉시 전송

## 응답 워크스페이스

- `Body`, `Headers`, `Cookies`, `Tests` 탭과, 의미 있는 정적 HTML이 있을 때만 보이는 `Preview` 탭
- 동적 HTML 페이지는 `Body` 탭에 남고 HTTP/HTTPS 원본 페이지는 `URL 열기` 액션으로 열 수 있습니다.
- JSON 트리 뷰어
- XML 포맷: `Pretty`, `Compact`, `Inline Children`
- 응답 본문 저장/복사
- `Raw`, `Normalized`, `Pretty` 모드 응답 비교

## Collections / History / Environments

- 컬렉션, 폴더, 저장된 요청 생성
- Drag & Drop으로 정리
- 컬렉션 전체 실행
- 실행 시점 스냅샷 기반 history 저장
- 활성 환경 전환과 `{{variables}}` 치환

## 워크스페이스 프로필

- `default`는 평소 Tessra 작업을 두는 메인 로컬 저장 공간입니다
- 다른 프로젝트, 가져온 OpenAPI/Postman 데이터, 임시 실험이 기존 작업과 섞이면 안 될 때 새 프로필을 만드세요
- 프로필은 collections, history, environments, default headers, saved tabs를 통째로 분리합니다
- 실전 기준으로는 이렇게 나누면 가장 덜 헷갈립니다
  - 프로필: 서로 다른 프로젝트나 작업 흐름
  - 환경: 같은 프로젝트 안의 `local`, `staging`, `prod`
- 전환이나 생성은 `Tessra: Change Workspace Profile`에서 할 수 있습니다
- 요청 상단의 프로필 배지에 현재 프로필이 보이고, `default` 배지에는 의미 설명 툴팁이 붙습니다

## Scripts

- Pre-request script
- Test script
- `pm.test`, `pm.expect`, `pm.environment`
- script logs와 test 결과 표시

## 요청별 Settings

- Timeout
- Follow redirects
- Save to history
- TLS override
- 최대 응답 크기
- Retry count / retry delay
- Headers까지만 받고 종료
- Default headers 건너뛰기
- Scripts 비활성화
- 의미 있는 정적 HTML이 있으면 Preview를 자동으로 열기

## 표시 언어

- `Tessra: Change Display Language`로 `English`, `Korean`, `Japanese`를 전환할 수 있습니다.
- Tessra는 패널, 프롬프트, 알림, 인앱 가이드에 자체 표시 언어 설정을 사용합니다.
- VS Code 설정 레이블과 Command Palette 명령 이름은 계속 VS Code locale을 따릅니다.

## 단축키

- `Ctrl+T`: 새 요청 탭
- `Ctrl+W`: 현재 탭 닫기
- `Enter`: URL 입력창에서 전송
- `Ctrl+Enter`: 요청 전송

macOS에서는 `Cmd`를 사용합니다.

## 로컬 저장

모든 Tessra 데이터는 VS Code `globalStorage` 아래 JSON 파일로 로컬 저장됩니다.

- `collections.json`
- `history.json`
- `environments.json`
- `active-environment.json`
- `default-headers.json`
- `tab-state.json`

Tessra는 사용자가 직접 API 요청을 보낼 때만 네트워크를 사용합니다.
