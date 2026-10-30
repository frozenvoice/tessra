# Tessra Release Notes

Release: 1.0.10

## Main Changes

- The Request Panel follows **The Quiet Instrument**: a compact, editor-native layout with Method → URL → Send as the primary path and infrequent actions in overflow menus.
- A quiet status strip replaces the old topline chip wall. It shows environment (`N vars` with Tessra signature accent + tiny tesseract mark), Defaults, request `Used N`, Scripts/History on·off, and risk overrides; Environment opens the variable editor; `Used N` / Vars toggles Variable Usage in strip disclosure.
- Scripts, Settings, WebSocket, and Headers secondary chrome are flatter and denser (one-line Scripts Guide link; divider field groups instead of soft cards).
- JSON and XML Body editing keep the lightweight textarea, with mirror/overlay syntax highlighting and existing undo/redo behavior preserved.
- Changing Body type with non-empty content asks Convert / Keep text / Cancel. Supported conversions are structural only; unsafe or nested cases are rejected and the original body is kept.

## Before / After (user-facing)

| Area | Before (1.0.9) | After (1.0.10) |
| --- | --- | --- |
| Request meta | Topline summary chips / collapsed env editor | One status strip (`N vars` / `Used N`, brand mark on Env); env editor + Variable Usage via disclosure |
| Body editor | Plain textarea for JSON/XML | Same textarea + optional JSON/XML highlight overlay |
| Body type change | Type switch without structural convert prompt | Convert / Keep text / Cancel when content is present |
| Theme presets | Felt like separate visual skins | Shared Quiet Instrument layout; color/token skins only |

## Implementation Notes

- Quiet Instrument CSS/HTML lives in `src/panels/requestPanel/requestPanelHtml.ts`.
- Body highlight uses the existing `dist/hljs.js` webview bundle; overlay is enabled for HTTP JSON/XML only.
- Body conversion is implemented in `src/services/BodyConversionService.ts` and exposed to the webview via `dist/bodyConversion.js`.
- Workspace backup `schemaVersion` remains `1`.
- Publisher / extension id remain `frozenvoice.tessra`.

## Verification Summary

- Unit coverage includes Body conversion matrix cases, Quiet Instrument status-strip contracts, Body syntax overlay toggles, localization strings for Convert/Keep text, reduced-motion and focus-visible hooks.
- Release packaging requires `npm run typecheck`, `npm run ci`, `npm test`, `npm run build`, and `git diff --check` before `npm run package`.
- Manual UI click-through of the full request panel is covered by `docs/manual-e2e-checklist.md` (1.0.10 smoke section); automated packaging does not substitute for that pass.

## Known Limitations

- Marketplace screenshots linked from the README may still show the pre–Quiet Instrument request panel until assets are replaced in `frozenvoice/frozenvoice-assets`.
- Body conversion is convenience structural mapping, not schema-aware. JSON↔XML is not a guaranteed round-trip; nested JSON cannot convert to form-urlencoded/form-data; form-data file fields and Binary invent/convert paths are blocked.
- Residual class-name / celebration-motion residue may remain behind Quiet Instrument overrides.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, Monaco Body editor, or backup schemaVersion changes.
