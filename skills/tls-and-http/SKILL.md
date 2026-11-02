---
name: tls-and-http
description: Check TLS/SSL certificates and HTTP endpoints — certificate expiry, issuer and chain, hostname mismatch, TLS version, status codes, redirects and response time. Use when the user asks "when does my cert expire", sees certificate/SSL errors (ERR_CERT_*, "self signed", "unable to verify"), wants to verify an HTTPS deployment, or asks whether a URL is up and how fast it responds.
---

# TLS and HTTP checks with netops

## Running it

Mod tool (`mcp__netops__run`) when available:

```json
{ "command": "cert", "target": "example.com" }
{ "command": "cert", "target": "mail.example.com", "port": 465 }
{ "command": "http", "target": "https://example.com/health", "method": "GET" }
```

Bundled CLI otherwise (`<base>` = this skill's base directory):

```bash
sh "<base>/../../scripts/netops" --json cert example.com
sh "<base>/../../scripts/netops" --json cert example.com -p 8443
sh "<base>/../../scripts/netops" --json http https://example.com
```

The mod only allows `GET`, `HEAD` and `OPTIONS` — netops is for checking, not for sending data.

## What to look at

**Certificate (`cert`)**
- `daysRemaining`: < 30 days → warn, < 7 → urgent, negative → expired. Remind the user that auto-renew (e.g. Let's Encrypt) normally renews at 30 days left; still being under 30 suggests renewal is failing.
- Subject / SANs must cover the exact hostname the user visits (`www.` vs apex is a classic miss).
- Issuer: self-signed or private CA explains "unable to verify" errors in clients.
- Chain: a missing intermediate breaks some clients (curl, Java, Android) while browsers still work.
- `protocol` (TLS version): TLS 1.0/1.1 is obsolete; 1.2 is the minimum, 1.3 preferred.

**HTTP (`http`)**
- Status: 2xx healthy; 3xx check where it redirects; 4xx client/config; 5xx server.
- Timing: > 1 s for a simple page is slow; separate network latency (compare `ping`) from server time.

## Reporting

Lead with the answer ("Certificate is valid for 63 more days, issued by Let's Encrypt, covers example.com and www.example.com"). Then list anything that needs action, with the fix. For renewals, give the exact date.

Keep the voice calm and specific: the verdict first, numbers people can check, one next step. No exclamation marks or emoji.
