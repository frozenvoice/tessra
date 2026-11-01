# Contributing to Tessra

Thanks for your interest in Tessra. Bug reports, focused fixes, and documentation improvements are welcome. For larger changes or new features, please open an issue first so we can agree on scope before you write code.

## Product principles

Tessra is a local-first API client for VS Code. Changes must keep these properties:

- No login, cloud sync, telemetry, or update checks. The extension makes no network calls except requests and WebSocket connections the user starts.
- No external resources or CDNs in the webview. Use codicons or inline SVG for icons.
- Safe defaults for TLS validation, response size, and script time limits. Relaxing a safety setting is always opt-in.
- Minimal runtime dependencies: Node.js built-in modules and esbuild bundles.

Product scope is described in [PRODUCT.md](PRODUCT.md), and the request panel's visual contract in [DESIGN.md](DESIGN.md). Detailed project rules live in [AGENTS.md](AGENTS.md).

## Development setup

```bash
npm ci
npm run watch
```

Press F5 in VS Code to launch an Extension Development Host with Tessra loaded.

## Before opening a pull request

Run the local checks that cover your change:

```bash
npm run ci
```

`npm run ci` runs the type checks, unit tests, and a production build. For UI, webview, storage, or execution changes, also run the related UI E2E specs against the latest build, as described in [Testing](docs/testing.md):

```bash
npm run test:e2e -- e2e/specs/<spec-file>.spec.ts
```

In the pull request, list the commands you ran and their results, and note anything you could not verify.

## Continuous integration

GitHub Actions runs only when a maintainer starts it manually (`workflow_dispatch`). Pull requests do not trigger CI automatically, so local verification is required. Do not add workflows or triggers that start automatically.

## Guidelines

- Update `README.md`, `README.ko.md`, and the related guides when user-visible behavior or settings change.
- Use synthetic values in tests, fixtures, and examples. Never commit real API keys, tokens, or private data.
- Keep keyboard access and visible focus for tabs, primary actions, and menus in the request panel.
- Report security issues privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
