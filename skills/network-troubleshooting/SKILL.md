---
name: network-troubleshooting
description: Diagnose why the internet or network is slow, flaky, or down on this machine — connectivity, VPN/proxy interference, DNS, packet loss, latency, jitter, Wi-Fi signal and throughput. Use when the user says things like "my internet is slow", "connection keeps dropping", "is it me or the site?", "video calls are choppy", "npm install hangs", or asks for a network health check.
---

# Network troubleshooting with netops

Work from the outside in: is there internet at all → is something in the way (VPN/proxy) → does name resolution work → is the path clean (loss, latency, jitter) → is the link itself good (Wi-Fi, throughput).

## How to run netops

Prefer the mod's tools when they are available (no shell prompt, structured JSON):

- `mcp__netops__diagnose` — the whole suite in one call. `speed: true` adds a 20–30 s speed test; only ask for it when throughput is the complaint.
- `mcp__netops__run` — one command, e.g. `{ "command": "ping", "target": "1.1.1.1", "count": 10 }`.

Otherwise use the bundled CLI through Bash. The script sits two folders above this skill's base directory, so with `<base>` being the base directory shown when this skill loaded:

```bash
sh "<base>/../../scripts/netops" --json report          # suite, structured JSON
sh "<base>/../../scripts/netops" --json report --speed  # + speed test
sh "<base>/../../scripts/netops" --json latency -c 20
```

If `netops` is already on PATH (`npm i -g github:Salberg87/netops`), `netops --json <command>` works the same. Always pass `--json`; the human output is colored and decorative.

## Procedure

1. Run `diagnose` (or `report --json`). Read `status` and `issues` first — each issue has `severity` (`fail`/`warn`), `area`, `message`.
2. Follow the first failing layer only; don't drown the user in every number.

| Symptom in the JSON | Likely cause | Next check |
| --- | --- | --- |
| `connectivity.connected: false` | No route out, captive portal, link down | `run iface`, `run route`; is there a default gateway? `run ping` the gateway IP |
| Some endpoints fail, others succeed | Site-specific block, DNS filter, IPv6 trouble | `run dns` the failing host, then `run http` it |
| `vpn.activeVpnRoute: true` or `vpn.vpns` non-empty | Traffic via VPN/proxy adds latency or blocks hosts | Ask whether the VPN is expected; compare with it off |
| `dns.success: false` | Resolver down/misconfigured | see the `dns-debugging` skill |
| `dnsSpeed.avgTime` > 50 ms | Slow resolver | suggest 1.1.1.1 / 8.8.8.8 / router DNS, re-test with `dns-speed` |
| `ping.packetLoss` > 0 | Congestion, bad Wi-Fi, faulty cable | `run ping` the gateway: loss there = local link; loss only beyond = ISP/upstream |
| `latency.avgLatency` > 100 ms | Distance, VPN, bufferbloat | `run trace` to see which hop jumps |
| `latency.jitter` > 30 ms | Wi-Fi interference, bufferbloat, busy uplink | `run wifi`; re-test latency during and after a speed test |
| Low `speed.download/upload.speedMbps` | Plan limit, Wi-Fi, ISP congestion | `run wifi` (signal/SNR), try wired, compare to plan |

3. Localise the fault: **gateway clean but upstream bad → ISP**; **gateway already bad → local network / Wi-Fi**; **only one site bad → that site or its DNS**.
4. Report back in this shape. The JSON's `verdict` field (`headline`, `sentence`, `notes[].hint`) is already written in netops' voice, so start from it:
   - **Verdict** — the headline and one sentence (e.g. "Mostly fine. Your connection is fast, but DNS is slow.").
   - **Evidence** — 2–4 key numbers with their thresholds.
   - **Fix** — concrete steps, most likely first.
   - **Re-test** — the single command that confirms the fix.

## Voice

Calm and specific, like a colleague who has already looked. Give numbers people can check, name one likely cause and one next step, and say what you don't know. Don't use exclamation marks, emoji, hype ("blazing fast"), or apologise for the network. See `docs/brand/README.md`.

## Thresholds (same as the CLI)

- DNS slow: > 50 ms average
- Latency high: > 100 ms average
- Jitter high: > 30 ms
- Any packet loss is worth mentioning; > 2 % is a real problem for calls and games.

## Notes

- Results describe *this machine's* network. In a cloud/remote session, say so — it is not the user's home connection.
- The speed test uses real bandwidth (tens of MB). Don't run it repeatedly or on metered connections without asking.
- `wifi` works on macOS, Linux (`iwconfig`/`nmcli`) and Windows (`netsh`); it reports nothing on wired-only hosts.
