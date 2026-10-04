# Scratch Fever — resolved spec

Brief from the user: *"Build the same game (Scritchy Scratchy) from scratch on three.js. English.
Keyboard and gamepad, flawless Xbox support. A real game menu, not a website. A complete game."*

Decisions taken during the run are numbered `ASSUMPTION-nn`; correct any of them at Gate 2.

## Core loop

Buy a scratch card → scratch the foil (mouse, keyboard cursor or gamepad stick + trigger) → symbols
pay out → spend cash on upgrades and better cards → automate with Scratch Bot → prestige for Jack
Points → repeat with permanent multipliers.

- **Tickets** — 8 card types, unlocked by lifetime earnings, grids from 3×3 to 6×6, price 1 → 750K.
  Each has a distinct palette, match threshold and feature mix (multiplier cells, bonus cells,
  progressive jackpot, wilds).
- **Generation** — outcome-first, like printed scratch cards: the prize tier is drawn, then a grid that
  shows exactly that prize is laid out. `evaluate()` re-derives the prize from the grid, so the two
  must agree (tested). Expected value at luck 0 sits at 1.1–1.5× the price (simulated, 20K tickets
  per type), so progress is always positive.
- **Upgrades** — Lucky Charm (odds), Fat Payouts, Big Brush, Loyalty Card (price), Quick Reveal (X),
  Season Pass (auto-buy), Scratch Bot + Bot Servos, Wild Streak, Bonus Hunter.
- **Prestige** — Jack Points = √(run earnings / 20 000). Each JP = +10 % payouts. Perks: Seed Money,
  Born Lucky, Bot Warranty, Golden Touch, Jack Multiplier.
- **Offline** — with Bot + Season Pass, up to 4 h of half-efficiency bot earnings on return.

## Camera and presentation

Fixed three-quarter view down onto a felt kiosk counter. The card is a thin 3D slab with a procedural
canvas face; the foil is a second canvas erased by the brush (`destination-out`), tracked per cell.
Flake particles, bloom, win rings, floating prize numbers. The camera drifts a little toward the
cursor and shakes on big wins (toggleable).

## Screens

Boot → Title (press any key / A) → Main menu (Continue / New Game / Options / Stats / Credits / Quit
on PC only) → Play. In play: Pause (Menu/Esc), Shop (Y/B key) with tabs Tickets / Upgrades /
Prestige (LB/RB), Stats (View/Tab), Options from pause. Confirm dialogs for New Game and Prestige.

Every screen is DOM over the canvas, built from `src/theme.css` tokens, 5 % safe area, ≥64 px hit
targets, loud focus ring, prompts that swap between keyboard and Xbox glyphs by last device.

## Controls

| Action | Keyboard / mouse | Xbox |
|---|---|---|
| Move brush | WASD / arrows, or mouse | Left stick |
| Scratch | Hold Space / E, or mouse drag | Hold RT (or LT) |
| Quick reveal (upgrade) | X / F | X |
| Shop | B | Y |
| Confirm / Back | Enter / Esc | A / B |
| Switch tabs | Q / R | LB / RB |
| Stats | Tab | View |
| Pause | Esc / P | Menu |

## Assumptions

- **ASSUMPTION-01** Name: *Scratch Fever* (chosen by the user from three options).
- **ASSUMPTION-02** No Higgsfield key art (user declined credits). Theme, logo and store art are
  procedural: tokens in `src/theme.css`, wordmark rendered from CSS, covers rendered from the game.
- **ASSUMPTION-03** The Kanuni asset library (`D:\2026\AssetLibrary`) is not reachable from this
  environment; every model, texture, sound and font is generated in code. No `.pak`.
- **ASSUMPTION-04** No bundled font files: the display face is a system stack
  (Arial Black / Segoe UI Black / Impact). On Xbox and Windows this resolves to Segoe UI Black.
- **ASSUMPTION-05** Partner Center identity is a placeholder (`CN=0000…`). Replace in
  `Package.appxmanifest` before signing — the certificate subject must match exactly.
- **ASSUMPTION-06** Save data lives in `localStorage` (WebView2 persists it per app). One slot.
- **ASSUMPTION-07** Quit is offered only inside the PC UWP shell; never on Xbox (certification).
- **ASSUMPTION-08** The game is fully offline: no network capability declared.
