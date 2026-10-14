// Skill implementations. Each starts an animated action; gameplay effects
// fire on phase boundaries (same phases the editor timeline shows).
import * as THREE from 'three';
import { footWorld } from '../engine/hero-model.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function aimDir(m, p) {
  const it = p.human ? m.input : null;
  if (it?.aim && Math.hypot(it.aim.x, it.aim.z) > 0.1) {
    const l = Math.hypot(it.aim.x, it.aim.z);
    return { x: it.aim.x / l, z: it.aim.z / l };
  }
  if (it && Math.hypot(it.mx, it.mz) > 0.2) {
    const l = Math.hypot(it.mx, it.mz);
    return { x: it.mx / l, z: it.mz / l };
  }
  if (!p.human && p.ai.aim) return p.ai.aim;
  return { x: p.fx, z: p.fz };
}

function moveDir(m, p) {
  const it = p.human ? m.input : p.ai.move;
  if (it && Math.hypot(it.mx ?? it.x, it.mz ?? it.z) > 0.2) {
    const x = it.mx ?? it.x, z = it.mz ?? it.z, l = Math.hypot(x, z);
    return { x: x / l, z: z / l };
  }
  return { x: p.fx, z: p.fz };
}

const P = (m, p, slot) => (k) => m.C(`hero.${p.heroId}.${slot}.${k}`);
const FX = (m, p) => m.C(`hero.${p.heroId}.fx`);

export const SKILLS = {
  // ── NOVA ───────────────────────────────────────────────────────────────
  'nova.atk': (m, p, ball) => {
    const k = P(m, p, 'atk'), col = FX(m, p), s = k('fxScale');
    const dir = aimDir(m, p);
    let target = null;
    m.startAction(p, 'nova.atk', {
      read: () => {
        target = m.aimAssist(p, dir, 25);
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 3 * s, r1: 0.4, time: k('read') + 0.05 });
        if (target) m.vfx.beam(V(p.x, 0.15, p.z), V(target.x, 0.15, target.z), col, 0.06, k('read') + 0.1);
      },
      volley: () => {
        if (!m.holding(p)) return;
        const t = target && target.alive ? target : m.aimAssist(p, dir, 25);
        const sp = m.C('ball.passSpeed') * k('speedMul');
        const d = t ? m.leadDir(p, t, sp, k('lead')) : dir;
        p.fx = d.x; p.fz = d.z;
        m.kick(p, ball, d, k('speedMul'), { target: t, color: col, flat: true, charge: 1 });
        const a = V(p.x, 0.5, p.z), b = V(p.x + d.x * 8, 0.5, p.z + d.z * 8);
        m.vfx.beam(a, b, col, 0.35 * s, 0.18);
        m.vfx.beam(a, b, '#ffffff', 0.12 * s, 0.12);
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.3, r1: 2.6 * s, time: 0.3 });
        m.stage.shake(0.35 * s);
        m.stage.zoomPunch(0.04 * s);
        m.hitstop = Math.max(m.hitstop, 0.05);
      },
    });
  },
  'nova.def': (m, p) => {
    const k = P(m, p, 'def'), col = FX(m, p), s = k('fxScale');
    m.startAction(p, 'nova.def', {
      pulse: () => {
        // Self-only: a burst of pace plus the pass lanes of every holder,
        // so NOVA "reads" where the ball is going next.
        p.t.haste = k('dur');
        for (const b of m.balls) {
          if (b.state !== 'held' || !b.owner || b.owner === p) continue;
          const h = b.owner;
          const t = m.aimAssist(h, { x: h.fx, z: h.fz });
          if (t) m.vfx.beam(V(h.x, 0.12, h.z), V(t.x, 0.12, t.z), col, 0.08, 0.9);
        }
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.5, r1: 7 * s, time: 0.45 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: '#ffffff', r0: 0.3, r1: 3 * s, time: 0.3 });
        m.vfx.pillar(p, col, 5, 0.35, 0.35);
      },
    }, { moveMul: 1 });
  },

  // ── BOLT ───────────────────────────────────────────────────────────────
  'bolt.atk': (m, p) => {
    const k = P(m, p, 'atk'), col = FX(m, p);
    const d = aimDir(m, p);
    p.dashDir = d;
    p.fx = d.x; p.fz = d.z;
    m.startAction(p, 'bolt.atk', {
      blitz: () => {
        p.t.blitz = k('blitz');
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.3, r1: 2 * k('fxScale'), time: 0.25 });
        m.vfx.dust(V(p.x, 0.1, p.z), 12, m.arena.theme.speck[0]);
        m.stage.shake(0.2);
      },
      skid: () => { p.t.blitz = 0; m.vfx.dust(V(p.x, 0.1, p.z), 10, m.arena.theme.speck[0]); },
    }, { moveMul: 1 });
  },
  'bolt.def': (m, p) => {
    const k = P(m, p, 'def'), col = FX(m, p);
    const d = moveDir(m, p);
    m.startAction(p, 'bolt.def', {
      leap: () => {
        const dist = k('dist');
        const hw = m.W / 2 - 0.5, hd = m.D / 2 - 0.5;
        const x1 = Math.max(-hw, Math.min(hw, p.x + d.x * dist));
        const z1 = Math.max(-hd, Math.min(hd, p.z + d.z * dist));
        p.leap = { x0: p.x, z0: p.z, x1, z1, t: 0, dur: k('leap'), h: k('height') };
        p.fx = d.x; p.fz = d.z;
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.3, r1: 1.8 * k('fxScale'), time: 0.25 });
        m.vfx.dust(V(p.x, 0.1, p.z), 10, m.arena.theme.speck[0]);
      },
    }, { moveMul: 1 });
  },

  // ── TITAN ──────────────────────────────────────────────────────────────
  'titan.atk': (m, p, ball) => {
    const k = P(m, p, 'atk'), col = FX(m, p), s = k('fxScale');
    const dir = aimDir(m, p);
    let charging = true;
    m.startAction(p, 'titan.atk', {
      charge: () => {
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          m.vfx.glow.add({ x: p.x + Math.cos(a) * 2.2, y: 0.6 + Math.random(), z: p.z + Math.sin(a) * 2.2, vx: -Math.cos(a) * 2.2 / k('charge'), vy: 0, vz: -Math.sin(a) * 2.2 / k('charge'), g: 0, drag: 0, life: k('charge'), max: k('charge'), size: 0.2 * s, size1: 0.05, color: col, rot: 0, spin: 6, floor: false });
        }
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 2.4 * s, r1: 0.5, time: k('charge') });
      },
      cannon: () => {
        charging = false;
        if (!m.holding(p)) return;
        const target = m.aimAssist(p, dir, 10);
        const sp = m.C('ball.passSpeed') * k('speedMul');
        const d = target ? m.leadDir(p, target, sp, 0.8) : dir;
        p.fx = d.x; p.fz = d.z;
        m.kick(p, ball, d, k('speedMul'), { target, color: col, flat: true, stun: k('stun'), knock: k('knock'), charge: 1 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.4, r1: 4.5 * s, time: 0.4 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: '#ffffff', r0: 0.3, r1: 2.5 * s, time: 0.25 });
        m.vfx.burst(V(p.x + d.x, 0.6, p.z + d.z), { count: 40, color: [col, '#ffffff', '#ff5a2a'], glow: true, dir: d, spread: 0.35, speed: 14, up: 3, life: 0.4, size: 0.22 });
        m.vfx.burst(V(p.x, 0.1, p.z), { count: 20, color: m.arena.theme.speck, speed: 6, up: 6, life: 0.7, size: 0.2 });
        m.stage.shake(0.7 * s);
        m.stage.flash(col, 0.5, 0.14);
        m.stage.zoomPunch(0.06 * s);
        m.hitstop = Math.max(m.hitstop, 0.08);
      },
    }, { moveMul: 0.15 });
    return true;
  },
  'titan.def': (m, p) => {
    const k = P(m, p, 'def');
    m.startAction(p, 'titan.def', {
      rise: () => {
        const cx = p.x + p.fx * 1.5, cz = p.z + p.fz * 1.5;
        const angle = Math.atan2(p.fx, p.fz);
        m.addWall(cx, cz, angle, k('wallLen'), k('wallTime'), m.arena.theme.rock);
        m.vfx.burst(V(cx, 0.2, cz), { count: 30, color: [m.arena.theme.rock, m.arena.theme.speck[0], '#ffffff'], speed: 6, up: 7, life: 0.6, size: 0.22 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: FX(m, p), r0: 0.4, r1: 3 * k('fxScale'), time: 0.3 });
        m.stage.shake(0.55);
      },
    }, { moveMul: 0 });
  },

  // ── JINX ───────────────────────────────────────────────────────────────
  'jinx.atk': (m, p, ball) => {
    const k = P(m, p, 'atk'), col = FX(m, p);
    const dir = aimDir(m, p);
    m.startAction(p, 'jinx.atk', {
      twirl: () => { m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 1.6, r1: 0.4, time: k('twirl') }); },
      split: () => {
        if (!m.holding(p)) return;
        const target = m.aimAssist(p, dir);
        const sp = m.C('ball.passSpeed') * 1.15;
        const d = target ? m.leadDir(p, target, sp, 0.6) : dir;
        const n = Math.round(k('decoys'));
        const spread = k('spread') * Math.PI / 180;
        const base = Math.atan2(d.z, d.x);
        m.kick(p, ball, d, 1.15, { target, color: col });
        // Decoys fan out on alternating sides of the real ball
        for (let i = 1; i <= n; i++) {
          const a = base + Math.ceil(i / 2) * spread * (i % 2 ? 1 : -1);
          const dec = m.makeBall(true);
          dec.lastPasser = p;
          m.kick(p, dec, { x: Math.cos(a), z: Math.sin(a) }, 1.15, { color: col });
          dec.immune.set(p.id, m.time + 10);
        }
        m.vfx.burst(V(p.x, 0.5, p.z), { count: 18, color: [col, '#ffffff'], glow: true, speed: 6, up: 3, life: 0.35 });
        m.stage.shake(0.2);
      },
    });
  },
  'jinx.def': (m, p) => {
    const k = P(m, p, 'def'), col = FX(m, p);
    const d = moveDir(m, p);
    m.startAction(p, 'jinx.def', {
      blink: () => {
        m.vfx.afterimage(p.model, col, 0.45, 0.6);
        m.vfx.burst(V(p.x, 0.9, p.z), { count: 16, color: [col, '#ffffff'], glow: true, speed: 4, up: 2, life: 0.35 });
        const dist = k('dist');
        p.x += d.x * dist; p.z += d.z * dist;
        m.clampToField(p);
        m.solid(p);
        p.t.invuln = 0.15;
        p.fx = d.x; p.fz = d.z;
        m.vfx.burst(V(p.x, 0.9, p.z), { count: 16, color: [col, '#ffffff'], glow: true, speed: 4, up: 2, life: 0.35 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 1.4 * k('fxScale'), r1: 0.2, time: 0.2 });
      },
    }, { moveMul: 0.6 });
  },

  // ── ECHO ───────────────────────────────────────────────────────────────
  'echo.atk': (m, p, ball) => {
    const k = P(m, p, 'atk'), col = FX(m, p);
    const dir = aimDir(m, p);
    m.startAction(p, 'echo.atk', {
      whip: () => {
        if (!m.holding(p)) return;
        const target = m.aimAssist(p, dir, 40);
        // kick off to the side and let it bend in
        const base = Math.atan2(dir.z, dir.x) + (target ? 0.7 : 0);
        const d = { x: Math.cos(base), z: Math.sin(base) };
        m.kick(p, ball, d, k('speedMul'), { target, color: col, homing: target ? k('homing') : 0, lob: 0.6 });
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.3, r1: 2 * k('fxScale'), time: 0.25 });
        m.vfx.burst(V(p.x, 0.4, p.z), { count: 16, color: [col, '#ffffff'], glow: true, dir: d, spread: 0.8, speed: 5, up: 2, life: 0.35 });
      },
    });
  },
  'echo.def': (m, p) => {
    const k = P(m, p, 'def'), col = FX(m, p);
    m.startAction(p, 'echo.def', {
      window: () => {
        p.t.trap = k('window');
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 1.8 * k('fxScale'), r1: 0.8, time: k('window'), opacity: 0.6 });
      },
      recover: () => { p.t.trap = 0; },
    }, { moveMul: 0.25 });
  },

  // ── KAIZ ───────────────────────────────────────────────────────────────
  'kaiz.atk': (m, p, ball) => {
    const k = P(m, p, 'atk'), col = FX(m, p), s = k('fxScale');
    let target = null, best = Infinity;
    for (const o of m.alive) {
      if (o === p || o.t.cloak > 0 || o.leap) continue;
      if (ball.prevHolder === o && (ball.immune.get(o.id) ?? 0) > m.time) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < k('range') && d < best) { best = d; target = o; }
    }
    if (!target) return false;
    m.startAction(p, 'kaiz.atk', {
      vanish: () => {
        m.vfx.afterimage(p.model, col, 0.4, 0.7);
        m.vfx.burst(V(p.x, 0.9, p.z), { count: 20, color: [col, '#ffffff'], glow: true, speed: 5, up: 3, life: 0.4 });
        p.model.visible = false;
      },
      strike: () => {
        p.model.visible = true;
        if (!m.holding(p) || !target.alive) return;
        const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1;
        p.x = target.x + (dx / d) * 1.0;
        p.z = target.z + (dz / d) * 1.0;
        m.clampToField(p);
        m.solid(p);
        p.fx = -dx / d; p.fz = -dz / d;
        ball.lastPasser = p;
        ball.prevHolder = p;
        ball.immune.set(p.id, m.time + m.C('rules.passBackImmune'));
        ball.vx = p.fx * 14; ball.vz = p.fz * 14;
        ball.color = col;
        ball.stun = 0.35; ball.knock = 4;
        m.catchBall(ball, target);
        const at = V(target.x, 0.1, target.z);
        m.vfx.ring(at, { color: col, r0: 0.3, r1: 3.5 * s, time: 0.35 });
        m.vfx.ring(at, { color: '#ffffff', r0: 0.2, r1: 2 * s, time: 0.2 });
        m.vfx.burst(V(target.x, 1, target.z), { count: 36, color: [col, '#ffffff', '#ffd84a'], glow: true, speed: 10, up: 6, life: 0.5 });
        m.vfx.pillar(at, col, 7, 0.5, 0.35);
        m.stage.shake(0.5 * s);
        m.stage.flash(col, 0.5, 0.15);
        m.hitstop = Math.max(m.hitstop, 0.09);
      },
      end: () => { p.model.visible = true; },
    }, { moveMul: 0 });
  },
  'kaiz.def': (m, p) => {
    const k = P(m, p, 'def'), col = FX(m, p);
    m.startAction(p, 'kaiz.def', {
      raise: () => {
        p.t.crown = k('dur');
        m.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.4, r1: 2.2 * k('fxScale'), time: 0.3 });
        m.vfx.burst(V(p.x, 1.6, p.z), { count: 14, color: ['#ffd84a', col], glow: true, speed: 3, up: 4, life: 0.4 });
      },
    }, { moveMul: 0.7 });
  },
};

// Editor helper: foot arc sample
export { footWorld };
