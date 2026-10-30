# Tessra 1.0.5 Release Notes

Release: 1.0.5

## Main Change

cURL parser compatibility hotfix for common import edge cases from browsers, docs, and shell snippets.

## Fixed Examples

- Compact request methods such as `-XPOST`, `-XPUT`, `-XDELETE`, and `-XPATCH`.
- Bundled short flags such as `-skL`, `-sS`, `-kL`, `-vL`, and `-iL`.
- Hyphen-prefixed data values such as `-d '-1'`, `--data '-1'`, `--data-raw '-1'`, and `--data-binary '-1'`.
- Compact value options such as `-H'Accept: application/json'`, `-A'Mozilla/5.0'`, `-uuser:pass`, and `-dfoo=bar`.
- URL-like tokens after `-X` or `-H` are preserved as URLs and reported as missing option values instead of being consumed as methods or headers.

## Verification

- cURL parser unit tests cover compact short options, bundled no-effect flags, hyphen-prefixed values, malformed headers, missing values, unsupported flags, and existing cURL import/export regression cases.
- The broader 1.0.4 regression suite still covers HTTP Stop cancel handling, compressed response decoding, WebSocket safety/keepalive behavior, and Workspace Backup / Restore validation.

## Known Limitations

- Tessra still imports cURL into Tessra's existing request model; unsupported cURL-only runtime flags are reported as warnings rather than becoming request settings.
- Cookie jar, GraphQL mode, recursive variable resolution, OpenAPI path parameter import, and collection runner scheduling are not part of 1.0.5.
