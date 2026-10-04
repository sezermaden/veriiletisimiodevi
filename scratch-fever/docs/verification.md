# Verification — Scratch Fever

All suites run headless under Chromium + SwiftShader (no GPU). Waits are frame-based
(`window.__game.frames`), never time-based. Full logs: `docs/shots/test-log.txt`, `docs/shots/layout-log.txt`.

| Suite | What it proves | Result |
|---|---|---|
| `test/economy.mjs` | 8 tickets × 4 000 rolls: a grid without a line never pays; never two paying lines; EV 1.0–2.2× and win rate 20–50 % per ticket; luck is monotonic; buy/settle bookkeeping; unlocks; upgrade growth, caps and gating; prestige maths and perks; save round-trip, corrupt and partial saves; offline cap | **68 / 68** |
| `test/input.mjs` | edge queue (press+release in one frame → both edges, cleared next frame); **12 taps at dt = 0.0163 → 12 registered**; pad press/held/release edges; radial deadzone (0.12 rest → 0, full → 1, diagonal ≤ 1); d-pad repeat (1 s held → 7 edges); RT hysteresis at 0.35; device switching swaps prompt glyphs; blur releases everything | **17 / 17** |
| `test/smoke.mjs` | keyboard only: title → menu → every menu screen → new game → buy → mouse drag reveals → keyboard sweep settles a ticket → pause/options/shop/stats → buys Quick Reveal and Scratch Bot → prestige dialog → X reveal → ticket switching → save & main menu → continue; zero console errors, zero 4xx | **41 / 41** |
| `test/gamepad.mjs` | fake Xbox pad only, Xbox host: body.tv, no cursor, no Quit; A/B/X/Y/LB/RB/View/Menu through every screen; stick + RT scratches a full ticket; bot + auto-buy finishes tickets hands-free; **BFS reachability graph** on every screen (all focusables reachable from the initial focus) | **55 / 55** |
| `test/layout.mjs` | 1920×1080, 2560×1440, 3840×2160, 1920×1200 (16:10), 2560×1080 (21:9) × 12 screens + HUD: something focused, hit ≥ `--hit-min`, inside the 5 % safe area, no focusable text < 20 px, nothing clipped, page never scrolls | **70 / 70** |

## Negative control

A green test proves nothing until it has been red. The bug fixed during the build: a WILD on the
grid could complete a *filler* symbol sitting one copy short, giving a second paying line and
inflating the expected value far past design.

1. Reverted the fix (`cap = t.match - 1` instead of `t.match - 1 - (wild ? 1 : 0)`) and ran `test/economy.mjs`.
2. **Red:** 56 passed, 12 failed — "never more than one paying line" failed on all 8 tickets with
   251–394 violations per 4 000 rolls; EV blew to 4.0–7.5× on the four late tickets.
3. Restored the fix. **Green:** 68 passed, 0 failed, 0 violations.

The second threshold chosen from measurement: a cell counts as revealed at **45 %** foil coverage
(measured: one straight mouse stroke through a row with the base brush covers 50 % of each cell
along it; the earlier 60 % threshold left every cell on the path unrevealed, which read as "the
mouse doesn't work"). `REVEAL_AT` in `ticket3d.js` carries the note.

## Expected value by ticket (20 000 rolls each, seed 42)

| Ticket | Luck 0 | Luck 10 | Luck 30 | Win rate (L0) |
|---|---|---|---|---|
| Lucky Penny | 1.27 | 1.4 | 1.7 | 37 % |
| Fruit Fiesta | 1.26 | 1.4 | 1.7 | 34 % |
| Silver Bells | 1.16 | 1.3 | 1.6 | 28 % |
| Gem Vault | 1.25 | 1.4 | 1.7 | 32 % |
| Multiplier Madness | 1.39 | 1.6 | 1.9 | 27 % |
| Golden Jackpot | 1.37 | 1.5 | 1.9 | 30 % |
| Cosmic Scratch | 1.34 | 1.5 | 1.9 | 31 % |
| Jack's Mega Ticket | 1.52 | 1.7 | 2.1 | 32 % |

Luck 10/30 columns are from the pre-tuning run and are approximate (the economy test bounds
them at < 2.2×); luck 0 and win rates are current.

## Budgets

| Item | Size |
|---|---|
| `www/` total (what the MSIX packages) | ≈ 1.7 MB, of which three.js 1.2 MB |
| Single-file bundle `dist/ScratchFever.html` | 631 KB minified |
| GPU textures per ticket | face 768×~1000 RGBA ≈ 3 MB + foil 512×~670 ≈ 1.4 MB; previous card disposed on discard |
| Audio | 0 bytes of samples; every sound synthesised |
| Icon set | 75 PNGs, 15 MB (Windows requires every scale) |

## Not covered here

- A physical Xbox controller on real hardware (the Gamepad API path is exercised with a fake pad that
  mirrors the standard mapping; the UWP shell's mouse-mode opt-out and B-button handling come from the kit).
- The MSBuild/MSIX step (needs Windows).
