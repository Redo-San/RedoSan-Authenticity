# Security Policy

> Canonical location: this root `SECURITY.md` supersedes the former
> `.github/SECURITY.md`. Machine-readable disclosure:
> <https://redo-san.github.io/.well-known/security.txt> (RFC 9116).

## Supported Versions

Only the latest `main` deployment and the newest tagged release receive
security updates.

| Version | Supported |
|---------|-----------|
| latest `main` / newest release (v1.7+) | ✅ |
| older releases | ❌ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **GitHub Private Vulnerability Reporting** (preferred): repository →
   **Security** tab → *Report a vulnerability*, or directly:
   <https://github.com/Redo-San/RedoSan-Authenticity/security/advisories/new>
2. **Email**: <mailto:12227211+Redo-San@users.noreply.github.com>

Include: description, steps to reproduce (URL/steps or sample file for the
affected tool), browser & OS versions, affected version, impact assessment,
and suggested fix if any.

### Response Timeline

- **Acknowledgement**: within 48 hours
- **Initial assessment**: within 5 business days
- **Fix or mitigation**: 7–30 days depending on severity (90-day ceiling for
  high/critical)

## Scope

**In scope**

- XSS / HTML injection through user-supplied files or tool outputs
- Prototype-pollution paths
- Service-worker cache poisoning
- Vulnerabilities in vendored libraries under `vendor/`
- Any path where the *local-only processing* guarantee can be violated

**Out of scope**

- Response headers on GitHub Pages infrastructure (controlled by GitHub)
- Self-XSS requiring a user to attack themselves
- Brute-force against biometric templates stored in the user's own
  IndexedDB — the documented threat model treats the device as trusted

## Safe Harbor

Good-faith research following this policy is welcomed and will not be met
with legal action.

## Security Practices

### For Users

- Verify the URL: `https://redo-san.github.io/RedoSan-Authenticity/`
- All processing is **client-side** — no files leave your device
- The web app includes a **two-layer security blocker**: Service Worker
  (`sw.js`) + 404 page that block dangerous file extensions and unknown
  scripts via 5 whitelists (JS, CSS, HTML, YAML, external CDN)
- Review the source code if you have concerns

### Automated Checks (CI)

This repository runs the following security and quality checks on every
pull request:

- **Secret Scanner**: Detects hardcoded API keys, tokens, and private keys in diffs (CI + pre-commit hook)
- **GitHub Secret Scanning**: Push protection + scanning enabled on the repository
- **Permissions Sheriff**: Audits GitHub Actions workflow permissions for least-privilege
- **npm audit Checker**: Scans dependencies for known vulnerabilities
- **Cross-Reference Checker**: Validates file references (whitelists, navigation, i18n keys)
- **CodeQL**: Semantic code analysis for security vulnerabilities (JavaScript/TypeScript + Actions)
- **Dependency Graph**: Tracks dependency supply chain
- **Spell Check** (cspell): Detects spelling errors in code, comments, and filenames
- **Malware Scan** (ClamAV): Scans repository for malware signatures
- **zizmor**: Scans GitHub Actions workflows for security issues (30 alerts closed in v1.7)
- **OpenSSF Scorecard**: Supply-chain security scoring
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
