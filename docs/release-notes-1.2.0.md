# Tessra 1.2.0

## Path Variables

For a request like:

`POST {{baseUrl}}/mz-chat/{{customerId}}/customer.do`

Tessra now detects path-segment placeholders such as `customerId` under the URL bar. You can change the value to `1111`, `2222`, or `3333` and Send without opening the Environment Editor.

- Environment values stay the default fallback.
- Override keeps a request-local value for the current request only.
- Reset returns to the Environment value; Clear returns to an unresolved editable state when no Environment value exists.
- Path variables missing from the Environment can be typed directly on the request.
- The Environment itself is never modified.

The raw URL template stays unchanged. The same path-only resolution applies to Collection Runner, WebSocket URLs, and request export (cURL / codegen).
