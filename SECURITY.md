# Security Policy

## Supported versions

Phlux is in early development. Only the latest minor receives security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you believe you have found a security issue in Phlux, report it privately through one of the following channels:

1. **GitHub Security Advisories** *(preferred)* — open a draft advisory at <https://github.com/gorkdev/phlux/security/advisories/new>. This keeps the report private until a fix is ready.
2. **Email** — send a description to `developer@ajans.io` with the subject line `[phlux-security] <short summary>`.

When reporting, please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof-of-concept.
- The Phlux version and OS you observed it on.
- Any suggested mitigation, if you have one in mind.

## What to expect

- **Acknowledgement** within 72 hours.
- **Triage and severity assessment** within 7 days. We use the [CVSS v3.1 calculator](https://www.first.org/cvss/calculator/3.1) to rate impact.
- **Fix and disclosure** — for high-severity issues, we aim to ship a patch release within 14 days and a coordinated disclosure note in the [CHANGELOG](CHANGELOG.md) and the GitHub advisory feed.

## In scope

The following areas are particularly relevant for Phlux's threat model:

- The PowerShell elevation path used for `Machine` `PATH` modification.
- Validation of downloaded PHP archives (URL allow-list, expected origin: `windows.php.net`).
- The shim mechanism (`%APPDATA%\Phlux\bin\php.cmd`) and how it resolves the active interpreter.
- IPC surface between the renderer and main process (`src/preload.js`, `src/main/ipc.js`).
- Anything that could allow arbitrary command execution, privilege escalation, or modification of files outside `%APPDATA%\Phlux\`.

## Out of scope

- Issues that require an attacker to already have administrator access to the machine.
- Vulnerabilities in third-party PHP builds themselves — please report those upstream to <https://www.php.net/security>.
- Bugs in unmodified Electron, Chromium, or Node.js — report those to their respective projects.
- Social-engineering attacks against the user (e.g. tricking them into running an unsigned `.exe`).

Thanks for helping keep Phlux and its users safe.
