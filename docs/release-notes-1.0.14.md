# Tessra Release Notes

Release: 1.0.14

## Main Changes

Pre-request and test scripts can now build common API signatures without leaving Tessra or pulling npm packages into the sandbox.

### Tessra Script utilities

These helpers live on `pm` and are **Tessra Script utilities**, not a Postman-official `pm.crypto` API. Postman currently steers crypto work toward the Web Crypto `crypto` global / packages; Tessra keeps a smaller sync surface for signing workflows.

| API | Result |
| --- | --- |
| `pm.crypto.sha256(value)` | lowercase hex SHA-256 (UTF-8) |
| `pm.crypto.hmacSha256(message, secret)` | lowercase hex HMAC-SHA256 (message first) |
| `pm.encoding.base64Encode(value)` | standard Base64 (UTF-8) |
| `pm.encoding.base64Decode(value)` | UTF-8 string; invalid Base64 throws |
| `pm.uuid()` | UUID v4 |
| `pm.time.unix()` | Unix seconds (integer) |
| `pm.time.unixMs()` | Unix milliseconds (integer) |

Inputs are string/number/boolean/bigint/null/undefined. Objects/arrays throw — use `JSON.stringify(...)` when needed.

### Examples

```javascript
const payload = pm.environment.get("payload") || "";
const secret = pm.environment.get("secret") || "";
pm.environment.set("signature", pm.crypto.hmacSha256(payload, secret));
```

```javascript
pm.environment.set(
  "encodedCredentials",
  pm.encoding.base64Encode(`${pm.environment.get("user") || ""}:${pm.environment.get("password") || ""}`)
);
```

```javascript
pm.environment.set("requestId", pm.uuid());
pm.environment.set("timestamp", String(pm.time.unix()));
```

## Security

- Node `require`, `process`, `Buffer`, and raw `crypto` stay unavailable in the sandbox.
- Utilities return primitives only.
- Existing script trust / `disableScripts` / timeout contracts are unchanged.

## Verification

- Unit coverage for known vectors, Base64 validation, UUID format, sandbox escape probes, and shared ScriptRunner path (RequestExecutor + CollectionRunner).
- Stable UI E2E includes Script utilities smoke (`e2e/specs/10-script-utilities.spec.ts`).

## Known Limitations

- No MD5/SHA-1/SHA-512 selectors, AES/RSA, Base64URL, JWT builder, or OAuth/AWS SigV4 helpers in 1.0.14.
- No arbitrary Node crypto exposure.
