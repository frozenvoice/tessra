# Tessra 1.2.3

## Safer execution, protected storage, and a demo video

1.2.3 collects the reliability work done since 1.2.2.

Requests and collection runs now stay pinned to the profile and environment they started with. Script variable changes merge key by key, concurrent edits to the same key are kept with a warning, and switching profiles or closing the panel cancels running HTTP, runner, and WebSocket work and drops late results. Stop also covers Body preparation, and HTTP transports and redirects accept only HTTP/HTTPS.

Stored JSON is validated for structure as well as syntax. A damaged file keeps its original plus a `.corrupt-*` backup, and Tessra blocks writes to it until it is repaired, so recovery defaults never overwrite user data.

The script realm no longer receives host objects or functions and cannot generate code dynamically. This is still same-process isolation, not an OS sandbox; see `docs/script-security.md`.

Code generation, cURL, and Postman export keep form, binary, and header semantics more faithfully. Closing an editor right after typing keeps the draft, and response tabs support keyboard navigation.

The README and Marketplace page now open with a 44-second demo recorded in VS Code with the released extension.

No request schema or storage format changes.
