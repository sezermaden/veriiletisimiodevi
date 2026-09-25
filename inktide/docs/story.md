# INKTIDE — Rise of the Murk · Story Bible & Script

> Warm, funny, punky, kid-friendly. Big feelings, short sentences, lots of splats.
> Everything here is original IP. The machine-readable script is `www/src/story/script.js`; the
> "Script" half of this document is generated from it, so the two never drift.

## Premise

**Tidehaven** is a bright seaside city where every wall is a canvas and every kid is a little bit
squid. Its people, the **Squidkin**, switch between a kid form and a squid form and swim through
their own ink. All of that colour — the murals, the neon, the ink itself — flows up from the
**Prism Wellspring**, a glowing spring hidden under the old lighthouse and kept bright by five
**Prism Cores**: *Ember* (orange), *Coral* (pink), *Kelp* (green), *Tide* (blue) and *Sunburst*
(gold).

**Baron Murkwell**, the anglerfish CEO of **Murk Industries**, thinks colour is "a premium
feature". One stormy night his crews drill into the Wellspring and rip out all five Cores to power
the **Graytide Engine** on top of **Murkwell Tower**. The Engine pumps out **Murk** — sensible,
beige-to-violet goop — that drowns the city's colour. Murkwell's business plan: bottle the stolen
colour and sell it back by subscription (*ColorPlus™*).

Retired Splashguard captain **Commodore Brine** recruits a rookie, **Kai**, to become Tidehaven's
new Splashguard. Guided over pirate radio by **Pix**, Kai fights through four districts, cracks
open Murk Industries' **Prism Capsules** (the tanks of bottled colour at the end of every stage)
and wins back the Cores from Murkwell's machines one by one.

### How the stages map to the Cores

- Every normal stage ends at a **Prism Capsule** (the `prism-core` entity): a Murk tank of bottled
  colour. Cracking it sends that district's colour home.
- The **boss** of each world holds a real Prism Core. World 4 holds two: the *Tide Core* in the
  Gray Heart (4-2) and the *Sunburst Core* inside the Graytide Mech (4-B).

## Characters

**Kai** — the player. A Squidkin rookie whose mantle cap and tentacle hair take the colour of the
chosen ink. Brave, a little goofy, says little but means it ("Colour isn't something you own. It's
something you share!"). Waves at the camera when a stage starts; cheers when it ends.

**Commodore Brine** — mantis shrimp, retired captain of the Splashguard. Captain's hat, a pale scar
across his carapace, stalk eyes, a magnificent white mustache and the fastest club-punch in the
sea (his knees disagree). Gruff, dry, secretly soft: calls Kai "sprout", claims every tear is
"salt" or "humidity". Beat Murkwell in a Turf Clash championship final thirty summers ago.
*Catchphrases:* "Not bad. Not good, either. But not bad." · "Back in my day…" · "Chin up, fins out."

**Pix** — glowing jellyfish, pirate-radio DJ and hacker, host of **PIX FM — the frequency Murk
can't mute**. Headphones, a boom mic and a blinking antenna. Chatty, punny, loud, loyal. Former
Murk Industries marketing intern who wrote the company jingle and has regretted it ever since.
Glows brighter when excited, redder when mad. *Sign-off:* "Stay glossy, Tidehaven!"

**Baron Murkwell** — anglerfish tycoon, CEO of Murk Industries. Top hat (the lure pokes out of the
crown), monocle, a jaw full of teeth and an Italian gray suit. Smug, theatrical, allergic to
sharing. **His lure glows when he gets angry** — dim when calm, warm when smug, blazing red when
furious. As a boy ("Little Mo") he loved colour; losing the championship to Brine soured him.
*Lines:* "Colour is a premium feature." · "Details." · "I'm keeping the hat."

**Foreman Dredge** — Murkwell's lieutenant and the biggest goon in the Murk Corps: tar-dark body,
glowing lime eyes, yellow hardhat with a headlamp, hi-vis vest, clipboard. Loves rules ("Safety
first! Then crushing."). Pilots **The Grinder** (1-B) and **The Bucketeer** (2-B), gets fired by
email in World 4, and helps Kai reach the Gray Heart. Ends the story as Murkwell's cheerful
community-service supervisor.

**Shelly** — hermit crab who runs **Shelly's Shell Shop** (the Armory). Sticker-covered spiral
shell, a wrench in her big claw, endless enthusiasm for upgrades. Sells upgrades for Pearls.

**Otto & Tilly** — sea-otter twins in referee stripes, judges of **Turf Clash**. Otto is loud and
absolute ("No crying!"), Tilly is precise and measures every square metre twice ("Crying is
permitted, Otto."). As junior referees they officiated the Brine vs Murkwell final.

**Murk P.A.** — the tinny public-address system of Murk Industries, announcing corporate nonsense
in every Murk facility ("Do not look directly at the colour.").

**The Murk Corps** — Gloopers, Shield Gloopers, Rollerbrutes, Buzzdrones, Snipe Eels, Bomblobs,
Murk Turrets and Murk Pods. Tar-bodied goons with hardhats and glowing eyes. Sloppy with pearls.

## Worlds

| World | Setting | Mood | Stages | Boss |
|---|---|---|---|---|
| 1 Brinewater Docks | piers, containers, cranes | sunset, salty, hopeful | 1-1 First Splash · 1-2 Container Crossing · 1-3 Crane Climb | **The Grinder** — Dredge's roller tank (Ember Core) |
| 2 Coral Heights | rooftops, skatepark, neon gardens | dusk, neon, playful | 2-1 Rooftop Rush · 2-2 Skatepark Sprawl · 2-3 Neon Gardens | **The Bucketeer** — Dredge's flying bucket mech (Coral Core) |
| 3 Murk Refinery | pipes, vats, conveyors | toxic night, smelly | 3-1 Sludge Lines · 3-2 Pipe Dream · 3-3 Vat Valley | **Sludge Serpent** — eel mech, remote-driven by Murkwell (Kelp Core) |
| 4 Murkwell Tower | the villain's spire | storm, final push | 4-1 The Ascent · 4-2 Gray Heart (Tide Core) | **Graytide Mech** — Baron Murkwell himself (Sunburst Core) |

Kit unlocks follow `KITS[*].unlock` in `weapons/base.js`: Wave Roller (1-2), Longshot (1-3),
Burst Popper (2-1), Slosh Bucket (2-2), Gatling Spinner (3-1), Swift Brush (3-2), Twin Dualies
(3-3). Brine recommends Turf Clash after World 1.

## Story arc (beats)

1. **Prologue (motion comic).** Tidehaven → the Wellspring and its five Cores → Murkwell's
   "colour is a premium feature" → the heist → the Graytide Engine → Kai sees the sky going gray →
   Brine drafts Kai → Pix goes on air.
2. **World 1.** Tutorial on the docks (paint, swim, climb, enemy ink, subs, specials). Crates,
   sponges and Rollerbrutes in the container yard; cranes, launch pads and Snipe Eels. Dredge and
   The Grinder guard the Ember Core. Murkwell hijacks PIX FM for the first time.
3. **World 2.** Coral Heights has been "upgraded to Tasteful Beige". Ink rails over the rooftops,
   balloon gates in the skatepark (Pix learned to kickflip there), switches and Murk barriers in
   the Neon Gardens. Dredge returns, "failed upward", in The Bucketeer. Murkwell summons him.
4. **World 3.** The Refinery makes the goop. Murk Pods, conveyors, pipe mazes, sponge bridges over
   vats. Murkwell drives the Sludge Serpent from his comfy office chair; it turns out he cancelled
   the insurance.
5. **World 4.** The storm climb up Murkwell Tower. Dredge is fired by email and switches sides,
   leading Kai through the back way into the Gray Heart (Tide Core). On the roof Murkwell reveals
   his grudge (the lost final) and fights in the Graytide Mech. Kai: "Colour isn't something you
   own. It's something you share!"
6. **Ending (motion comic).** The Mech falls; the Cores return; the Wellspring floods Tidehaven with
   colour; Murkwell is sentenced to repaint every wall he grayed — with a brush (Dredge brings him
   a smaller one, for the corners); Brine gives Kai his old Splashguard badge; Pix signs off.
7. **Credits** roll over an ink-painting montage, then the **post-credits tease**: something
   enormous opens one glowing eye far below the Wellspring, and Pix's radio picks up a signal from
   under the ocean.

### Lost Postcards (one per stage)

Fifteen collectible postcards tell the back-story in miniature: the dock kids, Pix's first
kickflip ("P."), Otto & Tilly as junior refs, Pix's intern welcome packet, Dredge's Employee of the
Month card, Murkwell's unsent apology to Brine ("M."), and finally a crayon drawing by "Little Mo,
age 6" — the boy who loved colour. The defaults live in `POSTCARDS` (script.js); a level's
`postcard` entity may override `title`/`text`.

## Integration notes (for level, boss and UI authors)

- Mid-stage beats: place `trigger` entities with `dialogue: '<id>'` using the ids below (e.g.
  `'w1-1.swim'`). Ids whose entry is marked **radio** play as non-blocking chatter (bottom-left,
  auto-advancing, player keeps control); the others are conversations (world pauses, 'advance'
  continues, 'skip' ends the conversation).
- NPCs: `{ type: 'npc', who, dialogue: 'npc.<who>' | [lines] | ['id1', 'id2'], idle: 'wave' }`.
- Bosses: emit `session.events.emit('bossDefeated', { id })` → StoryMode slows time, then runs the
  clear sequence. Optionally `session.events.emit('bossPhase', { phase: 2 })` plays
  `'<stage>.phase2'`; `'<stage>.hint'` is available for tutorials. Boss models can reuse
  `makeNpcModel('dredge' | 'murkwell')` from `entities/npc/models.js`.
- `session.mode.cutscene(async (cs) => { … })` gives camera moves, letterbox, `cs.say`,
  `cs.spawn(who, pos, yaw)`, `cs.move`, `cs.emote`, `cs.shake`, `cs.fade` (see story/cutscene.js).
- Speaker colours and voices: `SPEAKERS` in script.js (voice = `{ pitch, formant, wave }` for
  `audio.blip`).
- Music ids requested by the story: `docks`, `heights`, `refinery`, `tower`, `boss`, `finale`.


---

# Script

## Speakers

| id | name | colour | voice (pitch / formant / wave) |
|---|---|---|---|
| `brine` | Commodore Brine | #3fd6bd | 118 / 0.78 / sawtooth |
| `pix` | Pix | #ff5fd2 | 430 / 1.28 / square |
| `kai` | Kai | hero ink | 320 / 1.12 / triangle |
| `murkwell` | Baron Murkwell | #a77bff | 92 / 0.7 / sawtooth |
| `dredge` | Foreman Dredge | #ffb52e | 76 / 0.62 / square |
| `shelly` | Shelly | #ff8fae | 290 / 1.15 / triangle |
| `otto` | Otto | #ffd23f | 190 / 0.95 / square |
| `tilly` | Tilly | #7ee08f | 350 / 1.2 / triangle |
| `pa` | Murk P.A. | #b4addb | 150 / 0.85 / square |
| `kid` | Squidkin Kid | #8fe3ff | 380 / 1.25 / triangle |
| `narrator` | — | #ffe14d | — |

## Prologue (motion comic)

### Panel 1 — `lighthouse`

- _Narrator_: Tidehaven. A city on the edge of the sea, where every wall is a canvas and every kid is a little bit squid.

### Panel 2 — `wellspring`

- _Narrator_: Deep beneath the old lighthouse, the Prism Wellspring pours colour into every street, every mural, and every drop of Squidkin ink.
- _Narrator_: Five Prism Cores keep it shining: Ember, Coral, Kelp, Tide and Sunburst.

### Panel 3 — `murkwell`

- _Narrator_: But not everyone thinks colour should be free.
- **Baron Murkwell** _(smug)_: Free? FREE?! Nothing worth having is free, darling. Colour is a *premium feature*.

### Panel 4 — `heist`

- _Narrator_: One stormy night, Murk Industries drilled into the Wellspring and ripped out all five Prism Cores.

### Panel 5 — `engine`

- **Baron Murkwell** _(smug)_: With the Cores powering my Graytide Engine, Tidehaven will drown in lovely, sensible Murk.
- **Baron Murkwell** _(laugh)_: And then I'll sell the colour back. By the bottle. With a monthly subscription!

### Panel 6 — `kai`

- _Narrator_: Meanwhile, down at Brinewater Docks, a rookie named Kai was about to have a very big day.
- **Kai** _(worried)_: Huh? Why is the sky going... gray?

### Panel 7 — `brine`

- **Commodore Brine**: You there! Sprout! You've got ink in your veins and fire in your fins.
- **Commodore Brine** _(smug)_: Tidehaven needs a Splashguard. Congratulations: you're it.
- **Kai** _(shock)_: Me?!
- **Commodore Brine**: Don't make me say it twice. My knees can't take the drama.

### Panel 8 — `pix`

- **Pix** _(happy)_: And I'm Pix, coming at you live on PIX FM, the frequency Murk can't mute!
- **Pix** _(laugh)_: I'll be in your ear the whole way, rookie. Let's paint this town back!

## World 1 — Brinewater Docks

_Piers, containers & cranes at sunset_ · theme `docks`

### 1-1 · First Splash (`w1-1`)

_Every legend starts with a puddle._

- **Objective:** Crack open the Prism Capsule at the end of the pier
- **Par (rank S):** 3:30 · **Music:** `docks`

**Intro**

- **Pix** _(happy)_: Testing, testing... is this thing on? PIX FM, the frequency Murk can't mute! And today we have a very special guest: a brand-new Splashguard!
- **Commodore Brine**: Recruit. Singular. And barely. Let's see what you're made of, sprout.
- **Kai** _(determined)_: Ready when you are, Commodore!
- **Commodore Brine**: Murk Industries bottled up this dock's colour and locked it in a *Prism Capsule* at the end of the pier. Crack it, and the colour comes home.
- **Pix** _(laugh)_: Easy peasy, squeezy lemon. Well... squeezy tangerine. You'll see.

**Mid-stage beats** (trigger dialogue ids)

`w1-1.move`

- **Commodore Brine**: First things first. Walk with WASD or the left stick. Look around with the mouse or the right stick.
- **Commodore Brine**: Jump with [jump]. Squidkin kids are bouncy. It's a whole thing.

`w1-1.shoot`

- **Commodore Brine**: That's your Splash Blaster. Hold [fire] to paint. The ground, the walls: everything you ink is yours.
- **Pix** _(happy)_: Aim with the crosshair! And don't worry about waste. There's no such thing as too much ink.

`w1-1.swim`

- **Commodore Brine**: Now the good part. Hold [swim] to turn squid and dive into your ink. You'll swim faster than any kid can run.
- **Pix** _(laugh)_: And your tank refills while you swim! Science! Or magic. Mostly vibes.

`w1-1.refill` — radio

- **Pix**: Tank running dry? Dive into your ink with [swim] and it'll top right up!

`w1-1.climb`

- **Commodore Brine**: See that wall? Paint it. Then hold [swim] and swim straight up it. Squidkin don't take the stairs.

`w1-1.jump` — radio

- **Commodore Brine**: Press [jump] while swimming for a squid leap. Higher than a kid jump, and twice as stylish.

`w1-1.enemy-ink` — radio

- **Pix** _(worried)_: Ew, purple goop! That's Murk ink. It slows you down and nibbles your health. Paint over it!

`w1-1.gloopers`

- **Commodore Brine** _(angry)_: Gloopers! Murk Corps grunts. They hit like wet noodles, but there are a LOT of noodles. Splat 'em!
- **Pix**: Crosshair on target, hold [fire], and stay out of their goop!

`w1-1.sub`

- **Commodore Brine**: Your kit comes with a Burst Bomb. Throw it with [sub]. It costs a big gulp of ink, so pick your moment.

`w1-1.special`

- **Pix** _(happy)_: Every bit of turf you paint charges your special. When the gauge is full, hit [special] for a Tidal Slam!
- **Pix** _(smug)_: Warning: extremely cool.

`w1-1.checkpoint` — radio

- **Pix**: That flag is a checkpoint! Touch it, and if you get splatted you'll pop back right there.

`w1-1.capsule`

- **Commodore Brine** _(determined)_: There she is. The Prism Capsule. Shoot it until it cracks!

**Outro**

- **Pix** _(happy)_: WOOO! Did you see that? The whole pier just went technicolour!
- **Commodore Brine**: Hmph. Not bad. Not good, either. But not bad.
- **Pix** _(laugh)_: That's Brine for "I'm so proud I could cry."
- **Commodore Brine** _(worried)_: I have something in my eye. It's salt. We live in the sea.

**Lost Postcard — "Greetings from Brinewater!"** (from Juno): Wish you were here! The sunsets turn the whole harbour tangerine. Grandpa says the colour comes up from under the old lighthouse. I think he's pulling my tentacle.

### 1-2 · Container Crossing (`w1-2`)

_A maze of steel boxes and sneaky corners._

- **Objective:** Cross the container yard and reach the Prism Capsule
- **Par (rank S):** 4:00 · **Music:** `docks` · **Unlocks:** `wave-roller`

**Intro**

- **Pix** _(worried)_: Good morning, Brinewater! It's a gray and gloomy day... and that's not the weather. That's Murk Industries.
- **Pix** _(happy)_: Today's forecast: a hundred percent chance of rookie! Kai is heading into the container yard!
- **Commodore Brine**: Murk stacks its stolen goods in these boxes. Watch the corners. Gloopers love a good ambush.
- **Kai** _(determined)_: Corners. Got it. Watching them.

**Mid-stage beats** (trigger dialogue ids)

`w1-2.sponge`

- **Pix**: See that squishy block? It's a sponge! Paint it with your ink and it puffs up into a platform.
- **Pix**: Murk ink shrinks it right back down, so keep it glossy!

`w1-2.shield` — radio

- **Commodore Brine**: Shield Glooper. That plate stops ink cold. Hit it from the side, or lob a bomb over the top.

`w1-2.crates` — radio

- **Pix** _(laugh)_: Crates! Smash 'em for pearls. Pearls buy upgrades at Shelly's shop. It's called economics, baby!

`w1-2.rollerbrute` — radio

- **Commodore Brine** _(angry)_: Rollerbrute! When it revs up, get out of its lane. Then paint its back.

`w1-2.pa` — radio

- **Murk P.A.**: ATTENTION EMPLOYEES. Unauthorized colour has been spotted in Yard C. Do not look directly at the colour.

**Outro**

- **Pix** _(happy)_: Capsule cracked! And look what fell out: a *Wave Roller*! Somebody at Murk HQ is getting a very angry memo.
- **Commodore Brine** _(smug)_: A roller. Now we're talking. Back in my day I rolled a lane from here to the lighthouse. Uphill. Both ways.
- **Pix**: The lighthouse is downhill from here, Commodore.
- **Commodore Brine**: Not the way I rolled it.

**Lost Postcard — "Container Yard C"** (from A dockworker): Found a crate full of rubber ducks. Did not report it. The ducks are mine now. All 400 of them.

### 1-3 · Crane Climb (`w1-3`)

_Up, up, and don't look down._

- **Objective:** Climb the cranes to the Prism Capsule
- **Par (rank S):** 4:30 · **Music:** `docks` · **Unlocks:** `longshot`

**Intro**

- **Pix**: Kai, look up. Way up. See that crane? The capsule is dangling off the very top.
- **Kai** _(worried)_: ...How high is that?
- **Commodore Brine**: High enough to be interesting. Paint the walls and climb. And mind the Snipe Eels: you'll see their laser before you see them.
- **Pix** _(shock)_: Pro tip: if a red line is pointing at you... MOVE.

**Mid-stage beats** (trigger dialogue ids)

`w1-3.launchpad`

- **Pix** _(happy)_: That's a squid launch pad! Swim onto it as a squid and press [jump]. You'll be yeeted to the next crane.
- **Pix** _(smug)_: "Yeeted" is the technical term.

`w1-3.mover` — radio

- **Commodore Brine**: Moving platform. Time your jump. Or don't, and swim home from the bottom of the harbour.

`w1-3.sniper` — radio

- **Pix** _(shock)_: Red laser! Snipe Eel on the crane! Duck behind something and paint your way closer!

`w1-3.halfway` — radio

- **Commodore Brine**: Halfway there. Don't look down.
- **Commodore Brine**: ...You looked down, didn't you.

`w1-3.pa` — radio

- **Murk P.A.**: REMINDER: Crane safety is everyone's responsibility. Please do not let the squid climb the crane.

**Outro**

- **Pix** _(happy)_: Look at that view! You can see the whole harbour! And the *Longshot* you just liberated!
- **Commodore Brine**: A charger. Patience in a pipe. Hold still, breathe out, and splat 'em from across the bay.
- **Pix** _(worried)_: Oh. Uh, guys? My scanner is picking up something big at the end of the docks. Like, "rolls over cars" big.
- **Commodore Brine** _(angry)_: Dredge. Should've known.

**Lost Postcard — "View from the Crane"** (from Kip, age 9): You can see the whole city from up here! The lighthouse! The skatepark! My house! HI MOM!

### 1-B · The Grinder (`w1-boss`)

_Foreman Dredge and his roller tank._

- **Objective:** Stop The Grinder and free the Ember Core
- **Par (rank S):** 3:00 · **Music:** `boss` · **Boss:** `boss-grinder` · **Core:** Ember Core

**Intro**

- **Foreman Dredge** _(angry)_: HALT! This dock is a Murk Industries work zone! Hardhats required! Colour prohibited!
- **Kai** _(determined)_: You've got something that doesn't belong to you.
- **Foreman Dredge** _(smug)_: What, this? The Ember Core? It's company property now. Says so on the sticker.
- **Pix** _(shock)_: He put a STICKER on a PRISM CORE?!
- **Foreman Dredge** _(angry)_: Time to flatten you like a pancake. A GRAY pancake. Fire up The Grinder!
- **Commodore Brine**: Kid, rollers can't turn fast. Get behind it and paint its engine!

**Mid-stage beats** (trigger dialogue ids)

`w1-boss.phase2` — radio

- **Foreman Dredge** _(angry)_: Hey! You scratched the paint! ...Wait, we don't HAVE paint. You scratched the GRAY!
- **Pix**: He's getting mad! Keep moving, Kai!

`w1-boss.phase3` — radio

- **Foreman Dredge** _(angry)_: Full throttle! Safety regulations are more of a suggestion anyway!

`w1-boss.hint` — radio

- **Commodore Brine**: Its engine is on the back! Get behind it!

**Outro**

- **Foreman Dredge** _(sad)_: My Grinder! I'm gonna have to fill out SO many forms...
- **Foreman Dredge** _(worried)_: This isn't over, squid! The Baron's gonna hear about this! ...I mean, I'll tell him. Nicely. With a card.
- **Pix** _(laugh)_: The *Ember Core* is ours! One down, four to go! Somebody play an air horn!
- **Baron Murkwell** _(smug)_: Ahem. Is this "the frequency Murk can't mute"? Adorable. I own the building your antenna is on.
- **Baron Murkwell** _(smug)_: Baron Murkwell, CEO of Murk Industries. You took one little Core, little squid. I have four more, and an Engine that is very, very hungry.
- **Baron Murkwell** _(smug)_: Enjoy your colour while it lasts. Soon it will be premium content.
- **Pix** _(angry)_: He hacked my show! Nobody hacks my show! I'M the hacker on this show!
- **Commodore Brine**: Proud of you, sprout. Don't let it go to your head. Coral Heights is next.
- **Commodore Brine**: And if you want practice, Otto and Tilly are running *Turf Clash* matches down at the plaza.
- **Kai** _(happy)_: Turf Clash? Sign me up!

**Lost Postcard — "Championship Tickets"** (from Aunt Marlo): Got us two seats for the Turf Clash Final! Young Brine versus that fancy anglerfish kid. My money's on the shrimp.

## World 2 — Coral Heights

_Rooftops, skateparks & neon gardens at dusk_ · theme `heights`

### 2-1 · Rooftop Rush (`w2-1`)

_Rails over the rooftops._

- **Objective:** Race across the rooftops to the Prism Capsule
- **Par (rank S):** 4:00 · **Music:** `heights` · **Unlocks:** `burst-popper`

**Intro**

- **Pix** _(happy)_: Welcome to Coral Heights, the coolest neighbourhood in Tidehaven! Rooftop gardens, skate spots, neon everything...
- **Pix** _(sad)_: ...or it WAS. Now it's all beige. BEIGE, Kai.
- **Commodore Brine**: Murk has drones patrolling the rooftops. Stay low, move fast, and use those ink rails.
- **Kai** _(determined)_: Rooftops. Rails. Drones. Got it!

**Mid-stage beats** (trigger dialogue ids)

`w2-1.rail`

- **Pix** _(happy)_: Ink rail ahead! Shoot the start to switch it on, then swim onto it as a squid and ride!
- **Pix** _(laugh)_: Screaming "wheee" is optional but strongly encouraged.

`w2-1.drones` — radio

- **Commodore Brine**: Buzzdrones. They drop bombs from above. Look up and paint 'em out of the sky.

`w2-1.gap` — radio

- **Pix**: Big gap! Squid leap with [jump] out of your ink for extra height!

`w2-1.pa` — radio

- **Murk P.A.**: Good afternoon, Coral Heights. Your neighbourhood has been upgraded to Tasteful Beige. You're welcome.

**Outro**

- **Pix** _(laugh)_: Capsule popped! And you snagged a *Burst Popper*! Big, slow, SPLASHY shots. Like water balloons, but legal.
- **Commodore Brine**: Blasters splash around corners. Handy against anyone hiding behind a wall. Which, in my experience, is everyone.

**Lost Postcard — "Rooftop Garden"** (from Grandma Peb): Planted tomatoes on the roof. The seagulls are winning. I have a plan. The plan is a bigger hat.

### 2-2 · Skatepark Sprawl (`w2-2`)

_Grind, splat, repeat._

- **Objective:** Pop the balloons, open the gates, crack the Prism Capsule
- **Par (rank S):** 4:30 · **Music:** `heights` · **Unlocks:** `slosh-bucket`

**Intro**

- **Pix** _(happy)_: Oh, Kai. The Coral Heights Skatepark. I learned to kickflip here. I also learned what a sprained tentacle is here.
- **Commodore Brine**: Murk locked the park with balloon gates. Pop every balloon and the gate opens.
- **Kai** _(happy)_: Popping balloons? Best mission ever.
- **Pix**: Watch out for Bomblobs! They lob bombs in big arcs. Keep moving and you're golden.

**Mid-stage beats** (trigger dialogue ids)

`w2-2.balloons`

- **Pix** _(happy)_: See the balloons? Pop 'em ALL and the gate opens. It's like a party, but splashier.

`w2-2.spring` — radio

- **Pix** _(laugh)_: Bounce pad! Step on it for a big BOING!

`w2-2.bomblob` — radio

- **Commodore Brine**: Bomblob up top. When you see the arc, sidestep. Then return the favour.

`w2-2.halfpipe`

- **Kai** _(happy)_: Whoa, a halfpipe! ...Is there time for one run?
- **Commodore Brine**: No.
- **Pix** _(smug)_: ...Maybe one.

**Outro**

- **Pix** _(happy)_: Look at that park! It's GLOWING! And you found a *Slosh Bucket*: it throws ink over walls like a big splashy frisbee!
- **Commodore Brine**: Buckets. In my day we just called it "throwing things." Good for grunts up on ledges.

**Lost Postcard — "Skatepark Opening Day"** (from P.): Landed my first kickflip today!! Also my first faceplant. Totally worth it. Someday I'll have my own radio show and I'll talk about it forever.

### 2-3 · Neon Gardens (`w2-3`)

_Lights out in the flower beds._

- **Objective:** Flip the switches, drop the Murk barriers, reach the Prism Capsule
- **Par (rank S):** 5:00 · **Music:** `heights`

**Intro**

- **Pix** _(sad)_: The Neon Gardens. On a normal night, every flower here glows. Tonight... nothing. Murk is sucking the colour right out of the petals.
- **Commodore Brine**: Murk barriers everywhere. Splat the grunts powering one and it fizzles. Switches open the gates, so shoot 'em.
- **Kai** _(determined)_: I'll bring the glow back. Promise.
- **Pix** _(happy)_: Aww. Brine, did you hear that? I'm not crying, YOU'RE crying.
- **Commodore Brine**: Nobody is crying. It's humid.

**Mid-stage beats** (trigger dialogue ids)

`w2-3.switch`

- **Pix**: See the target with the Murk logo? That's a switch. Shoot it and a gate opens!

`w2-3.barrier` — radio

- **Commodore Brine**: Murk barrier. Can't shoot through it, can't swim through it. Splat the grunts powering it and it drops.

`w2-3.turret` — radio

- **Pix** _(smug)_: Turret! It can't move, so flank it. Rude, but effective.

`w2-3.pa` — radio

- **Murk P.A.**: Reminder: flowers are a non-essential colour. Please report glowing plants to your supervisor.

**Outro**

- **Pix** _(laugh)_: The flowers are glowing again! Kai, you're a hero! A GARDENING hero!
- **Commodore Brine**: Stay sharp. My nose says the Bucketeer is circling the Heights. Nasty flying contraption.
- **Pix**: Your NOSE says that?
- **Commodore Brine** _(smug)_: My nose has been right for forty years.

**Lost Postcard — "The Neon Gardens"** (from Wren): Every flower glows a different colour at night. The gardener says they drink from the same spring we do.

### 2-B · The Bucketeer (`w2-boss`)

_A flying bucket with a bad attitude._

- **Objective:** Ground The Bucketeer and free the Coral Core
- **Par (rank S):** 3:30 · **Music:** `boss` · **Boss:** `boss-bucketeer` · **Core:** Coral Core

**Intro**

- **Foreman Dredge** _(happy)_: Surprise! It's me, Foreman Dredge! Well, AERIAL Foreman Dredge now. I got a promotion!
- **Pix** _(shock)_: They PROMOTED you? After you LOST?
- **Foreman Dredge**: The Baron says I "failed upward." That's good, right? Up is good.
- **Foreman Dredge** _(smug)_: Behold: The Bucketeer! It sloshes! It flies! It has a cupholder!
- **Commodore Brine**: Flyers have to come down to refill. When it dips low, hit it with everything you've got.

**Mid-stage beats** (trigger dialogue ids)

`w2-boss.phase2` — radio

- **Foreman Dredge** _(angry)_: Ow! Hey! This thing is a RENTAL!

`w2-boss.phase3` — radio

- **Foreman Dredge** _(worried)_: Engage turbo slosh! ...Which button is turbo slosh?
- **Pix** _(laugh)_: Not that one! Definitely not that one!

`w2-boss.hint` — radio

- **Commodore Brine**: It dips low to refill! That's your window!

**Outro**

- **Foreman Dredge** _(sad)_: Crash-landed... again. You know, my mom was right. I should've been a florist.
- **Pix** _(happy)_: The *Coral Core*! Two down! Coral Heights is back to being the coolest block in town!
- **Baron Murkwell** _(angry)_: Dredge. My office. Now.
- **Foreman Dredge** _(worried)_: Coming, Baron! ...Bye, squid. You're actually pretty good. Don't tell anyone I said that.
- **Commodore Brine**: Next stop: the Murk Refinery. That's where they make the goop. It's going to smell.
- **Kai** _(worried)_: How bad?
- **Commodore Brine**: Bring a nose plug. Bring two.

**Lost Postcard — "Congratulations, Champion!"** (from Otto & Tilly (junior referees)): To Brine: best final we ever reffed! PS: please tell that anglerfish kid to stop sulking under the bleachers.

## World 3 — Murk Refinery

_Pipes, vats & conveyors on a toxic night_ · theme `refinery`

### 3-1 · Sludge Lines (`w3-1`)

_Conveyor belts of pure gloom._

- **Objective:** Shut down the sludge lines and reach the Prism Capsule
- **Par (rank S):** 4:30 · **Music:** `refinery` · **Unlocks:** `gatling-spinner`

**Intro**

- **Pix** _(laugh)_: Welcome to the Murk Refinery, where the goop gets made. Kai, try not to touch anything. Actually no: touch EVERYTHING. With ink.
- **Murk P.A.**: Welcome, visitors! The Refinery is proud to be Tidehaven's number one producer of gray. Please enjoy the smell.
- **Kai** _(worried)_: ...It really does smell.
- **Commodore Brine**: Murk Pods keep spitting out fresh Gloopers. Pop the pods first or you'll be fighting all day.

**Mid-stage beats** (trigger dialogue ids)

`w3-1.pods`

- **Commodore Brine** _(angry)_: That's a Murk Pod. Every few seconds: pop, fresh Glooper. Take it out first.

`w3-1.conveyor` — radio

- **Pix**: Conveyor belts! They'll carry you along. Or carry you away. Mind the edges!

`w3-1.vent` — radio

- **Pix** _(worried)_: Hot tip, literally: stay out of the steam!

**Outro**

- **Pix** _(happy)_: *Gatling Spinner* acquired! Spin it up and let it RIP!
- **Commodore Brine**: Spinners need a moment to charge. Find cover, spin up, then hose the whole room.

**Lost Postcard — "Welcome, New Intern!"** (from Murk Industries HR): Your first assignment: write a catchy jingle about the colour gray. Enthusiasm is mandatory. Snacks are not provided.

### 3-2 · Pipe Dream (`w3-2`)

_A maze of pipes, rails and launch pads._

- **Objective:** Navigate the pipe works to the Prism Capsule
- **Par (rank S):** 5:00 · **Music:** `refinery` · **Unlocks:** `swift-brush`

**Intro**

- **Pix** _(worried)_: Okay, so I hacked the refinery blueprints. Good news: the capsule is in the pipe works. Bad news: the pipe works were designed by a very angry octopus.
- **Commodore Brine**: Ink rails and launch pads everywhere. Keep your momentum.
- **Kai** _(determined)_: Momentum. That's my middle name.
- **Pix** _(happy)_: Your middle name is Momentum? Cool. Mine's Wavelength.

**Mid-stage beats** (trigger dialogue ids)

`w3-2.pipes` — radio

- **Pix**: The pipes are paintable on the outside! Ink 'em and climb right over!

`w3-2.rail` — radio

- **Pix** _(laugh)_: Rail express! All aboard the Kai-line!

`w3-2.lost` — radio

- **Commodore Brine**: Lost? Follow the pearls. Murk grunts drop 'em everywhere. Sloppy lot.

**Outro**

- **Pix** _(happy)_: A *Swift Brush*! Paint while you dash! It's like skateboarding, but YOU are the paint!
- **Commodore Brine**: Brushes are for the brave. Get close, stay fast, never stop moving.

**Lost Postcard — "Lost in the Pipes"** (from A very lost Glooper): Day 3 in the pipe works. I have named all the pipes. Gary is my favourite. Gary does not talk back.

### 3-3 · Vat Valley (`w3-3`)

_Whatever you do, don't fall in._

- **Objective:** Cross the vats and reach the Prism Capsule
- **Par (rank S):** 5:00 · **Music:** `refinery` · **Unlocks:** `twin-dualies`

**Intro**

- **Pix** _(worried)_: Vat Valley. Giant tanks of liquid Murk as far as the eye can see. Don't fall in. I'm serious. You'd come out beige.
- **Commodore Brine**: Sponges will get you over the vats. Keep 'em inked or they shrink.
- **Kai**: Keep the sponges puffy. Got it.

**Mid-stage beats** (trigger dialogue ids)

`w3-3.vats` — radio

- **Pix** _(worried)_: Liquid Murk below! Falling in means a trip back to the checkpoint!

`w3-3.sponge` — radio

- **Commodore Brine**: Sponge bridge. Ink it big, cross fast.

`w3-3.pa` — radio

- **Murk P.A.**: Attention: the Serpent is sleeping. Please keep squids to a minimum.

**Outro**

- **Pix** _(laugh)_: *Twin Dualies*! Two blasters! Dodge rolls! You're basically an action movie now!
- **Commodore Brine**: Dualies keep you slippery. Never stand still, never stop shooting.
- **Pix** _(shock)_: Uh-oh. Seismic readings from the big vat. Something long and slithery is waking up...
- **Commodore Brine** _(angry)_: The Sludge Serpent. Murkwell's pride and joy.

**Lost Postcard — "Employee of the Month"** (from Murk Industries): Congratulations, Dredge! Twelve years without a single colour incident. Your prize: this postcard.

### 3-B · Sludge Serpent (`w3-boss`)

_An eel mech in a sea of sludge._

- **Objective:** Defeat the Sludge Serpent and free the Kelp Core
- **Par (rank S):** 4:00 · **Music:** `boss` · **Boss:** `boss-serpent` · **Core:** Kelp Core

**Intro**

- **Baron Murkwell** _(smug)_: Well, well. The little squid who keeps breaking my things.
- **Baron Murkwell** _(smug)_: I have decided to handle this personally. From my office. In my very comfortable chair.
- **Kai** _(determined)_: Scared to come down here yourself?
- **Baron Murkwell** _(angry)_: Scared? I am BUSY. I have shareholders. Serpent: make this squid go away.
- **Commodore Brine**: It surfaces to strike. Paint its weak spots when it rears up!

**Mid-stage beats** (trigger dialogue ids)

`w3-boss.phase2` — radio

- **Baron Murkwell** _(angry)_: Do you have ANY idea how much that armour cost?

`w3-boss.phase3` — radio

- **Baron Murkwell** _(angry)_: Fine. FINE. Serpent: maximum sludge!

`w3-boss.hint` — radio

- **Commodore Brine**: Weak spots light up when it rears back! Paint 'em!

**Outro**

- **Baron Murkwell** _(angry)_: My Serpent! My beautiful, expensive Serpent! Dredge! Who is paying for this?!
- **Foreman Dredge** _(worried)_: Uh... insurance, sir?
- **Baron Murkwell** _(angry)_: We CANCELLED the insurance to save money!
- **Foreman Dredge**: ...Then, uh. You, sir.
- **Pix** _(happy)_: The *Kelp Core*! Three down! Can you hear that? That's the sound of the Refinery shutting down!
- **Commodore Brine** _(worried)_: Only one place left. Murkwell Tower. Kid... it's going to be rough up there.
- **Kai** _(determined)_: I've got this. WE'VE got this.
- **Commodore Brine**: ...Yeah. We do.

**Lost Postcard — "A Letter, Never Sent"** (from M.): Dear Brine. I'm sorry I threw my trophy in the harbour. And your trophy. And the referee's whistle. You were better. There. I said it. Now I'll never send this.

## World 4 — Murkwell Tower

_The villain's spire in the storm_ · theme `tower`

### 4-1 · The Ascent (`w4-1`)

_Climb the spire. Brave the storm._

- **Objective:** Scale Murkwell Tower
- **Par (rank S):** 5:30 · **Music:** `tower`

**Intro**

- **Pix**: This is it, Kai. Murkwell Tower. Tallest, grayest building in Tidehaven. The Graytide Engine is at the very top.
- **Commodore Brine**: Storm's rolling in. Wind's up, visibility's down, and every grunt Murk ever hired is between you and the roof.
- **Kai** _(determined)_: Then I'll paint my way through every single one.
- **Pix** _(happy)_: Okay, that was SO cool. I'm putting that on a t-shirt.

**Mid-stage beats** (trigger dialogue ids)

`w4-1.storm` — radio

- **Pix** _(worried)_: Wind gusts on the outer walls! Hug the tower!

`w4-1.halfway` — radio

- **Commodore Brine**: Halfway up. My old knees hurt just watching you.

`w4-1.pa` — radio

- **Murk P.A.**: ALERT. A squid is climbing the tower. All employees: act natural.

`w4-1.dredge`

- **Foreman Dredge** _(worried)_: Psst! Over here! Don't splat me, I'm unemployed!
- **Foreman Dredge** _(sad)_: I left the service door unlocked for you. Don't tell the Baron. Not that he'd listen. He never listens.

**Outro**

- **Pix** _(shock)_: You made the upper floors! Oh, and I intercepted a memo. Dredge got fired. Replaced by a robot. "Cost cutting."
- **Kai** _(sad)_: That's... actually kind of sad.
- **Foreman Dredge** _(sad)_: It IS sad. Hi. It's me. FORMER Foreman Dredge.
- **Foreman Dredge** _(sad)_: The Baron fired me by email. EMAIL. After twelve years.
- **Foreman Dredge**: The Tide Core is in the Gray Heart, the Engine's core room. I know the back way in. ...If you want.
- **Commodore Brine**: Can we trust him?
- **Pix**: He cried on my frequency for ten minutes straight. I think we can trust him.

**Lost Postcard — "Murkwell Tower Grand Opening"** (from The Management): The tallest building in Tidehaven! Beautifully gray! Please remember to wipe your fins.

### 4-2 · Gray Heart (`w4-2`)

_The core chamber of the Graytide Engine._

- **Objective:** Reach the Tide Core in the Gray Heart
- **Par (rank S):** 5:30 · **Music:** `tower` · **Core:** Tide Core

**Intro**

- **Foreman Dredge**: Welcome to the Gray Heart. The Tide Core is right in the middle, powering half the Engine.
- **Foreman Dredge**: The Baron changed all the locks. And the guards. And the password. It WAS "password." Now it's "password2."
- **Pix** _(smug)_: Great security, Murk Industries. Truly world-class.
- **Commodore Brine**: Slow and steady, sprout. Go get that Core.

**Mid-stage beats** (trigger dialogue ids)

`w4-2.engine` — radio

- **Pix**: The Engine's shielding is Murk-powered. Clear the grunts and it drops!

`w4-2.heart` — radio

- **Foreman Dredge** _(happy)_: The core room is straight ahead! Go, squid, go!

`w4-2.pa` — radio

- **Murk P.A.**: Warning: Engine pressure at... ninety... uh... someone please check the Engine pressure.

**Outro**

- **Pix** _(happy)_: THE *TIDE CORE*! Four! FOUR CORES! Kai, the Engine is sputtering!
- **Baron Murkwell** _(angry)_: ENOUGH!
- **Baron Murkwell** _(angry)_: You have cost me four Cores, one Grinder, one Bucketeer, one Serpent, and a perfectly good foreman.
- **Foreman Dredge** _(angry)_: You FIRED me!
- **Baron Murkwell** _(smug)_: Details.
- **Baron Murkwell** _(smug)_: Come up to the roof, little squid. The Sunburst Core powers my masterpiece. If you want it... come and take it.
- **Commodore Brine**: Kai. Whatever happens up there, I'm proud of you. Now go splat that fish.

**Lost Postcard — "A Crayon Drawing"** (from Little Mo, age 6): This is me and my dad at the beach. The sun is orange. The sea is blue. The sand is yellow. Everything has a colour and it is my favourite.

### 4-B · Graytide Mech (`w4-boss`)

_Baron Murkwell's final masterpiece._

- **Objective:** Defeat Baron Murkwell and free the Sunburst Core
- **Par (rank S):** 5:00 · **Music:** `finale` · **Boss:** `boss-murkwell` · **Core:** Sunburst Core

**Intro**

- **Baron Murkwell** _(smug)_: Behold! The Graytide Mech! Powered by the Sunburst Core, the brightest colour in the whole Wellspring!
- **Baron Murkwell** _(angry)_: Do you know WHY I do this, squid? Thirty summers ago I lost the Turf Clash championship. To HIM.
- **Commodore Brine**: You lost because you spent the whole final polishing your lure, Murky.
- **Baron Murkwell** _(angry)_: DON'T CALL ME MURKY! Colour was unfair then and it's unfair now. So I'll own ALL of it!
- **Kai** _(determined)_: Colour isn't something you own. It's something you share!
- **Pix** _(happy)_: Aaand that's going on the t-shirt too. GO GET HIM, KAI!

**Mid-stage beats** (trigger dialogue ids)

`w4-boss.phase2` — radio

- **Baron Murkwell** _(angry)_: You are ruining my suit! This is ITALIAN gray!

`w4-boss.phase3` — radio

- **Baron Murkwell** _(angry)_: All power to the Mech! If I can't have colour, NOBODY CAN!
- **Commodore Brine**: Hang in there, sprout! He's running on fumes!

`w4-boss.hint` — radio

- **Pix**: The Sunburst Core is in the chest! Hit it when the armour opens!

**Outro**

- **Baron Murkwell** _(sad)_: No... no, no, no. My Mech. My Engine. My beautiful, beautiful gray...
- **Kai** _(determined)_: It's over, Murkwell.
- **Baron Murkwell** _(sad)_: ...Fine. But I'm keeping the hat.
- **Pix** _(laugh)_: THE *SUNBURST CORE*! ALL FIVE CORES! KAI, YOU DID IT!
- **Commodore Brine** _(happy)_: Let's bring 'em home, sprout.

**Lost Postcard — "From the Lighthouse Keepers"** (from The Keepers of the Wellspring): To whoever brings the colour home: thank you. Tidehaven will remember.

## NPC & generic lines

`npc.brine`

- **Commodore Brine**: Stretch before you swim, sprout. Take it from an old shrimp with older knees.
- **Commodore Brine** _(worried)_: Thirty summers I kept the Wellspring safe. Now it's your turn. ...Don't tell anyone I said that sappy thing.

`npc.pix`

- **Pix** _(worried)_: Wanna request a song? I only have one record. It's the Murk Industries jingle. I wrote it when I was their intern.
- **Pix** _(sad)_: I am NOT proud of it. It's very catchy. That's the worst part.

`npc.shelly`

- **Shelly** _(happy)_: Welcome to Shelly's Shell Shop! Upgrades, repairs and stickers. Mostly stickers.
- **Shelly**: Bring me pearls and I'll soup up your kit. Bigger tank, faster swim, tougher armour. You name it!

`npc.otto`

- **Otto** _(determined)_: Otto here, head judge of Turf Clash! Most turf inked wins. No exceptions! No excuses! No crying!
- **Tilly**: Crying is permitted, Otto.
- **Otto** _(sad)_: ...Crying is permitted.

`npc.tilly`

- **Tilly** _(smug)_: Tilly, co-judge and official turf counter. I measure every square metre. Twice.
- **Tilly** _(happy)_: Otto shouts the results. I make sure they're correct.

`npc.dredge`

- **Foreman Dredge** _(worried)_: Safety first! Then... uh. Actually, just safety. I'm trying to be better.

`npc.kid`

- **Squidkin Kid** _(happy)_: Whoa, are you the new Splashguard? Can I have your autograph? Can you sign it in INK?

`generic.checkpoint` — radio

- **Pix** _(happy)_: Checkpoint! That flag's ours now!

`generic.checkpoint2` — radio

- **Commodore Brine**: Good. A place to regroup.

`generic.checkpoint3` — radio

- **Pix** _(laugh)_: Flag flipped! Splat with confidence!

`generic.splatted` — radio

- **Pix** _(worried)_: Ouch! You're okay! You're okay! Shake it off!

`generic.splatted2` — radio

- **Commodore Brine**: Up you get, sprout. Splashguards don't stay splatted.

`generic.splatted3` — radio

- **Pix** _(smug)_: That was a practice splat. Totally didn't count.

`generic.postcard` — radio

- **Pix** _(happy)_: Ooh, a Lost Postcard! Somebody's memory, all the way from way back when.

## Ending (motion comic)

### Panel 1 — `finale`

- _Narrator_: With a final, glorious SPLAT, the Graytide Mech came crashing down.

### Panel 2 — `cores`

- _Narrator_: Kai carried all five Prism Cores home to the lighthouse.
- _Narrator_: One by one, they sank back into the Wellspring. It flickered... it sputtered... and then...

### Panel 3 — `rainbow`

- _Narrator_: ...Tidehaven lit up like the first morning of summer.
- **Pix** _(laugh)_: Ladies, gents, fish and squids: COLOUR IS BACK ON THE AIR!

### Panel 4 — `murkwell-defeat`

- _Narrator_: As for Baron Murkwell...
- **Baron Murkwell** _(angry)_: Community service? Repainting every wall I grayed? With a BRUSH?
- **Foreman Dredge** _(happy)_: I brought you a smaller brush, sir. For the corners.
- **Baron Murkwell** _(sad)_: ...I hate corners.

### Panel 5 — `team`

- **Commodore Brine**: Kai. This badge was mine, back when I captained the Splashguard. It's yours now.
- **Kai** _(happy)_: Commodore... thank you.
- **Commodore Brine** _(happy)_: Don't get mushy. ...Okay. Get a little mushy.

### Panel 6 — `lighthouse`

- **Pix** _(happy)_: This has been PIX FM, the frequency Murk can't mute. Stay glossy, Tidehaven!
- _Narrator_: THE END

## Post-credits tease

### Panel 1 — `tease`

- _Narrator_: Far below the Wellspring, in waters no light has ever reached...
- _Narrator_: ...something opened one enormous, glowing eye.
- **Pix** _(shock)_: Uh. Guys? Why is my radio picking up a signal from UNDER the ocean?

