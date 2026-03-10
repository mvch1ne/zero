# Security Policy

## Supported Versions

SprintLab is currently in active development. Security fixes are applied to the latest version only.

| Version | Supported |
|---|---|
| Latest (`main`) | Yes |
| Older releases | No |

## Scope

### What is in scope

- Vulnerabilities in `backend/server.py` — particularly the `/infer/video` file upload endpoint (path traversal, unsafe temp file handling, denial-of-service via crafted video files)
- Vulnerabilities in frontend dependencies that could affect users uploading or processing videos
- Any issue where a maliciously crafted video file could cause unexpected code execution or data exfiltration

### What is out of scope

- Attacks that require physical access to the machine running the backend
- Theoretical vulnerabilities with no practical exploit path
- Issues in unmaintained third-party packages that have no fix upstream

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately by:

1. Opening a [GitHub Security Advisory](../../security/advisories/new) on this repository (preferred — keeps the report confidential until patched)
2. Or emailing the maintainer directly if you cannot use the advisory flow

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (can be a crafted video file, a curl command, etc.)
- Your assessment of severity

## What to Expect

- Acknowledgement within 48 hours
- An assessment of the issue and a rough timeline for a fix within 7 days
- Credit in the release notes if you would like it

## Notes on the Current Deployment Model

SprintLab is typically run locally — the backend is intended to run on the same machine as the browser. The CORS policy in `server.py` currently allows all origins (`*`), which is appropriate for local use but should be tightened before any public deployment. If you are deploying SprintLab on a server accessible over a network, you should restrict `allow_origins` to your frontend's actual origin.
