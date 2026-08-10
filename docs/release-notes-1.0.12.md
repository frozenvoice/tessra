# Tessra Release Notes

Release: 1.0.12

## Main Changes

- Collection Runner setup now lists every flattened request with checkboxes so you can exclude requests before Start.
- All requests are selected by default. Selection is per-run only and resets the next time you open Run All Requests.
- Selected-request counts update Runs (`selected × iterations`) while delay, stop-on-failure, Stop, history, and Rerun Failed keep their existing contracts.
- Excluded requests are omitted from the run; they are not counted as skipped.

## Before / After (user-facing)

| Area | Before (1.0.11) | After (1.0.12) |
| --- | --- | --- |
| Runner setup | Delay / iterations / stop-on-failure only | Request checklist + select all / clear + prior options |
| Run scope | Always the full flattened collection | Selected subset in original order |
| Totals | Total = all requests | Total = collection size; Selected = this run; progress denominator = selected |
| Persistence | N/A | No permanent skip flags; selection not stored |

## Implementation Notes

- Selection identity is `CollectionItem.id`.
- Flatten / filter helpers live in `src/panels/requestPanel/CollectionRunner.ts`.
- Workspace backup `schemaVersion` remains `1`.
- Publisher / extension id remain `frozenvoice.tessra`.

## Verification Summary

- Unit coverage includes selection filtering, totals, excluded-vs-skipped, history, rerun-failed, nested folders, duplicate names, and localization key parity.
- Release packaging requires `npm run typecheck`, `npm run ci`, `npm test`, `npm run build`, and `git diff --check` before `npm run package`.
- Manual UI click-through is covered by `docs/manual-e2e-checklist.md` (1.0.12 smoke section).

## Known Limitations

- Folder-level / tri-state tree checkboxes are not included in 1.0.12.
- Permanent per-request runner exclusion is intentionally not stored.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, Monaco Body editor, or backup schemaVersion changes.
