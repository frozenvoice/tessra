# Tessra Release Notes

Release: 1.0.7

## Main Changes

- Collection Runner now shows a pre-run options screen for delay, iterations, and stop-on-failure behavior.
- Runner delay applies only between request runs and can be canceled with Stop.
- Iterations repeat the full request list in order and report current iteration progress.
- Stop-on-failure can stop after HTTP errors, network errors, test failures, and script timeouts.
- Runner Stop now cancels active HTTP requests, retry waits, inter-request delays, and remaining iterations.
- Runner summaries now include total requests, total runs, passed, failed, skipped, duration, and stopped-on-failure state.

## Runner Option Examples

Delay between requests:

```text
Delay between requests (ms): 500
```

Iterations:

```text
Iterations: 2
```

Stop on failure:

```text
Stop on failure: enabled
```

With two requests and two iterations, Tessra runs four request executions in order:

```text
request 1, request 2, request 1, request 2
```

## Verification Summary

- Unit coverage verifies delay normalization, delay placement, and canceling during runner delay.
- Unit coverage verifies multiple iterations and iteration progress.
- Unit coverage verifies continue-on-failure and stop-on-failure behavior for HTTP failures, test failures, script timeouts, and network errors.
- Unit coverage verifies stopping active requests and retry waits.
- Unit coverage verifies stale late results cannot overwrite a newer runner summary.
- Webview source coverage verifies the pre-run options UI and runner summary/status wiring.

## Known Limitations

- Failed-only rerun executes the selected failed requests once, even when the original run used multiple iterations.
- Runner options are kept in memory for the current request panel session; they are not persisted to workspace storage in this release.
- This release does not add cookie jar, GraphQL mode, CLI, Git sync, `.env` linking, HAR import, or `.http` import/export.
