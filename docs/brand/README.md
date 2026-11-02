# netops brand: calm signal

netops tells you what your network is doing, in plain words, and then gets out
of the way. The look and the voice should feel like a good colleague you ask for
help: calm, specific and kind, never breathless.

<p>
  <img src="mark.svg" width="64" alt="netops mark">
</p>

## The mark

A single pulse line that settles and ends in a dot. The line is the signal and
the dot is the answer. It is drawn with one round-capped stroke on a soft tile.

- Files: [`mark.svg`](mark.svg) (tile), [`logo-light.svg`](logo-light.svg),
  [`logo-dark.svg`](logo-dark.svg), and `.claude-plugin/icon.png` (1024 px,
  rendered from `mark.svg`).
- In a terminal the mark is the character `∿`, in the accent color.
- Keep at least a quarter of the tile's width clear around it. Don't add a
  gradient, glow, shadow or outline, and don't animate it beyond a slow fade.

## Palette

One accent and three signal colors. Everything else is ink, paper and mist.

| Token | Hex | Used for |
| --- | --- | --- |
| Tide | `#2F8F7F` (tile) · `#3AA391` (terminal and UI) | The mark, section titles, sparklines, the primary button |
| Good | `#5DAA72` | `✓`, healthy numbers |
| Warn | `#D49A2E` | `!`, numbers worth a look |
| Bad | `#E06B58` | `✗`, failures |
| Mist | `#8A938F` | Labels, secondary text, timestamps |
| Ink | `#151816` · `#1B1F1D` | Dark backgrounds, text on light |
| Paper | `#F7F5F0` | Light backgrounds, the line in the mark |

Terminal colors are mid-tones that read on both dark and light themes. Values
use the terminal's own foreground color, so nothing disappears on a light
background. Status colors carry meaning, so never use them for decoration.

## Type

- **Terminal:** the user's monospace font. Section titles are the accent color
  in bold. Labels are mist and values use the default foreground.
- **Wordmark:** lowercase `netops`, in a rounded system sans (SF Pro Rounded
  where available), weight 650, tracking slightly tight.
- **Units:** a space before the unit (`18 ms`, `212 Mbps`), and round to whole
  milliseconds in summaries.

## Voice

The voice should be clear and calm. It should not sound like "AI".

| Do | Don't |
| --- | --- |
| Lead with the verdict: **All good**, **Mostly fine**, **Something's off**, **You're offline** | Open with a greeting or a pep talk |
| Back it with numbers people can check: "18 ms to the internet" | Use vague praise: "Your network is performing optimally" |
| Name the likely cause and one next step | List every possible cause |
| Write short sentences in plain words: "DNS answers in 9 ms" | Use jargon walls: "Resolver RTT nominal" |
| End sentences with full stops | Use exclamation marks, emoji, ✨, 🚀 or "Let's dive in" |
| Say what you don't know: "this is this machine's network, not your home's" | Guess with confidence |
| Show one gentle warning at a time | Use red banners and ALL CAPS |

The copy lives in [`lib/verdict.js`](../../lib/verdict.js), shared by the CLI
card, the markdown report, the JSON `verdict` field and the Claude Code pane.
The test `verdict copy has no exclamation marks or emoji` keeps it honest.

## Layout patterns

- **Section:** an accent title, with items indented two columns beneath it. No
  ruled lines.
- **Verdict card:** a rounded box at the end of `diagnose` and `full`. It holds
  the headline, one sentence, and at most four notes, each with a hint.
- **Sparkline:** latency samples drawn as `▁▂▃▅`, scaled to their own range, in
  the accent color. The shape matters more than the size.
- **Spinner:** three dots pulsing slowly (`∙●∙`) in the accent color, with
  muted text.
- **Pane:** the verdict first, then up to six metrics with right-aligned
  values, then "Worth a look", then the actions (**Check again** as primary,
  **Test speed** as secondary).

## Regenerating the pictures

```bash
COLORTERM=truecolor FORCE_COLOR=3 node docs/demo/render.mjs > docs/demo/diagnose.ansi
python3 docs/demo/ansi2svg.py docs/demo/diagnose.ansi docs/preview.svg
python3 docs/demo/claude-pane.py
```

`docs/preview.svg` is drawn from real CLI output, so it stays in step with the
theme. `docs/claude-pane.svg` is an illustration of the plugin in a Claude Code
session.
