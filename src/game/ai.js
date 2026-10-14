// Bot brains. Holders chase and pass; runners flee holders, dodge incoming
// passes and grab items. Reaction time and aim error scale with rules.botSkill.

import { segmentBlocked, isCircle } from './maps.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// Steer a desired direction around map obstacles: push away from nearby
// surfaces and slide along anything straight ahead.
function avoid(m, p, x, z) {
  const obs = m.arena.obstacles;
  if (!obs?.length) return { x, z };
  const l = Math.hypot(x, z);
  if (l < 0.05) return { x, z };
  let dx = x / l, dz = z / l;
  let ax = 0, az = 0;
  for (const o of obs) {
    let nx, nz, gap;
    if (isCircle(o)) {
      const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz) || 0.01;
      nx = ox / d; nz = oz / d; gap = d - o.r;
    } else {
      const cx = Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, p.x));
      const cz = Math.max(o.z - o.d / 2, Math.min(o.z + o.d / 2, p.z));
      const ox = p.x - cx, oz = p.z - cz, d = Math.hypot(ox, oz) || 0.01;
      nx = ox / d; nz = oz / d; gap = d;
    }
    if (gap > 2.2) continue;
    const facing = -(dx * nx + dz * nz); // >0 when heading into it
    if (facing <= 0) continue;
    const w = (2.2 - gap) / 2.2;
    // tangent that keeps the most of the desired heading
    let tx = -nz, tz = nx;
    if (tx * dx + tz * dz < 0) { tx = -tx; tz = -tz; }
    ax += (tx * 1.6 + nx * 0.8) * w * facing;
    az += (tz * 1.6 + nz * 0.8) * w * facing;
  }
  dx += ax; dz += az;
  const n = Math.hypot(dx, dz) || 1;
  return { x: (dx / n) * Math.min(1, l), z: (dz / n) * Math.min(1, l) };
}


function nearestTarget(m, p, ball) {
  let best = null, bd = Infinity;
  for (const o of m.alive) {
    if (o === p || o.t.cloak > 0) continue;
    if (o.zoneKind === 'grass' && Math.hypot(o.x - p.x, o.z - p.z) > 4) continue;
    if (ball && ball.prevHolder === o && (ball.immune.get(o.id) ?? 0) > m.time) continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z) + (o.t.shield > 0 || o.t.crown > 0 ? 6 : 0);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function blockedByWall(m, a, b) {
  if (m.arena.obstacles?.length && segmentBlocked(m.arena.obstacles, a, b, 1.0)) return true;
  for (const w of m.walls) {
    for (let i = 1; i < 6; i++) {
      const x = a.x + (b.x - a.x) * (i / 6), z = a.z + (b.z - a.z) * (i / 6);
      const { u, v } = m.wallLocal(w, x, z);
      if (Math.abs(u) < w.len / 2 && Math.abs(v) < 0.4) return true;
    }
  }
  return false;
}

export function think(m, p, dt) {
  const C = m.C;
  const s = C('rules.botSkill');
  const ai = p.ai;
  const it = { mx: ai.move.x, mz: ai.move.z, aim: ai.aim, aPressed: false, aReleased: false, aHeld: false, skillPressed: false, itemPressed: false };
  ai.t -= dt;
  if (ai.t > 0) return it;
  ai.t = (0.32 - 0.24 * s) * rnd(0.7, 1.3);

  const ball = m.holding(p);
  if (m.phase !== 'play') {
    // drift towards open space between rounds
    const cx = -p.x * 0.1, cz = -p.z * 0.1;
    ai.move = { x: cx + rnd(-0.3, 0.3), z: cz + rnd(-0.3, 0.3) };
    it.mx = ai.move.x * 0.4; it.mz = ai.move.z * 0.4;
    return it;
  }

  if (ball) {
    const target = nearestTarget(m, p, ball);
    const left = m.mode.timer === 'fuse' ? ball.fuse : m.mode.timer === 'hidden' ? 4 : m.roundT;
    const urgent = left < 2.5;
    if (!target) { ai.move = { x: rnd(-1, 1), z: rnd(-1, 1) }; it.mx = ai.move.x; it.mz = ai.move.z; return it; }
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1;
    // approach, with a bit of curve so it doesn't look robotic
    const curve = Math.sin(m.time * 1.3 + p.id) * 0.35;
    ai.move = avoid(m, p, dx / d - (dz / d) * curve, dz / d + (dx / d) * curve);
    it.mx = ai.move.x; it.mz = ai.move.z;
    const range = 4.5 + 4 * s + (urgent ? 5 : 0);
    if (p.lock <= 0 && !p.action && d < range && !blockedByWall(m, p, target)) {
      const lead = m.leadDir(p, target, C('ball.passSpeed'), 0.4 + 0.5 * s);
      const err = (1 - s) * 0.35 * rnd(-1, 1);
      const a = Math.atan2(lead.z, lead.x) + err;
      ai.aim = { x: Math.cos(a), z: Math.sin(a) };
      it.aim = ai.aim;
      if (p.cd.atk <= 0 && Math.random() < 0.3 + 0.35 * s) it.skillPressed = true;
      else if (Math.random() < 0.55 + 0.4 * s || urgent) it.aPressed = true;
    }
    if (p.item && ['magnet', 'cleats', 'overclock'].includes(p.item) && Math.random() < 0.3) it.itemPressed = true;
    return it;
  }

  // ── Runner ─────────────────────────────────────────────────────────────
  let fx = 0, fz = 0;
  let threatened = false;
  for (const b of m.balls) {
    if (b.state === 'dead') continue;
    if (b.state === 'held' && b.owner && b.owner !== p) {
      const h = b.owner;
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 0.1;
      const w = 9 / (d * d + 1);
      fx += (dx / d) * w; fz += (dz / d) * w;
      if (d < 4) threatened = true;
    } else if (b.state !== 'held') {
      const rx = p.x - b.x, rz = p.z - b.z;
      const v2 = b.vx * b.vx + b.vz * b.vz;
      const mine = b.lastPasser === p;
      if (mine && b.state === 'loose' && (b.immune.get(p.id) ?? 0) < m.time && m.roundT < 4 && m.mode.timer !== 'fuse') {
        // Re-grab my own loose ball so I can pass it on
        const d = Math.hypot(rx, rz) || 1;
        fx -= (rx / d) * 4; fz -= (rz / d) * 4;
        continue;
      }
      if (v2 > 4) {
        const tca = (rx * b.vx + rz * b.vz) / v2;
        if (tca > 0 && tca < 0.9) {
          const mx = rx - b.vx * tca, mz = rz - b.vz * tca;
          const miss = Math.hypot(mx, mz);
          if (miss < 1.4) {
            threatened = true;
            // dodge perpendicular to the ball path
            const pl = Math.hypot(mx, mz) || 1;
            const px = miss > 0.05 ? mx / pl : -b.vz / Math.sqrt(v2), pz = miss > 0.05 ? mz / pl : b.vx / Math.sqrt(v2);
            fx += px * 12; fz += pz * 12;
            if (Math.random() < s * 0.8) {
              if (p.cd.def <= 0 && Math.random() < 0.6) it.skillPressed = true;
              else if (p.cd.dash <= 0) it.aPressed = true;
            }
            if (p.item && ['shield', 'cloak', 'whistle', 'cleats'].includes(p.item) && Math.random() < s) it.itemPressed = true;
          }
        }
      } else {
        const d = Math.hypot(rx, rz) || 1;
        if (d < 2.5) { fx += (rx / d) * 2; fz += (rz / d) * 2; }
      }
    }
  }
  // Walls of the field
  const hw = m.W / 2, hd = m.D / 2;
  const edge = 2.5;
  if (p.x < -hw + edge) fx += (-hw + edge - p.x) * 1.5;
  if (p.x > hw - edge) fx -= (p.x - (hw - edge)) * 1.5;
  if (p.z < -hd + edge) fz += (-hd + edge - p.z) * 1.5;
  if (p.z > hd - edge) fz -= (p.z - (hd - edge)) * 1.5;
  // Corners are death traps: bias toward the centre a little
  fx -= p.x * 0.03; fz -= p.z * 0.03;
  // Spread out from other runners
  for (const o of m.alive) {
    if (o === p || m.holding(o)) continue;
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz) || 0.1;
    if (d < 2.5) { fx += (dx / d) * 0.6; fz += (dz / d) * 0.6; }
  }
  // Items
  if (!p.item && !threatened) {
    for (const item of m.items) {
      const dx = item.x - p.x, dz = item.z - p.z, d = Math.hypot(dx, dz);
      if (d < 6) { fx += (dx / d) * 1.2; fz += (dz / d) * 1.2; break; }
    }
  }
  if (p.item === 'overclock' && (ai.useItemAt ?? 0) < m.time) it.itemPressed = true;
  // Wander noise
  fx += Math.sin(m.time * 0.7 + p.id * 3) * 0.25;
  fz += Math.cos(m.time * 0.9 + p.id * 5) * 0.25;
  const l = Math.hypot(fx, fz);
  ai.move = l > 0.15 ? avoid(m, p, fx / l, fz / l) : { x: 0, z: 0 };
  if (threatened && p.cd.def <= 0 && Math.random() < 0.08 * s) it.skillPressed = true;
  it.mx = ai.move.x; it.mz = ai.move.z;
  return it;
}
