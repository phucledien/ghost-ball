// Maps = arena theme + pitch size + layout. Obstacles are solid for players
// and for the ball (unless the ball sails over their height); zones change
// how you move while standing in them. Layouts are mirrored so no spawn side
// is favoured. Coordinates are in world units from the pitch centre.
//
// obstacle: { kind: 'pillar' | 'tree' | 'rock', x, z, r, h }          (circle)
//           { kind: 'block' | 'low' | 'crate' | 'ice', x, z, w, d, h } (box)
// zone:     { kind: 'mud' | 'snow' | 'ice' | 'boost' | 'grass', x, z, w, d }

export const ZONES = {
  mud: { name: 'Sand pit', desc: 'Deep sand. Slow going.', speed: 0.72, accel: 0.7, friction: 1 },
  snow: { name: 'Snowdrift', desc: 'Knee-deep snow. Slow going.', speed: 0.7, accel: 0.7, friction: 1 },
  ice: { name: 'Ice rink', desc: 'No grip. You slide where momentum takes you.', speed: 1.12, accel: 0.22, friction: 0.08 },
  boost: { name: 'Boost lane', desc: 'Lab tech underfoot. Big burst of pace.', speed: 1.4, accel: 1.3, friction: 1 },
  grass: { name: 'Tall grass', desc: 'Hide in it: passes can\'t lock on to you from range.', speed: 0.92, accel: 1, friction: 1 },
};

// mirror helpers: one entry → 2 or 4 symmetric copies
const m2x = (o) => [o, { ...o, x: -o.x }];
const m2z = (o) => [o, { ...o, z: -o.z }];
const rot = (o) => [o, { ...o, x: -o.x, z: -o.z }];
const m4 = (o) => [o, { ...o, x: -o.x }, { ...o, z: -o.z }, { ...o, x: -o.x, z: -o.z }];

export const MAPS = {
  temple: {
    name: 'Sun Temple Ruins', theme: 'temple', W: 40, D: 26, size: 'Large', playersBonus: 2,
    desc: 'A cliff-top courtyard of broken pillars. Duck behind stone, lob passes over the low ruin walls, hide in the long grass.',
    obstacles: [
      ...m4({ kind: 'pillar', x: 7, z: 5, r: 0.75, h: 3.2 }),
      ...m4({ kind: 'pillar', x: 14, z: 7.5, r: 0.7, h: 2.2 }),
      ...m2x({ kind: 'pillar', x: 14, z: 0, r: 0.9, h: 3.8 }),
      ...m2z({ kind: 'low', x: 0, z: 8.5, w: 6, d: 0.8, h: 0.7 }),
      ...m4({ kind: 'block', x: 9.5, z: 10.2, w: 2.2, d: 1.4, h: 1.6 }),
      ...m2x({ kind: 'rock', x: 18, z: -9, r: 0.9, h: 1.2 }),
    ],
    zones: [
      ...rot({ kind: 'mud', x: 10.5, z: -4.5, w: 5, d: 3.5 }),
      ...m4({ kind: 'grass', x: 16.5, z: 10, w: 5, d: 4 }),
      ...m2z({ kind: 'grass', x: 0, z: 11.2, w: 7, d: 2.5 }),
    ],
  },
  egolab: {
    name: 'Ego Lab Complex', theme: 'egolab', W: 44, D: 28, size: 'Huge', playersBonus: 2,
    desc: 'The night-time training floor. Steel crates break up the lanes, boost strips shoot you across, hurdles stop flat passes but not lobs.',
    obstacles: [
      ...m4({ kind: 'crate', x: 6, z: 6, w: 2.4, d: 2.4, h: 2.2 }),
      ...m4({ kind: 'crate', x: 15, z: 3, w: 1.6, d: 4, h: 1.8 }),
      ...m2x({ kind: 'block', x: 20, z: 0, w: 1.2, d: 1.2, h: 3 }),
      ...m4({ kind: 'low', x: 11, z: 10, w: 0.6, d: 4.5, h: 0.55 }),
      ...m2z({ kind: 'low', x: 0, z: 6.5, w: 5, d: 0.6, h: 0.55 }),
      ...m4({ kind: 'pillar', x: 3, z: 11.5, r: 0.5, h: 2.6 }),
    ],
    zones: [
      ...m2z({ kind: 'boost', x: 0, z: 10.5, w: 14, d: 1.6 }),
      ...m2x({ kind: 'boost', x: 18, z: 0, w: 1.6, d: 10 }),
    ],
  },
  frost: {
    name: 'Frost Peak', theme: 'frost', W: 42, D: 28, size: 'Large', playersBonus: 2,
    desc: 'A snowfield above the clouds. Pine groves to hide behind, a frozen rink in the middle where nobody can stop, drifts that bog you down.',
    obstacles: [
      ...m4({ kind: 'tree', x: 16, z: 9, r: 0.7, h: 3.6 }),
      ...m4({ kind: 'tree', x: 18.5, z: 6.5, r: 0.6, h: 3 }),
      ...m4({ kind: 'tree', x: 13.5, z: 11, r: 0.55, h: 2.6 }),
      ...m2x({ kind: 'tree', x: 4.5, z: -11.5, r: 0.6, h: 3 }),
      ...m2x({ kind: 'tree', x: 4.5, z: 11.5, r: 0.6, h: 3 }),
      ...m4({ kind: 'ice', x: 9, z: 4, w: 1.6, d: 1.6, h: 1.4 }),
      ...m2x({ kind: 'rock', x: 17, z: 0, r: 1.1, h: 1.4 }),
    ],
    zones: [
      { kind: 'ice', x: 0, z: 0, w: 12, d: 7 },
      ...m4({ kind: 'snow', x: 10, z: 10.5, w: 5, d: 4 }),
      ...rot({ kind: 'snow', x: 4, z: -8, w: 6, d: 3 }),
    ],
  },
  pitch: {
    name: 'Training Pitch', theme: null, W: null, D: null, size: 'Classic', playersBonus: 0,
    desc: 'The original open pitch: no cover, nowhere to hide. Size and look follow the editor\'s arena settings.',
    obstacles: [],
    zones: [],
  },
};

export const MAP_IDS = Object.keys(MAPS);

// Resolve a map into concrete numbers. `mul` scales the whole layout (Twin
// mode plays on a bigger pitch). The Training Pitch takes its size and theme
// from the arena.* tunables.
export function resolveMap(mapId, C, mul = 1) {
  const M = MAPS[mapId] || MAPS.temple;
  const theme = M.theme || C('arena.theme');
  const W = Math.round((M.W || C('arena.width')) * mul);
  const D = Math.round((M.D || C('arena.depth')) * mul);
  const s = (o) => {
    const out = { ...o, x: o.x * mul, z: o.z * mul };
    if (o.w != null) { out.w = o.w * mul; out.d = o.d * mul; }
    return out;
  };
  return { id: mapId in MAPS ? mapId : 'temple', name: M.name, theme, W, D, playersBonus: M.playersBonus, obstacles: M.obstacles.map(s), zones: M.zones.map(s) };
}

// Shape helpers shared by the sim, the AI and the arena builder.
export function isCircle(o) { return o.r != null; }

export function zoneAt(zones, x, z) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const q = zones[i];
    if (Math.abs(x - q.x) <= q.w / 2 && Math.abs(z - q.z) <= q.d / 2) return q;
  }
  return null;
}

// Push a circle (x, z, r) out of every obstacle. Returns the normal of the
// last contact (or null) and mutates `pos`.
export function pushOut(obstacles, pos, r) {
  let hit = null;
  for (const o of obstacles) {
    if (isCircle(o)) {
      const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
      if (d < min) {
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        pos.x = o.x + nx * min; pos.z = o.z + nz * min;
        hit = { nx, nz, o };
      }
    } else {
      const hx = o.w / 2 + r, hz = o.d / 2 + r;
      const dx = pos.x - o.x, dz = pos.z - o.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx), pz = hz - Math.abs(dz);
        if (px < pz) { const s = Math.sign(dx) || 1; pos.x = o.x + s * hx; hit = { nx: s, nz: 0, o }; }
        else { const s = Math.sign(dz) || 1; pos.z = o.z + s * hz; hit = { nx: 0, nz: s, o }; }
      }
    }
  }
  return hit;
}

// Does the segment a→b pass through an obstacle taller than `minH`?
export function segmentBlocked(obstacles, a, b, minH = 1, pad = 0.15) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const n = Math.max(2, Math.ceil(len / 0.4));
  for (const o of obstacles) {
    if (o.h < minH) continue;
    for (let i = 1; i < n; i++) {
      const x = a.x + (dx * i) / n, z = a.z + (dz * i) / n;
      if (isCircle(o)) { if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true; }
      else if (Math.abs(x - o.x) < o.w / 2 + pad && Math.abs(z - o.z) < o.d / 2 + pad) return true;
    }
  }
  return false;
}
