// Imports every weapon module so they register themselves.
//
// Beyond the wielder contract in weapons/base.js, some weapons read a few optional fields so AI
// bots can drive them like the player does:
//   jumpBuffer (s)      Twin Dualies dodge roll — set > 0 while firing with a move direction
//                       (the Player passes its move intent to main.preMove(); wielders without
//                       that hook fall back to botMove)
//   botMove {x, z}      world-space move intent (Ink Jet flight, dodge-roll fallback)
//   botFire (bool)      trigger while flying the Ink Jet (the main weapon is blocked then);
//                       turf/bot.js sets it every step (Ink Jet also falls back to bot.input)
//   onOutOfInk()        called when a shot/roll can't be paid for
//   alive, kit          dead wielders don't roll; kit.special.hidesMain hides the main weapon
// Weapons pose the Squidkin arms through a per-frame hook on model.update (weapons/models.js).
import './mains/shooter.js';
import './mains/roller.js';
import './mains/charger.js';
import './mains/blaster.js';
import './mains/slosher.js';
import './mains/splatling.js';
import './mains/brush.js';
import './mains/dualies.js';
import './subs/bombs.js';
import './subs/sprinkler.js';
import './subs/ink-mine.js';
import './specials/tidal-slam.js';
import './specials/ink-storm.js';
import './specials/missile-barrage.js';
import './specials/ink-jet.js';
import './dummy.js';
