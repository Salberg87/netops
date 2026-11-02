---
name: port-and-route-checks
description: Check whether a service is reachable — open/closed ports on a host the user controls, traceroute to find where packets stop or slow down, routing table, default gateway, interfaces and VPN routes. Use when the user asks "is port 5432 open", "why can't I reach my server", "where is the latency coming from", "which interface is my traffic using", or is debugging firewalls and security groups.
---

# Port and route checks with netops

## Authorisation first

Port scanning hosts you don't own or administer can violate laws, contracts and acceptable-use policies. Before running `ports` against anything other than `localhost`, a private address, or a host the user has clearly said is theirs, ask. Never scan ranges of hosts. Keep port lists targeted.

## Running it

Mod tool (`mcp__netops__run`) when available:

```json
{ "command": "ports", "target": "my-server.example.com", "ports": "22,80,443,5432" }
{ "command": "trace", "target": "example.com", "maxHops": 20 }
{ "command": "route" }
{ "command": "iface" }
{ "command": "vpn" }
```

Bundled CLI otherwise (`<base>` = this skill's base directory):

```bash
sh "<base>/../../scripts/netops" --json ports my-server -p 22,443
sh "<base>/../../scripts/netops" --json trace example.com -m 20
sh "<base>/../../scripts/netops" --json route
```

## Reading results

**Ports**
- `open` → something accepted the TCP connection.
- `closed` (refused) → host reachable, nothing listening (service down or bound to 127.0.0.1 only).
- `filtered` (timed out) → a firewall, security group or NAT is dropping packets. Point at the specific layer: host firewall (ufw/iptables/Windows Firewall), cloud security group / NSG, or the router.
- Compare from inside the host (`localhost`) vs outside to split "service not listening" from "firewall blocking".

**Traceroute**
- Read for the *first* hop where latency jumps and stays high — that's where the delay enters. A single slow hop that recovers afterwards is usually just ICMP de-prioritisation.
- `*` rows that continue afterwards are normal; `*` until the end means filtering or the destination drops ICMP/UDP probes.
- Hop 1 is the local gateway: high latency there points at Wi-Fi/LAN.

**Routes / interfaces / VPN**
- The default route's interface tells you whether traffic goes via Wi-Fi, Ethernet or a tunnel (`utun*`, `wg*`, `tun*`, `ppp*`).
- Split-tunnel VPNs: a specific route for the target network via the tunnel explains "works on VPN only".

## Reporting

State reachability plainly ("443 is open, 5432 times out — a firewall is dropping it"), then the most likely layer and the command to confirm after the fix.

Keep the voice calm and specific: the verdict first, numbers people can check, one next step. No exclamation marks or emoji.
