# CI 아티팩트 보존

`.github/workflows/ci.yml`은 `workflow_dispatch`로만 시작한다. `push`, `pull_request`, `schedule`을 비롯한 자동 시작은 넣지 않는다.

E2E job이 실패하면 `e2e/.artifacts/`를 아티팩트 `tessra-e2e-artifacts`로 올린다. 스크린샷과 진단 메타만 해당하고, 성공한 실행에서는 올리지 않는다. 경로가 점으로 시작하므로 `include-hidden-files: true`를 유지한다.

## 왜 7일인가

`actions/upload-artifact`는 `retention-days`를 생략하면 저장소 기본값까지 파일을 남긴다. GitHub의 일반 기본값은 90일이다. 수동 전체 검증은 자주 돌지 않아도, 실패할 때마다 진단 묶음이 그 기간 동안 쌓인다.

7일은 실패한 수동 실행을 같은 주에 다시 열어 보기에 충분하고, 릴리스 산출물이나 배포 설정과는 관계가 없다. 허용 범위는 1–90일이다. 기간이 지나면 GitHub가 삭제한다. 이 저장소의 스크립트는 이미 올라간 아티팩트를 지우지 않는다.

## 검사

외부 패키지 없이 실행한다.

```bash
python3 scripts/check-artifact-retention.py
python3 scripts/check-artifact-retention.py --self-test
```

- `actions/upload-artifact` 단계에 비어 있지 않은 `retention-days`가 없으면 실패한다. `0`이나 91 이상인 정수처럼 GitHub 허용 범위 밖도 실패한다.
- `on`의 `push`, `pull_request`, `schedule`은 경고만 한다. 그 경고만으로는 종료 코드가 0이다.
- 워크플로 YAML을 읽지 못하면 실패한다. 누락을 놓치지 않기 위한 동작이다.

워크플로를 바꾼 뒤 위 스크립트를 실행하고, YAML이 로드되는지도 확인한다. 검사 스크립트는 PyYAML에 의존하지 않는다. YAML 1.1에서 키 `on`이 불리언으로 읽히면 자동 시작 경고를 놓칠 수 있다.
