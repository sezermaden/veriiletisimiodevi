/* Chapter and map metadata shared by menus and the story runner. */
export const CHAPTERS = [
  { id: 'ch1', num: 'CHAPTER ONE', title: 'Boot Sequence', desc: 'Wake up in the Workshop. Learn to hold the world in your hands.', map: 'intake', tint: '#3fa9ff' },
  { id: 'ch2', num: 'CHAPTER TWO', title: 'Tools of the Trade', desc: 'Weld, rope and float your way through the Fabrication Hall.', map: 'fabrication', tint: '#ffb23e' },
  { id: 'ch3', num: 'CHAPTER THREE', title: 'Moving Parts', desc: 'Build a machine that can cross the Proving Grounds.', map: 'proving', tint: '#53d86a' },
  { id: 'ch4', num: 'CHAPTER FOUR', title: 'Missing Textures', desc: 'Something in the simulation is un-rendering itself.', map: 'archive', tint: '#ff00dc' },
  { id: 'ch5', num: 'CHAPTER FIVE', title: 'The Unrendered', desc: 'Reach the Core. Build your way out.', map: 'core', tint: '#a64dff' },
];

export const SANDBOX_MAPS = [
  { id: 'foundry', name: 'gm_foundry', desc: 'Warehouse, pool, ramps and a tower. The classic building ground.', unlock: null },
  { id: 'flatland', name: 'gm_flatland', desc: 'Endless grass and one concrete box. Room for anything.', unlock: null },
  { id: 'proving', name: 'gm_proving_grounds', desc: 'The Chapter 3 test track, open for your own machines.', unlock: 'ch3' },
  { id: 'core', name: 'gm_core', desc: 'The arena at the heart of the simulation.', unlock: 'ch5' },
];

export const VERSION = '1.0.0';
