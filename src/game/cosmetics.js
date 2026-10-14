// Cosmetic catalog + per-hero default loadouts.
// A loadout is { hair, eyewear, headwear, boots, accessory, kit } of option ids.
// hero-model.js reads the resolved loadout and builds the matching parts.

export const COSMETIC_SLOTS = [
  {
    id: 'hair', label: 'Hair',
    options: [
      { id: 'spike', name: 'Spiky' },
      { id: 'long', name: 'Long Ponytail' },
      { id: 'buzz', name: 'Buzz Cut' },
      { id: 'bob', name: 'Bob' },
      { id: 'messy', name: 'Messy' },
      { id: 'swept', name: 'Swept · Dyed Tips' },
      { id: 'mohawk', name: 'Mohawk' },
      { id: 'bun', name: 'Man Bun' },
      { id: 'afro', name: 'Afro' },
      { id: 'slick', name: 'Slick Back' },
    ],
  },
  {
    id: 'eyewear', label: 'Eyewear',
    options: [
      { id: 'none', name: 'None' },
      { id: 'visor', name: 'Sport Visor Shades' },
      { id: 'round', name: 'Round Glasses' },
      { id: 'goggles', name: 'Forehead Goggles' },
      { id: 'paint', name: 'Face Paint Stripes' },
      { id: 'blacks', name: 'Eye Black' },
    ],
  },
  {
    id: 'headwear', label: 'Headwear',
    options: [
      { id: 'none', name: 'None' },
      { id: 'headband', name: 'Headband' },
      { id: 'sweatband', name: 'Sweatband' },
      { id: 'bandana', name: 'Bandana' },
      { id: 'cap', name: 'Backwards Cap' },
      { id: 'circlet', name: 'Gold Circlet' },
    ],
  },
  {
    id: 'boots', label: 'Boots',
    options: [
      { id: 'classic', name: 'Signature' },
      { id: 'neon', name: 'Neon Volt' },
      { id: 'gold', name: 'Golden' },
      { id: 'blackgold', name: 'Black & Gold' },
      { id: 'whiteblack', name: 'White Classic' },
      { id: 'crimson', name: 'Crimson' },
      { id: 'ice', name: 'Ice' },
    ],
  },
  {
    id: 'accessory', label: 'Accessory',
    options: [
      { id: 'none', name: 'None' },
      { id: 'armband', name: 'Captain Armband' },
      { id: 'wristbands', name: 'Wristbands' },
      { id: 'gloves', name: 'Gloves' },
      { id: 'scarf', name: 'Scarf' },
      { id: 'chain', name: 'Gold Chain' },
      { id: 'earring', name: 'Earring' },
      { id: 'mismatch', name: 'Mismatched Socks' },
    ],
  },
  {
    id: 'kit', label: 'Kit',
    options: [
      { id: 'home', name: 'Home' },
      { id: 'away', name: 'Away' },
      { id: 'alt', name: 'Third' },
      { id: 'shadow', name: 'Shadow' },
      { id: 'retro', name: 'Retro' },
    ],
  },
];

export const SLOT_BY_ID = Object.fromEntries(COSMETIC_SLOTS.map((s) => [s.id, s]));

// Boot colourways: [upper, sole/accent, swoosh]. 'classic' = hero's own boots.
export const BOOT_COLORS = {
  neon: ['#c8f53a', '#1a1a22', '#ff4fa0'],
  gold: ['#f0c040', '#8a5a18', '#fff1c0'],
  blackgold: ['#1a1820', '#e8a93a', '#e8a93a'],
  whiteblack: ['#f3efe6', '#1a1820', '#1a1820'],
  crimson: ['#c8283c', '#f3efe6', '#f3efe6'],
  ice: ['#9fe6ff', '#f3efe6', '#3a7be0'],
};

// Kit colourways relative to the hero look. Return { jersey, trim, shorts, socks }.
export function kitColors(kitId, look, jersey) {
  switch (kitId) {
    case 'away': return { jersey: '#f3efe6', trim: jersey, shorts: '#f3efe6', socks: jersey };
    case 'alt': return { jersey: look.trim === '#f3e9d2' ? look.shorts : look.trim, trim: jersey, shorts: jersey, socks: look.trim };
    case 'shadow': return { jersey: '#1c1a24', trim: jersey, shorts: '#121018', socks: '#1c1a24' };
    case 'retro': return { jersey: '#e9dcc0', trim: '#7a1f2a', shorts: '#2a2a3a', socks: '#7a1f2a' };
    default: return { jersey, trim: look.trim, shorts: look.shorts, socks: look.trim };
  }
}

export const DEFAULT_LOADOUT = {
  nova: { hair: 'spike', eyewear: 'none', headwear: 'headband', boots: 'whiteblack', accessory: 'armband', kit: 'home' },
  bolt: { hair: 'long', eyewear: 'none', headwear: 'none', boots: 'neon', accessory: 'wristbands', kit: 'home' },
  titan: { hair: 'buzz', eyewear: 'none', headwear: 'none', boots: 'blackgold', accessory: 'chain', kit: 'home' },
  jinx: { hair: 'bob', eyewear: 'goggles', headwear: 'none', boots: 'crimson', accessory: 'mismatch', kit: 'home' },
  echo: { hair: 'messy', eyewear: 'none', headwear: 'none', boots: 'ice', accessory: 'scarf', kit: 'home' },
  kaiz: { hair: 'swept', eyewear: 'none', headwear: 'circlet', boots: 'classic', accessory: 'gloves', kit: 'home' },
};

const FALLBACK = { hair: 'spike', eyewear: 'none', headwear: 'none', boots: 'classic', accessory: 'none', kit: 'home' };

const valid = (slot, id) => !!SLOT_BY_ID[slot]?.options.some((o) => o.id === id);

// Merge a hero's defaults with (partial) overrides; unknown slots/ids are ignored.
export function resolveLoadout(heroId, overrides = null) {
  const out = { ...FALLBACK, ...(DEFAULT_LOADOUT[heroId] || {}) };
  if (overrides) for (const [slot, id] of Object.entries(overrides)) if (valid(slot, id)) out[slot] = id;
  return out;
}

export const loadoutKey = (l) => COSMETIC_SLOTS.map((s) => l[s.id]).join('.');
