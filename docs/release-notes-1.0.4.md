# Tessra 1.0.4 Release Notes

Release: 1.0.4

## Highlights

- HTTP Stop now cancels the active Node.js HTTP/HTTPS request and guards against late canceled runs overwriting a newer request on the same tab.
- WebSocket connections now enforce frame and message size limits. Oversized frames/messages fail with a clear Message Too Big diagnostic and close code 1009 when possible.
- WebSocket keepalive now uses protocol-level ping frames when enabled. It remains off by default and is cleaned up on disconnect, reconnect, error, remote close, and panel disposal.
- HTTP responses with `Content-Encoding: gzip`, `deflate`, or `br` are automatically decompressed with Node.js `zlib`.
- Max response size now has a safer default of 10 MB. Both raw received bytes and decompressed output are limited so large responses are not stored in history or pushed into the webview.
- cURL import now reports warnings for unsupported or malformed flags and handles common DevTools flags such as `--data-urlencode`, `-G`, `--data-binary`, `--data-raw`, `--compressed`, `--location`, `--insecure`, `--url`, `--user-agent`, and `--referer`.

## Verification

Run the standard release checks before packaging:

```bash
npm test
npm run build
git diff --check
npm run package
```

Additional smoke coverage should include HTTP cancel, compressed responses, large response limits, WebSocket connect/send/receive/keepalive/oversize handling, cURL warning cases, and Workspace Backup / Restore command visibility.

## Known Limitations

- Workspace Backup / Restore remains schemaVersion 1 and still uses replace import only.
- Workspace Backup / Restore v1 still excludes history and open tabs / tab state.
- Encrypted backups, merge import, all-profile backup, scheduled backup, cookie jar, GraphQL mode, and Git sync are not part of 1.0.4.
- WebSocket keepalive sends protocol ping frames; it does not send app-level text ping messages.
