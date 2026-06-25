# Tessra Release Notes

Release: 1.0.6

## Main Changes

- Recursive variable resolution now handles nested values across request URL, WebSocket URL, headers, query params, auth values, body text, form-data text values, binary file paths, and workspace default headers.
- OpenAPI import now converts path template parameters into Tessra variable placeholders.
- Pre-request and test script timeout is configurable with `tessra.scriptTimeoutMs`.

## Examples

Nested variables:

```text
host = api.example.com
baseUrl = https://{{host}}
request URL = {{baseUrl}}/users
resolved URL = https://api.example.com/users
```

OpenAPI path parameters:

```text
/users/{userId} -> /users/{{userId}}
/orders/{orderId}/items/{itemId} -> /orders/{{orderId}}/items/{{itemId}}
```

Script timeout setting:

```json
{
  "tessra.scriptTimeoutMs": 5000
}
```

The accepted range is 100 to 30000 ms. Invalid values fall back to the safe default of 3000 ms.

## Verification Summary

- Recursive variable resolution has unit coverage for nested, multi-step, missing, and circular references.
- Request export coverage verifies nested variables in URL, headers, query params, body, auth values, form-data values, and file paths.
- WebSocket mode detection coverage verifies nested variable URLs.
- OpenAPI import coverage verifies `{param}` to `{{param}}` conversion without moving query/header params.
- Script timeout coverage verifies default normalization, clamping, configured timeout, and timeout error messages.

## Known Limitations

- Circular variable references are reported and left unresolved rather than auto-corrected.
- Workspace Backup / Restore v1 still excludes history and open tabs.
- This release does not add cookie jar, GraphQL mode, collection runner delay/iterations, CLI, Git sync, or encrypted backups.
