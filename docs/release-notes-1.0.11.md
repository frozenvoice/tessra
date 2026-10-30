# Tessra Release Notes

Release: 1.0.11

## Main Changes

- The in-app Guide (`GUIDE.md` / `GUIDE.ko.md` / `GUIDE.ja.md`) now matches the current Request Panel: status strip (`N vars` / `Used N`), Pin/Compare with utilities in `⋯`, Body conversion, Workspace Backup/Restore, WebSocket, runner options, shortcuts, and local storage files including `variables.json`.
- Guide content-parity tests keep English/Korean/Japanese section counts aligned and block pre-redesign chip/toolbar wording from returning.
- Fixed URL/Params double serialization that could duplicate query keys when building the final request URL.
- Restored Response Pin / Compare as always-visible actions on the sticky response summary.
- VSIX packaging excludes `tmp/` and other staging artifacts.

## Before / After (user-facing)

| Area | Before (1.0.10) | After (1.0.11) |
| --- | --- | --- |
| In-app Guide | Pre-redesign chip/toolbar wording; missing Backup/WebSocket/Body conversion depth | Current UI wording and major workflow coverage in en/ko/ja |
| URL + Params | Possible duplicate query keys | Single coalesced query serialization |
| Response actions | Pin/Compare discoverability could regress | Pin/Compare stay on the sticky summary; utilities in `⋯` |
| Package contents | Staging folders could be included | `tmp/` and similar staging paths excluded |

## Implementation Notes

- Guide parity coverage lives in `src/test/unit/guidePanel.test.ts`.
- Workspace backup `schemaVersion` remains `1`.
- Publisher / extension id remain `frozenvoice.tessra`.

## Verification Summary

- Release packaging requires `npm run typecheck`, `npm run ci`, `npm test`, `npm run build`, and `git diff --check` before `npm run package`.
- Manual UI click-through is covered by `docs/manual-e2e-checklist.md` (1.0.11 smoke section); automated packaging does not substitute for that pass.

## Known Limitations

- Body conversion remains convenience structural mapping, not schema-aware.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, Monaco Body editor, or backup schemaVersion changes.
