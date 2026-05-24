# Security Policy

## Supported Versions

Only the latest release receives security updates.

| Version | Supported |
|---------|-----------|
| v1.0-beta.x | :white_check_mark: |
| Older releases | :x: |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **GitHub Private Vulnerability Reporting**: Visit the repository's **Security** tab → "Report a vulnerability"
2. **Email**: [redosan@artlover.com](mailto:redosan@artlover.com)

Include: description, steps to reproduce, affected version, impact, and suggested fix (if any).

### Response Timeline

- **Acknowledgement**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: 7-30 days depending on severity

## Security Practices

### For Users

- Verify the URL: `https://redo-san.github.io/RedoSan-Authenticity/`
- All processing is **client-side** — no files leave your device
- Review the source code if you have concerns

### Automated Checks (CI)

This repository runs the following security bots on every pull request:

- **Secret Scanner**: Detects hardcoded API keys, tokens, and private keys in diffs
- **Permissions Sheriff**: Audits GitHub Actions workflow permissions for least-privilege
- **npm audit Checker**: Scans dependencies for known vulnerabilities
- **Cross-Reference Checker**: Validates file references (whitelists, navigation, i18n keys)
- **CodeQL**: Semantic code analysis for security vulnerabilities
- **Dependency Graph**: Tracks dependency supply chain

### For Developers

- Never commit secrets, tokens, or certificates to the repository
- Use repository secrets and variables for sensitive values
- Validate all user-supplied files before processing
- Keep dependencies up to date (`npm audit fix`)
