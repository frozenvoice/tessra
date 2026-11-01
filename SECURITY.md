# Security Policy

## Supported versions

Security fixes are released for the latest version of Tessra on the Visual Studio Marketplace. Please update to the latest version before reporting.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, pull request, or discussion for an unfixed vulnerability.

Include what you can of the following:

- Tessra and VS Code versions, and your operating system
- Steps to reproduce, with a minimal request, collection, or script
- The impact you expect (for example, a credential sent to an unintended host, or data written outside Tessra's storage)

Use synthetic values only. Do not include real API keys, tokens, passwords, or private response data in a report.

## Scope notes

- Tessra is local-first. Besides requests you send yourself, it makes no network calls: no login, telemetry, update checks, or cloud sync. Reports that it contacts anything else are in scope.
- Pre-request and test scripts run in a Node.js VM with JSON-only inputs and outputs. This is not an operating-system sandbox; run only scripts you trust. See [Script security](docs/script-security.md) for the exact limits.
- Protected variable values are stored in VS Code SecretStorage. See [Secret variables](docs/secret-variables.md) for what is and is not covered.
