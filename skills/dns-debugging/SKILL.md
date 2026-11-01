---
name: dns-debugging
description: Debug DNS problems — a domain not resolving, wrong or stale records, email (MX/SPF/DKIM TXT) setup, propagation after a DNS change, slow resolvers, and reverse DNS. Use when the user mentions DNS, nameservers, A/AAAA/CNAME/MX/TXT/NS records, "DNS_PROBE_FINISHED_NXDOMAIN", "domain not found", or just changed DNS and wants to verify it.
---

# DNS debugging with netops

## Running it

Prefer the mod tool `mcp__netops__run` when present:

```json
{ "command": "dns", "target": "example.com", "recordType": "ALL" }
{ "command": "dns", "target": "example.com", "recordType": "MX" }
{ "command": "rdns", "target": "93.184.216.34" }
{ "command": "dns-speed", "target": "example.com" }
{ "command": "whois", "target": "example.com" }
```

Without the mod, run the bundled CLI (`<base>` = this skill's base directory):

```bash
sh "<base>/../../scripts/netops" --json dns example.com -a
sh "<base>/../../scripts/netops" --json dns example.com -t TXT
sh "<base>/../../scripts/netops" --json rdns 8.8.8.8
sh "<base>/../../scripts/netops" --json whois example.com
```

## Playbook

**Domain does not resolve**
1. `dns <domain> -a`. If *every* type fails with `ENOTFOUND`/`NXDOMAIN`, check the registration: `whois` — expired domains and missing NS delegation look exactly like this.
2. If `NS` resolves but `A`/`AAAA` does not, the zone exists but lacks the record.
3. If another well-known domain (e.g. `google.com`) also fails, the problem is the local resolver, not the domain — switch to the `network-troubleshooting` skill.

**Records look wrong / change not visible**
- netops queries the system resolver, which caches. Say so, and tell the user TTLs govern propagation; a record changed minutes ago may still show the old value.
- Compare `A` vs `CNAME`: a CNAME at a name forbids other records there.

**Email deliverability**
- `MX` — at least one, priorities sensible, targets resolve (`dns <mx-host>`).
- `TXT` on the apex — exactly **one** `v=spf1 ...` record; flag duplicates or `+all`.
- `TXT` on `_dmarc.<domain>` — `v=DMARC1; p=...` present.
- DKIM lives at `<selector>._domainkey.<domain>`; ask for the selector if unknown.

**Slow lookups**
- `dns-speed` > 50 ms average is slow. Suggest a faster resolver and re-test.

**Reverse DNS**
- Mail servers need PTR (`rdns <ip>`) to match a name that forward-resolves back to the same IP (FCrDNS).

## Reporting

Quote the records you actually saw (type, value, priority) and the response time. Distinguish clearly between "the record is missing" and "the lookup failed".
