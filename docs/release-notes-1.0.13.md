# Tessra Release Notes

Release: 1.0.13

## Main Changes

- `Tessra: Import Environment` now accepts Postman Environment JSON and common `.env` files (`.env`, `.env.local`, `production.env`, and other `*.env` names).
- `.env` import creates a new Tessra Environment named after the file basename, with every imported variable enabled.
- Imports are one-time local copies: Tessra does not watch, sync, rewrite, or delete the source `.env` file.
- Imported environments are never auto-activated; use Set Active explicitly.
- Duplicate environment names become `.env (2)`, `.env (3)`, and so on without overwriting existing data.
- Malformed lines are skipped with a confirmation warning; zero valid variables aborts the import.

## Before / After (user-facing)

| Area | Before (1.0.12) | After (1.0.13) |
| --- | --- | --- |
| Import Environment | Postman JSON only | Postman JSON + `.env` family |
| Activation | unchanged | Still never auto-activates on import |
| Source file | N/A | Never modified |
| Name conflicts | `(Imported)` style unique names | Basename, then `(2)`, `(3)`, … |

## Implementation Notes

- Parser: dependency-free `src/services/DotEnvService.ts` (no `dotenv` package, no variable expansion).
- Multiline double-quoted values are supported; `${VAR}` / `$VAR` stay literal.
- Workspace backup `schemaVersion` remains `1`.
- Publisher / extension id remain `frozenvoice.tessra`.

## Verification Summary

- Unit coverage includes parser edge cases, unique naming, localization parity, and Postman Environment regression.
- Release packaging requires `npm run typecheck`, `npm run ci`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check` before `npm run package`.
- Manual UI click-through is covered by `docs/manual-e2e-checklist.md` (1.0.13 smoke section).

## Known Limitations

- Native OS file dialogs are not covered by stable UI E2E (no production backdoor). Use the manual checklist for `.env` import.
- No `.env` watcher, auto-reload, linked environment, or export-back-to-`.env` in 1.0.13.
- This release does not change backup schemaVersion, GraphQL mode, cookie jar, CLI, or Git sync.
