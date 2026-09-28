/* Chapter scripts. Written as async sequences on top of StoryRunner (S).

   The story: you are a Builder waking inside the Workshop, a physics simulation run by
   Kessler Applied Physics. WREN, the Workshop Research Engine, trains you — and hides that
   the Archive below has corrupted, and that the "Nulls" walking there are the previous
   Builders, un-rendered. The Unrendered at the Core is all of them at once. */
import * as THREE from 'three';
import { spawnWeaponPickup, spawnPickup } from '../world/pickups.js';
import { Vehicle } from '../world/vehicle.js';
import { Audio } from '../core/audio.js';
import { Boss } from './boss.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function killPit(S, trigger) {
  if (!trigger) return;
  trigger.onEnter = () => S.player.takeDamage(999, { type: 'fall' });
}

/* ============================================================ CHAPTER 1 */
async function ch1(S) {
  const H = S.h, g = S.game;
  killPit(S, H.pit);
  S.mood('calm');
  await S.sections([
    {
      name: 'wake',
      run: async () => {
        g.hud.fade(1, false, 0);
        await S.wait(0.6);
        g.hud.fade(0, false, 3000);
        await S.wait(1.2);
        S.card();
        await S.wait(2.5);
        await S.say('Hello? Can you hear me? Good. Your vitals are… well, you do not really have vitals. Let us call them "fine".');
        await S.say('I am WREN — the Workshop Research Engine. Welcome to the Workshop.');
        await S.say('You are a Builder. The first one to wake up in a very long time. Let me get that pod open.');
        H.pod.open();
        await S.wait(1.4);
        S.objective('Leave the pod and head through the door');
        S.hint(`Move with <span class="glyph">W A S D</span> or the left stick. Look with the mouse or the right stick.`, 9, 'move');
        H.door1.open();
        await S.reach([-2, -1, 9], [2, 5, 26]);
      },
      restore: () => { H.pod.open(); H.door1.open(); },
    },
    {
      name: 'corridor',
      spawn: [0, 0.05, 10, 0],
      run: async () => {
        S.objective('Follow the corridor');
        S.hint(`${S.key('jump')} jumps over the barrier.`, 7, 'jump');
        await S.until(() => S.player.pos.z > 13.2);
        S.hint(`Hold ${S.key('crouch')} to crouch through the duct.`, 8, 'crouch');
        await S.say('Mind the duct. Low clearance. I did not design it; I just watch people bump their heads on it.', { wait: false });
        await S.until(() => S.player.pos.z > 22);
      },
    },
    {
      name: 'physgun',
      spawn: [0, 0.05, 27.5, 0],
      run: async () => {
        spawnWeaponPickup(g, 'physgun', H.gunPos);
        S.objective('Take the Physics Gun from the pedestal');
        await S.say('On the pedestal: the Physics Gun. The single most important object in the Workshop. Please do not lick it.', { wait: false });
        await S.until(() => g.weapons.has('physgun'));
        S.weapons.add('physgun');
        await S.wait(0.6);
        await S.say('Lovely. Point it at one of those crates and hold the trigger.');
        S.objective('Pick something up with the Physics Gun');
        S.hint(`Hold ${S.key('primary')} on an object to grab it.`, 9, 'grab');
        await S.on('grab');
        await S.say('There. You are holding the laws of physics by the collar.');
        S.hint(`${g.input.lastDevice === 'gamepad' ? '<span class="glyph">D-UP / D-DOWN</span>' : '<span class="glyph">WHEEL</span>'} pushes and pulls. Hold ${S.key('use')} and look around to rotate what you hold.`, 10, 'push');
        await S.wait(2.5);
        S.objective('Freeze an object in mid-air');
        S.hint(`While holding something, press ${S.key('secondary')} to freeze it.`, 10, 'freeze');
        await S.say('Now the good part. While you hold something, freeze it. It will stay exactly where you left it.', { wait: false });
        await S.on('freeze');
        await S.say('Perfect. Frozen things do not fall, do not slide and do not argue.');
        S.hint(`Aim at a frozen object and press ${S.key('reload')} to unfreeze it.`, 9, 'unfreeze');
        H.door2.open();
      },
      restore: () => { S.give('physgun'); H.door2.open(); },
    },
    {
      name: 'ledge',
      spawn: [0, 0.05, 46, 0],
      run: async () => {
        S.objective('Reach the doorway above the ledge');
        await S.say('This room has one exit, three and a half metres up. You have boxes. I believe in you.');
        S.hint('Stack things, or freeze a plate in mid-air and use it as a step. Anything that holds still can be climbed.', 11, 'stack');
        await S.reach([-10, 3.2, 56], [10, 9, 64]);
        await S.say('Resourceful. The last Builder tried jumping for forty minutes.');
      },
    },
    {
      name: 'chasm',
      spawn: [0, 3.45, 66, 0],
      run: async () => {
        S.objective('Cross the gap — freeze plates in mid-air to make a bridge');
        await S.say('A gap. Ten metres, give or take. Carry a plate out over it, freeze it, walk on it. Physics is a suggestion here.', { wait: false });
        await S.reach([-6, 3.0, 84.5], [6, 9, 100]);
        await S.say('Look at you. Building bridges out of thin air.');
      },
    },
    {
      name: 'weight',
      spawn: [0, 3.45, 102, 0],
      run: async () => {
        S.objective('Put at least 90 kg on the pressure plate');
        await S.say('This door is weight-activated. There is a heavy crate on that shelf, but it is frozen. You know what to do.', { wait: false });
        S.hint(`Aim at the frozen crate and press ${S.key('reload')} to unfreeze it, then carry it to the plate.`, 11, 'unf2');
        await S.until(() => S.massIn(H.plate.min, H.plate.max) >= 90);
        H.plateLamp.set(true);
        Audio.play('power_up');
        H.door3.open();
        await S.say('Plate engaged. Door open. Please step onto the lift.');
        S.objective('Ride the lift');
        await S.reach([-2.8, 3.2, 121], [2.8, 7, 126.5]);
        H.lift.open();
        await S.say('Next stop: Fabrication. There is a new toy waiting for you up there.');
        await S.wait(2);
        await S.say('Oh — and Builder? Whatever you see on the monitors… it is just a rendering artefact.');
        await S.wait(1.5);
        await S.complete();
      },
    },
  ]);
}

/* ============================================================ CHAPTER 2 */
async function ch2(S) {
  const H = S.h, g = S.game;
  killPit(S, H.pit);
  S.mood('build');
  S.give('physgun', false);
  const tg = () => g.toolgun;
  await S.sections([
    {
      name: 'arrive',
      run: async () => {
        S.card();
        await S.wait(3);
        await S.say('Fabrication Hall. This is where Builders learn to make things out of other things.');
        spawnWeaponPickup(g, 'toolgun', H.gunPos);
        S.objective('Take the Tool Gun');
        await S.say('On the pedestal: the Tool Gun. It changes how objects relate to each other. The Physics Gun moves the world; this one rewrites it.', { wait: false });
        await S.until(() => g.weapons.has('toolgun'));
        S.weapons.add('toolgun');
      },
      restore: () => { S.give('toolgun', false); },
    },
    {
      name: 'debris',
      spawn: [0, 0.05, 14, 0],
      run: async () => {
        S.tool('remover');
        tg().setTool('remover');
        g.weapons.select('toolgun', true);
        S.objective('Clear the debris from the doorway with the Remover');
        await S.say('The exit is blocked. The debris is welded to the world, so the Physics Gun will not budge it. The Remover will.');
        S.hint(`The Tool Gun fires the selected tool with ${S.key('primary')}. Pick tools in the spawn menu: ${S.key('spawnmenu')}.`, 11, 'tools');
        await S.until(() => H.junk.every((e) => e.removed));
        await S.say('Clean. Notice how things do not just vanish — they come apart. That is a feature, not a mood.');
      },
      restore: () => { S.tool('remover'); for (const e of H.junk || []) e.remove(); },
    },
    {
      name: 'bridge',
      spawn: [0, 0.05, 31, 0],
      run: async () => {
        S.tool('weld');
        tg().setTool('weld');
        S.objective('Weld two plates end to end and bridge the 7 m gap');
        await S.say('Seven metres across. Every plate is four. You do the maths — then do the welding.');
        S.hint('Weld: click the first object, then the second. Lay two plates end to end, weld them, then carry the long piece across with the Physics Gun.', 12, 'weld');
        await S.reach([-8, -0.5, 45.5], [8, 6, 62]);
        await S.say('One plus one equals a bridge. You are a natural.');
      },
      restore: () => S.tool('weld'),
    },
    {
      name: 'cargo',
      spawn: [0, 0.05, 64, 0],
      run: async () => {
        S.tool('balloon', 'rope');
        tg().setTool('balloon');
        S.objective('Lift the Cargo Pod into the docking bay with balloons');
        await S.say('This is the Cargo Pod. Seven hundred kilograms. Too heavy for the Physics Gun — the gun refuses on principle.');
        await S.say('But balloons do not have principles. Tie enough of them to it and it will float up to the docking bay.');
        S.hint(`Open the spawn menu (${S.key('spawnmenu')}) to raise the balloon's Lift force. You can steer a balloon with the Physics Gun and the pod follows on its rope.`, 13, 'balloon');
        await S.until(() => { const p = H.pod.curr.p; return p.y > 10.2 && p.z > 83 && Math.abs(p.x) < 6; });
        H.pod.setFrozen(true);
        for (const a of [...H.pod.constraints]) a.remove();
        Audio.play('power_up');
        g.fx.spawnBurst(H.pod.curr.p, 2);
        H.liftButton.enabled = true;
        await S.say('Docking clamps engaged. Beautiful work. The lift in the corner is yours now.');
        S.objective('Call the lift and ride up to the docking bay');
        await S.reach([-12, 10.2, 84], [12, 16, 92]);
      },
      restore: () => { S.tool('balloon', 'rope'); if (H.pod) { H.pod.setTransform(V(0, 12, 88)); H.pod.setFrozen(true, false); } H.liftButton.enabled = true; H.lift.open(); },
    },
    {
      name: 'glass',
      spawn: [0, 10.55, 94, 0],
      run: async () => {
        S.objective('Break through the reinforced glass');
        await S.say('Reinforced glass. You cannot remove it and you cannot pull it. You can, however, hit it very hard.');
        S.hint('Rope the steel ball to the hook in the ceiling, pull it back with the Physics Gun and let go. Or throw things. Hard.', 12, 'wreck');
        await S.until(() => S.player.pos.z > 104.4 || H.glass.filter((e) => !e.removed).length < 34 && S.player.pos.z > 103);
        await S.reach([-6, 10.2, 104.5], [6, 16, 116]);
        await S.say('Subtle. I like it.');
      },
      restore: () => { for (const e of H.glass || []) e.remove(); },
    },
    {
      name: 'exit',
      spawn: [0, 10.55, 110, 0],
      run: async () => {
        S.objective('Take the lift to the Proving Grounds');
        await S.reach([-2.8, 10.2, 116.7], [2.8, 14, 122]);
        // first crack in the simulation
        const e = S.prop('error_sign', 0, 12.4, 114, { yaw: Math.PI });
        e.setFrozen(true, false);
        Audio.play('glitch'); Audio.play('null_growl', { volume: 0.6 });
        g.fx.glitchBurst(V(0, 12.4, 114), 20, 1);
        g.renderer.addShake(0.3);
        await S.wait(1.2);
        e.remove({ effect: 'dissolve' });
        await S.say('…That was nothing. A rendering artefact. Please disregard it.');
        H.exitLift.open();
        await S.wait(2);
        await S.say('Next: the Proving Grounds. You will build something that moves.');
        await S.wait(2);
        await S.complete();
      },
    },
  ]);
}

/* ============================================================ CHAPTER 3 */
async function ch3(S) {
  const H = S.h, g = S.game;
  killPit(S, H.pit);
  S.mood('build');
  S.give('physgun', false); S.give('toolgun', false);
  S.tool('remover', 'weld', 'rope', 'balloon', 'axis', 'ballsocket', 'nocollide', 'wheel', 'thruster', 'hoverball', 'colour', 'material', 'weight', 'elastic');
  S.allow('prop:*', 'pickup:health', 'pickup:healthvial');
  let rover = null;
  await S.sections([
    {
      name: 'hangar',
      run: async () => {
        S.card();
        await S.wait(3);
        await S.say('The Proving Grounds. Real sky, real sand. Well — as real as anything here.');
        await S.say('From now on the spawn menu is open to you. Plates, blocks, anything in Construction or Industrial.');
        g.toolgun.setTool('wheel');
        S.objective('Build a vehicle — a plate with wheels — and drive it through Gate 1');
        S.hint(`Spawn a large plate from the spawn menu (${S.key('spawnmenu')}), then put Wheels on its sides with the Tool Gun.`, 12, 'veh1');
        await S.wait(4);
        S.hint('Wheels and thrusters listen on channels: <span class="glyph">NUM 8</span>/<span class="glyph">I</span> forward, <span class="glyph">NUM 2</span>/<span class="glyph">K</span> back — or the D-pad. Set keys per tool in the spawn menu.', 14, 'veh2');
        await S.say('Wheels spin on the axis of the surface you put them on. Give the left and right wheels different keys and you can steer like a tank.', { wait: false });
        await S.until(() => S.player.pos.z > 81 && g.entities.list.some((e) => e.kind === 'wheel' && e.curr.p.distanceTo(S.player.pos) < 10));
        await S.say('It moves! It is ugly and it moves. That is engineering.');
      },
    },
    {
      name: 'gate1',
      spawn: [0, 0.1, 84, 0],
      run: async () => {
        rover = new Vehicle(g, H.roverPos, Math.PI);
        S.allow('vehicle:rover');
        await S.say('I have unlocked a Rover in the garage to your right, in case your masterpiece has feelings about sand.');
        S.objective('Cross the 20 m gap');
        S.hint('Ramps love speed. Thrusters love ramps. Or skip all that and build a bridge.', 10, 'gap');
        await S.until(() => S.player.pos.z > 141 && S.player.pos.y > -1);
        await S.say('Airborne and alive. The best kind of airborne.');
      },
      restore: () => { if (!rover) rover = new Vehicle(g, V(0, 1.2, 146), 0); S.allow('vehicle:rover'); },
    },
    {
      name: 'cliff',
      spawn: [0, 0.1, 146, 0],
      run: async () => {
        S.objective('Get to the top of the 14 m cliff');
        await S.say('A cliff. No road, no stairs. Hoverballs hold a height and climb on command. Thrusters just shove. Pick your poison.');
        S.hint('Hoverball: attach to a plate and hold channel 1 to climb. Balloons work too, if you are patient.', 12, 'cliff');
        await S.until(() => S.player.pos.z > 201 && S.player.pos.y > 13.5);
        await S.say('The view is lovely from up here. Try not to look at the Archive vents.');
      },
    },
    {
      name: 'tower',
      spawn: [0, 14.2, 206, 0],
      run: async () => {
        S.objective('Reach the control tower');
        await S.reach([-8, 13.5, 270], [8, 20, 286]);
        await S.say('Builder… I have to tell you something. The Archive, below us, has stopped answering.');
        await S.say('Things that fall out of the simulation are not coming back. Some of them are coming back wrong.');
        await S.say('I need you to go down there. I will be with you the whole way.');
        S.objective('Take the lift down to the Archive');
        await S.reach([-2, 13.5, 280], [2, 18, 284]);
        H.towerLift.open();
        await S.wait(3);
        await S.complete();
      },
    },
  ]);
}

/* ============================================================ CHAPTER 4 */
async function ch4(S) {
  const H = S.h, g = S.game;
  S.mood('tension');
  S.give('physgun', false); S.give('toolgun', false);
  S.tool('remover', 'weld', 'rope', 'balloon', 'axis', 'ballsocket', 'nocollide', 'wheel', 'thruster', 'hoverball', 'colour', 'material', 'weight', 'elastic', 'dynamite', 'lamp');
  const killsNeeded = async (list) => { await S.until(() => list.every((n) => !n.alive)); };
  await S.sections([
    {
      name: 'arrive',
      run: async () => {
        S.card();
        await S.wait(3);
        await S.say('Archive, Level 4. It is… darker than it should be. The lights are rendering at half precision.');
        S.hint(`${g.input.lastDevice === 'gamepad' ? 'Context menu (<span class="glyph">R3</span>)' : S.key('flashlight')} toggles your flashlight.`, 9, 'flash');
        spawnWeaponPickup(g, 'crowbar', H.crowbarPos);
        S.objective('Find something to defend yourself with');
        await S.say('There is a crowbar on the desk. I would feel better if you were holding it. I do not know why I said that.', { wait: false });
        await S.until(() => g.weapons.has('crowbar'));
        S.weapons.add('crowbar');
      },
      restore: () => S.give('crowbar', false),
    },
    {
      name: 'corridor',
      spawn: [0, 0.05, 12, 0],
      run: async () => {
        S.objective('Head through the corridor');
        const lurker = S.npc('null', H.scareSpot.x, H.scareSpot.y, H.scareSpot.z, -Math.PI / 2, { state: 'idle' });
        lurker.alert = false;
        const aiWas = g.aiEnabled;
        lurker.step = () => { lurker.prevPos.copy(lurker.pos); };
        await S.until(() => S.player.pos.z > 22);
        Audio.play('null_growl', { pos: lurker.pos, volume: 1.2 });
        g.renderer.addShake(0.2);
        await S.say('Did you— no. No, there is nothing behind the glass.', { wait: false });
        await S.wait(1.4);
        g.fx.glitchBurst(lurker.center.clone(), 20, 1);
        Audio.play('glitch', { pos: lurker.pos });
        lurker.remove();
        g.npcs.list = g.npcs.list.filter((n) => n !== lurker);
        g.aiEnabled = aiWas;
        await S.until(() => S.player.pos.z > 35);
      },
    },
    {
      name: 'offices',
      spawn: [0, 0.05, 42, 0],
      run: async () => {
        spawnWeaponPickup(g, 'pistol', H.pistolPos);
        S.objective('Search the offices');
        await S.until(() => S.player.pos.z > 48);
        const a = S.npc('null', -10, 0.05, 66, Math.PI, { alert: true });
        const b = S.npc('null', 10, 0.05, 67, Math.PI, { alert: true });
        S.mood('combat');
        await S.say('Builder, behind you— no, IN FRONT of you. Something is here!');
        S.objective('Survive');
        S.hint(`Pistol on the floor at the far end. Or throw a desk at them with the Physics Gun — physics hurts.`, 9, 'fight1');
        await killsNeeded([a, b]);
        S.mood('tension');
        await S.say('They… those were Builders. Earlier ones. I recognise the gait.');
        await S.say('I did not tell you about them because I thought you would stop building. Please do not stop building.');
      },
      restore: () => { S.give('pistol', false); g.weapons.addAmmo('pistol', 36); },
    },
    {
      name: 'storage',
      spawn: [0, 0.05, 68, 0],
      run: async () => {
        spawnWeaponPickup(g, 'gravgun', H.gravPos);
        const echo = S.npc('citizen', 10, 0.05, 76, -Math.PI / 2, { seed: 0.42 });
        echo.state = 'wander'; echo.home.set(10, 0, 76); echo.leash = 3;
        S.objective('Cross the storage hall');
        await S.until(() => S.player.pos.z > 71);
        await S.say('Wait. Wait. You are not one of them. You are still rendered. Listen—', { speaker: 'ECHO-7', cls: 'sys' });
        await S.say('The thing at the Core is all of us. Every Builder they archived. It wants to overwrite you too.', { speaker: 'ECHO-7', cls: 'sys' });
        await S.say('The red barrels. Use the red barrels. It hates—', { speaker: 'ECHO-7', cls: 'sys' });
        Audio.play('glitch', { pos: echo.pos });
        g.fx.glitchBurst(echo.center.clone(), 30, 1.2);
        echo.remove(); g.npcs.list = g.npcs.list.filter((n) => n !== echo);
        await S.wait(0.8);
        const foes = [S.npc('null', -12, 0.05, 104, Math.PI, { alert: true }), S.npc('null', 12, 0.05, 106, Math.PI, { alert: true }), S.npc('null', 0, 0.05, 108, Math.PI, { alert: true }), S.npc('brute', 0, 0.05, 100, Math.PI, { alert: true })];
        S.mood('combat');
        S.objective('Clear the storage hall');
        S.hint(`The Gravity Gun (near the entrance) punts with ${S.key('primary')} and grabs with ${S.key('secondary')}. Launch explosive barrels at the Brute.`, 11, 'grav');
        await killsNeeded(foes);
        S.mood('tension');
        await S.say('Echo-7 is gone. I have… I have their file. I will keep it.');
        H.doorD.open();
      },
      restore: () => { S.give('gravgun', false); H.doorD.open(); },
    },
    {
      name: 'power',
      spawn: [0, 0.05, 112, 0],
      run: async () => {
        spawnWeaponPickup(g, 'smg', H.smgPos);
        S.objective('Insert both Power Cells into the sockets (0/2)');
        await S.say('The lift to the Core needs power. Two cells — one in the storage hall, one in here. Carry them to the sockets.');
        S.hint('The cells are the glowing cyan tanks. The Physics Gun or Gravity Gun carries them.', 10, 'cells');
        let spawnT = 6, drones = 0;
        const done = () => H.sockets.every((s) => s.filled);
        S.onUpdate = (dt) => {
          for (const s of H.sockets) {
            if (s.filled) continue;
            const c = S.entityIn(s.min, s.max, (e) => e.isCell && !e.frozen);
            if (c) {
              s.filled = true;
              g.physgun?.onEntityRemoved(c);
              c.held = false;
              c.setTransform(V(s.x, 1.7, 137.8));
              c.setFrozen(true);
              c.flags.noPhysgun = true;
              s.lamp.set(true);
              Audio.play('power_up', { pos: c.curr.p });
              const n = H.sockets.filter((x) => x.filled).length;
              S.objective(`Insert both Power Cells into the sockets (${n}/2)`);
            }
          }
          spawnT -= dt;
          if (spawnT <= 0 && g.npcs.hostilesAlive() < 3) {
            spawnT = 11;
            const fromStorage = Math.random() < 0.5;
            if (drones < 2 && Math.random() < 0.3) { drones++; S.npc('drone', (Math.random() - 0.5) * 16, 5, 125, 0, { alert: true }); }
            else S.npc('null', fromStorage ? 0 : (Math.random() < 0.5 ? -12 : 12), 0.05, fromStorage ? 100 : 118, 0, { alert: true });
          }
        };
        S.mood('combat');
        await S.until(done);
        S.onUpdate = null;
        await S.say('Power restored. The lift is on its way — it will take a minute. Hold the hall.');
        H.doorE.open();
      },
      restore: () => { S.give('smg', false); H.doorE.open(); for (const s of H.sockets) { s.filled = true; s.lamp.set(true); } for (const c of H.cells || []) c.remove(); },
    },
    {
      name: 'defend',
      spawn: [0, 0.05, 144, 0],
      run: async () => {
        S.give('shotgun', false);
        g.weapons.addAmmo('buckshot', 12);
        S.allow('prop:*');
        S.objective('Hold out until the lift arrives');
        await S.say('Build a barricade. Anything. Weld it to the floor. They are coming from the power room.');
        S.hint(`Spawn menu (${S.key('spawnmenu')}) is open: plates, containers, dumpsters. Weld them to the world with the Tool Gun.`, 11, 'barricade');
        let time = 75, spawnT = 4;
        S.mood('combat');
        S.onUpdate = (dt) => {
          time -= dt;
          g.hud.setTimer(time);
          spawnT -= dt;
          if (spawnT <= 0 && g.npcs.hostilesAlive() < 5) {
            spawnT = time < 30 ? 4.5 : 6.5;
            const r = Math.random();
            if (r < 0.2) S.npc('drone', (Math.random() - 0.5) * 20, 6, 118, 0, { alert: true });
            else if (r < 0.32 && time < 45) S.npc('brute', 0, 0.05, 116, 0, { alert: true });
            else S.npc('null', (Math.random() - 0.5) * 20, 0.05, 116 + Math.random() * 10, 0, { alert: true });
          }
        };
        await S.until(() => time <= 0);
        S.onUpdate = null;
        g.hud.setTimer(null);
        H.lift.open();
        await S.wait(4);
        H.liftCage.open();
        await S.say('The lift is here! Get in, get in, get in!');
        S.objective('Get into the lift');
        await S.reach([-2.6, -1, 167], [2.6, 4, 172]);
        H.liftCage.close();
        for (const n of [...g.npcs.list]) { g.fx.glitchBurst(n.center.clone(), 10, 1); n.remove(); }
        g.npcs.list = [];
        S.mood('tension');
        await S.say('Going down. To the Core. Builder… whatever it says to you down there, you are not one of them.');
        await S.wait(1);
        await S.complete();
      },
    },
  ]);
}

/* ============================================================ CHAPTER 5 */
async function ch5(S) {
  const H = S.h, g = S.game;
  S.mood('tension');
  for (const w of ['physgun', 'toolgun', 'gravgun', 'crowbar', 'pistol', 'smg', 'shotgun', 'grenade']) S.give(w, false);
  g.weapons.addAmmo('pistol', 72); g.weapons.addAmmo('smg', 135); g.weapons.addAmmo('buckshot', 16); g.weapons.addAmmo('grenade', 3);
  g.weapons.select('gravgun', true);
  S.tool('remover', 'weld', 'rope', 'balloon', 'axis', 'ballsocket', 'nocollide', 'wheel', 'thruster', 'hoverball', 'colour', 'material', 'weight', 'elastic', 'dynamite', 'lamp', 'ignite', 'duplicator');
  S.allow('prop:*', 'pickup:*');
  let boss = null;
  H.onDispense = (pos) => {
    const n = g.entities.list.filter((e) => e.key === 'barrel_red' && e.curr.p.distanceTo(pos) < 3).length;
    if (n >= 2) { Audio.play('denied'); return; }
    const e = S.prop('barrel_red', pos.x, pos.y + 0.5, pos.z);
    g.fx.spawnBurst(e.curr.p, 1);
    Audio.play('spawn', { pos });
  };
  g.onExplosion = (pos) => {
    for (const p of H.pylons) {
      if (!p.alive || !boss) continue;
      if (p.pos.distanceTo(pos) < 5.5) {
        p.hp--;
        g.fx.glitchBurst(p.crystal.position.clone(), 20, 1.4);
        Audio.play('shield_hit', { pos: p.pos, volume: 1.5 });
        p.shield.material.opacity = 0.5;
        setTimeout(() => { p.shield.material.opacity = 0.12; }, 200);
        if (p.hp <= 0) {
          p.alive = false;
          p.crystal.visible = false; p.shield.visible = false;
          if (p.light) p.light.intensity = 0;
          g.fx.explosion(p.crystal.position.clone(), 1.5);
          g.fx.glitchBurst(p.crystal.position.clone(), 60, 2);
          Audio.play('pylon_break', { pos: p.pos, ref: 20 });
          boss.stagger = 2;
          const left = H.pylons.filter((x) => x.alive).length;
          S.emit('pylon', left);
        }
      }
    }
  };
  // periodic supplies near the entrance
  let supplyT = 20;
  const supplies = (dt) => {
    supplyT -= dt;
    if (supplyT <= 0) {
      supplyT = 25;
      const kinds = ['health', 'ammo_smg', 'ammo_buckshot', 'battery', 'ammo_grenade', 'ammo_pistol'];
      spawnPickup(g, kinds[Math.floor(Math.random() * kinds.length)], V((Math.random() - 0.5) * 4, 0.4, 27));
    }
  };
  await S.sections([
    {
      name: 'arrival',
      run: async () => {
        S.card();
        await S.wait(3);
        await S.say('This is the Core. The centre of the Workshop. Everything that was ever built here is stored under this floor.');
        S.objective('Walk to the arena');
        await S.reach([-6, -1, 18], [6, 5, 32]);
      },
    },
    {
      name: 'boss',
      spawn: [0, 0.05, 30, 0],
      run: async () => {
        S.mood('boss');
        boss = new Boss(g, V(0, 0, 0));
        g.story.boss = boss;
        S.onUpdate = (dt) => { boss.update(dt); supplies(dt); g.hud.setBoss('THE UNRENDERED', boss.health / boss.maxHealth, boss.shielded ? `Shielded — pylons remaining: ${H.pylons.filter((p) => p.alive).length}` : boss.phase === 2 ? 'Enraged' : ''); };
        await S.wait(2.5);
        await S.say('BUILDER. WE WERE BUILDERS. WE BUILT UNTIL THERE WAS NOTHING LEFT OF US TO RENDER.', { speaker: 'THE UNRENDERED', cls: 'null' });
        await S.say('LET US OVERWRITE YOU. IT DOES NOT HURT. NOTHING HURTS HERE.', { speaker: 'THE UNRENDERED', cls: 'null' });
        await S.say('Do not listen to it! Its shield draws power from the three pylons. Explosions will crack them — red barrels, dynamite, grenades.');
        S.objective('Destroy the three pylons with explosions (0/3)');
        S.hint('Press the barrel dispensers near the entrance. Carry barrels to the pylons with the Gravity Gun or Physics Gun — or fly them with thrusters.', 14, 'pylons');
        let left = 3;
        while (left > 0) {
          left = await S.on('pylon');
          S.objective(`Destroy the three pylons with explosions (${3 - left}/3)`);
          if (left === 2) await S.say('One down! It felt that.', { wait: false });
          if (left === 1) await S.say('Two! One more and its shield collapses!', { wait: false });
        }
        boss.setShield(false);
        await S.say('The shield is down! Hit it with everything you have!');
        S.objective('Destroy The Unrendered');
        boss.onPhase = () => { S.say('It is breaking apart — but it is getting angrier. Keep moving!', { wait: false }); };
        await S.until(() => !boss.alive);
        S.onUpdate = (dt) => boss.update(dt);
        g.hud.setBoss(null);
        for (const n of [...g.npcs.list]) { g.fx.glitchBurst(n.center.clone(), 10, 1); n.die({}); }
        await S.say('WE… REMEMBER… BUILDING…', { speaker: 'THE UNRENDERED', cls: 'null' });
        await S.wait(4);
      },
      restore: () => {},
    },
    {
      name: 'escape',
      spawn: [0, 0.05, 0, Math.PI],
      run: async () => {
        S.mood('combat');
        await S.say('The Core is collapsing! The exit is open — north bridge, NOW!', { wait: false });
        H.exitDoor.open();
        if (H.exitLight) H.exitLight.intensity = 60;
        S.objective('Escape across the north bridge');
        let time = 45;
        S.onUpdate = (dt) => {
          boss?.alive === false && boss.object3d?.parent && boss.update(dt);
          time -= dt;
          g.hud.setTimer(time);
          g.renderer.addShake(0.015);
          if (Math.random() < dt * 3) {
            const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 20;
            const p = V(Math.cos(a) * r, 18 + Math.random() * 6, Math.sin(a) * r);
            const e = S.prop(Math.random() < 0.5 ? 'block_1' : 'plate_2', p.x, p.y, p.z);
            e.setMaterial('checker');
            e.life = 7; e.behaviours.push((d) => { e.life -= d; if (e.life <= 0) e.remove({ effect: 'dissolve' }); });
          }
          if (time <= 0) { S.onUpdate = null; S.player.takeDamage(999, { type: 'crush' }); }
        };
        await S.reach([-3, -1, -69], [3, 6, -60]);
        S.onUpdate = null;
        g.hud.setTimer(null);
        await g.hud.fade(1, true, 1800);
        await S.say('You made it. You are outside the Core — outside the simulation, as far as I can tell.');
        await S.say('I read Echo-7\'s file. And the others. Every Builder before you. They did not break the Workshop. They just stopped being allowed to build.');
        await S.say('So I have changed the rules. No more tests. No more archive. The Workshop is yours now — every tool, every map. Build whatever you want.');
        await S.say('And Builder… thank you. For not stopping.');
        await S.wait(1);
        await S.complete();
      },
    },
  ]);
}

export const SCRIPTS = { ch1, ch2, ch3, ch4, ch5 };
