// ============================================================
// Dog Quest - game data (heroes, cats, gear, spells, world, quests)
// ============================================================
'use strict';

const WORLD_W = 200, WORLD_H = 150;
const MAX_LEVEL = 50;

// ---------------- Heroes ----------------
const BREEDS = {
  retriever: {
    name: 'Barkley', title: 'Golden Retriever Knight', cls: 'Knight',
    desc: 'A loyal all-rounder. Balanced attack, health and magic.',
    fur: '#e2a54a', fur2: '#f6d38c', ear: 'floppy', tail: 'feather', nose: '#3a2418', eye: '#2b1a10',
    hp: 1.0, atk: 1.0, mag: 1.0, mp: 1.0, spd: 1.0, def: 1.0, crit: 0.08,
    start: { weapon: 'wood_sword', helmet: null, armor: 'cloth_tunic' }, bark: 1.0,
  },
  husky: {
    name: 'Frost', title: 'Husky Mage', cls: 'Mage',
    desc: 'A mystic snow dog. Weaker in melee, but spells hit hard and mana flows freely.',
    fur: '#6f7c8f', fur2: '#f2f5f9', ear: 'pointy', tail: 'bushy', nose: '#1d1f24', eye: '#4fb8ff', mask: true,
    hp: 0.85, atk: 0.85, mag: 1.4, mp: 1.35, spd: 1.0, def: 0.9, crit: 0.06,
    start: { weapon: 'twig_staff', helmet: 'apprentice_hat', armor: null }, bark: 1.15,
  },
  shiba: {
    name: 'Pepper', title: 'Shiba Inu Rogue', cls: 'Rogue',
    desc: 'Lightning quick with a sharp bite. Fast attacks, frequent critical hits and quick rolls.',
    fur: '#d9772b', fur2: '#fbeee0', ear: 'pointy', tail: 'curl', nose: '#2a1a12', eye: '#2b1a10', cheeks: true,
    hp: 0.88, atk: 1.1, mag: 0.9, mp: 0.95, spd: 1.2, def: 0.9, crit: 0.2,
    start: { weapon: 'rusty_dagger', helmet: null, armor: 'cloth_tunic' }, bark: 1.3,
  },
  bulldog: {
    name: 'Tank', title: 'Bulldog Guardian', cls: 'Guardian',
    desc: 'A sturdy wall of wrinkles. Huge health and defense, heavy hits, but a bit slow.',
    fur: '#b88a5e', fur2: '#f3e6d6', ear: 'rose', tail: 'stub', nose: '#2a1d18', eye: '#2b1a10', jowls: true,
    hp: 1.45, atk: 1.08, mag: 0.8, mp: 0.85, spd: 0.88, def: 1.3, crit: 0.06,
    start: { weapon: 'stick', helmet: 'pot_helm', armor: 'cloth_tunic' }, bark: 0.8,
  },
};
const BREED_ORDER = ['retriever', 'husky', 'shiba', 'bulldog'];

// ---------------- Keys & chests ----------------
const KEYS = [
  null,
  { name: 'Wooden Key', color: '#a8743a', dark: '#6b4520' },
  { name: 'Bronze Key', color: '#d08a45', dark: '#8a4f1c' },
  { name: 'Silver Key', color: '#d9e2ea', dark: '#8898a8' },
  { name: 'Gold Key', color: '#ffd23f', dark: '#b8860b' },
  { name: 'Royal Key', color: '#c07cff', dark: '#6b2fb3' },
];

// ---------------- Equipment ----------------
// weapon types: sword, axe, hammer, dagger, staff
const WEAPON_TYPES = {
  sword: { range: 46, speed: 1.0, arc: 1.4, sfx: 'swing' },
  axe: { range: 50, speed: 0.82, arc: 1.5, sfx: 'swingHeavy' },
  hammer: { range: 54, speed: 0.72, arc: 1.6, sfx: 'swingHeavy' },
  dagger: { range: 38, speed: 1.4, arc: 1.2, sfx: 'swing' },
  staff: { range: 44, speed: 0.95, arc: 1.3, sfx: 'swing' },
};
const ITEMS = {
  // ---- weapons ----
  stick: { slot: 'weapon', type: 'sword', name: 'Sturdy Stick', tier: 1, atk: 3, mag: 0, price: 20, look: { blade: '#9a6a3a', hilt: '#6b4520', gem: null, stick: true } },
  wood_sword: { slot: 'weapon', type: 'sword', name: 'Wooden Sword', tier: 1, atk: 5, mag: 0, price: 60, look: { blade: '#c89a60', hilt: '#6b4520', gem: null } },
  twig_staff: { slot: 'weapon', type: 'staff', name: 'Twig Staff', tier: 1, atk: 2, mag: 5, price: 70, look: { blade: '#8a5a2a', hilt: '#6b4520', gem: '#7fe0ff' } },
  rusty_dagger: { slot: 'weapon', type: 'dagger', name: 'Rusty Dagger', tier: 1, atk: 4, mag: 0, price: 50, look: { blade: '#b0826a', hilt: '#5a3a22', gem: null } },
  iron_sword: { slot: 'weapon', type: 'sword', name: 'Iron Sword', tier: 2, atk: 10, mag: 0, price: 320, look: { blade: '#c9d2dc', hilt: '#5a4a3a', gem: null } },
  bone_axe: { slot: 'weapon', type: 'axe', name: 'Bone Axe', tier: 2, atk: 14, mag: 0, price: 380, look: { blade: '#efe6d2', hilt: '#8a6a4a', gem: null } },
  oak_staff: { slot: 'weapon', type: 'staff', name: 'Oak Staff', tier: 2, atk: 4, mag: 11, price: 360, look: { blade: '#6b4a2a', hilt: '#4a3018', gem: '#ff7b2e' } },
  fang_dagger: { slot: 'weapon', type: 'dagger', name: 'Fang Dagger', tier: 2, atk: 8, mag: 0, price: 300, look: { blade: '#f4f0e6', hilt: '#6b3a2a', gem: null } },
  steel_blade: { slot: 'weapon', type: 'sword', name: 'Steel Blade', tier: 3, atk: 18, mag: 0, price: 1200, look: { blade: '#e6eef6', hilt: '#3a5a8a', gem: '#4fb8ff' } },
  war_hammer: { slot: 'weapon', type: 'hammer', name: 'War Hammer', tier: 3, atk: 25, mag: 0, price: 1400, look: { blade: '#8a96a2', hilt: '#5a3a22', gem: null } },
  crystal_staff: { slot: 'weapon', type: 'staff', name: 'Crystal Staff', tier: 3, atk: 7, mag: 19, price: 1300, look: { blade: '#a0c8e8', hilt: '#3a4a6a', gem: '#9ff4ff' } },
  frost_dagger: { slot: 'weapon', type: 'dagger', name: 'Frostbite Dagger', tier: 3, atk: 15, mag: 3, price: 1150, look: { blade: '#aee8ff', hilt: '#2a4a6a', gem: '#e0ffff' } },
  claymore: { slot: 'weapon', type: 'sword', name: "Knight's Claymore", tier: 4, atk: 30, mag: 0, price: 3600, look: { blade: '#f0f4f8', hilt: '#8a1f2a', gem: '#ff4a5a', big: true } },
  moon_staff: { slot: 'weapon', type: 'staff', name: 'Moonlight Staff', tier: 4, atk: 10, mag: 30, price: 3800, look: { blade: '#d8d0ff', hilt: '#3a2a6a', gem: '#c8b8ff' } },
  shadow_kris: { slot: 'weapon', type: 'dagger', name: 'Shadow Kris', tier: 4, atk: 26, mag: 4, price: 3400, look: { blade: '#5a4a7a', hilt: '#1a1a2a', gem: '#b46cff' } },
  magma_axe: { slot: 'weapon', type: 'axe', name: 'Magma Axe', tier: 4, atk: 36, mag: 0, price: 4200, look: { blade: '#ff6a2a', hilt: '#3a1a10', gem: '#ffd23f' } },
  sun_sword: { slot: 'weapon', type: 'sword', name: 'Sunforged Sword', tier: 5, atk: 44, mag: 6, price: 9000, look: { blade: '#ffe89a', hilt: '#b8860b', gem: '#ff9a2a', big: true } },
  titan_hammer: { slot: 'weapon', type: 'hammer', name: 'Titan Hammer', tier: 5, atk: 55, mag: 0, price: 10000, look: { blade: '#6a7a8a', hilt: '#b8860b', gem: '#4fb8ff' } },
  arch_staff: { slot: 'weapon', type: 'staff', name: 'Archmage Scepter', tier: 5, atk: 14, mag: 46, price: 9500, look: { blade: '#ffd23f', hilt: '#6b2fb3', gem: '#ff5aff' } },
  void_dagger: { slot: 'weapon', type: 'dagger', name: 'Void Fang', tier: 5, atk: 38, mag: 8, price: 8800, look: { blade: '#2a1a3a', hilt: '#b46cff', gem: '#ff5aff' } },
  excalibark: { slot: 'weapon', type: 'sword', name: 'Excalibark', tier: 5, atk: 62, mag: 22, price: 20000, chestOnly: true, legendary: true, look: { blade: '#e0fbff', hilt: '#ffd23f', gem: '#4fffc8', big: true } },
  // ---- helmets ----
  leather_cap: { slot: 'helmet', style: 'cap', name: 'Leather Cap', tier: 1, def: 2, hp: 6, mag: 0, price: 50, look: { c1: '#8a5a2a', c2: '#6b4520' } },
  pot_helm: { slot: 'helmet', style: 'pot', name: 'Pot Helmet', tier: 1, def: 3, hp: 4, mag: 0, price: 70, look: { c1: '#8a96a2', c2: '#5a6672' } },
  apprentice_hat: { slot: 'helmet', style: 'wizard', name: 'Apprentice Hat', tier: 1, def: 1, hp: 0, mag: 4, price: 60, look: { c1: '#4a6ab5', c2: '#ffd23f' } },
  iron_helm: { slot: 'helmet', style: 'knight', name: 'Iron Helm', tier: 2, def: 7, hp: 12, mag: 0, price: 350, look: { c1: '#b0bac4', c2: '#6a7682' } },
  wizard_hat: { slot: 'helmet', style: 'wizard', name: 'Wizard Hat', tier: 2, def: 3, hp: 0, mag: 9, price: 380, look: { c1: '#6b2fb3', c2: '#ffd23f' } },
  bandana: { slot: 'helmet', style: 'bandana', name: 'Rogue Bandana', tier: 2, def: 5, hp: 10, mag: 2, price: 320, look: { c1: '#c0303a', c2: '#ffffff' } },
  horned_helm: { slot: 'helmet', style: 'horned', name: 'Horned Helm', tier: 3, def: 13, hp: 25, mag: 0, price: 1200, look: { c1: '#9aa4ae', c2: '#efe6d2' } },
  frost_crown: { slot: 'helmet', style: 'crown', name: 'Frost Circlet', tier: 3, def: 8, hp: 10, mag: 15, price: 1300, look: { c1: '#aee8ff', c2: '#4fb8ff' } },
  shadow_hood: { slot: 'helmet', style: 'hood', name: 'Shadow Hood', tier: 3, def: 11, hp: 20, mag: 5, price: 1150, look: { c1: '#3a3048', c2: '#b46cff' } },
  knight_helm: { slot: 'helmet', style: 'knight', name: 'Knight Helm', tier: 4, def: 20, hp: 40, mag: 0, price: 3500, look: { c1: '#e6eef6', c2: '#c0303a' } },
  sun_mask: { slot: 'helmet', style: 'crown', name: 'Sun Diadem', tier: 4, def: 14, hp: 20, mag: 23, price: 3700, look: { c1: '#ffd23f', c2: '#ff7b2e' } },
  kabuto: { slot: 'helmet', style: 'horned', name: 'Samurai Kabuto', tier: 4, def: 22, hp: 32, mag: 3, price: 3800, look: { c1: '#8a1f2a', c2: '#ffd23f' } },
  dragon_helm: { slot: 'helmet', style: 'horned', name: 'Dragon Helm', tier: 5, def: 30, hp: 70, mag: 5, price: 9000, look: { c1: '#2f7a4a', c2: '#ffd23f' } },
  archmage_hat: { slot: 'helmet', style: 'wizard', name: 'Archmage Hat', tier: 5, def: 18, hp: 25, mag: 33, price: 9200, look: { c1: '#1f1f5a', c2: '#ff5aff' } },
  royal_crown: { slot: 'helmet', style: 'crown', name: 'Crown of Pawtopia', tier: 5, def: 28, hp: 60, mag: 26, price: 20000, chestOnly: true, legendary: true, look: { c1: '#ffd23f', c2: '#c0303a' } },
  // ---- armor ----
  cloth_tunic: { slot: 'armor', style: 'cloth', name: 'Cloth Tunic', tier: 1, def: 3, hp: 10, mag: 0, price: 60, look: { c1: '#6a8a5a', c2: '#4a6a3a' } },
  leather_vest: { slot: 'armor', style: 'leather', name: 'Leather Vest', tier: 1, def: 5, hp: 14, mag: 0, price: 90, look: { c1: '#8a5a2a', c2: '#5a3a1a' } },
  novice_robe: { slot: 'armor', style: 'robe', name: 'Novice Robe', tier: 1, def: 2, hp: 4, mag: 4, price: 80, look: { c1: '#4a6ab5', c2: '#ffd23f' } },
  chainmail: { slot: 'armor', style: 'chain', name: 'Chainmail', tier: 2, def: 11, hp: 25, mag: 0, price: 400, look: { c1: '#9aa4ae', c2: '#6a7682' } },
  mage_robe: { slot: 'armor', style: 'robe', name: 'Mage Robe', tier: 2, def: 5, hp: 10, mag: 10, price: 420, look: { c1: '#6b2fb3', c2: '#ffd23f' } },
  ninja_garb: { slot: 'armor', style: 'leather', name: 'Ninja Garb', tier: 2, def: 9, hp: 20, mag: 2, price: 380, look: { c1: '#2a2a3a', c2: '#c0303a' } },
  iron_plate: { slot: 'armor', style: 'plate', name: 'Iron Plate', tier: 3, def: 19, hp: 45, mag: 0, price: 1400, look: { c1: '#b0bac4', c2: '#6a7682' } },
  frost_mail: { slot: 'armor', style: 'chain', name: 'Frost Mail', tier: 3, def: 16, hp: 35, mag: 8, price: 1500, look: { c1: '#aee8ff', c2: '#3a7ab5' } },
  mystic_robe: { slot: 'armor', style: 'robe', name: 'Mystic Robe', tier: 3, def: 9, hp: 20, mag: 18, price: 1350, look: { c1: '#2a8a8a', c2: '#9ff4ff' } },
  knight_armor: { slot: 'armor', style: 'plate', name: 'Knight Armor', tier: 4, def: 28, hp: 70, mag: 0, price: 4000, look: { c1: '#e6eef6', c2: '#c0303a' } },
  ember_plate: { slot: 'armor', style: 'plate', name: 'Ember Plate', tier: 4, def: 32, hp: 60, mag: 4, price: 4200, look: { c1: '#8a2a1a', c2: '#ff9a2a' } },
  star_robe: { slot: 'armor', style: 'robe', name: 'Starweave Robe', tier: 4, def: 14, hp: 30, mag: 28, price: 3900, look: { c1: '#1f1f5a', c2: '#ffd23f' } },
  paladin_plate: { slot: 'armor', style: 'plate', name: 'Paladin Plate', tier: 5, def: 42, hp: 110, mag: 6, price: 9500, look: { c1: '#fff4c8', c2: '#b8860b' } },
  celestial_robe: { slot: 'armor', style: 'robe', name: 'Celestial Robe', tier: 5, def: 22, hp: 45, mag: 42, price: 9500, look: { c1: '#f0f0ff', c2: '#6ab5ff' } },
  royal_armor: { slot: 'armor', style: 'plate', name: 'Royal Pawguard', tier: 5, def: 46, hp: 120, mag: 25, price: 20000, chestOnly: true, legendary: true, look: { c1: '#6b2fb3', c2: '#ffd23f' } },
};
for (const id in ITEMS) ITEMS[id].id = id;

const TIER_COLORS = ['#ffffff', '#c8c8c8', '#6ad86a', '#4fb8ff', '#c07cff', '#ffb13b'];
const TIER_NAMES = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

// ---------------- Spells ----------------
const SPELLS = {
  flame: { name: 'Flame Bark', desc: 'Hurl a blazing fireball that explodes on impact.', cost: 14, cd: 0.45, power: 1.7, color: '#ff7b2e', price: 0, upBase: 150 },
  heal: { name: 'Healing Lick', desc: 'Restore health to yourself and a nearby ally.', cost: 24, cd: 1.5, power: 1.3, color: '#6aff8a', price: 250, upBase: 200 },
  thunder: { name: 'Thunder Paw', desc: 'Strike up to 3 nearby enemies with lightning.', cost: 24, cd: 0.9, power: 2.3, color: '#ffe84a', price: 450, upBase: 300 },
  frost: { name: 'Frost Howl', desc: 'Blast a cone of freezing shards that slows enemies.', cost: 18, cd: 0.6, power: 0.8, color: '#7fe0ff', price: 700, upBase: 400 },
  shield: { name: 'Bone Shield', desc: 'Orbiting bones absorb damage and bash nearby foes.', cost: 28, cd: 5, power: 0.6, color: '#f4f0e6', price: 1000, upBase: 500 },
  quake: { name: 'Earthquake Stomp', desc: 'Slam the ground to damage and stun all enemies around you.', cost: 30, cd: 1.6, power: 2.2, color: '#c8a064', price: 1800, upBase: 700 },
  spirit: { name: 'Spirit Wolves', desc: 'Summon ghostly wolves that hunt down enemies.', cost: 32, cd: 1.1, power: 1.25, color: '#9ab8ff', price: 3200, upBase: 1000 },
  meteor: { name: 'Meteor Howl', desc: 'Call a devastating meteor down on your foes.', cost: 45, cd: 2.2, power: 5.2, color: '#ff4a2a', price: 6500, upBase: 1500 },
};
const SPELL_ORDER = ['flame', 'heal', 'thunder', 'frost', 'shield', 'quake', 'spirit', 'meteor'];
const SPELL_MAX = 10;

// ---------------- Enemies (cats!) ----------------
// ai: melee, archer, caster, dasher, pouncer, brute, breath, ninja
const ENEMIES = {
  kitten: { name: 'Kitten Scout', ai: 'melee', size: 0.72, hp: 0.55, atk: 0.7, spd: 95, xp: 0.7, gold: 0.7, fur: '#e8a15a', belly: '#fbe3c4', pattern: 'stripes', stripe: '#b8692b', eye: '#6fdc5a', acc: 'none' },
  tabby: { name: 'Tabby Brawler', ai: 'melee', size: 0.95, hp: 1.0, atk: 1.0, spd: 88, xp: 1, gold: 1, fur: '#c98a4b', belly: '#f3dcb8', pattern: 'stripes', stripe: '#7a4a22', eye: '#f5d142', acc: 'bandana', accColor: '#c0303a' },
  siamese: { name: 'Siamese Archer', ai: 'archer', size: 0.92, hp: 0.8, atk: 0.95, spd: 85, xp: 1.1, gold: 1.1, fur: '#efe3cf', belly: '#fbf5ea', pattern: 'points', stripe: '#5a4234', eye: '#4fb8ff', acc: 'bow' },
  witch: { name: 'Black Cat Witch', ai: 'caster', size: 0.92, hp: 0.8, atk: 1.15, spd: 75, xp: 1.2, gold: 1.2, fur: '#2b2533', belly: '#3d3547', pattern: 'solid', eye: '#b6ff4a', acc: 'witchhat', accColor: '#4a2a6a', element: 'dark' },
  caracal: { name: 'Desert Caracal', ai: 'pouncer', size: 1.0, hp: 0.95, atk: 1.1, spd: 110, xp: 1.1, gold: 1, fur: '#c99a61', belly: '#f0dcc0', pattern: 'solid', eye: '#ffd23f', acc: 'none', tufts: true },
  sphynx: { name: 'Sphynx Assassin', ai: 'dasher', size: 0.92, hp: 0.75, atk: 1.2, spd: 120, xp: 1.2, gold: 1.2, fur: '#e9b8a8', belly: '#f5d4c8', pattern: 'hairless', eye: '#9fffe0', acc: 'mask', accColor: '#6b2f5a' },
  mummy: { name: 'Mummy Cat', ai: 'melee', size: 1.05, hp: 1.35, atk: 1.0, spd: 62, xp: 1.2, gold: 1.1, fur: '#8a7a5a', belly: '#b9a27a', pattern: 'bandage', eye: '#ff4a4a', acc: 'none' },
  snowleopard: { name: 'Snow Leopard', ai: 'breath', element: 'ice', size: 1.12, hp: 1.2, atk: 1.1, spd: 95, xp: 1.3, gold: 1.2, fur: '#e6e8ee', belly: '#ffffff', pattern: 'spots', stripe: '#6b6f7c', eye: '#8fe3ff', acc: 'scarf', accColor: '#3a7ab5' },
  persian: { name: 'Persian Knight', ai: 'brute', size: 1.2, hp: 1.6, atk: 1.2, spd: 60, xp: 1.5, gold: 1.4, fur: '#f1ece6', belly: '#ffffff', pattern: 'fluffy', eye: '#ff9d2e', acc: 'knighthelm', armored: true },
  forestcat: { name: 'Norwegian Brute', ai: 'brute', size: 1.3, hp: 1.8, atk: 1.3, spd: 70, xp: 1.6, gold: 1.5, fur: '#8a7a6a', belly: '#d8cfc4', pattern: 'fluffy', stripe: '#5a4a3a', eye: '#ffcc33', acc: 'horns' },
  frostwitch: { name: 'Frost Witch', ai: 'caster', element: 'ice', size: 0.95, hp: 0.85, atk: 1.2, spd: 75, xp: 1.3, gold: 1.3, fur: '#dfe8f5', belly: '#ffffff', pattern: 'solid', eye: '#3fd0ff', acc: 'witchhat', accColor: '#3a6ea5' },
  ninja: { name: 'Ninja Cat', ai: 'ninja', size: 0.92, hp: 0.9, atk: 1.2, spd: 120, xp: 1.4, gold: 1.4, fur: '#3a3a44', belly: '#4a4a55', pattern: 'solid', eye: '#ff5050', acc: 'ninjamask', accColor: '#c0303a' },
  bengal: { name: 'Bengal Hunter', ai: 'pouncer', size: 1.05, hp: 1.05, atk: 1.15, spd: 115, xp: 1.3, gold: 1.3, fur: '#d99b3f', belly: '#f6e2c0', pattern: 'spots', stripe: '#5a3514', eye: '#9bff3f', acc: 'none' },
  mainecoon: { name: 'Maine Coon Brute', ai: 'brute', size: 1.4, hp: 2.0, atk: 1.35, spd: 65, xp: 1.8, gold: 1.7, fur: '#7a5236', belly: '#c8a888', pattern: 'fluffy', stripe: '#4a2f1c', eye: '#ffb13b', acc: 'club' },
  panther: { name: 'Shadow Panther', ai: 'dasher', size: 1.2, hp: 1.2, atk: 1.3, spd: 140, xp: 1.6, gold: 1.5, fur: '#1b1a22', belly: '#26242f', pattern: 'solid', eye: '#ffe14a', acc: 'none' },
  firelynx: { name: 'Fire Lynx', ai: 'breath', element: 'fire', size: 1.1, hp: 1.2, atk: 1.25, spd: 100, xp: 1.6, gold: 1.5, fur: '#d9602a', belly: '#f6c090', pattern: 'spots', stripe: '#7a1f0a', eye: '#fff04a', acc: 'none', tufts: true },
  cheetah: { name: 'Cheetah Runner', ai: 'dasher', size: 1.1, hp: 1.0, atk: 1.25, spd: 175, xp: 1.6, gold: 1.5, fur: '#e8b54a', belly: '#fbecc8', pattern: 'spots', stripe: '#2a1a0a', eye: '#ffcf3f', acc: 'none', tears: true },
  tiger: { name: 'Tiger Warrior', ai: 'brute', size: 1.5, hp: 2.2, atk: 1.4, spd: 85, xp: 2, gold: 2, fur: '#ec8a2a', belly: '#fbe7cf', pattern: 'stripes', stripe: '#1f130a', eye: '#ffd23f', acc: 'samurai', accColor: '#8a1f2a' },
  lioness: { name: 'Lioness Guard', ai: 'pouncer', size: 1.35, hp: 1.8, atk: 1.4, spd: 125, xp: 2, gold: 2, fur: '#d9a760', belly: '#f6e2c0', pattern: 'solid', eye: '#ffcf3f', acc: 'collar', accColor: '#ffd23f' },
};
for (const id in ENEMIES) ENEMIES[id].id = id;

// Boss definitions: based on a cat type, scaled up with attack patterns.
const BOSSES = {
  big_tom: { name: 'Big Tom', base: 'tabby', scale: 2.0, hp: 9, atk: 1.2, moves: ['swipe', 'slam', 'summon'], acc: 'crown', accColor: '#ffd23f', fur: '#b8763a' },
  clawdia: { name: 'Captain Clawdia', base: 'siamese', scale: 1.9, hp: 7.5, atk: 1.2, moves: ['volley', 'dash', 'swipe', 'summon'], acc: 'pirate', accColor: '#2a2a2a' },
  foreman: { name: 'Foreman Furball', base: 'mainecoon', scale: 1.7, hp: 10, atk: 1.2, moves: ['slam', 'quake', 'swipe'], acc: 'hardhat', accColor: '#ffd23f' },
  nip_lord: { name: 'The Nip Lord', base: 'witch', scale: 1.9, hp: 9, atk: 1.25, moves: ['orbs', 'circles', 'summon', 'teleport'], acc: 'witchhat', accColor: '#2f7a4a', fur: '#3a2a4a' },
  mangy_max: { name: 'Mangy Max', base: 'tabby', scale: 2.0, hp: 10, atk: 1.25, moves: ['swipe', 'dash', 'slam', 'summon'], acc: 'eyepatch', fur: '#8a8078', stripe: '#4a4038' },
  pharaoh: { name: 'Pharaoh Fluffhotep', base: 'sphynx', scale: 2.0, hp: 10, atk: 1.25, moves: ['circles', 'orbs', 'summon', 'dash'], acc: 'pharaoh', accColor: '#ffd23f' },
  sandclaw: { name: 'Sandclaw', base: 'caracal', scale: 1.9, hp: 10, atk: 1.25, moves: ['pounce', 'swipe', 'volley'], acc: 'crown', accColor: '#d08a45' },
  mirage_queen: { name: 'The Mirage Queen', base: 'siamese', scale: 1.9, hp: 10, atk: 1.3, moves: ['orbs', 'teleport', 'circles', 'volley'], acc: 'tiara', accColor: '#ff5aff', fur: '#f5e8ff' },
  scarab_king: { name: 'Scarab King Mau', base: 'mummy', scale: 2.0, hp: 11, atk: 1.3, moves: ['slam', 'summon', 'circles', 'quake'], acc: 'pharaoh', accColor: '#4fb8ff' },
  frostwhisk: { name: 'Tsarina Frostwhisk', base: 'snowleopard', scale: 2.0, hp: 11, atk: 1.3, moves: ['breath', 'circles', 'pounce', 'summon'], acc: 'tiara', accColor: '#aee8ff' },
  icebeard: { name: 'Icebeard', base: 'forestcat', scale: 1.8, hp: 11, atk: 1.3, moves: ['slam', 'breath', 'swipe', 'quake'], acc: 'horns', element: 'ice', fur: '#c8d8e8' },
  sir_fluff: { name: 'Sir Fluffington', base: 'persian', scale: 1.8, hp: 12, atk: 1.3, moves: ['slam', 'swipe', 'dash', 'summon'], acc: 'knighthelm' },
  yowlgar: { name: 'Yowlgar the Howler', base: 'snowleopard', scale: 2.1, hp: 12, atk: 1.35, moves: ['pounce', 'breath', 'quake', 'orbs'], acc: 'horns', fur: '#b8c0cc' },
  nightpaw: { name: 'Nightpaw', base: 'panther', scale: 1.9, hp: 12, atk: 1.35, moves: ['dash', 'teleport', 'orbs', 'summon'], acc: 'crown', accColor: '#b46cff' },
  shuriken: { name: 'Master Shuriken', base: 'ninja', scale: 1.8, hp: 11, atk: 1.35, moves: ['teleport', 'volley', 'dash', 'summon'], acc: 'ninjamask', accColor: '#ffd23f' },
  grimalkin: { name: 'Grimalkin the Witch', base: 'witch', scale: 2.0, hp: 12, atk: 1.4, moves: ['circles', 'orbs', 'summon', 'teleport'], acc: 'witchhat', accColor: '#8a1f2a' },
  gnarlwhisker: { name: 'Old Gnarlwhisker', base: 'bengal', scale: 1.9, hp: 11, atk: 1.3, moves: ['pounce', 'swipe', 'summon', 'volley'], acc: 'crown', accColor: '#2f7a4a' },
  infernus: { name: 'Infernus', base: 'firelynx', scale: 2.2, hp: 13, atk: 1.4, moves: ['breath', 'circles', 'dash', 'slam', 'orbs'], acc: 'horns', element: 'fire' },
  forgemaster: { name: 'Forgemaster Brass', base: 'mainecoon', scale: 1.8, hp: 13, atk: 1.4, moves: ['slam', 'quake', 'circles', 'swipe'], acc: 'hardhat', accColor: '#d08a45' },
  obsidian: { name: 'Obsidian Stalker', base: 'panther', scale: 2.0, hp: 13, atk: 1.45, moves: ['dash', 'teleport', 'circles', 'orbs'], acc: 'horns', fur: '#2a1a2a', eye: '#ff4a2a' },
  sheba: { name: 'Queen Sheba', base: 'lioness', scale: 2.0, hp: 14, atk: 1.45, moves: ['pounce', 'swipe', 'summon', 'roar', 'dash'], acc: 'tiara', accColor: '#ffd23f' },
  king_leo: { name: 'King Leo, the Lion Tyrant', base: 'lioness', scale: 3.0, hp: 30, atk: 1.5, moves: ['swipe', 'roar', 'charge', 'meteor', 'summon', 'orbs'], lion: true, acc: 'crown', accColor: '#ffd23f', fur: '#d9a040' },
};

// ---------------- Regions ----------------
const REGIONS = [
  { id: 0, key: 'meadows', name: 'Barkshire Meadows', cx: 48, cy: 80, lv: [1, 8], music: 'world', enemies: ['kitten', 'kitten', 'tabby', 'tabby', 'siamese', 'witch'], ground: 'grass' },
  { id: 1, key: 'desert', name: 'Sandpaw Desert', cx: 92, cy: 124, lv: [8, 16], music: 'desert', enemies: ['caracal', 'sphynx', 'mummy', 'siamese'], ground: 'desert' },
  { id: 2, key: 'tundra', name: 'Frostfang Tundra', cx: 80, cy: 28, lv: [14, 22], music: 'snow', enemies: ['snowleopard', 'persian', 'forestcat', 'frostwitch'], ground: 'snow' },
  { id: 3, key: 'woods', name: 'Whisker Woods', cx: 132, cy: 72, lv: [20, 30], music: 'woods', enemies: ['ninja', 'bengal', 'witch', 'mainecoon', 'panther'], ground: 'dark' },
  { id: 4, key: 'ember', name: 'Ember Wastes', cx: 160, cy: 122, lv: [28, 38], music: 'ember', enemies: ['firelynx', 'mainecoon', 'cheetah', 'tiger'], ground: 'ash' },
  { id: 5, key: 'pride', name: 'The Pride Lands', cx: 165, cy: 30, lv: [35, 45], music: 'pride', enemies: ['tiger', 'panther', 'cheetah', 'lioness'], ground: 'savanna' },
];

// ---------------- Towns ----------------
const TOWNS = {
  pawston: {
    name: 'Pawston', region: 0, tx: 44, ty: 84, color: '#c0503a',
    smith: ['wood_sword', 'twig_staff', 'rusty_dagger', 'iron_sword', 'fang_dagger', 'leather_cap', 'pot_helm', 'apprentice_hat', 'cloth_tunic', 'leather_vest', 'novice_robe'],
    mage: ['heal', 'thunder'],
    npcs: [
      { id: 'elder', name: 'Elder Barkus', look: { breed: 'retriever', fur: '#b8b0a4', fur2: '#ece6dc', beard: true, hat: 'none' }, pos: [0, -2],
        lines: ['Our kingdom needs you, young pup. Be brave!', 'King Leo grows stronger every day. Gather the four Royal Seals!', 'Remember: roll away when the ground glows red!'] },
      { id: 'waggles', name: 'Mrs. Waggles', look: { breed: 'bulldog', fur: '#d8b8a0', fur2: '#fff0e6', bow: '#ff5a8a' }, pos: [-3, 3], wander: true,
        lines: ['Oh dear, my little Biscuit loves to wander off...', 'Have you tried the Healing Lick spell? The mage tower sells it!'] },
      { id: 'rufus', name: 'Guard Rufus', look: { breed: 'husky', fur: '#5a4a3a', fur2: '#e8dccc', helmet: 'iron_helm' }, pos: [6, 1],
        lines: ['Cats spotted near the meadows again. Stay sharp!', 'Tip: chests come in five kinds. Each needs its own key!'] },
      { id: 'pip', name: 'Pip', look: { breed: 'shiba', fur: '#e8c080', fur2: '#fff6e8', small: true }, pos: [3, 4], wander: true,
        lines: ['When I grow up I want to be a hero like you!', 'Did you know? Hitting enemies with your weapon restores mana!'] },
    ],
  },
  dunebark: {
    name: 'Dunebark', region: 1, tx: 88, ty: 118, color: '#d0a040',
    smith: ['iron_sword', 'bone_axe', 'oak_staff', 'fang_dagger', 'iron_helm', 'wizard_hat', 'bandana', 'chainmail', 'mage_robe', 'ninja_garb'],
    mage: ['heal', 'thunder', 'shield'],
    npcs: [
      { id: 'chief', name: 'Chief Sniffsworth', look: { breed: 'retriever', fur: '#c8a070', fur2: '#f6e6c8', hat: 'turban', hatColor: '#ffffff' }, pos: [0, -2],
        lines: ['The sands whisper of the Sphinx Tomb, south-east of here.', 'Stay hydrated, heroes. Pant often!'] },
      { id: 'sandy', name: 'Merchant Sandy', look: { breed: 'shiba', fur: '#c89a60', fur2: '#fff0dc', hat: 'turban', hatColor: '#c0303a' }, pos: [-2, 3], wander: true,
        lines: ['Desert cats are sneaky. Watch for Sphynx dashes!', 'Business has been ruff since the lion took over.'] },
      { id: 'dune_guard', name: 'Guard Dusty', look: { breed: 'bulldog', fur: '#a07850', fur2: '#f0dcc0', helmet: 'pot_helm' }, pos: [7, 0],
        lines: ['Caracals pounce from afar. Move when you see the red circle!'] },
    ],
  },
  snowmuzzle: {
    name: 'Snowmuzzle', region: 2, tx: 72, ty: 34, color: '#4a7ab5',
    smith: ['steel_blade', 'war_hammer', 'crystal_staff', 'frost_dagger', 'horned_helm', 'frost_crown', 'shadow_hood', 'iron_plate', 'frost_mail', 'mystic_robe', 'chainmail'],
    mage: ['frost', 'quake', 'shield'],
    npcs: [
      { id: 'jarl', name: 'Jarl Woofgar', look: { breed: 'husky', fur: '#4a4a52', fur2: '#f2f5f9', beard: true, helmet: 'horned_helm' }, pos: [0, -2],
        lines: ['The Frozen Den lies to the north-east. Its queen is as cold as her heart.', 'A true Snowmuzzle dog fears nothing but bath time.'] },
      { id: 'olga', name: 'Olga', look: { breed: 'bulldog', fur: '#e8e0d8', fur2: '#ffffff', hat: 'beanie', hatColor: '#c0303a' }, pos: [2, 4], wander: true,
        lines: ['Brr! Want some hot bone broth?', 'The Frost Witches freeze you solid. Keep moving!'] },
    ],
  },
  fortfido: {
    name: 'Fort Fido', region: 3, tx: 120, ty: 80, color: '#3a8a4a',
    smith: ['steel_blade', 'crystal_staff', 'claymore', 'moon_staff', 'shadow_kris', 'knight_helm', 'kabuto', 'shadow_hood', 'knight_armor', 'star_robe', 'iron_plate'],
    mage: ['spirit', 'shield', 'frost'],
    npcs: [
      { id: 'captain', name: 'Captain Rover', look: { breed: 'retriever', fur: '#6a4a2a', fur2: '#d8b890', helmet: 'knight_helm' }, pos: [0, -2],
        lines: ['The Shadow Grove is east of here. Nightpaw lurks within.', 'Fort Fido has never fallen. Not on my watch!'] },
      { id: 'scout', name: 'Scout Sniffer', look: { breed: 'shiba', fur: '#3a3a3a', fur2: '#d8d0c8', hat: 'bandana', hatColor: '#2f7a4a' }, pos: [-7, 0], wander: true,
        lines: ['Ninja cats teleport behind you. Keep your ears up!'] },
    ],
  },
  cinderpaw: {
    name: 'Cinderpaw Camp', region: 4, tx: 148, ty: 116, color: '#c04a2a',
    smith: ['claymore', 'magma_axe', 'moon_staff', 'sun_sword', 'titan_hammer', 'arch_staff', 'void_dagger', 'sun_mask', 'dragon_helm', 'archmage_hat', 'ember_plate', 'paladin_plate', 'celestial_robe'],
    mage: ['meteor', 'quake', 'spirit'],
    npcs: [
      { id: 'emberpaw', name: 'Smith Emberpaw', look: { breed: 'bulldog', fur: '#5a3a2a', fur2: '#d8a888', hat: 'bandana', hatColor: '#ff7b2e' }, pos: [0, -2],
        lines: ['The Magma Lair burns south-east of here. Bring your best armor!', 'I forge the finest blades this side of the volcano.'] },
      { id: 'ash', name: 'Ash', look: { breed: 'husky', fur: '#3a3a3a', fur2: '#9a9a9a' }, pos: [3, 3], wander: true,
        lines: ['Tigers here hit like falling boulders. Dodge, dodge, dodge!'] },
    ],
  },
};
const TOWN_ORDER = ['pawston', 'dunebark', 'snowmuzzle', 'fortfido', 'cinderpaw'];

// ---------------- Dungeons (22) ----------------
// theme: cave, tomb, ice, ruin, lava, castle, crypt, mine, temple
const DUNGEONS = [
  { id: 'puppy_cave', name: 'Puppy Cave', region: 0, tx: 34, ty: 72, level: 2, theme: 'cave', rooms: 4, enemies: ['kitten', 'tabby'], boss: 'big_tom', chests: [1, 2], main: true, reward: { key: 1, gold: 60 } },
  { id: 'mousetrap_mine', name: 'Mousetrap Mine', region: 0, tx: 26, ty: 94, level: 4, theme: 'mine', rooms: 5, enemies: ['kitten', 'tabby', 'siamese'], boss: 'foreman', chests: [1, 1, 2], reward: { gold: 120 } },
  { id: 'whisker_hollow', name: 'Whisker Hollow', region: 0, tx: 62, ty: 96, level: 5, theme: 'ruin', rooms: 5, enemies: ['tabby', 'siamese', 'kitten'], boss: 'clawdia', chests: [1, 2, 3], main: true, reward: { gold: 150 } },
  { id: 'catnip_cellar', name: 'Catnip Cellar', region: 0, tx: 56, ty: 64, level: 7, theme: 'crypt', rooms: 5, enemies: ['witch', 'tabby', 'siamese'], boss: 'nip_lord', chests: [1, 2, 4], reward: { gold: 200 } },
  { id: 'old_kennel', name: 'Old Kennel Ruins', region: 0, tx: 68, ty: 78, level: 9, theme: 'ruin', rooms: 6, enemies: ['tabby', 'witch', 'siamese'], boss: 'mangy_max', chests: [2, 3, 5], reward: { gold: 280 } },
  { id: 'dune_burrow', name: 'Dune Burrow', region: 1, tx: 76, ty: 130, level: 10, theme: 'tomb', rooms: 5, enemies: ['caracal', 'mummy', 'siamese'], boss: 'sandclaw', chests: [1, 2, 3], reward: { gold: 320 } },
  { id: 'sphinx_tomb', name: 'Sphinx Tomb', region: 1, tx: 102, ty: 132, level: 13, theme: 'tomb', rooms: 7, enemies: ['sphynx', 'mummy', 'caracal'], boss: 'pharaoh', chests: [2, 2, 3], main: true, reward: { key: 2, seal: 'sun', gold: 500 } },
  { id: 'mirage_temple', name: 'Mirage Temple', region: 1, tx: 110, ty: 112, level: 15, theme: 'temple', rooms: 6, enemies: ['sphynx', 'siamese', 'witch'], boss: 'mirage_queen', chests: [2, 3, 4], reward: { gold: 600 } },
  { id: 'scarab_catacombs', name: 'Scarab Catacombs', region: 1, tx: 84, ty: 140, level: 17, theme: 'crypt', rooms: 7, enemies: ['mummy', 'sphynx', 'caracal'], boss: 'scarab_king', chests: [2, 3, 5], reward: { gold: 750 } },
  { id: 'icicle_grotto', name: 'Icicle Grotto', region: 2, tx: 58, ty: 24, level: 16, theme: 'ice', rooms: 6, enemies: ['snowleopard', 'frostwitch'], boss: 'icebeard', chests: [2, 3, 3], reward: { gold: 700 } },
  { id: 'frozen_den', name: 'Frozen Den', region: 2, tx: 90, ty: 18, level: 20, theme: 'ice', rooms: 8, enemies: ['snowleopard', 'persian', 'frostwitch', 'forestcat'], boss: 'frostwhisk', chests: [3, 3, 4], main: true, reward: { key: 3, seal: 'frost', gold: 1000 } },
  { id: 'glacier_vault', name: 'Glacier Vault', region: 2, tx: 102, ty: 34, level: 22, theme: 'castle', rooms: 7, enemies: ['persian', 'forestcat', 'frostwitch'], boss: 'sir_fluff', chests: [3, 4, 5], reward: { gold: 1100 } },
  { id: 'howling_peak', name: 'Howling Peak', region: 2, tx: 70, ty: 14, level: 24, theme: 'ice', rooms: 7, enemies: ['snowleopard', 'forestcat', 'persian'], boss: 'yowlgar', chests: [3, 4, 4], reward: { gold: 1300 } },
  { id: 'mossy_ruins', name: 'Mossy Ruins', region: 3, tx: 112, ty: 68, level: 23, theme: 'ruin', rooms: 6, enemies: ['bengal', 'witch', 'ninja'], boss: 'gnarlwhisker', chests: [3, 3, 4], reward: { gold: 1200 } },
  { id: 'ninja_dojo', name: 'Ninja Dojo', region: 3, tx: 126, ty: 58, level: 25, theme: 'temple', rooms: 7, enemies: ['ninja', 'panther', 'bengal'], boss: 'shuriken', chests: [3, 4, 4], reward: { gold: 1500 } },
  { id: 'shadow_grove', name: 'Shadow Grove', region: 3, tx: 148, ty: 64, level: 27, theme: 'ruin', rooms: 8, enemies: ['panther', 'ninja', 'witch', 'mainecoon'], boss: 'nightpaw', chests: [3, 4, 4], main: true, reward: { key: 4, seal: 'moon', gold: 1800 } },
  { id: 'witch_hollow', name: "Witch's Hollow", region: 3, tx: 140, ty: 90, level: 29, theme: 'crypt', rooms: 7, enemies: ['witch', 'panther', 'mainecoon'], boss: 'grimalkin', chests: [4, 4, 5], reward: { gold: 2000 } },
  { id: 'cinder_forge', name: 'Cinder Forge', region: 4, tx: 138, ty: 130, level: 31, theme: 'mine', rooms: 7, enemies: ['firelynx', 'mainecoon', 'tiger'], boss: 'forgemaster', chests: [4, 4, 5], reward: { gold: 2400 } },
  { id: 'magma_lair', name: 'Magma Lair', region: 4, tx: 170, ty: 132, level: 34, theme: 'lava', rooms: 8, enemies: ['firelynx', 'tiger', 'cheetah', 'mainecoon'], boss: 'infernus', chests: [4, 5, 5], main: true, reward: { key: 5, seal: 'flame', gold: 3000 } },
  { id: 'obsidian_depths', name: 'Obsidian Depths', region: 4, tx: 178, ty: 108, level: 37, theme: 'lava', rooms: 8, enemies: ['cheetah', 'tiger', 'firelynx', 'panther'], boss: 'obsidian', chests: [4, 5, 5], reward: { gold: 3500 } },
  { id: 'pride_arena', name: 'Pridelands Arena', region: 5, tx: 150, ty: 38, level: 40, theme: 'temple', rooms: 8, enemies: ['lioness', 'tiger', 'cheetah'], boss: 'sheba', chests: [5, 5, 5], reward: { gold: 5000 } },
  { id: 'lions_keep', name: "Lion's Keep", region: 5, tx: 176, ty: 22, level: 44, theme: 'castle', rooms: 9, enemies: ['lioness', 'tiger', 'panther', 'cheetah'], boss: 'king_leo', chests: [5, 5], main: true, final: true, reward: { gold: 10000 } },
];
const DUNGEON_BY_ID = {};
DUNGEONS.forEach((d, i) => { d.index = i; DUNGEON_BY_ID[d.id] = d; });

const THEMES = {
  cave: { floor: '#6b5a48', floor2: '#5e4e3e', wall: '#3a2e24', wallTop: '#4e3f31', accent: '#8a7458', light: '#ffb060', dark: 0.55, deco: ['rock', 'mushroom', 'bones'] },
  mine: { floor: '#5a5048', floor2: '#4e453e', wall: '#2e2824', wallTop: '#443a33', accent: '#8a6a3a', light: '#ffc070', dark: 0.6, deco: ['cart', 'rock', 'crystal'] },
  tomb: { floor: '#c8a870', floor2: '#b8985f', wall: '#7a5e38', wallTop: '#9a7a4a', accent: '#e8c890', light: '#ffd080', dark: 0.45, deco: ['urn', 'pillar', 'bones'] },
  temple: { floor: '#a89a8a', floor2: '#988a7a', wall: '#5a4a5a', wallTop: '#6e5e6e', accent: '#d8b860', light: '#ffe0a0', dark: 0.45, deco: ['pillar', 'statue', 'urn'] },
  ice: { floor: '#a8c8e0', floor2: '#98b8d4', wall: '#4a6a8a', wallTop: '#6a8aaa', accent: '#e0f4ff', light: '#b0e8ff', dark: 0.4, deco: ['crystal', 'icicle', 'rock'] },
  ruin: { floor: '#6a7a5a', floor2: '#5e6e4e', wall: '#3a4a34', wallTop: '#4e5e46', accent: '#8aa86a', light: '#d0ff90', dark: 0.5, deco: ['pillar', 'mushroom', 'vines'] },
  crypt: { floor: '#5a5a66', floor2: '#4e4e5a', wall: '#26262e', wallTop: '#383842', accent: '#8a7aaa', light: '#b890ff', dark: 0.62, deco: ['bones', 'urn', 'candle'] },
  lava: { floor: '#4a3434', floor2: '#3e2c2c', wall: '#1e1414', wallTop: '#2e1e1e', accent: '#ff6a2a', light: '#ff8a40', dark: 0.5, deco: ['lavapool', 'rock', 'crystal'] },
  castle: { floor: '#7a6a8a', floor2: '#6e5e7e', wall: '#2e243a', wallTop: '#42364e', accent: '#ffd23f', light: '#ffd890', dark: 0.5, deco: ['pillar', 'banner', 'statue'] },
};

// ---------------- Quests ----------------
// objective types: talk{npc}, clear{dungeon}, kill{count, enemy?, region?}, goto{tx,ty,label}, chests{count}
const QUESTS = {
  m1: { main: true, name: 'A New Leash on Life', desc: 'Elder Barkus is waiting for you in the center of Pawston.', obj: { type: 'talk', npc: 'elder' }, next: 'm2', reward: { gold: 50, xp: 20, item: 'leather_cap' },
    talk: ['Ah, you are awake at last! Look at that paw... the Mark of the Paw! You are the hero of legend!', 'King Leo and his cat army have taken our King and sealed themselves in the Lion\'s Keep.', 'First things first: cats have been sneaking out of Puppy Cave, just north-west of town. Clear it out!', 'Take this cap. It is not much, but it will keep your ears warm.'] },
  m2: { main: true, name: 'Trouble in Puppy Cave', desc: 'Clear Puppy Cave, north-west of Pawston, and defeat Big Tom.', obj: { type: 'clear', dungeon: 'puppy_cave' }, next: 'm3', reward: { gold: 120, xp: 60 } },
  m3: { main: true, name: 'Cat Patrol', desc: 'Defeat 10 cats roaming Barkshire Meadows.', obj: { type: 'kill', count: 10, region: 0 }, next: 'm4', reward: { gold: 150, xp: 120, item: 'leather_vest' } },
  m4: { main: true, name: "Clawdia's Hideout", desc: 'Captain Clawdia leads the meadow cats from Whisker Hollow, south-east of Pawston. Defeat her!', obj: { type: 'clear', dungeon: 'whisker_hollow' }, next: 'm5', reward: { gold: 300, xp: 300 } },
  m5: { main: true, name: 'Journey to the Dunes', desc: 'Travel south-east to Dunebark and speak with Chief Sniffsworth.', obj: { type: 'talk', npc: 'chief' }, next: 'm6', reward: { gold: 150, xp: 250 },
    talk: ['Heroes from Pawston? Wonderful! Elder Barkus sent word of you.', 'The first Royal Seal, the Sun Seal, is held by Pharaoh Fluffhotep deep inside the Sphinx Tomb.', 'Bring it back and the desert will sing your names! Also, the Bronze Key inside opens bronze chests.'] },
  m6: { main: true, name: 'The Sun Seal', desc: 'Defeat Pharaoh Fluffhotep in the Sphinx Tomb and claim the Sun Seal.', obj: { type: 'clear', dungeon: 'sphinx_tomb' }, next: 'm7', reward: { gold: 600, xp: 900 } },
  m7: { main: true, name: 'Cold Noses', desc: 'Head north to the snowy town of Snowmuzzle and meet Jarl Woofgar.', obj: { type: 'talk', npc: 'jarl' }, next: 'm8', reward: { gold: 250, xp: 500 },
    talk: ['HAR! Warm-blooded heroes in my frozen hall!', 'Tsarina Frostwhisk guards the Frost Seal in the Frozen Den, far to the north-east.', 'Beat her and you will earn my respect. And the Silver Key!'] },
  m8: { main: true, name: 'The Frost Seal', desc: 'Defeat Tsarina Frostwhisk in the Frozen Den and claim the Frost Seal.', obj: { type: 'clear', dungeon: 'frozen_den' }, next: 'm9', reward: { gold: 1200, xp: 1800 } },
  m9: { main: true, name: 'Into the Whisker Woods', desc: 'Travel east to Fort Fido and report to Captain Rover.', obj: { type: 'talk', npc: 'captain' }, next: 'm10', reward: { gold: 400, xp: 900 },
    talk: ['Heroes! Stand at ease. We have been expecting you.', 'The Moon Seal lies in the Shadow Grove, east of the fort, guarded by Nightpaw the panther.', 'Be careful. That cat is faster than a thrown tennis ball.'] },
  m10: { main: true, name: 'The Moon Seal', desc: 'Defeat Nightpaw in the Shadow Grove and claim the Moon Seal.', obj: { type: 'clear', dungeon: 'shadow_grove' }, next: 'm11', reward: { gold: 2000, xp: 3000 } },
  m11: { main: true, name: 'Heat of Battle', desc: 'Cross into the Ember Wastes and find Smith Emberpaw at Cinderpaw Camp.', obj: { type: 'talk', npc: 'emberpaw' }, next: 'm12', reward: { gold: 600, xp: 1600 },
    talk: ['You made it through the ash storm. Tough pups!', 'The last seal, the Flame Seal, is held by Infernus in the Magma Lair, south-east of camp.', 'Buy some proper armor from me first. Infernus breathes fire hotter than my forge!'] },
  m12: { main: true, name: 'The Flame Seal', desc: 'Defeat Infernus in the Magma Lair and claim the Flame Seal.', obj: { type: 'clear', dungeon: 'magma_lair' }, next: 'm13', reward: { gold: 3500, xp: 4500 } },
  m13: { main: true, name: 'The Four Seals', desc: 'Return to Elder Barkus in Pawston with the four Royal Seals.', obj: { type: 'talk', npc: 'elder' }, next: 'm14', reward: { gold: 1000, xp: 3000 },
    talk: ['The Sun, Frost, Moon and Flame Seals... You have gathered them all!', 'With their power, the barrier around the Lion\'s Keep will shatter.', 'The keep stands in the far north-east, beyond the Pride Lands. Free our King, heroes. Pawtopia believes in you!'] },
  m14: { main: true, name: 'The Lion King', desc: "Storm the Lion's Keep in the far north-east and defeat King Leo!", obj: { type: 'clear', dungeon: 'lions_keep' }, next: null, reward: { gold: 0, xp: 0 } },

  // ---- side quests (from town quest boards) ----
  s_puppy: { town: 'pawston', after: 'm1', name: 'Lost Puppy', desc: 'Mrs. Waggles\' puppy Biscuit wandered off towards the lake west of Pawston. Find him!', obj: { type: 'goto', tx: 22, ty: 80, label: 'Biscuit' }, reward: { gold: 100, xp: 60, item: 'novice_robe' } },
  s_mine: { town: 'pawston', after: 'm1', name: 'Mine Your Business', desc: 'Cats took over Mousetrap Mine, south-west of Pawston. Clear it out!', obj: { type: 'clear', dungeon: 'mousetrap_mine' }, reward: { gold: 180, xp: 150, item: 'pot_helm' } },
  s_archers: { town: 'pawston', after: 'm2', name: 'Arrows in the Grass', desc: 'Siamese Archers keep shooting at farmers. Defeat 6 of them.', obj: { type: 'kill', count: 6, enemy: 'siamese' }, reward: { gold: 200, xp: 200 } },
  s_catnip: { town: 'pawston', after: 'm2', name: 'Catnip Crisis', desc: 'Something smells funny in the Catnip Cellar, north-east of Pawston. Investigate!', obj: { type: 'clear', dungeon: 'catnip_cellar' }, reward: { gold: 300, xp: 300, item: 'iron_sword' } },
  s_kennel: { town: 'pawston', after: 'm3', name: 'Kennel Memories', desc: 'The Old Kennel Ruins, east of Pawston, are overrun by Mangy Max\'s gang.', obj: { type: 'clear', dungeon: 'old_kennel' }, reward: { gold: 450, xp: 450, item: 'chainmail' } },
  s_slayer: { town: 'pawston', after: 'm2', name: 'Cat Catastrophe', desc: 'Prove your might. Defeat 150 cats anywhere in Pawtopia.', obj: { type: 'kill', count: 150 }, reward: { gold: 3000, xp: 3000, item: 'kabuto' } },
  s_treasure: { town: 'pawston', after: 'm2', name: 'Treasure Hunter', desc: 'Open 15 treasure chests across the kingdom.', obj: { type: 'chests', count: 15 }, reward: { gold: 2500, xp: 2000, item: 'star_robe' } },
  s_burrow: { town: 'dunebark', after: 'm4', name: 'Dune Burrow', desc: 'Sandclaw and his caracals dig tunnels under the dunes, west of Dunebark.', obj: { type: 'clear', dungeon: 'dune_burrow' }, reward: { gold: 400, xp: 400, item: 'bone_axe' } },
  s_sphynx: { town: 'dunebark', after: 'm5', name: 'Sphynx Hunt', desc: 'Defeat 8 Sphynx Assassins lurking in the desert.', obj: { type: 'kill', count: 8, enemy: 'sphynx' }, reward: { gold: 500, xp: 600 } },
  s_oasis: { town: 'dunebark', after: 'm5', name: 'Oasis Rescue', desc: 'A trader is stranded at the eastern oasis. Go check on him.', obj: { type: 'goto', tx: 116, ty: 126, label: 'Stranded trader' }, reward: { gold: 500, xp: 500, item: 'bandana' } },
  s_mirage: { town: 'dunebark', after: 'm5', name: 'Mirage Madness', desc: 'Strange lights glow in the Mirage Temple, north-east of Dunebark.', obj: { type: 'clear', dungeon: 'mirage_temple' }, reward: { gold: 700, xp: 800, item: 'mage_robe' } },
  s_scarab: { town: 'dunebark', after: 'm6', name: 'Scarab Secrets', desc: 'The Scarab Catacombs in the far south hold an ancient mummy king.', obj: { type: 'clear', dungeon: 'scarab_catacombs' }, reward: { gold: 900, xp: 1000, item: 'crystal_staff' } },
  s_icicle: { town: 'snowmuzzle', after: 'm7', name: 'Icicle Grotto', desc: 'Icebeard hides in the Icicle Grotto, west of Snowmuzzle.', obj: { type: 'clear', dungeon: 'icicle_grotto' }, reward: { gold: 800, xp: 1000, item: 'frost_dagger' } },
  s_leopard: { town: 'snowmuzzle', after: 'm7', name: 'Snow Patrol', desc: 'Defeat 8 Snow Leopards menacing the tundra.', obj: { type: 'kill', count: 8, enemy: 'snowleopard' }, reward: { gold: 900, xp: 1200 } },
  s_glacier: { town: 'snowmuzzle', after: 'm8', name: 'The Glacier Vault', desc: 'Sir Fluffington guards a treasure vault east of Snowmuzzle.', obj: { type: 'clear', dungeon: 'glacier_vault' }, reward: { gold: 1300, xp: 1600, item: 'frost_mail' } },
  s_howl: { town: 'snowmuzzle', after: 'm8', name: 'Howling Peak', desc: 'Something howls atop the mountain north of Snowmuzzle. Silence it!', obj: { type: 'clear', dungeon: 'howling_peak' }, reward: { gold: 1500, xp: 2000, item: 'horned_helm' } },
  s_mossy: { town: 'fortfido', after: 'm9', name: 'Mossy Ruins', desc: 'Old Gnarlwhisker haunts the Mossy Ruins, west of Fort Fido.', obj: { type: 'clear', dungeon: 'mossy_ruins' }, reward: { gold: 1400, xp: 2000, item: 'shadow_hood' } },
  s_dojo: { town: 'fortfido', after: 'm9', name: 'The Ninja Dojo', desc: 'Master Shuriken trains ninja cats in a dojo north of Fort Fido.', obj: { type: 'clear', dungeon: 'ninja_dojo' }, reward: { gold: 1800, xp: 2400, item: 'shadow_kris' } },
  s_ninjas: { town: 'fortfido', after: 'm9', name: 'Shadow Hunters', desc: 'Defeat 10 Ninja Cats in the Whisker Woods.', obj: { type: 'kill', count: 10, enemy: 'ninja' }, reward: { gold: 1600, xp: 2200 } },
  s_witch: { town: 'fortfido', after: 'm10', name: "Witch's Hollow", desc: 'Grimalkin brews trouble in her hollow, south-east of Fort Fido.', obj: { type: 'clear', dungeon: 'witch_hollow' }, reward: { gold: 2400, xp: 3200, item: 'moon_staff' } },
  s_forge: { town: 'cinderpaw', after: 'm11', name: 'Cinder Forge', desc: 'Forgemaster Brass makes weapons for the cat army in the Cinder Forge, west of camp.', obj: { type: 'clear', dungeon: 'cinder_forge' }, reward: { gold: 3000, xp: 4000, item: 'ember_plate' } },
  s_tigers: { town: 'cinderpaw', after: 'm11', name: 'Tiger Tamers', desc: 'Defeat 8 Tiger Warriors.', obj: { type: 'kill', count: 8, enemy: 'tiger' }, reward: { gold: 3000, xp: 4000 } },
  s_obsidian: { town: 'cinderpaw', after: 'm12', name: 'Obsidian Depths', desc: 'A shadowy stalker hides in the Obsidian Depths, north-east of camp.', obj: { type: 'clear', dungeon: 'obsidian_depths' }, reward: { gold: 4000, xp: 5500, item: 'void_dagger' } },
  s_arena: { town: 'cinderpaw', after: 'm12', name: 'Pridelands Arena', desc: 'Queen Sheba challenges any dog brave enough to enter her arena in the Pride Lands.', obj: { type: 'clear', dungeon: 'pride_arena' }, reward: { gold: 6000, xp: 8000, item: 'dragon_helm' } },
};
for (const id in QUESTS) QUESTS[id].id = id;
const MAIN_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14'];

const SEALS = {
  sun: { name: 'Sun Seal', color: '#ffb13b' },
  frost: { name: 'Frost Seal', color: '#7fe0ff' },
  moon: { name: 'Moon Seal', color: '#c8b8ff' },
  flame: { name: 'Flame Seal', color: '#ff5a2a' },
};

const INTRO_SLIDES = [
  { text: 'The kingdom of Pawtopia was a land of wagging tails, sunny meadows and endless belly rubs.', scene: 'peace' },
  { text: 'But from the scorching Pride Lands came King Leo, a lion of boundless ambition. He united every cat clan under his banner.', scene: 'lion' },
  { text: 'His armies swept across the land. The Dog King was captured, and a magic barrier now shields Leo\'s fortress: the Lion\'s Keep.', scene: 'keep' },
  { text: 'Legends speak of four Royal Seals that can shatter the barrier... and of heroes born with the Mark of the Paw.', scene: 'seals' },
  { text: 'Wake up, hero. Pawtopia needs you!', scene: 'hero' },
];

const ENDING_SLIDES = [
  { text: 'With a final mighty roar, King Leo collapsed. The Lion\'s Keep trembled as its dark magic faded away.', scene: 'lionfall' },
  { text: 'Deep in the dungeons, the heroes found the Dog King, tired but wagging.', scene: 'king' },
  { text: 'Freed from Leo\'s spell, the cat clans laid down their claws. Dogs and cats signed the Treaty of Belly Rubs.', scene: 'peace' },
  { text: 'And the heroes of Pawtopia? They became legends, told to every puppy at bedtime.', scene: 'hero' },
];

const CREDITS = [
  ['DOG QUEST', 'title'],
  ['Heroes of Pawtopia', 'sub'],
  ['', ''],
  ['Game Design & Programming', 'head'],
  ['Made with love and JavaScript', ''],
  ['', ''],
  ['Heroes', 'head'],
  ['Barkley the Golden Retriever', ''],
  ['Frost the Husky', ''],
  ['Pepper the Shiba Inu', ''],
  ['Tank the Bulldog', ''],
  ['', ''],
  ['Villains', 'head'],
  ['King Leo, the Lion Tyrant', ''],
  ['and 21 very naughty cat bosses', ''],
  ['', ''],
  ['Inspired by', 'head'],
  ['Cat Quest II by The Gentlebros', ''],
  ['', ''],
  ['Special Thanks', 'head'],
  ['Every good dog, everywhere', ''],
  ['', ''],
  ['THE END', 'title'],
  ['Thanks for playing!', 'sub'],
];
