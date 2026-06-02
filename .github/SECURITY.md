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
- The web app includes a **two-layer security blocker**: Service Worker (`sw.js`) + 404 page that block dangerous file extensions and unknown scripts via 5 whitelists (JS, CSS, HTML, YAML, external CDN)
- Review the source code if you have concerns

### Automated Checks (CI)

This repository runs the following security and quality checks on every pull request:

- **Secret Scanner**: Detects hardcoded API keys, tokens, and private keys in diffs
- **Permissions Sheriff**: Audits GitHub Actions workflow permissions for least-privilege
- **npm audit Checker**: Scans dependencies for known vulnerabilities
- **Cross-Reference Checker**: Validates file references (whitelists, navigation, i18n keys)
- **CodeQL**: Semantic code analysis for security vulnerabilities (JavaScript/TypeScript + Actions)
- **Dependency Graph**: Tracks dependency supply chain
- **Spell Check** (codespell): Detects spelling errors in code, comments, and filenames
- **Malware Scan** (ClamAV): Scans repository for malware signatures
- **zizmor**: Scans GitHub Actions workflows for security issues
- **ABOM Supply Chain Audit**: Audits dependency supply chain for tampering
- **CSS Lint** (stylelint): Validates CSS for errors and duplicate selectors
- **HTML Hint**: Validates HTML for best practices and accessibility
- **JS Syntax Check**: Validates JavaScript syntax
- **Prettier Check**: Ensures consistent code formatting
- **Console.log Detector**: Flags debugging output that should not be committed
- **PR Size Label**: Labels PRs based on line count change
- **File Size Budget**: Rejects PRs exceeding individual file size limits

### For Developers

- Never commit secrets, tokens, or certificates to the repository
- Use repository secrets and variables for sensitive values
- Validate all user-supplied files before processing
- Keep dependencies up to date (`npm audit fix`)
