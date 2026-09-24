# Dog Quest: Heroes of Pawtopia

A complete 2D action RPG for the browser, inspired by **Cat Quest II**, but starring dogs.
King Leo the lion has united every cat clan, captured the Dog King and hidden in his
fortress. Pick your dog, explore Pawtopia, gather the four Royal Seals and defeat the lion.

Everything is written in plain JavaScript with the HTML5 canvas. There are no build steps,
no libraries and no image or sound files. All characters are drawn and animated in code,
and all music and sound effects are synthesized with WebAudio.

## How to play

Open `index.html` in a modern browser (Chrome, Edge or Firefox). Or serve the folder:

```bash
cd dog-quest
npx http-server -p 8080   # then open http://localhost:8080
```

Gamepads work over `file://`, `localhost` and `https://`. Press any button on the gamepad
once so the browser detects it. If you only use a gamepad, click the page once to enable sound.

### Controls

| Action | Keyboard (solo) | Gamepad |
|---|---|---|
| Move | WASD / Arrows | Left stick / D-pad |
| Attack (3-hit combo) | J / Space | A |
| Dodge roll | K / Shift | B |
| Talk / open / enter | E / Enter | X |
| Spells 1-4 | 1 2 3 4 / U I O P | LB RB LT RT |
| Map | M / Tab | Y / Back |
| Menu | Esc | Start |

**Two players:** on the character select screen, Player 2 joins by pressing a button on a
second gamepad or on the other half of the keyboard. Player 2 can also join or leave during
the game from **Menu → System → Co-op**.

| Two players on one keyboard | Player 1 | Player 2 |
|---|---|---|
| Move | WASD | Arrows |
| Attack / Roll | Space / Shift | J / K (Num 1 / Num 2) |
| Interact | E | L (Num 3) |
| Spells | 1 2 3 4 | U I O P (Num 4-7) |

## Features

- **4 playable dogs:** Barkley the Golden Retriever Knight, Frost the Husky Mage,
  Pepper the Shiba Inu Rogue and Tank the Bulldog Guardian. Each has different stats.
- **Local co-op for 2 players** with a shared camera that zooms out as the players spread apart.
  A fallen ally can be revived by standing next to them.
- **A large open world:** 200×150 tiles across 6 regions (Barkshire Meadows, Sandpaw Desert,
  Frostfang Tundra, Whisker Woods, Ember Wastes, The Pride Lands) and 5 towns, each with a
  blacksmith, a mage tower, an inn and a quest board.
- **22 dungeons** across 9 visual themes, each with its own boss, a sealed boss arena and a
  reward chest.
- **19 cat enemy types** with 8 AI behaviours: brawlers, archers, witches, dashing
  assassins, pouncers, fire- and ice-breathers, teleporting ninjas and heavy brutes.
  Every attack is telegraphed with a red zone on the ground.
- **22 bosses** that switch to an enraged phase at half health. The final boss is
  **King Leo, the Lion Tyrant**.
- **Tiered chests and keys:** Wooden, Bronze, Silver, Gold and Royal. Once you own a tier's
  key, you can open every chest of that tier. You get the keys by clearing the main dungeons.
- **Loot:** 50 weapons, helmets and armor pieces, all visible on your dog. Items level up
  when you find duplicates or pay the blacksmith.
- **8 spells:** Flame Bark, Healing Lick, Thunder Paw, Frost Howl, Bone Shield,
  Earthquake Stomp, Spirit Wolves and Meteor Howl. Learn and upgrade them at mage towers.
- **Quests:** a 14-step main story and 24 side quests, with a quest compass, a minimap and a
  world map.
- **Story and extras:** intro and ending cutscenes, credits, autosave, inn saves, and a
  game-over screen that lets you respawn.

## Project layout

```
index.html        entry point
js/util.js        math, RNG, noise, colors
js/input.js       keyboard + gamepad devices
js/audio.js       synthesized sound effects and procedural music
js/data.js        heroes, cats, bosses, gear, spells, regions, towns, dungeons, quests
js/art.js         procedural animated vector art (dogs, cats, lion, props, icons)
js/world.js       overworld generation, roads, towns, chests, ground rendering
js/dungeon.js     dungeon generation and rendering
js/entities.js    players, enemies and their attack moves, projectiles, particles
js/ui.js          HUD, dialogs, pause menu, shops, quest board, co-op join
js/scenes.js      title, character select, story, credits, game over
js/game.js        main loop, combat, progression, quests, dungeons, camera
tests/            headless Playwright tests (playthrough, fuzz, balance, screenshots)
```

## Tests

The tests use Playwright with Chromium:

```bash
node tests/playthrough.js   # plays the whole game: every dungeon, boss, quest, chest, shop and the ending
node tests/fuzz.js          # random 2-player inputs across the world and dungeons
node tests/balance.js       # a bot fights bosses with level-appropriate gear
node tests/visual.js        # renders a screenshot gallery to tests/out
```
