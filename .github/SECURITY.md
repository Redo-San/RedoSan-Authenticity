# Security Policy

## Supported Versions

This project is currently in **beta**. Only the latest release receives security updates.

| Version | Supported |
|---------|-----------|
| v1.0-beta.x | :white_check_mark: |
| Older releases | :x: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it privately.

**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email**: [redosan@artlover.com](mailto:redosan@artlover.com)
2. **GitHub Private Vulnerability Reporting**: Visit the repository's Security tab and use the "Report a vulnerability" feature.

Please include the following details:

- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Potential impact
- Any suggested fix (if available)

### Response Timeline

- **Acknowledgement**: Within 48 hours of receiving your report
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity, typically 7-30 days for critical issues

## Security Practices

### For Users

- Always use the latest version by visiting the official GitHub Pages site
- Verify you are on the correct URL: `https://redo-san.github.io/RedoSan-Authenticity/`
- No files are uploaded — all processing is client-side JavaScript
- Review the source code in the repository if you have concerns

### For Developers

- Avoid hardcoding credentials or tokens in source code
- Never commit sensitive files (.env, keys, certificates) to the repository
- Validate user-supplied files before processing
- Keep JavaScript dependencies up to date
