#!/usr/bin/env python3
"""Convert truecolor ANSI terminal output into a calm, self-contained SVG.

Every glyph gets its own x position, so box-drawing characters and sparkline
blocks stay aligned whatever monospace font the viewer falls back to.

usage: ansi2svg.py input.ansi output.svg [title]
"""
import re
import sys
from html import escape

FG = "#E7ECE9"      # default foreground
BG = "#151816"      # warm ink
FRAME = "#262B28"
DOT = "#353B37"
TITLE = "#7F8984"
CHAR_W = 7.8
LINE_H = 19
PAD_X = 20
TOP = 52
FONT = "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace"

src, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else "netops diagnose"
text = open(src, encoding="utf-8").read().rstrip("\n")
lines = text.split("\n")

BLOCKS = "▁▂▃▄▅▆▇█"
SGR = re.compile(r"\x1b\[([0-9;]*)m")

def parse(line):
    """Yield (col, char, color, bold) for each visible character."""
    color, bold, col, pos = None, False, 0, 0
    for m in SGR.finditer(line + "\x1b[m"):
        for ch in line[pos:m.start()]:
            yield col, ch, color, bold
            col += 1
        pos = m.end()
        codes = [int(c) for c in m.group(1).split(";") if c] or [0]
        i = 0
        while i < len(codes):
            c = codes[i]
            if c == 0:
                color, bold = None, False
            elif c == 1:
                bold = True
            elif c == 22:
                bold = False
            elif c == 39:
                color = None
            elif c == 38 and i + 4 < len(codes) + 1 and codes[i + 1] == 2:
                r, g, b = codes[i + 2:i + 5]
                color = f"#{r:02X}{g:02X}{b:02X}"
                i += 4
            elif c == 90:
                color = "#8A938F"
            i += 1

cols = max((sum(1 for _ in parse(l)) for l in lines), default=40)
width = int(PAD_X * 2 + max(cols, 56) * CHAR_W)
height = TOP + len(lines) * LINE_H + 16

parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)} output">',
    f'<rect x="0.5" y="0.5" width="{width-1}" height="{height-1}" rx="14" fill="{BG}" stroke="{FRAME}"/>',
    *[f'<circle cx="{22 + i*16}" cy="20" r="5" fill="{DOT}"/>' for i in range(3)],
    f'<text x="{width/2}" y="24" text-anchor="middle" fill="{TITLE}" font-family="{FONT}" font-size="12">{escape(title)}</text>',
    f'<g font-family="{FONT}" font-size="13" xml:space="preserve">',
]

for row, line in enumerate(lines):
    y = TOP + row * LINE_H
    run, run_style = [], None
    def flush():
        if not run:
            return
        color, bold = run_style
        xs = " ".join(f"{PAD_X + c * CHAR_W:.1f}" for c, _ in run)
        chars = escape("".join(ch for _, ch in run))
        weight = ' font-weight="600"' if bold else ""
        parts.append(f'<text x="{xs}" y="{y}" fill="{color or FG}"{weight}>{chars}</text>')
    for col, ch, color, bold in parse(line):
        style = (color, bold)
        if ch in BLOCKS:
            # Sparkline blocks as rounded bars: no font has to supply them.
            flush(); run, run_style = [], None
            level = BLOCKS.index(ch) + 1
            h = 2 + (LINE_H - 7) * level / len(BLOCKS)
            x = PAD_X + col * CHAR_W + 1
            parts.append(f'<rect x="{x:.1f}" y="{y + 3 - h:.1f}" width="{CHAR_W - 2:.1f}" height="{h:.1f}" rx="1.5" fill="{color or FG}"/>')
            continue
        if ch == " ":
            flush(); run, run_style = [], None
            continue
        if style != run_style:
            flush(); run, run_style = [], style
        run.append((col, ch))
    flush()

parts += ["</g>", "</svg>"]
open(out, "w", encoding="utf-8").write("\n".join(parts) + "\n")
print(f"wrote {out} ({width}x{height})")
