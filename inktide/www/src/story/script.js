// INKTIDE story script — the machine-readable half of docs/story.md.
//
//   WORLDS          [{ id, name, subtitle, theme, color }]
//   STAGE_ORDER     story order of the 15 stage ids
//   STAGE_META      { stageId: { world, num, title, subtitle, objective, intro, outro, unlockKit,
//                     music, par, boss?, bossName?, core? } }
//   DIALOGUE        { id: [lines] | { radio: true, lines: [lines] } }   mid-stage beats, NPC talk
//   POSTCARDS       { stageId: { title, text, from } }   default Lost Postcard lore per stage
//   PROLOGUE, ENDING, POST_CREDITS   motion-comic panels [{ art, lines, hold? }]
//   SPEAKERS        { who: { name, color, voice: { pitch, formant, wave }, radio? } }
//
// A line is { who, text, mood? }. Moods: happy, laugh, angry, sad, shock, smug, worried,
// determined (anything else = neutral). Text may contain control tokens {fire} {swim} {jump} {sub}
// {special} {interact} (rendered as button prompts), {kitName} {subName} {specialName} (the equipped
// kit's names, filled in by the in-game director) and *emphasis*.
// DIALOGUE entries written as { radio: true, lines } play as non-blocking radio chatter (the player
// keeps control and lines auto-advance); plain arrays are conversations (the world pauses).

const L = (who) => (text, mood) => (mood ? { who, text, mood } : { who, text });
const brine = L('brine'), pix = L('pix'), kai = L('kai'), murk = L('murkwell'), dredge = L('dredge');
const shelly = L('shelly'), otto = L('otto'), tilly = L('tilly'), pa = L('pa'), kid = L('kid'), nar = L('narrator');
const radio = (...lines) => ({ radio: true, lines });

// ---------------------------------------------------------------------------------------------
export const SPEAKERS = {
  brine: { name: 'Commodore Brine', color: '#3fd6bd', voice: { pitch: 118, formant: 0.78, wave: 'sawtooth' } },
  pix: { name: 'Pix', color: '#ff5fd2', voice: { pitch: 430, formant: 1.28, wave: 'square', volume: 0.8 }, radio: true },
  kai: { name: 'Kai', color: null /* hero ink colour */, voice: { pitch: 320, formant: 1.12, wave: 'triangle' } },
  murkwell: { name: 'Baron Murkwell', color: '#a77bff', voice: { pitch: 92, formant: 0.7, wave: 'sawtooth' } },
  dredge: { name: 'Foreman Dredge', color: '#ffb52e', voice: { pitch: 76, formant: 0.62, wave: 'square', volume: 0.85 } },
  shelly: { name: 'Shelly', color: '#ff8fae', voice: { pitch: 290, formant: 1.15, wave: 'triangle' } },
  otto: { name: 'Otto', color: '#ffd23f', voice: { pitch: 190, formant: 0.95, wave: 'square', volume: 0.8 } },
  tilly: { name: 'Tilly', color: '#7ee08f', voice: { pitch: 350, formant: 1.2, wave: 'triangle' } },
  pa: { name: 'Murk P.A.', color: '#b4addb', voice: { pitch: 150, formant: 0.85, wave: 'square', volume: 0.7 }, radio: true },
  kid: { name: 'Squidkin Kid', color: '#8fe3ff', voice: { pitch: 380, formant: 1.25, wave: 'triangle' } },
  narrator: { name: '', color: '#ffe14d', voice: null },
};

// ---------------------------------------------------------------------------------------------
export const WORLDS = [
  { id: 1, name: 'Brinewater Docks', subtitle: 'Piers, containers & cranes at sunset', theme: 'docks', color: '#ff8a1f' },
  { id: 2, name: 'Coral Heights', subtitle: 'Rooftops, skateparks & neon gardens at dusk', theme: 'heights', color: '#ff5fa8' },
  { id: 3, name: 'Murk Refinery', subtitle: 'Pipes, vats & conveyors on a toxic night', theme: 'refinery', color: '#8be04a' },
  { id: 4, name: 'Murkwell Tower', subtitle: "The villain's spire in the storm", theme: 'tower', color: '#8a6bff' },
];

export const STAGE_ORDER = [
  'w1-1', 'w1-2', 'w1-3', 'w1-boss',
  'w2-1', 'w2-2', 'w2-3', 'w2-boss',
  'w3-1', 'w3-2', 'w3-3', 'w3-boss',
  'w4-1', 'w4-2', 'w4-boss',
];

/** The five Prism Cores, in the order Kai wins them back. */
export const CORES = [
  { id: 'ember', name: 'Ember Core', color: '#ff7a2e', stage: 'w1-boss' },
  { id: 'coral', name: 'Coral Core', color: '#ff5fa8', stage: 'w2-boss' },
  { id: 'kelp', name: 'Kelp Core', color: '#5fe08a', stage: 'w3-boss' },
  { id: 'tide', name: 'Tide Core', color: '#3fb6ff', stage: 'w4-2' },
  { id: 'sunburst', name: 'Sunburst Core', color: '#ffd23f', stage: 'w4-boss' },
];

// ---------------------------------------------------------------------------------------------
export const STAGE_META = {
  // ================================ WORLD 1 — BRINEWATER DOCKS ================================
  'w1-1': {
    world: 1, num: '1-1', title: 'First Splash', subtitle: 'Every legend starts with a puddle.',
    objective: 'Crack open the Prism Capsule at the end of the pier',
    unlockKit: null, music: 'docks', par: 210,
    intro: [
      pix('Testing, testing... is this thing on? PIX FM, the frequency Murk can\'t mute! And today we have a very special guest: a brand-new Splashguard!', 'happy'),
      brine('Recruit. Singular. And barely. Let\'s see what you\'re made of, sprout.'),
      kai('Ready when you are, Commodore!', 'determined'),
      brine('Murk Industries bottled up this dock\'s colour and locked it in a *Prism Capsule* at the end of the pier. Crack it, and the colour comes home.'),
      pix('Easy peasy, squeezy lemon. Well... squeezy tangerine. You\'ll see.', 'laugh'),
    ],
    outro: [
      pix('WOOO! Did you see that? The whole pier just went technicolour!', 'happy'),
      brine('Hmph. Not bad. Not good, either. But not bad.'),
      pix('That\'s Brine for "I\'m so proud I could cry."', 'laugh'),
      brine('I have something in my eye. It\'s salt. We live in the sea.', 'worried'),
    ],
  },
  'w1-2': {
    world: 1, num: '1-2', title: 'Container Crossing', subtitle: 'A maze of steel boxes and sneaky corners.',
    objective: 'Cross the container yard and reach the Prism Capsule',
    unlockKit: 'wave-roller', music: 'docks', par: 240,
    intro: [
      pix('Good morning, Brinewater! It\'s a gray and gloomy day... and that\'s not the weather. That\'s Murk Industries.', 'worried'),
      pix('Today\'s forecast: a hundred percent chance of rookie! Kai is heading into the container yard!', 'happy'),
      brine('Murk stacks its stolen goods in these boxes. Watch the corners. Gloopers love a good ambush.'),
      kai('Corners. Got it. Watching them.', 'determined'),
    ],
    outro: [
      pix('Capsule cracked! And look what fell out: a *Wave Roller*! Somebody at Murk HQ is getting a very angry memo.', 'happy'),
      brine('A roller. Now we\'re talking. Back in my day I rolled a lane from here to the lighthouse. Uphill. Both ways.', 'smug'),
      pix('The lighthouse is downhill from here, Commodore.'),
      brine('Not the way I rolled it.'),
    ],
  },
  'w1-3': {
    world: 1, num: '1-3', title: 'Crane Climb', subtitle: 'Up, up, and don\'t look down.',
    objective: 'Climb the cranes to the Prism Capsule',
    unlockKit: 'longshot', music: 'docks', par: 270,
    intro: [
      pix('Kai, look up. Way up. See that crane? The capsule is dangling off the very top.'),
      kai('...How high is that?', 'worried'),
      brine('High enough to be interesting. Paint the walls and climb. And mind the Snipe Eels: you\'ll see their laser before you see them.'),
      pix('Pro tip: if a red line is pointing at you... MOVE.', 'shock'),
    ],
    outro: [
      pix('Look at that view! You can see the whole harbour! And the *Longshot* you just liberated!', 'happy'),
      brine('A charger. Patience in a pipe. Hold still, breathe out, and splat \'em from across the bay.'),
      pix('Oh. Uh, guys? My scanner is picking up something big at the end of the docks. Like, "rolls over cars" big.', 'worried'),
      brine('Dredge. Should\'ve known.', 'angry'),
    ],
  },
  'w1-boss': {
    world: 1, num: '1-B', title: 'The Grinder', subtitle: 'Foreman Dredge and his roller tank.',
    objective: 'Stop The Grinder and free the Ember Core',
    unlockKit: null, music: 'boss', par: 180, boss: 'boss-grinder', bossName: 'The Grinder', core: 'ember',
    intro: [
      dredge('HALT! This dock is a Murk Industries work zone! Hardhats required! Colour prohibited!', 'angry'),
      kai('You\'ve got something that doesn\'t belong to you.', 'determined'),
      dredge('What, this? The Ember Core? It\'s company property now. Says so on the sticker.', 'smug'),
      pix('He put a STICKER on a PRISM CORE?!', 'shock'),
      dredge('Time to flatten you like a pancake. A GRAY pancake. Fire up The Grinder!', 'angry'),
      brine('Kid, rollers can\'t turn fast. Get behind it and paint its engine!'),
    ],
    outro: [
      dredge('My Grinder! I\'m gonna have to fill out SO many forms...', 'sad'),
      dredge('This isn\'t over, squid! The Baron\'s gonna hear about this! ...I mean, I\'ll tell him. Nicely. With a card.', 'worried'),
      pix('The *Ember Core* is ours! One down, four to go! Somebody play an air horn!', 'laugh'),
      murk('Ahem. Is this "the frequency Murk can\'t mute"? Adorable. I own the building your antenna is on.', 'smug'),
      murk('Baron Murkwell, CEO of Murk Industries. You took one little Core, little squid. I have four more, and an Engine that is very, very hungry.', 'smug'),
      murk('Enjoy your colour while it lasts. Soon it will be premium content.', 'smug'),
      pix('He hacked my show! Nobody hacks my show! I\'M the hacker on this show!', 'angry'),
      brine('Proud of you, sprout. Don\'t let it go to your head. Coral Heights is next.'),
      brine('And if you want practice, Otto and Tilly are running *Turf Clash* matches down at the plaza.'),
      kai('Turf Clash? Sign me up!', 'happy'),
    ],
  },

  // ================================ WORLD 2 — CORAL HEIGHTS ===================================
  'w2-1': {
    world: 2, num: '2-1', title: 'Rooftop Rush', subtitle: 'Rails over the rooftops.',
    objective: 'Race across the rooftops to the Prism Capsule',
    unlockKit: 'burst-popper', music: 'heights', par: 240,
    intro: [
      pix('Welcome to Coral Heights, the coolest neighbourhood in Tidehaven! Rooftop gardens, skate spots, neon everything...', 'happy'),
      pix('...or it WAS. Now it\'s all beige. BEIGE, Kai.', 'sad'),
      brine('Murk has drones patrolling the rooftops. Stay low, move fast, and use those ink rails.'),
      kai('Rooftops. Rails. Drones. Got it!', 'determined'),
    ],
    outro: [
      pix('Capsule popped! And you snagged a *Burst Popper*! Big, slow, SPLASHY shots. Like water balloons, but legal.', 'laugh'),
      brine('Blasters splash around corners. Handy against anyone hiding behind a wall. Which, in my experience, is everyone.'),
    ],
  },
  'w2-2': {
    world: 2, num: '2-2', title: 'Skatepark Sprawl', subtitle: 'Grind, splat, repeat.',
    objective: 'Pop the balloons, open the gates, crack the Prism Capsule',
    unlockKit: 'slosh-bucket', music: 'heights', par: 270,
    intro: [
      pix('Oh, Kai. The Coral Heights Skatepark. I learned to kickflip here. I also learned what a sprained tentacle is here.', 'happy'),
      brine('Murk locked the park with balloon gates. Pop every balloon and the gate opens.'),
      kai('Popping balloons? Best mission ever.', 'happy'),
      pix('Watch out for Bomblobs! They lob bombs in big arcs. Keep moving and you\'re golden.'),
    ],
    outro: [
      pix('Look at that park! It\'s GLOWING! And you found a *Slosh Bucket*: it throws ink over walls like a big splashy frisbee!', 'happy'),
      brine('Buckets. In my day we just called it "throwing things." Good for grunts up on ledges.'),
    ],
  },
  'w2-3': {
    world: 2, num: '2-3', title: 'Neon Gardens', subtitle: 'Lights out in the flower beds.',
    objective: 'Flip the switches, drop the Murk barriers, reach the Prism Capsule',
    unlockKit: null, music: 'heights', par: 300,
    intro: [
      pix('The Neon Gardens. On a normal night, every flower here glows. Tonight... nothing. Murk is sucking the colour right out of the petals.', 'sad'),
      brine('Murk barriers everywhere. Splat the grunts powering one and it fizzles. Switches open the gates, so shoot \'em.'),
      kai('I\'ll bring the glow back. Promise.', 'determined'),
      pix('Aww. Brine, did you hear that? I\'m not crying, YOU\'RE crying.', 'happy'),
      brine('Nobody is crying. It\'s humid.'),
    ],
    outro: [
      pix('The flowers are glowing again! Kai, you\'re a hero! A GARDENING hero!', 'laugh'),
      brine('Stay sharp. My nose says the Bucketeer is circling the Heights. Nasty flying contraption.'),
      pix('Your NOSE says that?'),
      brine('My nose has been right for forty years.', 'smug'),
    ],
  },
  'w2-boss': {
    world: 2, num: '2-B', title: 'The Bucketeer', subtitle: 'A flying bucket with a bad attitude.',
    objective: 'Ground The Bucketeer and free the Coral Core',
    unlockKit: null, music: 'boss', par: 210, boss: 'boss-bucketeer', bossName: 'The Bucketeer', core: 'coral',
    intro: [
      dredge('Surprise! It\'s me, Foreman Dredge! Well, AERIAL Foreman Dredge now. I got a promotion!', 'happy'),
      pix('They PROMOTED you? After you LOST?', 'shock'),
      dredge('The Baron says I "failed upward." That\'s good, right? Up is good.'),
      dredge('Behold: The Bucketeer! It sloshes! It flies! It has a cupholder!', 'smug'),
      brine('Flyers have to come down to refill. When it dips low, hit it with everything you\'ve got.'),
    ],
    outro: [
      dredge('Crash-landed... again. You know, my mom was right. I should\'ve been a florist.', 'sad'),
      pix('The *Coral Core*! Two down! Coral Heights is back to being the coolest block in town!', 'happy'),
      murk('Dredge. My office. Now.', 'angry'),
      dredge('Coming, Baron! ...Bye, squid. You\'re actually pretty good. Don\'t tell anyone I said that.', 'worried'),
      brine('Next stop: the Murk Refinery. That\'s where they make the goop. It\'s going to smell.'),
      kai('How bad?', 'worried'),
      brine('Bring a nose plug. Bring two.'),
    ],
  },

  // ================================ WORLD 3 — MURK REFINERY ===================================
  'w3-1': {
    world: 3, num: '3-1', title: 'Sludge Lines', subtitle: 'Conveyor belts of pure gloom.',
    objective: 'Shut down the sludge lines and reach the Prism Capsule',
    unlockKit: 'gatling-spinner', music: 'refinery', par: 270,
    intro: [
      pix('Welcome to the Murk Refinery, where the goop gets made. Kai, try not to touch anything. Actually no: touch EVERYTHING. With ink.', 'laugh'),
      pa('Welcome, visitors! The Refinery is proud to be Tidehaven\'s number one producer of gray. Please enjoy the smell.'),
      kai('...It really does smell.', 'worried'),
      brine('Murk Pods keep spitting out fresh Gloopers. Pop the pods first or you\'ll be fighting all day.'),
    ],
    outro: [
      pix('*Gatling Spinner* acquired! Spin it up and let it RIP!', 'happy'),
      brine('Spinners need a moment to charge. Find cover, spin up, then hose the whole room.'),
    ],
  },
  'w3-2': {
    world: 3, num: '3-2', title: 'Pipe Dream', subtitle: 'A maze of pipes, rails and launch pads.',
    objective: 'Navigate the pipe works to the Prism Capsule',
    unlockKit: 'swift-brush', music: 'refinery', par: 300,
    intro: [
      pix('Okay, so I hacked the refinery blueprints. Good news: the capsule is in the pipe works. Bad news: the pipe works were designed by a very angry octopus.', 'worried'),
      brine('Ink rails and launch pads everywhere. Keep your momentum.'),
      kai('Momentum. That\'s my middle name.', 'determined'),
      pix('Your middle name is Momentum? Cool. Mine\'s Wavelength.', 'happy'),
    ],
    outro: [
      pix('A *Swift Brush*! Paint while you dash! It\'s like skateboarding, but YOU are the paint!', 'happy'),
      brine('Brushes are for the brave. Get close, stay fast, never stop moving.'),
    ],
  },
  'w3-3': {
    world: 3, num: '3-3', title: 'Vat Valley', subtitle: 'Whatever you do, don\'t fall in.',
    objective: 'Cross the vats and reach the Prism Capsule',
    unlockKit: 'twin-dualies', music: 'refinery', par: 300,
    intro: [
      pix('Vat Valley. Giant tanks of liquid Murk as far as the eye can see. Don\'t fall in. I\'m serious. You\'d come out beige.', 'worried'),
      brine('Sponges will get you over the vats. Keep \'em inked or they shrink.'),
      kai('Keep the sponges puffy. Got it.'),
    ],
    outro: [
      pix('*Twin Dualies*! Two blasters! Dodge rolls! You\'re basically an action movie now!', 'laugh'),
      brine('Dualies keep you slippery. Never stand still, never stop shooting.'),
      pix('Uh-oh. Seismic readings from the big vat. Something long and slithery is waking up...', 'shock'),
      brine('The Sludge Serpent. Murkwell\'s pride and joy.', 'angry'),
    ],
  },
  'w3-boss': {
    world: 3, num: '3-B', title: 'Sludge Serpent', subtitle: 'An eel mech in a sea of sludge.',
    objective: 'Defeat the Sludge Serpent and free the Kelp Core',
    unlockKit: null, music: 'boss', par: 240, boss: 'boss-serpent', bossName: 'Sludge Serpent', core: 'kelp',
    intro: [
      murk('Well, well. The little squid who keeps breaking my things.', 'smug'),
      murk('I have decided to handle this personally. From my office. In my very comfortable chair.', 'smug'),
      kai('Scared to come down here yourself?', 'determined'),
      murk('Scared? I am BUSY. I have shareholders. Serpent: make this squid go away.', 'angry'),
      brine('It surfaces to strike. Paint its weak spots when it rears up!'),
    ],
    outro: [
      murk('My Serpent! My beautiful, expensive Serpent! Dredge! Who is paying for this?!', 'angry'),
      dredge('Uh... insurance, sir?', 'worried'),
      murk('We CANCELLED the insurance to save money!', 'angry'),
      dredge('...Then, uh. You, sir.'),
      pix('The *Kelp Core*! Three down! Can you hear that? That\'s the sound of the Refinery shutting down!', 'happy'),
      brine('Only one place left. Murkwell Tower. Kid... it\'s going to be rough up there.', 'worried'),
      kai('I\'ve got this. WE\'VE got this.', 'determined'),
      brine('...Yeah. We do.'),
    ],
  },

  // ================================ WORLD 4 — MURKWELL TOWER ==================================
  'w4-1': {
    world: 4, num: '4-1', title: 'The Ascent', subtitle: 'Climb the spire. Brave the storm.',
    objective: 'Scale Murkwell Tower',
    unlockKit: null, music: 'tower', par: 330,
    intro: [
      pix('This is it, Kai. Murkwell Tower. Tallest, grayest building in Tidehaven. The Graytide Engine is at the very top.'),
      brine('Storm\'s rolling in. Wind\'s up, visibility\'s down, and every grunt Murk ever hired is between you and the roof.'),
      kai('Then I\'ll paint my way through every single one.', 'determined'),
      pix('Okay, that was SO cool. I\'m putting that on a t-shirt.', 'happy'),
    ],
    outro: [
      pix('You made the upper floors! Oh, and I intercepted a memo. Dredge got fired. Replaced by a robot. "Cost cutting."', 'shock'),
      kai('That\'s... actually kind of sad.', 'sad'),
      dredge('It IS sad. Hi. It\'s me. FORMER Foreman Dredge.', 'sad'),
      dredge('The Baron fired me by email. EMAIL. After twelve years.', 'sad'),
      dredge('The Tide Core is in the Gray Heart, the Engine\'s core room. I know the back way in. ...If you want.'),
      brine('Can we trust him?'),
      pix('He cried on my frequency for ten minutes straight. I think we can trust him.'),
    ],
  },
  'w4-2': {
    world: 4, num: '4-2', title: 'Gray Heart', subtitle: 'The core chamber of the Graytide Engine.',
    objective: 'Reach the Tide Core in the Gray Heart',
    unlockKit: null, music: 'tower', par: 330, core: 'tide',
    intro: [
      dredge('Welcome to the Gray Heart. The Tide Core is right in the middle, powering half the Engine.'),
      dredge('The Baron changed all the locks. And the guards. And the password. It WAS "password." Now it\'s "password2."'),
      pix('Great security, Murk Industries. Truly world-class.', 'smug'),
      brine('Slow and steady, sprout. Go get that Core.'),
    ],
    outro: [
      pix('THE *TIDE CORE*! Four! FOUR CORES! Kai, the Engine is sputtering!', 'happy'),
      murk('ENOUGH!', 'angry'),
      murk('You have cost me four Cores, one Grinder, one Bucketeer, one Serpent, and a perfectly good foreman.', 'angry'),
      dredge('You FIRED me!', 'angry'),
      murk('Details.', 'smug'),
      murk('Come up to the roof, little squid. The Sunburst Core powers my masterpiece. If you want it... come and take it.', 'smug'),
      brine('Kai. Whatever happens up there, I\'m proud of you. Now go splat that fish.'),
    ],
  },
  'w4-boss': {
    world: 4, num: '4-B', title: 'Graytide Mech', subtitle: 'Baron Murkwell\'s final masterpiece.',
    objective: 'Defeat Baron Murkwell and free the Sunburst Core',
    unlockKit: null, music: 'finale', par: 300, boss: 'boss-murkwell', bossName: 'Baron Murkwell', core: 'sunburst',
    intro: [
      murk('Behold! The Graytide Mech! Powered by the Sunburst Core, the brightest colour in the whole Wellspring!', 'smug'),
      murk('Do you know WHY I do this, squid? Thirty summers ago I lost the Turf Clash championship. To HIM.', 'angry'),
      brine('You lost because you spent the whole final polishing your lure, Murky.'),
      murk('DON\'T CALL ME MURKY! Colour was unfair then and it\'s unfair now. So I\'ll own ALL of it!', 'angry'),
      kai('Colour isn\'t something you own. It\'s something you share!', 'determined'),
      pix('Aaand that\'s going on the t-shirt too. GO GET HIM, KAI!', 'happy'),
    ],
    outro: [
      murk('No... no, no, no. My Mech. My Engine. My beautiful, beautiful gray...', 'sad'),
      kai('It\'s over, Murkwell.', 'determined'),
      murk('...Fine. But I\'m keeping the hat.', 'sad'),
      pix('THE *SUNBURST CORE*! ALL FIVE CORES! KAI, YOU DID IT!', 'laugh'),
      brine('Let\'s bring \'em home, sprout.', 'happy'),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Mid-stage beats. Level authors reference these ids from `trigger` entities (dialogue: 'w1-1.swim')
// and NPCs. Bosses may call session.mode.dialogue('w1-boss.phase2') etc.
export const DIALOGUE = {
  // ---- 1-1 First Splash (tutorial) ----
  'w1-1.move': [
    brine('First things first. Walk with the left stick or your movement keys, and look around with the right stick or the mouse.'),
    brine('Jump with {jump}. Squidkin kids are bouncy. It\'s a whole thing.'),
  ],
  'w1-1.shoot': [
    brine('That\'s your {kitName}. Hold {fire} to paint. The ground, the walls: everything you ink is yours.'),
    pix('Aim with the crosshair! And don\'t worry about waste. There\'s no such thing as too much ink.', 'happy'),
  ],
  'w1-1.swim': [
    brine('Now the good part. Hold {swim} to turn squid and dive into your ink. You\'ll swim faster than any kid can run.'),
    pix('And your tank refills while you swim! Science! Or magic. Mostly vibes.', 'laugh'),
  ],
  'w1-1.refill': radio(pix('Tank running dry? Dive into your ink with {swim} and it\'ll top right up!')),
  'w1-1.climb': [
    brine('See that wall? Paint it. Then hold {swim} and swim straight up it. Squidkin don\'t take the stairs.'),
  ],
  'w1-1.jump': radio(brine('Press {jump} while swimming for a squid leap. Higher than a kid jump, and twice as stylish.')),
  'w1-1.enemy-ink': radio(pix('Ew, purple goop! That\'s Murk ink. It slows you down and nibbles your health. Paint over it!', 'worried')),
  'w1-1.gloopers': [
    brine('Gloopers! Murk Corps grunts. They hit like wet noodles, but there are a LOT of noodles. Splat \'em!', 'angry'),
    pix('Crosshair on target, hold {fire}, and stay out of their goop!'),
  ],
  'w1-1.sub': [
    brine('Your sub weapon is the {subName}. Use it with {sub}. It costs a big gulp of ink, so pick your moment.'),
  ],
  'w1-1.special': [
    pix('Every bit of turf you paint charges your special. When the gauge is full, hit {special} to unleash your {specialName}!', 'happy'),
    pix('Warning: extremely cool.', 'smug'),
  ],
  'w1-1.checkpoint': radio(pix('That flag is a checkpoint! Touch it, and if you get splatted you\'ll pop back right there.')),
  'w1-1.capsule': [
    brine('There she is. The Prism Capsule. Shoot it until it cracks!', 'determined'),
  ],

  // ---- 1-2 Container Crossing ----
  'w1-2.sponge': [
    pix('See that squishy block? It\'s a sponge! Paint it with your ink and it puffs up into a platform.'),
    pix('Murk ink shrinks it right back down, so keep it glossy!'),
  ],
  'w1-2.shield': radio(brine('Shield Glooper. That plate stops ink cold. Hit it from the side, or lob a bomb over the top.')),
  'w1-2.crates': radio(pix('Crates! Smash \'em for pearls. Pearls buy upgrades at Shelly\'s shop. It\'s called economics, baby!', 'laugh')),
  'w1-2.rollerbrute': radio(brine('Rollerbrute! When it revs up, get out of its lane. Then paint its back.', 'angry')),
  'w1-2.pa': radio(pa('ATTENTION EMPLOYEES. Unauthorized colour has been spotted in Yard C. Do not look directly at the colour.')),

  // ---- 1-3 Crane Climb ----
  'w1-3.launchpad': [
    pix('That\'s a squid launch pad! Swim onto it as a squid and press {jump}. You\'ll be yeeted to the next crane.', 'happy'),
    pix('"Yeeted" is the technical term.', 'smug'),
  ],
  'w1-3.mover': radio(brine('Moving platform. Time your jump. Or don\'t, and swim home from the bottom of the harbour.')),
  'w1-3.sniper': radio(pix('Red laser! Snipe Eel on the crane! Duck behind something and paint your way closer!', 'shock')),
  'w1-3.halfway': radio(brine('Halfway there. Don\'t look down.'), brine('...You looked down, didn\'t you.')),
  'w1-3.pa': radio(pa('REMINDER: Crane safety is everyone\'s responsibility. Please do not let the squid climb the crane.')),

  // ---- 1-B The Grinder ----
  'w1-boss.phase2': radio(dredge('Hey! You scratched the paint! ...Wait, we don\'t HAVE paint. You scratched the GRAY!', 'angry'), pix('He\'s getting mad! Keep moving, Kai!')),
  'w1-boss.phase3': radio(dredge('Full throttle! Safety regulations are more of a suggestion anyway!', 'angry')),
  'w1-boss.hint': radio(brine('Its engine is on the back! Get behind it!')),

  // ---- 2-1 Rooftop Rush ----
  'w2-1.rail': [
    pix('Ink rail ahead! Shoot the start to switch it on, then swim onto it as a squid and ride!', 'happy'),
    pix('Screaming "wheee" is optional but strongly encouraged.', 'laugh'),
  ],
  'w2-1.drones': radio(brine('Buzzdrones. They drop bombs from above. Look up and paint \'em out of the sky.')),
  'w2-1.gap': radio(pix('Big gap! Squid leap with {jump} out of your ink for extra height!')),
  'w2-1.pa': radio(pa('Good afternoon, Coral Heights. Your neighbourhood has been upgraded to Tasteful Beige. You\'re welcome.')),

  // ---- 2-2 Skatepark Sprawl ----
  'w2-2.balloons': [
    pix('See the balloons? Pop \'em ALL and the gate opens. It\'s like a party, but splashier.', 'happy'),
  ],
  'w2-2.spring': radio(pix('Bounce pad! Step on it for a big BOING!', 'laugh')),
  'w2-2.bomblob': radio(brine('Bomblob up top. When you see the arc, sidestep. Then return the favour.')),
  'w2-2.halfpipe': [
    kai('Whoa, a halfpipe! ...Is there time for one run?', 'happy'),
    brine('No.'),
    pix('...Maybe one.', 'smug'),
  ],

  // ---- 2-3 Neon Gardens ----
  'w2-3.switch': [
    pix('See the target with the Murk logo? That\'s a switch. Shoot it and a gate opens!'),
  ],
  'w2-3.barrier': radio(brine('Murk barrier. Can\'t shoot through it, can\'t swim through it. Splat the grunts powering it and it drops.')),
  'w2-3.turret': radio(pix('Turret! It can\'t move, so flank it. Rude, but effective.', 'smug')),
  'w2-3.pa': radio(pa('Reminder: flowers are a non-essential colour. Please report glowing plants to your supervisor.')),

  // ---- 2-B The Bucketeer ----
  'w2-boss.phase2': radio(dredge('Ow! Hey! This thing is a RENTAL!', 'angry')),
  'w2-boss.phase3': radio(dredge('Engage turbo slosh! ...Which button is turbo slosh?', 'worried'), pix('Not that one! Definitely not that one!', 'laugh')),
  'w2-boss.hint': radio(brine('It dips low to refill! That\'s your window!')),

  // ---- 3-1 Sludge Lines ----
  'w3-1.pods': [
    brine('That\'s a Murk Pod. Every few seconds: pop, fresh Glooper. Take it out first.', 'angry'),
  ],
  'w3-1.conveyor': radio(pix('Conveyor belts! They\'ll carry you along. Or carry you away. Mind the edges!')),
  'w3-1.vent': radio(pix('Hot tip, literally: stay out of the steam!', 'worried')),

  // ---- 3-2 Pipe Dream ----
  'w3-2.pipes': radio(pix('The pipes are paintable on the outside! Ink \'em and climb right over!')),
  'w3-2.rail': radio(pix('Rail express! All aboard the Kai-line!', 'laugh')),
  'w3-2.lost': radio(brine('Lost? Follow the pearls. Murk grunts drop \'em everywhere. Sloppy lot.')),

  // ---- 3-3 Vat Valley ----
  'w3-3.vats': radio(pix('Liquid Murk below! Falling in means a trip back to the checkpoint!', 'worried')),
  'w3-3.sponge': radio(brine('Sponge bridge. Ink it big, cross fast.')),
  'w3-3.pa': radio(pa('Attention: the Serpent is sleeping. Please keep squids to a minimum.')),

  // ---- 3-B Sludge Serpent ----
  'w3-boss.phase2': radio(murk('Do you have ANY idea how much that armour cost?', 'angry')),
  'w3-boss.phase3': radio(murk('Fine. FINE. Serpent: maximum sludge!', 'angry')),
  'w3-boss.hint': radio(brine('Weak spots light up when it rears back! Paint \'em!')),

  // ---- 4-1 The Ascent ----
  'w4-1.storm': radio(pix('Wind gusts on the outer walls! Hug the tower!', 'worried')),
  'w4-1.halfway': radio(brine('Halfway up. My old knees hurt just watching you.')),
  'w4-1.pa': radio(pa('ALERT. A squid is climbing the tower. All employees: act natural.')),
  'w4-1.dredge': [
    dredge('Psst! Over here! Don\'t splat me, I\'m unemployed!', 'worried'),
    dredge('I left the service door unlocked for you. Don\'t tell the Baron. Not that he\'d listen. He never listens.', 'sad'),
  ],

  // ---- 4-2 Gray Heart ----
  'w4-2.engine': radio(pix('The Engine\'s shielding is Murk-powered. Clear the grunts and it drops!')),
  'w4-2.heart': radio(dredge('The core room is straight ahead! Go, squid, go!', 'happy')),
  'w4-2.pa': radio(pa('Warning: Engine pressure at... ninety... uh... someone please check the Engine pressure.')),

  // ---- 4-B Graytide Mech ----
  'w4-boss.phase2': radio(murk('You are ruining my suit! This is ITALIAN gray!', 'angry')),
  'w4-boss.phase3': radio(murk('All power to the Mech! If I can\'t have colour, NOBODY CAN!', 'angry'), brine('Hang in there, sprout! He\'s running on fumes!')),
  'w4-boss.hint': radio(pix('The Sunburst Core is in the chest! Hit it when the armour opens!')),

  // ---- NPC conversations ----
  'npc.brine': [
    brine('Stretch before you swim, sprout. Take it from an old shrimp with older knees.'),
    brine('Thirty summers I kept the Wellspring safe. Now it\'s your turn. ...Don\'t tell anyone I said that sappy thing.', 'worried'),
  ],
  'npc.pix': [
    pix('Wanna request a song? I only have one record. It\'s the Murk Industries jingle. I wrote it when I was their intern.', 'worried'),
    pix('I am NOT proud of it. It\'s very catchy. That\'s the worst part.', 'sad'),
  ],
  'npc.shelly': [
    shelly('Welcome to Shelly\'s Shell Shop! Upgrades, repairs and stickers. Mostly stickers.', 'happy'),
    shelly('Bring me pearls and I\'ll soup up your kit. Bigger tank, faster swim, tougher armour. You name it!'),
  ],
  'npc.otto': [
    otto('Otto here, head judge of Turf Clash! Most turf inked wins. No exceptions! No excuses! No crying!', 'determined'),
    tilly('Crying is permitted, Otto.'),
    otto('...Crying is permitted.', 'sad'),
  ],
  'npc.tilly': [
    tilly('Tilly, co-judge and official turf counter. I measure every square metre. Twice.', 'smug'),
    tilly('Otto shouts the results. I make sure they\'re correct.', 'happy'),
  ],
  'npc.dredge': [
    dredge('Safety first! Then... uh. Actually, just safety. I\'m trying to be better.', 'worried'),
  ],
  'npc.kid': [
    kid('Whoa, are you the new Splashguard? Can I have your autograph? Can you sign it in INK?', 'happy'),
  ],

  // ---- generic beats the mode plays on its own ----
  'generic.checkpoint': radio(pix('Checkpoint! That flag\'s ours now!', 'happy')),
  'generic.checkpoint2': radio(brine('Good. A place to regroup.')),
  'generic.checkpoint3': radio(pix('Flag flipped! Splat with confidence!', 'laugh')),
  'generic.splatted': radio(pix('Ouch! You\'re okay! You\'re okay! Shake it off!', 'worried')),
  'generic.splatted2': radio(brine('Up you get, sprout. Splashguards don\'t stay splatted.')),
  'generic.splatted3': radio(pix('That was a practice splat. Totally didn\'t count.', 'smug')),
  'generic.postcard': radio(pix('Ooh, a Lost Postcard! Somebody\'s memory, all the way from way back when.', 'happy')),
};

// ---------------------------------------------------------------------------------------------
// Lost Postcards: the level's `postcard` entity may carry its own title/text; these are the
// canonical defaults (collectPostcard falls back to them). Together they tell Brine and
// Murkwell's shared history.
export const POSTCARDS = {
  'w1-1': { title: 'Greetings from Brinewater!', from: 'Juno', text: 'Wish you were here! The sunsets turn the whole harbour tangerine. Grandpa says the colour comes up from under the old lighthouse. I think he\'s pulling my tentacle.' },
  'w1-2': { title: 'Container Yard C', from: 'A dockworker', text: 'Found a crate full of rubber ducks. Did not report it. The ducks are mine now. All 400 of them.' },
  'w1-3': { title: 'View from the Crane', from: 'Kip, age 9', text: 'You can see the whole city from up here! The lighthouse! The skatepark! My house! HI MOM!' },
  'w1-boss': { title: 'Championship Tickets', from: 'Aunt Marlo', text: 'Got us two seats for the Turf Clash Final! Young Brine versus that fancy anglerfish kid. My money\'s on the shrimp.' },
  'w2-1': { title: 'Rooftop Garden', from: 'Grandma Peb', text: 'Planted tomatoes on the roof. The seagulls are winning. I have a plan. The plan is a bigger hat.' },
  'w2-2': { title: 'Skatepark Opening Day', from: 'P.', text: 'Landed my first kickflip today!! Also my first faceplant. Totally worth it. Someday I\'ll have my own radio show and I\'ll talk about it forever.' },
  'w2-3': { title: 'The Neon Gardens', from: 'Wren', text: 'Every flower glows a different colour at night. The gardener says they drink from the same spring we do.' },
  'w2-boss': { title: 'Congratulations, Champion!', from: 'Otto & Tilly (junior referees)', text: 'To Brine: best final we ever reffed! PS: please tell that anglerfish kid to stop sulking under the bleachers.' },
  'w3-1': { title: 'Welcome, New Intern!', from: 'Murk Industries HR', text: 'Your first assignment: write a catchy jingle about the colour gray. Enthusiasm is mandatory. Snacks are not provided.' },
  'w3-2': { title: 'Lost in the Pipes', from: 'A very lost Glooper', text: 'Day 3 in the pipe works. I have named all the pipes. Gary is my favourite. Gary does not talk back.' },
  'w3-3': { title: 'Employee of the Month', from: 'Murk Industries', text: 'Congratulations, Dredge! Twelve years without a single colour incident. Your prize: this postcard.' },
  'w3-boss': { title: 'A Letter, Never Sent', from: 'M.', text: 'Dear Brine. I\'m sorry I threw my trophy in the harbour. And your trophy. And the referee\'s whistle. You were better. There. I said it. Now I\'ll never send this.' },
  'w4-1': { title: 'Murkwell Tower Grand Opening', from: 'The Management', text: 'The tallest building in Tidehaven! Beautifully gray! Please remember to wipe your fins.' },
  'w4-2': { title: 'A Crayon Drawing', from: 'Little Mo, age 6', text: 'This is me and my dad at the beach. The sun is orange. The sea is blue. The sand is yellow. Everything has a colour and it is my favourite.' },
  'w4-boss': { title: 'From the Lighthouse Keepers', from: 'The Keepers of the Wellspring', text: 'To whoever brings the colour home: thank you. Tidehaven will remember.' },
};

// ---------------------------------------------------------------------------------------------
// Motion comics. `art` ids are drawn procedurally by story/comic-art.js.
export const PROLOGUE = [
  { art: 'lighthouse', lines: [
    nar('Tidehaven. A city on the edge of the sea, where every wall is a canvas and every kid is a little bit squid.'),
  ] },
  { art: 'wellspring', lines: [
    nar('Deep beneath the old lighthouse, the Prism Wellspring pours colour into every street, every mural, and every drop of Squidkin ink.'),
    nar('Five Prism Cores keep it shining: Ember, Coral, Kelp, Tide and Sunburst.'),
  ] },
  { art: 'murkwell', lines: [
    nar('But not everyone thinks colour should be free.'),
    murk('Free? FREE?! Nothing worth having is free, darling. Colour is a *premium feature*.', 'smug'),
  ] },
  { art: 'heist', lines: [
    nar('One stormy night, Murk Industries drilled into the Wellspring and ripped out all five Prism Cores.'),
  ] },
  { art: 'engine', lines: [
    murk('With the Cores powering my Graytide Engine, Tidehaven will drown in lovely, sensible Murk.', 'smug'),
    murk('And then I\'ll sell the colour back. By the bottle. With a monthly subscription!', 'laugh'),
  ] },
  { art: 'kai', lines: [
    nar('Meanwhile, down at Brinewater Docks, a rookie named Kai was about to have a very big day.'),
    kai('Huh? Why is the sky going... gray?', 'worried'),
  ] },
  { art: 'brine', lines: [
    brine('You there! Sprout! You\'ve got ink in your veins and fire in your fins.'),
    brine('Tidehaven needs a Splashguard. Congratulations: you\'re it.', 'smug'),
    kai('Me?!', 'shock'),
    brine('Don\'t make me say it twice. My knees can\'t take the drama.'),
  ] },
  { art: 'pix', lines: [
    pix('And I\'m Pix, coming at you live on PIX FM, the frequency Murk can\'t mute!', 'happy'),
    pix('I\'ll be in your ear the whole way, rookie. Let\'s paint this town back!', 'laugh'),
  ] },
];

export const ENDING = [
  { art: 'finale', lines: [
    nar('With a final, glorious SPLAT, the Graytide Mech came crashing down.'),
  ] },
  { art: 'cores', lines: [
    nar('Kai carried all five Prism Cores home to the lighthouse.'),
    nar('One by one, they sank back into the Wellspring. It flickered... it sputtered... and then...'),
  ] },
  { art: 'rainbow', lines: [
    nar('...Tidehaven lit up like the first morning of summer.'),
    pix('Ladies, gents, fish and squids: COLOUR IS BACK ON THE AIR!', 'laugh'),
  ] },
  { art: 'murkwell-defeat', lines: [
    nar('As for Baron Murkwell...'),
    murk('Community service? Repainting every wall I grayed? With a BRUSH?', 'angry'),
    dredge('I brought you a smaller brush, sir. For the corners.', 'happy'),
    murk('...I hate corners.', 'sad'),
  ] },
  { art: 'team', lines: [
    brine('Kai. This badge was mine, back when I captained the Splashguard. It\'s yours now.'),
    kai('Commodore... thank you.', 'happy'),
    brine('Don\'t get mushy. ...Okay. Get a little mushy.', 'happy'),
  ] },
  { art: 'lighthouse', lines: [
    pix('This has been PIX FM, the frequency Murk can\'t mute. Stay glossy, Tidehaven!', 'happy'),
    nar('THE END'),
  ] },
];

export const POST_CREDITS = [
  { art: 'tease', lines: [
    nar('Far below the Wellspring, in waters no light has ever reached...'),
    nar('...something opened one enormous, glowing eye.'),
    pix('Uh. Guys? Why is my radio picking up a signal from UNDER the ocean?', 'shock'),
  ] },
];

// ---------------------------------------------------------------------------------------------
// Helpers

/** Resolve a DIALOGUE id or inline lines → { lines, radio }. Unknown ids give no lines. */
export function resolveLines(idOrLines) {
  if (!idOrLines) return { lines: [], radio: false };
  if (Array.isArray(idOrLines)) return { lines: idOrLines, radio: false };
  if (typeof idOrLines === 'object' && Array.isArray(idOrLines.lines)) return { lines: idOrLines.lines, radio: !!idOrLines.radio };
  const d = DIALOGUE[idOrLines] ?? STAGE_META[idOrLines]?.intro;
  if (!d) { console.warn(`story: unknown dialogue id "${idOrLines}"`); return { lines: [], radio: false }; }
  return Array.isArray(d) ? { lines: d, radio: false } : { lines: d.lines, radio: !!d.radio };
}

export function speaker(who) { return SPEAKERS[who] || { name: who || '', color: '#ffffff', voice: { pitch: 260 } }; }

export function nextStage(stageId) {
  const i = STAGE_ORDER.indexOf(stageId);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}

export function worldOf(stageId) { return WORLDS.find((w) => w.id === STAGE_META[stageId]?.world) || null; }
