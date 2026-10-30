# Tessra Release Notes

Release: 1.1.0

## Main Changes

1.1.0 is a stability-focused maintenance release. It keeps Tessra’s local-first product surface the same while fixing Auth Reveal/Hide and hardening the Request Panel codebase behind the scenes.

### Auth Reveal / Hide fix

Sensitive Auth fields can be revealed and hidden again:

- Basic password
- Bearer token
- API Key value

### Reliability

- Request Panel internals are organized by UI subsystem for safer maintenance.
- The real VS Code UI regression suite covers more request-panel flows.
- Existing request and storage formats are unchanged.

### Compatibility

- No storage migration
- Existing collections, environments, history, and settings continue to work
- VS Code minimum engine unchanged (`^1.74.0`)
- No login, cloud sync, or telemetry — same offline-first policy
