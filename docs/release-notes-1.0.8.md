# Tessra Release Notes

Release: 1.0.8

## Main Change

- Body editor undo/redo stability has been improved for request editing workflows.

## Fixed Scenario

1. Edit a JSON body.
2. Send the request.
3. Return to the Body tab.
4. Press Ctrl+Z or Cmd+Z.
5. Tessra restores the previous body edit.
6. Press Ctrl+Y or Ctrl+Shift+Z to redo the edit.

## Implementation Notes

- Tessra now keeps a lightweight Body editor undo/redo stack per open request tab.
- The stack survives request sends, response updates, and request editor tab switches for the same tab.
- Explicit body replacement boundaries, such as loading another request, loading a sample request, or changing the body type, start a fresh undo stack.
- The stack is limited to 100 entries and coalesces fast typing into a single undo step.

## Verification Summary

- Unit coverage verifies Body editor undo/redo state after a webview rerender with a remounted textarea.
- Source coverage verifies Body editor shortcut handling, reset boundaries, and textarea auto-grow refresh after undo/redo.
- Full automated test, build, diff, package, VSIX inspection, and local install smoke checks were run for this release.

## Known Limitations

- The Body editor still uses Tessra's textarea-based editor; Monaco Editor is not introduced in this release.
- Native browser undo is preserved where the textarea remains mounted, but Tessra uses its own lightweight stack when webview rerenders replace the textarea DOM.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, ScriptRunner utility expansion, `.env` linking, HAR import, or `.http` import/export.
