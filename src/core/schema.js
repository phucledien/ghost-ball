// Single source of truth for every tunable value in Ghost Ball.
// The game reads these every frame, the editor renders a control for each,
// and "Lock" writes the edited values to config/locked.json.
//
// Entry shape: { key, v (default), min, max, step, label, type }
// type: 'num' | 'bool' | 'color' | 'enum'

const S = [];
const num = (key, v, min, max, step, label) => S.push({ key, v, min, max, step, label, type: 'num' });
const bool = (key, v, label) => S.push({ key, v, label, type: 'bool' });
const color = (key, v, label) => S.push({ key, v, label, type: 'color' });
const choice = (key, v, options, label) => S.push({ key, v, options, label, type: 'enum' });

// ── Rules ────────────────────────────────────────────────────────────────
choice('rules.mode', 'classic', ['classic', 'fuse', 'twin', 'shrink', 'sudden'], 'Game mode');
num('rules.players', 8, 2, 12, 1, 'Players');
num('rules.roundTime', 15, 5, 40, 0.5, 'Round time (s)');
num('rules.intermission', 2.6, 0.5, 6, 0.1, 'Between rounds (s)');
num('rules.catchLock', 0.4, 0, 1.5, 0.05, 'Catch lock — can\'t pass after receiving (s)');
num('rules.passerImmune', 0.3, 0, 1, 0.05, 'Passer immune to own pass (s)');
num('rules.passBackImmune', 0.9, 0, 3, 0.05, 'No pass-back window (s)');
num('rules.botSkill', 0.6, 0, 1, 0.05, 'Bot skill');
num('rules.itemEvery', 6, 2, 20, 0.5, 'Item spawn every (s)');
num('rules.maxItems', 3, 0, 8, 1, 'Max items on field');
num('rules.fuseTime', 10, 3, 30, 0.5, 'Fuse mode — fuse length (s)');
num('rules.fuseLooseBurn', 0.4, 0, 1, 0.05, 'Fuse mode — burn rate while loose/in flight');
num('rules.shrinkPerRound', 0.12, 0, 0.3, 0.01, 'Shrink mode — shrink per round');

// ── Movement ─────────────────────────────────────────────────────────────
num('move.speed', 6.2, 2, 14, 0.1, 'Run speed');
num('move.accel', 42, 5, 120, 1, 'Acceleration');
num('move.friction', 16, 2, 60, 1, 'Stop friction');
num('move.holderMul', 1.06, 0.7, 1.5, 0.01, 'Ball holder speed ×');
num('move.radius', 0.45, 0.2, 1, 0.01, 'Body radius');
num('move.dashSpeed', 22, 8, 50, 0.5, 'Dash speed');
num('move.dashTime', 0.14, 0.05, 0.5, 0.01, 'Dash time (s)');
num('move.dashCd', 1.6, 0.2, 6, 0.1, 'Dash cooldown (s)');
num('move.chargeMul', 0.85, 0.3, 1, 0.01, 'Speed × while charging a pass');
num('move.actionMul', 0.8, 0, 1, 0.01, 'Speed × during kick / skill animations');

// ── Ball ─────────────────────────────────────────────────────────────────
num('ball.passSpeed', 16, 6, 40, 0.5, 'Pass speed');
num('ball.chargeMul', 1.6, 1, 3, 0.05, 'Full-charge speed ×');
num('ball.chargeTime', 0.55, 0.1, 2, 0.05, 'Charge time (s)');
num('ball.lobApex', 0.9, 0, 4, 0.05, 'Pass arc height');
num('ball.friction', 3.4, 0.2, 12, 0.1, 'Loose ball friction');
num('ball.bounce', 0.62, 0, 1, 0.02, 'Wall bounce');
num('ball.aimAssist', 24, 0, 90, 1, 'Aim assist cone (°)');
num('ball.aimRange', 13, 3, 30, 0.5, 'Aim assist range');
num('ball.pickup', 0.75, 0.3, 2, 0.05, 'Pickup radius');
num('ball.danger', 4, 0, 10, 0.5, 'Danger glow under (s)');
num('ball.size', 0.32, 0.15, 0.8, 0.01, 'Ball radius');

// ── Camera ───────────────────────────────────────────────────────────────
num('camera.zoom', 9.5, 5, 30, 0.25, 'Zoom (half-height)');
num('camera.pitch', 36, 15, 89, 1, 'Pitch (°)');
num('camera.yaw', 45, -180, 180, 1, 'Yaw (°)');
num('camera.follow', 0.08, 0, 1, 0.01, 'Follow smoothing');
num('camera.lookAhead', 1.6, 0, 6, 0.1, 'Look-ahead');
bool('camera.followBall', true, 'Follow the ball (else you)');

choice('art.heroStyle', 'master', ['master', 'legacy'], 'Hero art · Blender master / original');

// ── Render ───────────────────────────────────────────────────────────────
num('render.pixelScale', 3, 1, 8, 1, 'Pixel size');
bool('render.shadows', true, 'Shadows');
num('render.saturate', 1.12, 0.5, 2, 0.01, 'Saturation');
num('render.contrast', 1.04, 0.6, 1.6, 0.01, 'Contrast');
num('render.sun', 1.6, 0, 4, 0.05, 'Sun strength');
num('render.ambient', 1.25, 0, 4, 0.05, 'Ambient strength');
num('render.animFps', 60, 6, 60, 1, 'Animation fps (stepped)');

// ── FX ───────────────────────────────────────────────────────────────────
num('fx.hitstop', 0.03, 0, 0.3, 0.005, 'Hitstop on catch (s)');
num('fx.shake', 1, 0, 3, 0.05, 'Screen shake ×');
num('fx.flash', 0.35, 0, 1, 0.01, 'Flash strength');
num('fx.particles', 1, 0, 3, 0.05, 'Particle amount ×');
bool('fx.smears', true, 'Smears & afterimages');
num('fx.slowmo', 0.55, 0.05, 1, 0.01, 'Elimination slow-mo speed');
num('fx.slowmoTime', 0.3, 0, 3, 0.05, 'Elimination slow-mo length (s)');
num('fx.trail', 1, 0, 3, 0.05, 'Ball trail ×');

// ── Arena ────────────────────────────────────────────────────────────────
choice('arena.map', 'temple', ['temple', 'egolab', 'frost', 'pitch'], 'Map (editor & default)');
choice('arena.theme', 'temple', ['temple', 'egolab', 'frost'], 'Training Pitch · theme');
num('arena.width', 30, 12, 60, 1, 'Training Pitch · width');
num('arena.depth', 19, 8, 40, 1, 'Training Pitch · depth');
num('arena.crowd', 1, 0, 1, 0.05, 'Crowd density');
bool('arena.lights', true, 'Torches & lanterns');

// ── UI / design tokens ───────────────────────────────────────────────────
color('ui.ink', '#f3e9d2', 'Ink');
color('ui.panel', '#0e1524', 'Panel');
color('ui.panel2', '#18223a', 'Panel raised');
color('ui.line', '#2b3858', 'Line');
color('ui.accent', '#e8a93a', 'Accent (gold)');
color('ui.blue', '#3b7be0', 'Blue');
color('ui.red', '#dc4343', 'Red');
color('ui.green', '#5cc46a', 'Green');
color('ui.tan', '#8c7b58', 'Tan');
num('ui.scale', 1, 0.6, 1.6, 0.05, 'HUD scale');
num('ui.btnSize', 78, 44, 120, 1, 'Action button size');
num('ui.joySize', 128, 80, 200, 1, 'Joystick size');
num('ui.radius', 4, 0, 24, 1, 'Corner radius');

// ── Animation phases (generic actions) ───────────────────────────────────
// Each action is a list of phases; durations here, pose keys in engine/anim.js
num('anim.pass.windup', 0.09, 0, 0.6, 0.005, 'Pass · windup');
num('anim.pass.strike', 0.05, 0.01, 0.3, 0.005, 'Pass · strike');
num('anim.pass.follow', 0.14, 0, 0.6, 0.005, 'Pass · follow');
num('anim.pass.recover', 0.12, 0, 0.6, 0.005, 'Pass · recover');
num('anim.pass.amp', 1, 0, 2, 0.05, 'Pass · pose amplitude');
num('anim.catch.absorb', 0.06, 0.01, 0.3, 0.005, 'Catch · absorb');
num('anim.catch.settle', 0.18, 0, 0.6, 0.005, 'Catch · settle');
num('anim.catch.amp', 1, 0, 2, 0.05, 'Catch · pose amplitude');
num('anim.dash.crouch', 0.04, 0, 0.3, 0.005, 'Dash · crouch');
num('anim.dash.burst', 0.14, 0.02, 0.5, 0.005, 'Dash · burst');
num('anim.dash.skid', 0.12, 0, 0.5, 0.005, 'Dash · skid');
num('anim.dash.amp', 1, 0, 2, 0.05, 'Dash · pose amplitude');
num('anim.elim.shock', 0.25, 0, 1, 0.01, 'Eliminate · shock');
num('anim.elim.burst', 0.08, 0.01, 0.4, 0.005, 'Eliminate · burst');
num('anim.elim.scatter', 0.9, 0.1, 3, 0.05, 'Eliminate · scatter');
num('anim.elim.amp', 1, 0, 2, 0.05, 'Eliminate · pose amplitude');
num('anim.run.stride', 1, 0.3, 2, 0.05, 'Run · stride');
num('anim.run.bob', 1, 0, 3, 0.05, 'Run · bounce');

export const SCHEMA = S;

// Hero & skill tunables are appended by game/heroes.js so each hero's numbers
// sit next to its definition.
export function addSchema(entries) {
  for (const e of entries) {
    if (!S.find((s) => s.key === e.key)) S.push(e);
  }
}

export const schemaHelpers = { num: (key, v, min, max, step, label) => ({ key, v, min, max, step, label, type: 'num' }),
  color: (key, v, label) => ({ key, v, label, type: 'color' }),
  bool: (key, v, label) => ({ key, v, label, type: 'bool' }) };
