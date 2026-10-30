# Tessra 1.2.6

## Headers-only requests close their connection

With **Settings → Stop after headers** enabled, Tessra returned the status and headers but kept reading the response body in the background. An endless or very large body could hold the socket open long after the result was shown.

1.2.6 records the headers result first and then closes the response stream. The response still shows status and headers with an empty body, and later stream events cannot turn a completed result into an error.

This release fixes the headers-only path only. An intermediate redirect response whose body never ends can still delay a request; that existing behavior is unchanged.

No request schema, storage format, or script API changes.
