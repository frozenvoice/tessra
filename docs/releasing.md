# 수동 전체 검증과 VSIX 공개

현재 저장소에는 VSIX 게시/릴리스 자동화가 없다. `.github/workflows/ci.yml`은 `workflow_dispatch`로 전체 검증만 수행하며 Marketplace 게시, 버전 증가, 태그 생성, VSIX 생성은 하지 않는다. 일반 push/PR에는 원격 빌드·테스트가 실행되지 않는다. 평소 작업 완료 기준과 선택 회귀는 [testing.md](testing.md)를 따른다.

## 공개 전 최종 소스 고정

1. 릴리스 버전, `package.json`/`package-lock.json`, Changelog, README 및 필요한 릴리스 문서까지 최종 커밋에 포함한다. 버전 변경 이전 SHA의 검증을 재사용하지 않는다.
2. 패키징에 사용할 checkout이 깨끗한지 `git status --porcelain --untracked-files=all`로 확인하고 `git rev-parse HEAD`의 전체 SHA를 기록한다. `.vscodeignore`로 제외되지 않은 untracked/ignored 파일도 VSIX에 섞이지 않도록 archive 목록을 확인한다.
3. 그 최종 커밋을 원격에 push한 다음, 사용자가 해당 Actions 실행을 명시적으로 요청한 경우에만 해당 SHA를 가리키는 브랜치에서 **CI → Run workflow**를 실행한다. 릴리스 준비·게시 요청만으로 dispatch·watch·rerun을 승인받은 것으로 해석하지 않는다. 승인이나 해당 SHA의 성공 근거가 없으면 미충족 게이트를 보고하고 공개를 보류한다. 승인된 CLI 예시는 아래와 같다. 일반 개발 중에는 이 절차를 실행하거나 완료를 기다릴 필요가 없다.

```bash
gh workflow run ci.yml --repo frozenvoice/tessra --ref <release-branch>
gh run list --repo frozenvoice/tessra --workflow ci.yml --event workflow_dispatch --commit <final-sha>
gh run view <run-id> --repo frozenvoice/tessra --json headSha,event,workflowName,status,conclusion,attempt,jobs,url
```

브랜치가 이동했더라도 실제 실행의 `headSha`가 최종 SHA와 같아야 한다. 다르면 최종 소스에 대한 새 전체 검증이 필요하며 해당 Actions 실행에 대한 명시적 사용자 요청 전에는 dispatch·watch·rerun하지 않는다. SHA가 같다는 이유만으로 로컬 부분 검증이나 다른 workflow의 성공을 전체 검증으로 취급하지 않는다.

## 수동 공개 게이트

선택한 `ci.yml`의 `workflow_dispatch` 실행에 대해 최신 attempt가 `completed`/`success`인지 확인한다. 그 attempt의 다음 세 job이 모두 존재하고 `success`여야 한다. 누락, skipped, cancelled, failure, timed_out은 공개를 중단하는 결과다.

| Job | 필수 검증 | 플랫폼 / timeout |
| --- | --- | --- |
| `unit` | `Typecheck`, `Test`, `Build` 단계 성공 | Ubuntu, Node 22 / 15분 |
| `unit-windows` | `Test` 단계 성공 | Windows, Node 22 / 15분 |
| `e2e` | `Build extension`, `Run critical UI regression contracts`, `Run UI E2E` 단계 성공 | Ubuntu + xvfb, Node 22, VS Code `1.99.3` / 45분 |

job의 성공 표시 외에 필수 단계의 `conclusion`도 확인한다. 특히 E2E 두 단계(`test:e2e:ui-regressions`, `test:e2e:ci`)가 생략된 실행은 허용하지 않는다. 최신 attempt의 단계는 Actions UI 또는 다음 읽기 전용 API로 확인할 수 있다.

```bash
gh api repos/frozenvoice/tessra/actions/runs/<run-id>/attempts/<attempt>/jobs --paginate
```

Windows 테스트를 Linux 결과로 대체하지 않는다. 실패하면 원인을 수정하고 최종 SHA를 다시 고정하여 전체 검증한다. 자동 rerun/watch를 일반 작업 완료 조건으로 추가하지 않는다. 실행 URL, SHA, attempt와 세 job/필수 단계 결과를 릴리스 검증 기록에 남긴다.

## 검증한 SHA에서 패키징하고 동일 VSIX 게시

1. 패키징 checkout의 `HEAD`가 위에서 검증한 SHA와 같은지 다시 확인한다. 소스 변경이 있으면 중단한다. lockfile 기준 `npm ci`로 의존성을 준비하고 `npm run package -- -o tmp/tessra-release.vsix`로 VSIX를 생성한다. `package`는 `npx @vscode/vsce package --no-rewrite-relative-links`이며, vsce가 `vscode:prepublish` → `npm run build`를 실행한다. 바로 전에 같은 전체 build를 별도로 반복하지 않는다. 사용한 Node/vsce 버전도 기록한다.
2. `git status --porcelain --untracked-files=all`와 `git rev-parse HEAD`로 패키징 후에도 최종 소스가 같은지 확인한다. 생성된 `dist/`나 VSIX의 존재만으로 소스 일치를 판단하지 않는다.
3. VSIX는 ZIP archive다. `extension/package.json`의 name/publisher/version이 그 SHA의 manifest와 같고 `extension.vsixmanifest`의 Identity 버전/게시자가 일치하는지 확인한다. archive의 `extension/dist/extension.js`, `htmlPreview.js`, `bodyConversion.js`, `hljs.js`를 각각 패키징 직후의 로컬 번들과 SHA-256으로 비교한다.
4. `.vscodeignore` 계약을 확인한다. 네 번들은 포함하고 `src/`, `e2e/`, `scripts/`, `node_modules/`, `.github/`, `.vscode-test/`, 테스트 산출물, 임시 파일, promo 자산은 제외한다. 오래된 VSIX나 다른 checkout에서 만든 번들로 대체하지 않는다.
5. 생성한 **동일 VSIX 파일**로 [installed VSIX smoke](testing.md#installed-vsix-smoke)와 [해당 릴리스 수동 체크리스트](manual-e2e-checklist.md)를 실행한다. `TESSRA_E2E_VSIX`가 해당 archive를 가리키도록 설정하고 임시 user-data/extensions 디렉터리만 사용한다. 테스트를 위해 사용자 VS Code 프로필이나 실제 저장 데이터를 변경하지 않는다.
6. VSIX 파일의 SHA-256, 최종 소스 SHA, manifest 버전, 원격 검증 실행 URL/attempt와 smoke 결과를 기록한다. 게시 직전에 파일 해시가 그대로인지 확인하고, 모든 게이트 성공 후에만 권한 있는 담당자가 `npx @vscode/vsce publish --packagePath tmp/tessra-release.vsix`로 그 파일을 게시한다. 이 명령은 공개 단계이며 평소 검증 명령이 아니다. 자격증명을 저장소나 로그에 남기지 않는다.

게이트 이후 소스/버전을 수정하거나 VSIX를 다시 만들었다면 기존 승인 기록을 그대로 사용하지 않는다. 소스 변경은 해당 최종 SHA의 전체 검증부터, archive 변경은 내용·해시 비교와 설치 smoke부터 다시 확인한다. 게시 직전에도 선택한 원격 실행의 최신 attempt가 여전히 성공인지 확인한다.

## Required checks 확인

push/PR 자동 실행을 제거할 때 branch protection/ruleset에 `unit`, `unit-windows`, `e2e`가 required status checks로 남아 있으면 일반 PR이 대기할 수 있다. 실제 설정에서 확인된 해당 CI 항목만 해제하고 리뷰/기타 보호 규칙은 유지한다. 가짜 성공 job, 우회 병합, 보호 규칙 전체 해제를 사용하지 않는다. 릴리스 공개 게이트는 위의 최종 SHA 전체 검증으로 유지한다.

기본/유일 브랜치는 `main`이며 2026-10-30 기준 branches API의 `protected`는 `false`다. 비공개 저장소였을 때는 rulesets 및 main protection 상세 API가 GitHub 플랜 제한으로 HTTP 403을 반환해 required-check 상세 목록을 확인하지 못했다. 공개 저장소에서는 같은 API로 확인할 수 있으므로, 보호 규칙을 추가하거나 바꿀 때 실제 required 이름/app ID를 확인하고 대상 CI 이름 `unit`, `unit-windows`, `e2e`만 조정한다. 원격 설정 변경은 저장소 관리자의 명시적 요청이 있을 때만 수행한다.
