/* Content tables for Emberfield Valley: items, crops, fish, mining, shops, villagers and projects. */
(function () {
  var D = EF.D = {};

  // ---------- Tools ----------
  D.TOOLS = {
    hoe:   { name: 'Hoe',          energy: 3, desc: 'Turns open grass into soil you can plant in.' },
    can:   { name: 'Watering Can', energy: 2, desc: 'Waters soil. Refill it at water tiles or the well.' },
    axe:   { name: 'Axe',          energy: 4, desc: 'Chops trees for wood.' },
    pick:  { name: 'Pickaxe',      energy: 4, desc: 'Breaks rocks and ore, outdoors and in the mines.' },
    sword: { name: 'Sword',        energy: 3, desc: 'Swings at monsters in front of you.' },
    rod:   { name: 'Fishing Rod',  energy: 3, desc: 'Face water and use it to cast a line.' }
  };
  D.TIER_PREFIX = ['', 'Copper ', 'Iron '];
  D.CAN_CAPACITY = [20, 30, 40];
  D.SWORD_DAMAGE = [4, 7, 11];
  D.ROD_BITE = [1, 0.8, 0.6];       // multiplier on bite waiting time
  D.ROD_ZONE = [0.22, 0.28, 0.34];  // width of the catch zone in the reel minigame

  D.items = {};
  function def(o) { D.items[o.id] = o; return o; }

  Object.keys(D.TOOLS).forEach(function (kind) {
    for (var t = 0; t < 3; t++) {
      def({
        id: kind + '_' + t, name: D.TIER_PREFIX[t] + D.TOOLS[kind].name, type: 'tool',
        kind: kind, tier: t, price: 0, color: ['#9a6b3f', '#c9783f', '#8fd3e8'][t],
        desc: D.TOOLS[kind].desc
      });
    }
  });

  // ---------- Crops ----------
  // season: 0 Spring, 1 Summer, 2 Autumn, 3 Winter
  D.crops = {
    turnip:      { name: 'Turnip',      season: 0, days: 4,  seedPrice: 20,  price: 35,  color: '#f4eefc' },
    potato:      { name: 'Potato',      season: 0, days: 6,  seedPrice: 50,  price: 80,  color: '#c9a25a' },
    tomato:      { name: 'Tomato',      season: 1, days: 6,  seedPrice: 40,  price: 60,  color: '#e0473a' },
    melon:       { name: 'Melon',       season: 1, days: 8,  seedPrice: 80,  price: 250, color: '#7ed36b' },
    corn:        { name: 'Corn',        season: 2, days: 7,  seedPrice: 60,  price: 50,  color: '#f5d13c' },
    pumpkin:     { name: 'Pumpkin',     season: 2, days: 10, seedPrice: 100, price: 320, color: '#f08a2c' },
    winter_root: { name: 'Winter Root', season: 3, days: 8,  seedPrice: 30,  price: 70,  color: '#b38ad6' }
  };
  Object.keys(D.crops).forEach(function (k) {
    var c = D.crops[k];
    def({ id: k, name: c.name, type: 'crop', price: c.price, color: c.color, desc: 'A ' + c.name.toLowerCase() + ' harvested from the fields.' });
    def({ id: 'seed_' + k, name: c.name + ' Seeds', type: 'seed', crop: k, price: Math.floor(c.seedPrice / 2), color: c.color,
          desc: 'Plant on tilled soil during ' + EF.C.SEASONS[c.season] + '.' });
  });

  // ---------- Fish ----------
  D.fish = [
    { id: 'sunfish',    name: 'Sunfish',    seasons: [0, 1],       weight: 5, speed: 1.0, price: 30,  color: '#ffb347' },
    { id: 'carp',       name: 'Carp',       seasons: [0, 1, 2, 3], weight: 6, speed: 0.8, price: 25,  color: '#9aa86a' },
    { id: 'trout',      name: 'Trout',      seasons: [0, 2],       weight: 3, speed: 1.3, price: 60,  color: '#c9b08a' },
    { id: 'glimmerfin', name: 'Glimmerfin', seasons: [1, 2],       weight: 1, speed: 1.8, price: 150, color: '#7fe8ff' },
    { id: 'ember_eel',  name: 'Ember Eel',  seasons: [3],          weight: 1, speed: 2.0, price: 180, color: '#ff6a3d' }
  ];
  D.fish.forEach(function (f) {
    def({ id: f.id, name: f.name, type: 'fish', price: f.price, color: f.color, desc: 'A fish from the lake.' });
  });

  // ---------- Forage (spawns on the farm and in the forest each morning) ----------
  D.forage = { 0: ['herb', 'mushroom'], 1: ['herb', 'berry'], 2: ['berry', 'mushroom'], 3: ['mushroom'] };
  def({ id: 'herb', name: 'Wild Herb', type: 'forage', price: 20, color: '#7ad17a', desc: 'Fragrant and useful for festivals.' });
  def({ id: 'berry', name: 'Sweet Berry', type: 'forage', price: 30, color: '#d6336c', desc: 'Sweet, slightly sticky.' });
  def({ id: 'mushroom', name: 'Mushroom', type: 'forage', price: 25, color: '#f1e0c5', desc: 'Grows in shady corners.' });

  // ---------- Materials ----------
  def({ id: 'wood', name: 'Wood', type: 'material', price: 2, color: '#a77444', desc: 'Sturdy timber.' });
  def({ id: 'stone', name: 'Stone', type: 'material', price: 2, color: '#9aa0a6', desc: 'Rough building stone.' });
  def({ id: 'copper_ore', name: 'Copper Ore', type: 'material', price: 5, color: '#c9733a', desc: 'Needs smelting at the smithy.' });
  def({ id: 'iron_ore', name: 'Iron Ore', type: 'material', price: 10, color: '#b8b0a6', desc: 'Dense and heavy.' });
  def({ id: 'gold_ore', name: 'Gold Ore', type: 'material', price: 25, color: '#f0c743', desc: 'Glints in the lamplight.' });
  def({ id: 'gleam_shard', name: 'Gleam Shard', type: 'material', price: 80, color: '#b08cff', desc: 'Hums faintly with violet light.' });
  def({ id: 'copper_bar', name: 'Copper Bar', type: 'material', price: 30, color: '#e08a4f', desc: 'Smelted copper.' });
  def({ id: 'iron_bar', name: 'Iron Bar', type: 'material', price: 60, color: '#d0d6dc', desc: 'Smelted iron.' });
  def({ id: 'gold_bar', name: 'Gold Bar', type: 'material', price: 120, color: '#ffd84d', desc: 'Smelted gold.' });
  def({ id: 'slime_gel', name: 'Slime Gel', type: 'material', price: 10, color: '#6ee07a', desc: 'Squishy. Sells for a little.' });
  def({ id: 'bat_wing', name: 'Bat Wing', type: 'material', price: 15, color: '#5b4a6e', desc: 'Thin and leathery.' });
  def({ id: 'golem_core', name: 'Golem Core', type: 'material', price: 120, color: '#ff9f5a', desc: 'A warm core from a stone golem.' });

  // ---------- Food and gifts ----------
  def({ id: 'bread', name: 'Bread', type: 'food', price: 20, energy: 40, health: 0, color: '#e2b06a', desc: 'Warm and filling. Restores energy.' });
  def({ id: 'stew', name: 'Hearty Stew', type: 'food', price: 60, energy: 90, health: 25, color: '#c2572e', desc: 'Restores lots of energy and some health.' });
  def({ id: 'salad', name: 'Garden Salad', type: 'food', price: 15, energy: 30, health: 5, color: '#8fd16a', desc: 'Light and crisp.' });
  def({ id: 'wildflower', name: 'Wildflower', type: 'gift', price: 10, color: '#f7a8d3', desc: 'A little bouquet of meadow flowers.' });
  def({ id: 'bouquet', name: 'Bouquet', type: 'gift', price: 40, color: '#ff6fa1', desc: 'A lovely arrangement. Some gifts mean more than others.' });

  // ---------- Mining and chopping ----------
  // tile char -> what breaking it yields. tier = minimum tool tier; hits = base hit count.
  D.breakable = {
    R: { drop: 'stone',      min: 1, max: 2, tool: 'pick', tier: 0, hits: 3 },
    O: { drop: 'copper_ore', min: 1, max: 2, tool: 'pick', tier: 0, hits: 4 },
    I: { drop: 'iron_ore',   min: 1, max: 1, tool: 'pick', tier: 1, hits: 5 },
    G: { drop: 'gold_ore',   min: 1, max: 1, tool: 'pick', tier: 2, hits: 6 },
    Y: { drop: 'gleam_shard', min: 1, max: 1, tool: 'pick', tier: 2, hits: 5 },
    T: { drop: 'wood',       min: 2, max: 3, tool: 'axe',  tier: 0, hits: 4 }
  };

  // ---------- Smithy ----------
  D.smelt = [
    { out: 'copper_bar', from: 'copper_ore', qty: 5, gold: 10 },
    { out: 'iron_bar',   from: 'iron_ore',   qty: 5, gold: 15 },
    { out: 'gold_bar',   from: 'gold_ore',   qty: 5, gold: 25 }
  ];
  // Upgrading a tool from tier t to t+1 costs bars and gold.
  D.upgradeCost = [
    { bar: 'copper_bar', qty: 5, gold: 300 },  // basic -> copper
    { bar: 'iron_bar',   qty: 5, gold: 800 }   // copper -> iron
  ];

  // ---------- Shops ----------
  D.shops = {
    bakery:  { name: 'Hearthstone Bakery', stock: [{ id: 'bread', price: 45 }, { id: 'stew', price: 120 }, { id: 'salad', price: 60 }] },
    florist: { name: 'Petal & Pot', stock: [{ id: 'wildflower', price: 12 }, { id: 'bouquet', price: 90 }] },
    general: { name: 'Crossroads Store' },          // seeds for the current season + buys anything
    smithy:  { name: 'Brannoc\'s Forge' },          // upgrades and smelting
    fish:    { name: 'Lakeside Fish Buyer', buyBonus: 1.25 }
  };

  // ---------- Villagers ----------
  // Loves/likes/hates are item ids. Schedules are from/to hours; default is home.
  D.npcs = [
    {
      id: 'oswin', name: 'Mayor Oswin', home: { area: 'town', x: 8, y: 9 }, romance: false,
      look: { hair: '#d6d6d6', shirt: '#6b3fa0', pants: '#3b3b4f', skin: '#f1c7a0' },
      loves: ['gleam_shard', 'trout'], likes: ['bread', 'stew', 'copper_bar'], hates: ['slime_gel', 'bat_wing'],
      sched: [{ from: 9, to: 18, area: 'town', x: 12, y: 12 }],
      intro: [
        'Ah, you must be the one who inherited the old Vale farm. I am Mayor Oswin.',
        'Since the Tremor, Hollowmere has been coming apart at the seams. The well is cracked, the river bridge is gone, and half the roofs leak.',
        'Check the Restoration Board in the square. Bring what it asks for, and we will rebuild together.'
      ],
      talk: {
        low: ['Every stone you bring saves us from hiring a crew from the city.', 'The council keeps asking whether the Tremor will return. I tell them the valley is patient.', 'Keep an eye on the notice board. It changes whenever we make progress.'],
        mid: ['You have been working hard. The town notices, even if the council is slow to say so.', 'Sable thinks the violet glow under the mountain is a Gleam deposit. I think it is a warning.'],
        high: ['When this town stands again, I would like you to have a seat on the council. Or at least the best chair.', 'You are part of Hollowmere now. I will not forget that.']
      },
      story: [
        { at: 0, text: 'Hollowmere still needs everything. Start with the well.' },
        { at: 2, text: 'The bridge is open again! Corrin has been sending me postcards from the lake.' },
        { at: 4, text: 'The mine lift runs again. Be careful below; the Gleam has made the rock restless.' },
        { at: 6, text: 'Almost there. The lantern festival decorations are waiting in the storeroom.' },
        { at: 8, text: 'We did it. Hollowmere is whole again.' }
      ]
    },
    {
      id: 'greta', name: 'Greta', home: { area: 'town', x: 31, y: 16 }, romance: false, shop: 'general',
      look: { hair: '#8c4a2b', shirt: '#3d7d4a', pants: '#5a4a3a', skin: '#e8b98a' },
      loves: ['melon', 'pumpkin'], likes: ['turnip', 'potato', 'corn'], hates: ['slime_gel'],
      sched: [{ from: 8, to: 20, area: 'town', x: 31, y: 16 }],
      intro: [
        'Welcome to the Crossroads Store! Seeds, supplies, and whatever the Tremor left on the shelves.',
        'Plant what the season allows, and sell what you do not need. I buy everything at a fair price.'
      ],
      talk: {
        low: ['Business is slow, but the farmers always come back in spring.', 'Turnips in spring, melons in summer. Anything else will just wilt on you.'],
        mid: ['You have a good eye for crops. Want a tip? Water in the morning, before the sun gets strong.', 'My late husband used to say a shop is only as good as its shelves. He was right.'],
        high: ['You are practically family. The cheapest seeds are always yours.', 'Do not let the valley grind you down. Take a day off now and then, dear.']
      }
    },
    {
      id: 'nell', name: 'Nell', home: { area: 'town', x: 33, y: 9 }, romance: false, shop: 'bakery',
      look: { hair: '#e0b04a', shirt: '#f2f2f2', pants: '#7a5a8a', skin: '#f6d0ac' },
      loves: ['potato', 'corn'], likes: ['tomato', 'bread', 'stew'], hates: ['bat_wing'],
      sched: [{ from: 7, to: 21, area: 'town', x: 33, y: 9 }],
      intro: [
        'Hello! I am Nell. The oven has been sulking since the Tremor, but the bread still tastes like home.',
        'If you are hungry, come by. Bread, stew, salads. Whatever you need to keep going.'
      ],
      talk: {
        low: ['The oven needs repairs before I can bake at full speed.', 'Flour is scarce this season. Everything tastes a little more like hope.'],
        mid: ['You look tired. Eat something warm before you sleep.', 'I used to bake for the whole valley. I would love to do that again.'],
        high: ['Come by early tomorrow. I will save you the best loaf.', 'You make this town feel alive again.']
      }
    },
    {
      id: 'brannoc', name: 'Brannoc', home: { area: 'town', x: 8, y: 16 }, romance: false, shop: 'smithy',
      look: { hair: '#2b2b2b', shirt: '#7a3b2a', pants: '#3a3430', skin: '#c99468' },
      loves: ['iron_bar', 'golem_core'], likes: ['copper_bar', 'gold_ore'], hates: ['wildflower'],
      sched: [{ from: 7, to: 19, area: 'town', x: 8, y: 16 }],
      intro: [
        'Brannoc. Smith. Do not ask me about the weather. Ask me about your tools.',
        'Tools wear down. Bring copper and iron bars and I will keep them sharp. I can also smelt ore for you.'
      ],
      talk: {
        low: ['Hit it harder, not smarter. Works more often than you would think.', 'Bring me ore and I will smelt it. Gold bars do not come cheap.'],
        mid: ['Your pickaxe has seen better days. Bring me copper and we will talk upgrades.', 'Iron is tough to find, but the lower mine floors hold more than you would expect.'],
        high: ['Honest work, honest tools. That is all I ever wanted.', 'If you are ever in trouble down the mines, I will come running with a hammer.']
      }
    },
    {
      id: 'juniper', name: 'Juniper', home: { area: 'town', x: 39, y: 16 }, romance: true, shop: 'florist',
      look: { hair: '#7a2f6b', shirt: '#4fb7a0', pants: '#4a4a6a', skin: '#f4c7a8' },
      loves: ['bouquet'], likes: ['wildflower', 'herb', 'berry'], hates: ['slime_gel', 'golem_core'],
      sched: [{ from: 9, to: 18, area: 'town', x: 39, y: 16 }, { from: 18, to: 21, area: 'town', x: 24, y: 14 }],
      intro: [
        'Oh! A new face in the valley. I am Juniper. Flowers, herbs, and the occasional bit of gossip.',
        'If you are looking for something pretty for someone special, you have come to the right place.'
      ],
      talk: {
        low: ['The wildflowers came back early this year. Little miracles.', 'Herbs need sun and patience, like most good things.'],
        mid: ['You have such a calm way about you. Do you garden in your sleep?', 'I know a hill where the bluebells bloom late. I would love to show you sometime.'],
        high: ['Every time you visit, my whole day brightens. I am sure that is not just the flowers.', 'If you ever want to share a meal, I would like that very much.']
      }
    },
    {
      id: 'sable', name: 'Sable', home: { area: 'town', x: 17, y: 9 }, romance: true,
      look: { hair: '#1f1f3a', shirt: '#3a2a5a', pants: '#2a2a2a', skin: '#d9b08c' },
      loves: ['gleam_shard', 'ember_eel'], likes: ['mushroom', 'glimmerfin'], hates: ['copper_ore'],
      sched: [{ from: 10, to: 17, area: 'town', x: 17, y: 9 }, { from: 17, to: 20, area: 'town', x: 22, y: 14 }],
      intro: [
        'Please do not touch the glass. I am Sable, and that violet light is the most interesting thing that has happened in years.',
        'The Gleam crystals hum when they are near water. I am trying to work out why.'
      ],
      talk: {
        low: ['The crystals in the mine are warm to the touch. That is not normal, is it?', 'I need Gleam Shards for my experiments. Could you bring a few?'],
        mid: ['Your questions are better than the council\'s. Keep asking them.', 'Sometimes I lose track of time in the lab. Then I remember the sunlight outside.'],
        high: ['You have made this lab feel less lonely. Thank you.', 'The stars are beautiful from the hill. Would you come see them with me sometime?']
      }
    },
    {
      id: 'ilse', name: 'Ilse', home: { area: 'town', x: 16, y: 16 }, romance: true,
      look: { hair: '#c0622a', shirt: '#5a8f3a', pants: '#6a4a2a', skin: '#e6b48a' },
      loves: ['tomato', 'potato'], likes: ['turnip', 'corn', 'salad'], hates: ['bat_wing'],
      sched: [{ from: 9, to: 15, area: 'farm', x: 30, y: 13 }],
      intro: [
        'Hey, neighbor! I am Ilse. My plot is just over the hill, next to the old orchard.',
        'Need help with your crops? I know this soil better than anyone.'
      ],
      talk: {
        low: ['Tomatoes like warm mornings and steady water.', 'The Tremor cracked my greenhouse. We are patching it up one pane at a time.'],
        mid: ['You have a knack for this. You know when to water and when to leave things be.', 'My dad taught me to listen to the land. Sounds silly, but it works.'],
        high: ['You feel like family already. I hope you are not planning to leave anytime soon.', 'Want to walk the fields at sunset? I would like that.']
      }
    },
    {
      id: 'corrin', name: 'Corrin', home: { area: 'lake', x: 6, y: 10 }, romance: true, shop: 'fish',
      look: { hair: '#4a6a8a', shirt: '#2f5f8f', pants: '#3a3a3a', skin: '#c99c74' },
      loves: ['trout', 'glimmerfin'], likes: ['sunfish', 'carp', 'stew'], hates: ['slime_gel'],
      sched: [{ from: 6, to: 18, area: 'lake', x: 18, y: 12 }],
      intro: [
        'Corrin. Fisher, boat-builder, occasional rain-watcher. Welcome to the lake.',
        'Everything in the water has been a little different since the Tremor. Glimmerfins are everywhere now.'
      ],
      talk: {
        low: ['Carp are reliable. Trout bite best in spring and autumn.', 'The lake is calm today. That is the best time to fish, if you ask me.'],
        mid: ['You are a natural with a rod. Patience and timing, that is the whole trick.', 'I am rebuilding the dock. Thinking of adding a second boat.'],
        high: ['You are good company, you know that? Better than the fish.', 'Next time we fish together, I will show you where the big ones hide.']
      }
    },
    {
      id: 'pim', name: 'Pim', home: { area: 'town', x: 27, y: 12 }, romance: false,
      look: { hair: '#3b2a1a', shirt: '#d9552b', pants: '#4a6a9a', skin: '#f0c4a0' },
      loves: ['berry', 'bread'], likes: ['wildflower', 'herb'], hates: ['bat_wing'],
      sched: [{ from: 8, to: 16, area: 'forest', x: 20, y: 27 }, { from: 16, to: 19, area: 'town', x: 24, y: 20 }],
      intro: [
        'Hi! I am Pim! Are you the new farmer? Can I see your hoe?',
        'I found a glowing rock in the forest! Mom said not to touch it. So I did not. Mostly.'
      ],
      talk: {
        low: ['Berries! I found a whole bush of them. Want some?', 'Do you know how deep the mines go? I would love to go down there someday.'],
        mid: ['You are the coolest grown-up in Hollowmere. Do not tell Mom I said that.', 'My dog Biscuit chased a slime into the mines. Biscuit is fine. Probably.'],
        high: ['When I grow up I am going to be a farmer just like you!', 'You are my favorite person. Do not tell anybody.']
      }
    }
  ];
  D.spouseTalk = [
    'Good morning! I already watered a few rows for you.',
    'Dinner tonight? I will make the stew, you handle the dishes.',
    'I love this valley, and I love you even more.',
    'Tell me everything about your day. I want to hear all of it.'
  ];
  D.reactions = {
    loved: 'Oh, I absolutely love this! Thank you!',
    liked: 'Thanks, that is really nice of you.',
    neutral: 'Oh... thank you, I suppose.',
    hated: 'Ugh. Why would you give me this?'
  };

  // ---------- Restoration Board projects ----------
  // reqs: {item, qty} or {gold}. effect is handled in game.js.
  D.projects = [
    { id: 'well', title: 'Restore the Well', desc: 'The old well cracked during the Tremor. Patch it with stone and wood.',
      reqs: [{ item: 'stone', qty: 10 }, { item: 'wood', qty: 10 }],
      done: 'The well water runs clear again. Drink up, it is the best water in the valley.' },
    { id: 'bridge', title: 'Rebuild the River Bridge', desc: 'The bridge to the lake collapsed. Wood and copper will hold it up.',
      reqs: [{ item: 'wood', qty: 25 }, { item: 'copper_bar', qty: 3 }],
      done: 'The bridge stands again! The lake is open to everyone.' },
    { id: 'lift', title: 'Repair the Mine Lift', desc: 'The lift to the deeper mine floors is jammed. Iron and copper will free it.',
      reqs: [{ item: 'iron_bar', qty: 4 }, { item: 'copper_bar', qty: 4 }],
      done: 'The lift grinds back to life. Mine floors 4 to 6 are open.' },
    { id: 'oven', title: 'Fix the Bakery Oven', desc: 'Nell\'s oven cracked. Stone and copper will make it bake again.',
      reqs: [{ item: 'stone', qty: 20 }, { item: 'copper_bar', qty: 2 }],
      done: 'Nell is thrilled. Bakery prices drop by 15 percent for you now.' },
    { id: 'lamps', title: 'Light the Town Lamps', desc: 'The lamp posts need Gleam Shards to glow through the night.',
      reqs: [{ item: 'gleam_shard', qty: 5 }],
      done: 'The lamps glow violet and gold. The town looks safe after dark again.' },
    { id: 'clock', title: 'Rebuild the Clocktower', desc: 'The clocktower lost its gears. Iron and gold will make them turn.',
      reqs: [{ item: 'iron_bar', qty: 8 }, { item: 'gold_bar', qty: 2 }],
      done: 'Tick, tock. The clocktower chimes for the first time in a year.' },
    { id: 'deep', title: 'Reinforce the Deep Shafts', desc: 'The lowest mine floors are unstable. Golem cores and iron will brace them.',
      reqs: [{ item: 'golem_core', qty: 3 }, { item: 'iron_bar', qty: 6 }],
      done: 'The deep shafts are braced. Mine floors 7 and 8 are open to explorers.' },
    { id: 'festival', title: 'Hold the Lantern Festival', desc: 'Gather festival herbs and berries, and donate 1000 gold for the lanterns.',
      reqs: [{ item: 'herb', qty: 15 }, { item: 'berry', qty: 15 }, { gold: 1000 }],
      done: 'Lanterns float over the valley and everyone is singing. Hollowmere is whole again.' }
  ];

  D.intro = [
    'The Tremor came without warning. Stone split, the old well cracked, and a strange violet light began seeping up from the valley floor.',
    'Your grandmother\'s farm just outside town survived with a few scratches. Now it is yours.',
    'Mayor Oswin is waiting in the square. Hollowmere needs rebuilding, and it needs you.'
  ];
})();
