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

- Always download the latest release from the official GitHub repository
- Verify checksums if available
- Do not run the tool on untrusted or sensitive systems without proper isolation
- The online launcher downloads and executes code from GitHub — review the launcher script before running

### For Developers

- Avoid hardcoding credentials or tokens in source code
- Never commit sensitive files (.env, keys, certificates) to the repository
- Use `except Exception:` instead of bare `except:` to avoid suppressing system signals
- Close file handles and PIL Image objects properly
- Validate user-supplied file paths before passing to subprocess calls

## Known Security Considerations

This project is in **beta** and has known security-related issues being tracked:

- Private keys are stored unencrypted on disk ([#11](https://github.com/Redo-San/RedoSan-Authenticity/issues/11))
- Password-based key derivation uses unsalted SHA256 ([#12](https://github.com/Redo-San/RedoSan-Authenticity/issues/12))
- User-controlled paths passed to subprocess calls ([#13](https://github.com/Redo-San/RedoSan-Authenticity/issues/13))
- Online launcher lacks integrity verification ([#14](https://github.com/Redo-San/RedoSan-Authenticity/issues/14))

These are actively being addressed and will be resolved in future releases.
