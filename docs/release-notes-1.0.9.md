# Tessra Release Notes

Release: 1.0.9

## Main Changes

- Webview event listener registration is now guarded so repeated request panel renders do not duplicate delegated handlers.
- CI and typecheck scripts were added for automated build and test validation.
- The manual E2E checklist was refreshed for recent backup, runner, variable, script timeout, cURL, WebSocket, and Body editor workflows.
- Workspace variable backup behavior is clarified in the README files.

## Implementation Notes

- `mainContent` delegated handlers are bound once through a guarded lifecycle helper.
- Render-scoped handlers still attach to newly rendered DOM nodes, such as buttons, tabs, inputs, textareas, and response controls.
- Workspace variables remain part of Tessra workspace backups, but request `{{variable}}` resolution continues to use the active environment.
- The default GitHub Actions CI job runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. VSIX packaging remains a manual release step.

## Verification Summary

- Unit/source coverage verifies delegated Webview listeners are not registered more than once across repeated binds.
- Existing regression coverage continues to verify Body editor undo/redo, Collection Runner options, recursive variables, OpenAPI path parameters, cURL compatibility, WebSocket behavior, and workspace backup validation.
- Local release validation included typecheck, CI script, tests, build, diff check, VSIX package, VSIX internal inspection, and install smoke.

## Known Limitations

- This release does not split `requestPanelHtml.ts`, introduce a webview esbuild bundle, or migrate StorageService to async I/O.
- The GitHub Actions workflow does not package a VSIX by default; Marketplace release packaging remains manual.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, ScriptRunner utility expansion, `.env` linking, HAR import, or `.http` import/export.
