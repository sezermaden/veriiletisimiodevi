# Scratch Fever

A scratch-card incremental game for PC and Xbox, built on three.js and shipped as a UWP app
(WebView2). Scratch the foil, match symbols, buy better tickets and upgrades, let Scratch Bot take
over, prestige for Jack Points. Keyboard, mouse and Xbox controller are first-class; every screen is
navigable from the pad with a 10-foot layout on the console.

```
scratch-fever/
  ScratchFever/            UWP shell (.NET 9 + Native AOT, WinUI 2 WebView2)
    www/                   the game — open index.html through any static server
      src/main.js          state machine, HUD, play loop
      src/game/            economy.js (pure logic), ticket3d.js (3D card + scratching), symbols.js
      src/ui/ui.js         screens: title, menu, pause, shop, options, stats, help, credits, dialogs
      src/engine/          input (kb+mouse+pad), focus (d-pad navigation), view, audio, fx
      src/theme.css        design tokens — every colour and size the UI uses
    Assets/                75-file tile/icon set (generated)
    StoreArt/              covers, screenshots
  tools/                   serve, shots, cover, icons, single-file bundle, Store packaging script
  test/                    economy, input, smoke (keyboard), gamepad, layout
  docs/                    spec-resolved.md, verification.md, legal/
```

## Run it

```bash
npm install                 # playwright + esbuild (dev only; the game itself has no dependencies)
npm run serve               # http://localhost:8080
```

Any static file server works — the game is plain ES modules with an import map. In a browser the
Gamepad API picks up an Xbox controller as soon as a button is pressed.

## Controls

| Action | Keyboard / mouse | Xbox |
|---|---|---|
| Move brush | WASD / arrows, or mouse | Left stick |
| Scratch | Hold Space / E, or mouse drag | Hold RT (or LT) |
| Quick reveal (upgrade) | X / F | X |
| Shop | B | Y |
| Confirm / Back | Enter / Esc | A / B |
| Switch tabs / tickets | Q / R | LB / RB |
| Stats | Tab | View |
| Pause | Esc / P | Menu |

## Tests

```bash
npm test                    # all five suites, headless Chromium under SwiftShader (no GPU needed)
npm run test:economy        # pure logic: generation ⇄ evaluation agreement, EV bounds, save, prestige
npm run test:input          # edge queue, deadzone, repeat, trigger, device switching
npm run test:smoke          # keyboard-only walkthrough of every screen and a full ticket
npm run test:gamepad        # pad-only walkthrough + BFS reachability graph per screen
npm run test:layout         # 5 window shapes × 12 screens: focus, hit size, safe area, clipping
```

Results and the negative-control numbers are in `docs/verification.md`.

## Store art

```bash
npm run shots               # drives the game, captures StoreArt/Screenshots/*.png
npm run cover               # renders covers from the play screenshot + CSS wordmark
npm run icons               # 75-file UWP icon set from Cover-1080x1080.png
npm run bundle              # single-file dist/ScratchFever.html (itch / web)
```

## Windows / Xbox package

Everything is prepared; the one step that needs Windows is the build itself.

1. Partner Center → your app → **Product management → Product identity**. Put the real values in
   `ScratchFever/Package.appxmanifest` (`Identity Name`, `Publisher="CN=…"`, `PublisherDisplayName`).
   The current `CN=0000…` is a placeholder.
2. Create a signing certificate whose subject matches `Publisher` exactly:
   ```powershell
   $c = New-SelfSignedCertificate -Type Custom -Subject "CN=<your GUID>" -KeyUsage DigitalSignature `
        -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")
   Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($c.Thumbprint)" -FilePath "ScratchFever\ScratchFever_TemporaryKey.pfx" `
        -Password (ConvertTo-SecureString "pw" -Force -AsPlainText)
   ```
3. Open `ScratchFever.sln` in Visual Studio 2022 (UWP + .NET 9 workloads), **Release | x64**, build.
   Press Play to run on the PC; use Xbox Device Portal / Dev Mode to deploy the x64 package to a console.
4. `.\tools\Make-StoreUpload.ps1 -Platforms "x86|x64"` produces and verifies the `.msixupload`.
   Upload only that file to Partner Center.

Pitfalls the kit already avoids: no symlinks under the app folder, no `node_modules` under `www`,
`www\**` is the only packaged content, no capabilities declared (fully offline), no Quit button on
Xbox, mouse mode disabled so the Gamepad API receives the sticks, B handled in the game.

## Design notes

`docs/spec-resolved.md` records the loop, screens, controls and every assumption made during the
build. The economy is outcome-first (like printed scratch cards): the prize tier is drawn, then a
grid that shows exactly that prize is laid out; `evaluate()` re-derives the prize from the grid and
the test suite proves the two agree. Expected value at luck 0 sits at 1.1–1.5× the price for every
ticket (20K-ticket simulation), so progress is always positive.
