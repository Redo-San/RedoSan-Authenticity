# Security Policy

## Supported versions

RedoSan Authenticity is a fully client-side application: no accounts, no
telemetry, no server-side processing. Only the latest `main` deployment at
<https://redo-san.github.io/RedoSan-Authenticity/> receives security fixes.

| Version | Supported |
|---------|-----------|
| latest `main` | ✅ |
| older tags / forks | ❌ |

## Reporting a vulnerability

Please do **not** open a public issue for anything you believe is
exploitable.

1. Preferred: use GitHub's private vulnerability reporting at
   <https://github.com/Redo-San/RedoSan-Authenticity/security/advisories/new>
2. Or email the maintainer alias:
   `12227211+Redo-San@users.noreply.github.com`

The machine-readable disclosure file lives at
<https://redo-san.github.io/.well-known/security.txt> (RFC 9116).

## What to include

- A minimal reproduction (URL/steps, or a sample file for the affected tool).
- Browser and OS versions.
- Impact assessment from your perspective.

## Scope

In scope: XSS/HTML-injection through user-supplied files or tool outputs,
prototype-pollution paths, service-worker cache poisoning, dependency
vulnerabilities in vendored libraries (`vendor/`), and any path where
"local-only processing" can be violated.

Out of scope: missing headers on GitHub Pages infrastructure itself
(GitHub controls those), self-XSS requiring a user to attack themselves,
and brute-force against the local biometric templates stored in the
user's own IndexedDB (documented threat model treats the device as
trusted).

## Response targets

- Acknowledgement: within 7 days.
- Triage & severity: within 14 days.
- Fix or mitigation: within 90 days for high/critical findings.

## Safe harbor

Good-faith research following this policy is welcomed and will not be met
with legal action.
