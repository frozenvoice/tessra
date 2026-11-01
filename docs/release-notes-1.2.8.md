# Tessra 1.2.8

## API Key headers stay on their own origin

With **Settings → Follow redirects** enabled, Tessra already removed `Authorization`, cookies, and a few well-known key headers when a redirect crossed to another origin. An API Key configured in **Auth** under a custom header name (for example `X-Team-Key`) was not on that list, so a cross-origin redirect could carry it to the new host.

1.2.8 tracks the header names that Auth actually applied and removes them on any cross-origin redirect, in request tabs and in Collection Runner. Same-origin redirects keep them. If a redirect chain later returns to the original origin, the removed header is not reattached.

## Safer WebSocket handshakes

A WebSocket server could keep a connection in its handshake by sending an endless or very slow upgrade response. 1.2.8 limits upgrade response headers to 16 KiB and applies one deadline to the whole handshake: the request timeout, or 30 seconds when the timeout is `0`. An unlimited timeout still applies to the open connection, not to the handshake. Request header names and values are checked before a socket is opened, so an invalid name or a value with a line break fails immediately instead of reaching the server.

## The Auto-saved cue stays visible

Since 1.2.7, the environment editor refreshed itself right after every save and cleared the "Auto-saved" cue almost as soon as it appeared. 1.2.8 keeps the cue for its full two seconds when the refresh is for the same environment, and still clears it when you switch to another environment or to Workspace variables.

## Correction to the 1.2.7 notes

The 1.2.7 notes said the release had no extension code changes. That was wrong. The 1.2.7 package already included incremental server-sent events (SSE), explicit secret variables in VS Code SecretStorage, response charset decoding with original-byte warnings, one total network deadline per request, History snapshot fixes, and stricter HTML Preview sanitization. The [Changelog](../CHANGELOG.md) now lists them under 1.2.7.

No request schema, storage format, or script API changes.
