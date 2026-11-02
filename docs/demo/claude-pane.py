#!/usr/bin/env python3
"""Draw docs/claude-pane.svg: the netops plugin inside a Claude Code session.

An illustration, not a screenshot: conversation on the left, the /netops pane
docked on the right, the status line below. Same palette as the CLI.
"""
from html import escape

W, H = 920, 500
BG, FRAME, PANEL = "#151816", "#262B28", "#1A1E1C"
FG, MIST, DIM = "#E7ECE9", "#8A938F", "#5E6763"
TIDE, GOOD, WARN = "#3AA391", "#5DAA72", "#D49A2E"
MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace"
CW, LH = 7.6, 20

out = []
def t(x, y, s, fill=FG, weight=None, size=13):
    w = f' font-weight="{weight}"' if weight else ""
    out.append(f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}"{w}>{escape(s)}</text>')

out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="netops in Claude Code: a conversation and the network health pane">')
out.append(f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="14" fill="{BG}" stroke="{FRAME}"/>')
for i in range(3):
    out.append(f'<circle cx="{22+i*16}" cy="20" r="5" fill="#353B37"/>')
out.append(f'<g font-family="{MONO}" xml:space="preserve">')
t(W/2 - 40, 24, "~/projects", MIST, size=12)

# --- conversation (left) ---
L = 28
out.append(f'<rect x="{L-8}" y="52" width="520" height="34" rx="8" fill="{PANEL}"/>')
t(L + 4, 74, "> my internet feels slow today — what's going on?", FG)

t(L, 114, "●", TIDE); t(L + 16, 114, "netops", FG, 600); t(L + 16 + 7*CW, 114, "diagnose", MIST)
t(L + 16, 134, "└ Mostly fine · 1 thing to look at", DIM)

reply = [
    ("Your connection itself is fine: ", FG), ("14 ms", GOOD), (" to the", FG),
]
y = 172
t(L, y, "●", FG)
lines = [
    "Your connection itself is fine: 14 ms to the internet",
    "and DNS answers in 10 ms. What you are feeling is",
    "jitter. Latency jumps to 41 ms between samples,",
    "which usually means Wi-Fi interference.",
    "",
    "Try a cable, or sit closer to the router, then run",
    "/netops again to compare.",
]
for i, line in enumerate(lines):
    t(L + 16, y + i * LH, line)

# prompt box
out.append(f'<rect x="{L-8}" y="{H-112}" width="520" height="40" rx="8" fill="none" stroke="{FRAME}"/>')
t(L + 4, H - 87, ">", MIST)
out.append(f'<rect x="{L+18}" y="{H-101}" width="8" height="17" fill="{MIST}" opacity="0.6"/>')

# status line
t(L, H - 44, "∿ ! · 14 ms · 1 to look at", TIDE, size=12)
t(L + 230, H - 44, "/netops to open the pane", DIM, size=12)

# --- pane (right) ---
PX, PY, PW, PH = 568, 52, 330, H - 92
out.append(f'<rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" rx="10" fill="{PANEL}" stroke="{FRAME}"/>')
t(PX + 16, PY + 26, "Network health", MIST, size=12)
out.append(f'<line x1="{PX}" y1="{PY+40}" x2="{PX+PW}" y2="{PY+40}" stroke="{FRAME}"/>')

x, y = PX + 18, PY + 70
t(x, y, "! Mostly fine", WARN, 600)
t(x, y + LH, "14 ms to the internet, DNS answers", FG, size=12)
t(x, y + LH*2 - 2, "in 10 ms and no VPN in the way.", FG, size=12)
t(x, y + LH*3, "Checked at 09:41", DIM, size=12)

y += LH * 4 + 10
rows = [("Ping", "14 ms", True), ("Jitter", "41 ms", False), ("DNS", "10 ms", False), ("Down", "212 Mbps", False), ("Up", "48 Mbps", False)]
samples = [12, 14, 13, 38, 12, 15, 41, 13, 12, 29, 13, 14]
for i, (k, v, spark) in enumerate(rows):
    yy = y + i * LH
    t(x, yy, k, MIST, size=12.5)
    t(x + 150, yy, v, WARN if k == "Jitter" else FG, size=12.5)
    out[-1] = out[-1].replace("<text ", '<text text-anchor="end" ')
    if spark:
        lo, hi = min(samples), max(samples)
        for j, s in enumerate(samples):
            h = 3 + 11 * (s - lo) / (hi - lo)
            out.append(f'<rect x="{x + 170 + j*8:.1f}" y="{yy + 2 - h:.1f}" width="5.5" height="{h:.1f}" rx="1.5" fill="{TIDE}"/>')

y += LH * len(rows) + 16
t(x, y, "Worth a look", FG, 600, size=12.5)
t(x, y + LH, "!", WARN, size=12.5); t(x + 14, y + LH, "High jitter (41 ms)", FG, size=12.5)
t(x + 14, y + LH*2, "A cable, or sitting closer to the", DIM, size=12)
t(x + 14, y + LH*3 - 2, "router, usually helps.", DIM, size=12)

y += LH * 4 + 14
out.append(f'<rect x="{x}" y="{y-17}" width="112" height="28" rx="8" fill="{TIDE}"/>')
t(x + 14, y + 2, "Check again", "#0F1311", 600, size=12.5)
out.append(f'<rect x="{x+124}" y="{y-17}" width="104" height="28" rx="8" fill="none" stroke="#3A413D"/>')
t(x + 138, y + 2, "Test speed", FG, size=12.5)

out += ["</g>", "</svg>"]
open("docs/claude-pane.svg", "w", encoding="utf-8").write("\n".join(out) + "\n")
print("wrote docs/claude-pane.svg")
