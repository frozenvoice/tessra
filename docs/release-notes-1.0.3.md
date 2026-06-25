# Tessra 1.0.3 Release Notes

Release: 1.0.3

Tessra 1.0.3 focuses on Workspace Backup / Restore v1 and final import/export command cleanup for Marketplace upload.

## Main Change

Workspace Backup / Restore v1 adds Command Palette actions for moving Tessra workspace data between machines:

- `Tessra: Export Workspace Backup`
- `Tessra: Import Workspace Backup`

## Included In Backup

- collections
- environments
- active environment
- default headers
- workspace variables

## Not Included In v1

- history
- open tabs / tabState

## Import Behavior

Import replaces the current active profile data with the backup contents. It is not a merge import.

Before restore, Tessra creates an automatic pre-import backup under the extension global storage backup directory.

## Safety

Backup files may contain secrets such as tokens, API keys, Authorization headers, and environment values. Store backup files securely and avoid sharing them through public repositories, shared folders, or issue attachments.

## Menu Cleanup

Import/export commands are easier to find from the Command Palette and sidebar:

- Collection import from the Collections title bar now routes through a general import picker instead of cURL-only import.
- `Tessra: Export Collection` and `Tessra: Export Environment` are available from the Command Palette.
- Existing tree context export actions continue to export the selected collection or environment.

## Verification Checklist

- `npm test`
- `npm run build`
- `git diff --check`
- `npm run package`
- Optional local VSIX install smoke test
