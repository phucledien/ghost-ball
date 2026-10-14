// Hero roster. Archetypes are inspired by "ego striker" anime tropes but the
// names, looks and kits are original.
//
// Every hero has: a passive, an ATTACK skill (usable while holding the ball)
// and a DEFENSE skill (usable while running from it). Each skill is an
// animation made of phases; phase durations and the skill's numbers are
// tunables, registered into the schema below.
//
// Phase types drive the editor timeline colours (same idea as the reference):
//   hold = anticipation / held pose, fast = the snap, move = follow-through
import { addSchema, schemaHelpers as H } from '../core/schema.js';

export const HEROES = [
  {
    id: 'nova', name: 'NOVA', title: 'The Architect', role: 'Playmaker',
    blurb: 'Reads the whole pitch. Passes arrive where you will be, not where you are.',
    look: { skin: '#e2a878', hair: '#1d1a2b', jersey: '#2f6fe0', trim: '#f3e9d2', shorts: '#16264a', boots: '#f3e9d2', hairStyle: 'spike', build: 1.0 },
    fx: '#5aa8ff',
    rating: { power: 3, control: 5, escape: 3, difficulty: 2 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 1.0, cdAtk: 9, cdDef: 11 },
    passive: { name: 'Metavision', desc: 'Wider aim assist and longer assist range.', params: { aimBonus: [18, 0, 60, 1, 'Extra assist cone (°)'] } },
    atk: {
      name: 'Direct Volley', desc: 'A first-time volley that leads the target and arrives almost instantly.',
      phases: [
        { name: 'read', type: 'hold', pose: 'coil', dur: 0.2, note: 'Eyes lock the lane' },
        { name: 'volley', type: 'fast', pose: 'kick', dur: 0.05, note: 'Snap through the ball' },
        { name: 'follow', type: 'move', pose: 'follow', dur: 0.18, note: 'Leg keeps rising' },
        { name: 'recover', type: 'move', pose: 'idle', dur: 0.14, note: 'Back to shape' },
      ],
      params: { speedMul: [2.1, 1, 4, 0.05, 'Ball speed ×'], lead: [1, 0, 1.5, 0.05, 'Lead prediction'] },
    },
    def: {
      name: 'Field Read', desc: 'A burst of pace, and every holder\'s pass lane lights up. Be gone before the ball is.',
      phases: [
        { name: 'focus', type: 'hold', pose: 'crouch', dur: 0.12, note: 'Breathe in' },
        { name: 'pulse', type: 'fast', pose: 'flex', dur: 0.06, note: 'Vision pulse' },
        { name: 'recover', type: 'move', pose: 'idle', dur: 0.1, note: 'Into the run' },
      ],
      params: { speed: [1.45, 1, 2.5, 0.05, 'Speed ×'], dur: [1.4, 0.2, 4, 0.05, 'Duration (s)'] },
    },
  },
  {
    id: 'bolt', name: 'BOLT', title: 'The Panther', role: 'Speedster',
    blurb: 'Top speed in the facility. If the lane is open, she is already through it.',
    look: { skin: '#f0c098', hair: '#d83a4a', jersey: '#e04a5a', trim: '#2a0f18', shorts: '#2a0f18', boots: '#f3e9d2', hairStyle: 'long', build: 0.92 },
    fx: '#ff5a6a',
    rating: { power: 2, control: 2, escape: 5, difficulty: 1 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 1.0, cdAtk: 8, cdDef: 8 },
    passive: { name: 'Afterburn', desc: 'Permanently faster than everyone else.', params: { speed: [1.1, 1, 1.5, 0.01, 'Speed ×'] } },
    atk: {
      name: 'Blitz Carry', desc: 'Dash with the ball glued to your boot. Whoever you touch is IT.',
      phases: [
        { name: 'crouch', type: 'hold', pose: 'crouch', dur: 0.1, note: 'Load the spring' },
        { name: 'blitz', type: 'fast', pose: 'sprint', dur: 0.34, note: 'Burn the lane' },
        { name: 'skid', type: 'move', pose: 'skid', dur: 0.16, note: 'Brake & turn' },
      ],
      params: { speed: [24, 10, 50, 0.5, 'Blitz speed'], knock: [5, 0, 15, 0.5, 'Tag knockback'] },
    },
    def: {
      name: 'Panther Leap', desc: 'A long leap. Passes sail underneath you.',
      phases: [
        { name: 'crouch', type: 'hold', pose: 'crouch', dur: 0.06, note: 'Coil' },
        { name: 'leap', type: 'fast', pose: 'leap', dur: 0.32, note: 'Airborne — untouchable' },
        { name: 'land', type: 'move', pose: 'land', dur: 0.12, note: 'Absorb' },
      ],
      params: { dist: [6, 2, 12, 0.25, 'Leap distance'], height: [1.6, 0.2, 4, 0.05, 'Leap height'] },
    },
  },
  {
    id: 'titan', name: 'TITAN', title: 'The King', role: 'Bruiser',
    blurb: 'Plays only for himself. His passes are punishments.',
    look: { skin: '#b9784e', hair: '#141218', jersey: '#1d1b24', trim: '#e8a93a', shorts: '#e8a93a', boots: '#1d1b24', hairStyle: 'buzz', build: 1.18 },
    fx: '#ffb43a',
    rating: { power: 5, control: 3, escape: 2, difficulty: 1 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 0.94, cdAtk: 11, cdDef: 12 },
    passive: { name: 'Royal Body', desc: 'Cannot be knocked back or stunned.', params: {} },
    atk: {
      name: 'Predator Cannon', desc: 'A charged cannon pass. The receiver is stunned and knocked back.',
      phases: [
        { name: 'charge', type: 'hold', pose: 'coil', dur: 0.34, note: 'Hold the anticipation' },
        { name: 'cannon', type: 'fast', pose: 'kick', dur: 0.06, note: 'Detonate' },
        { name: 'follow', type: 'move', pose: 'follow', dur: 0.2, note: 'Momentum keeps going' },
        { name: 'recover', type: 'move', pose: 'idle', dur: 0.2, note: 'Overlap on the way out' },
      ],
      params: { speedMul: [2.4, 1, 4, 0.05, 'Ball speed ×'], stun: [0.9, 0, 3, 0.05, 'Stun (s)'], knock: [7, 0, 20, 0.5, 'Knockback'] },
    },
    def: {
      name: 'Rampart', desc: 'Stomp up a stone wall. Balls bounce off it.',
      phases: [
        { name: 'stomp', type: 'hold', pose: 'stompUp', dur: 0.14, note: 'Knee up' },
        { name: 'rise', type: 'fast', pose: 'stomp', dur: 0.08, note: 'Slam' },
        { name: 'settle', type: 'move', pose: 'idle', dur: 0.18, note: 'Stand tall' },
      ],
      params: { wallTime: [3, 0.5, 8, 0.1, 'Wall time (s)'], wallLen: [3.4, 1, 8, 0.1, 'Wall length'] },
    },
  },
  {
    id: 'jinx', name: 'JINX', title: 'The Monster', role: 'Trickster',
    blurb: 'Dances with the monster inside. Nobody knows which ball is real.',
    look: { skin: '#f2c49a', hair: '#2a1a14', jersey: '#f0c43a', trim: '#1e1a12', shorts: '#1e1a12', boots: '#e04a5a', hairStyle: 'bob', build: 0.9 },
    fx: '#ffe14a',
    rating: { power: 3, control: 3, escape: 4, difficulty: 3 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 1.02, cdAtk: 9, cdDef: 7 },
    passive: { name: 'Inner Monster', desc: 'Shorter catch lock — pass sooner after receiving.', params: { lockMul: [0.45, 0, 1, 0.05, 'Catch lock ×'] } },
    atk: {
      name: 'Phantom Pair', desc: 'Kick the real ball plus decoys. Decoys pop on contact.',
      phases: [
        { name: 'twirl', type: 'hold', pose: 'twirl', dur: 0.16, note: 'Spin the defender' },
        { name: 'split', type: 'fast', pose: 'kick', dur: 0.05, note: 'Three balls, one truth' },
        { name: 'follow', type: 'move', pose: 'follow', dur: 0.16, note: 'Showboat' },
      ],
      params: { decoys: [2, 1, 5, 1, 'Decoys'], spread: [26, 5, 70, 1, 'Spread (°)'] },
    },
    def: {
      name: 'Feint Step', desc: 'Blink a short distance in your move direction.',
      phases: [
        { name: 'fade', type: 'hold', pose: 'crouch', dur: 0.05, note: 'Fake left' },
        { name: 'blink', type: 'fast', pose: 'sprint', dur: 0.03, note: 'Gone' },
        { name: 'reappear', type: 'move', pose: 'land', dur: 0.14, note: 'Land the feint' },
      ],
      params: { dist: [4.2, 1, 10, 0.1, 'Blink distance'] },
    },
  },
  {
    id: 'echo', name: 'ECHO', title: 'The Trapper', role: 'Genius',
    blurb: 'Lazy until the ball arrives. Then he does the impossible.',
    look: { skin: '#eac2a0', hair: '#eef2f6', jersey: '#eef2f6', trim: '#2ab8c8', shorts: '#2ab8c8', boots: '#1a2a3a', hairStyle: 'messy', build: 1.08 },
    fx: '#6af0ff',
    rating: { power: 2, control: 5, escape: 3, difficulty: 3 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 0.97, cdAtk: 8, cdDef: 10 },
    passive: { name: 'Lazy Genius', desc: 'Cooldowns recover faster while standing still.', params: { idleRegen: [2.2, 1, 5, 0.1, 'Idle cooldown ×'] } },
    atk: {
      name: 'Curve Ghost', desc: 'A bending pass that hunts its target.',
      phases: [
        { name: 'lean', type: 'hold', pose: 'coil', dur: 0.16, note: 'Open the hip' },
        { name: 'whip', type: 'fast', pose: 'kick', dur: 0.05, note: 'Outside of the boot' },
        { name: 'follow', type: 'move', pose: 'follow', dur: 0.2, note: 'Watch it bend' },
      ],
      params: { homing: [7, 0, 20, 0.25, 'Homing strength'], speedMul: [1.25, 0.6, 3, 0.05, 'Ball speed ×'] },
    },
    def: {
      name: 'Perfect Trap', desc: 'A parry window. A ball that touches you is instantly fired back out.',
      phases: [
        { name: 'stance', type: 'hold', pose: 'crouch', dur: 0.05, note: 'Soft knees' },
        { name: 'window', type: 'hold', pose: 'trap', dur: 0.45, note: 'Trap window' },
        { name: 'recover', type: 'move', pose: 'idle', dur: 0.15, note: 'Exhale' },
      ],
      params: { speedMul: [1.8, 1, 4, 0.05, 'Redirect speed ×'] },
    },
  },
  {
    id: 'kaiz', name: 'KAIZ', title: 'The Emperor', role: 'Assassin',
    blurb: 'Arrives from nowhere. Leaves you holding the crown.',
    look: { skin: '#f0caa6', hair: '#f2d27a', jersey: '#6a46d8', trim: '#f3e9d2', shorts: '#f3e9d2', boots: '#6a46d8', hairStyle: 'swept', build: 1.0 },
    fx: '#b48aff',
    rating: { power: 4, control: 4, escape: 3, difficulty: 3 }, // design ratings 1–5 shown on the select screen
    stats: { speed: 1.0, cdAtk: 12, cdDef: 11 },
    passive: { name: 'Imperial Pace', desc: 'Faster while holding the ball. Hunts down a target before the clock does.', params: { holdSpeed: [1.12, 1, 1.5, 0.01, 'Speed × while holding'] } },
    atk: {
      name: 'Emperor Impact', desc: 'Vanish, reappear behind the nearest rival and hammer the ball into them.',
      phases: [
        { name: 'vanish', type: 'hold', pose: 'crouch', dur: 0.12, note: 'Fade out' },
        { name: 'strike', type: 'fast', pose: 'kick', contact: true, dur: 0.05, note: 'Impact' },
        { name: 'crown', type: 'move', pose: 'flex', dur: 0.32, note: 'Pose for the crowd' },
      ],
      params: { range: [7, 2, 16, 0.25, 'Range'] },
    },
    def: {
      name: 'Crown Guard', desc: 'A shield bubble. The ball bounces off.',
      phases: [
        { name: 'raise', type: 'fast', pose: 'guard', dur: 0.08, note: 'Arms up' },
        { name: 'guard', type: 'hold', pose: 'guard', dur: 0.2, note: 'Hold' },
        { name: 'release', type: 'move', pose: 'idle', dur: 0.12, note: 'Release' },
      ],
      params: { dur: [1.5, 0.3, 4, 0.05, 'Shield time (s)'] },
    },
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// Register tunables: hero.<id>.<...>
const entries = [];
for (const h of HEROES) {
  const p = `hero.${h.id}`;
  entries.push(H.num(`${p}.speed`, h.stats.speed, 0.6, 1.5, 0.01, `${h.name} · speed ×`));
  entries.push(H.color(`${p}.fx`, h.fx, `${h.name} · FX colour`));
  entries.push(H.color(`${p}.jersey`, h.look.jersey, `${h.name} · jersey`));
  entries.push(H.color(`${p}.hair`, h.look.hair, `${h.name} · hair`));
  for (const [k, d] of Object.entries(h.passive.params)) entries.push(H.num(`${p}.passive.${k}`, ...d));
  for (const slot of ['atk', 'def']) {
    const s = h[slot];
    entries.push(H.num(`${p}.${slot}.cd`, slot === 'atk' ? h.stats.cdAtk : h.stats.cdDef, 1, 30, 0.5, `${s.name} · cooldown (s)`));
    for (const ph of s.phases) entries.push(H.num(`${p}.${slot}.${ph.name}`, ph.dur, 0, 1.5, 0.005, `${s.name} · ${ph.name}`));
    entries.push(H.num(`${p}.${slot}.amp`, 1, 0, 2, 0.05, `${s.name} · pose amplitude`));
    entries.push(H.num(`${p}.${slot}.fxScale`, 1, 0, 3, 0.05, `${s.name} · FX scale`));
    for (const [k, d] of Object.entries(s.params)) entries.push(H.num(`${p}.${slot}.${k}`, ...d));
  }
}
addSchema(entries);

// Generic actions available to everyone (durations live in schema.js anim.*)
export const ACTIONS = {
  pass: { name: 'Pass', phases: [
    { name: 'windup', type: 'hold', pose: 'coil', note: 'Plant & load' },
    { name: 'strike', type: 'fast', pose: 'kick', contact: true, note: 'Strike' },
    { name: 'follow', type: 'move', pose: 'follow', note: 'Follow through' },
    { name: 'recover', type: 'move', pose: 'idle', note: 'Back to the game' },
  ] },
  catch: { name: 'Catch', phases: [
    { name: 'absorb', type: 'fast', pose: 'absorb', contact: true, note: 'Cushion it' },
    { name: 'settle', type: 'move', pose: 'idle', note: 'Settle' },
  ] },
  dash: { name: 'Dash', phases: [
    { name: 'crouch', type: 'hold', pose: 'crouch', note: 'Dip' },
    { name: 'burst', type: 'fast', pose: 'sprint', note: 'Burst' },
    { name: 'skid', type: 'move', pose: 'skid', note: 'Skid' },
  ] },
  elim: { name: 'Eliminated', phases: [
    { name: 'shock', type: 'hold', pose: 'shock', note: 'Uh oh' },
    { name: 'burst', type: 'fast', pose: 'blown', note: 'Detonate' },
    { name: 'scatter', type: 'move', pose: 'blown', note: 'Voxels everywhere' },
  ] },
};

// Resolve the phase list (with live durations) for any action id.
// actionId: 'pass' | 'catch' | 'dash' | 'elim' | '<hero>.atk' | '<hero>.def'
export function phasesFor(actionId, C) {
  if (ACTIONS[actionId]) {
    return ACTIONS[actionId].phases.map((p) => ({ ...p, dur: C(`anim.${actionId}.${p.name}`) }));
  }
  const [hid, slot] = actionId.split('.');
  const s = HERO_BY_ID[hid][slot];
  return s.phases.map((p) => ({ ...p, dur: C(`hero.${hid}.${slot}.${p.name}`) }));
}

export function ampFor(actionId, C) {
  if (ACTIONS[actionId]) return C(`anim.${actionId}.amp`);
  const [hid, slot] = actionId.split('.');
  return C(`hero.${hid}.${slot}.amp`);
}

export function actionLabel(actionId) {
  if (ACTIONS[actionId]) return ACTIONS[actionId].name;
  const [hid, slot] = actionId.split('.');
  return `${HERO_BY_ID[hid].name} · ${HERO_BY_ID[hid][slot].name}`;
}
