// Match simulation: players, ball(s), rules, rounds, items. Fixed 60 Hz step.
// Reads every tunable live through C(key) so editor changes apply instantly.
import * as THREE from 'three';
import { HEROES, HERO_BY_ID, phasesFor, ampFor } from './heroes.js';
import { MODES } from './modes.js';
import { ITEMS, ITEM_IDS } from './items.js';
import { SKILLS } from './skills.js';
import { think } from './ai.js';
import { ZONES, zoneAt, pushOut, segmentBlocked } from './maps.js';
import { buildHero, applyPose, footWorld } from '../engine/hero-model.js';
import { buildBall, buildItemCrate, buildMarker, buildArrow } from '../engine/props.js';
import { POSES, actionPose, locomotionPose, lerpPose, totalDuration, phaseAt } from '../engine/anim.js';

import { gaitStepLength, RUN_STANCE, HERO_SCALE } from '../engine/hero-motion.js';

const STEP = 1 / 60;
const G = 30; // ball gravity
const BOT_NAMES = ['RIO', 'ZEN', 'KOA', 'VEX', 'MOR', 'TAJ', 'ODE', 'PIK', 'SUN', 'YUL', 'NIX', 'AXE'];

export class Match {
  constructor({ stage, vfx, arena, C, humanHero = null, modeId = null, lab = false, playersBonus = 0, loadout = null }) {
    this.playersBonus = playersBonus;
    this.loadout = loadout; // cosmetics for the human's striker
    this.lab = lab; // editor Skill Lab: no rounds, no bots, no items
    this.stage = stage;
    this.vfx = vfx;
    this.arena = arena;
    this.C = C;
    this.scene = stage.scene;
    this.humanHero = humanHero;
    this.modeId = modeId || C('rules.mode');
    this.mode = MODES[this.modeId] || MODES.classic;
    this.listeners = {};
    this.players = [];
    this.balls = [];
    this.decoys = [];
    this.walls = [];
    this.items = [];
    this.time = 0;
    this.acc = 0;
    this.hitstop = 0;
    this.slowT = 0;
    this.round = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.roundT = 0;
    this.shrink = 1;
    this.itemT = 0;
    this.input = null; // set by the page each frame for the human
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.cam = new THREE.Vector3();
    this.paused = false;
  }

  on(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, data) { for (const fn of this.listeners[type] || []) fn(data); }

  get W() { return this.arena.W * this.shrink; }
  get D() { return this.arena.D * this.shrink; }
  get human() { return this.players.find((p) => p.human); }
  get alive() { return this.players.filter((p) => p.alive); }

  // ── Setup ──────────────────────────────────────────────────────────────
  start() {
    const C = this.C;
    const count = Math.min(14, Math.round(C('rules.players') + (this.mode.playersBonus || 0) + this.playersBonus));
    const roster = [];
    if (this.humanHero) roster.push(this.humanHero);
    const pool = HEROES.map((h) => h.id);
    while (roster.length < count) roster.push(pool[C('art.benchmark')?roster.length%pool.length:(roster.length * 7 + Math.floor(Math.random() * 6)) % pool.length]);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    roster.forEach((hid, i) => this.addPlayer(hid, i === 0 && !!this.humanHero, i === 0 && this.humanHero ? 'YOU' : names[i % names.length]));
    this.layoutPlayers();
    this.nextRound(true);
  }

  addPlayer(heroId, human, name) {
    const hero = HERO_BY_ID[heroId];
    const model = buildHero(heroId, this.C, human ? this.loadout : null);
    this.group.add(model);
    const marker = buildMarker(human ? '#e8a93a' : '#ffffff');
    marker.children[0].material.opacity = human ? 0.95 : 0.25;
    this.group.add(marker);
    const p = {
      id: this.players.length, heroId, hero, human, name, alive: true,
      x: 0, z: 0, y: 0, vx: 0, vz: 0, fx: 0, fz: 1, cyc: Math.random() * 6,
      model, marker, cd: { atk: 2, def: 2, dash: 0 }, lock: 0, stun: 0, freeze: 0,
      action: null, charge: -1, item: null, magnet: false,
      t: { cleats: 0, shield: 0, cloak: 0, invuln: 0, haste: 0, crown: 0, trap: 0, blitz: 0, leap: 0, dash: 0 },
      zone: null, poseAcc: 1, pose: { ...POSES.idle }, ai: { t: 0, move: { x: 0, z: 0 } },
      dashDir: { x: 0, z: 1 }, leap: null, shieldFx: null,
    };
    this.players.push(p);
    return p;
  }

  // Replace presentation only; preserve match state when art settings change.
  refreshArt() {
    for (const p of this.players) {
      const old = p.model;
      const model = buildHero(p.heroId, this.C, old.userData.loadout);
      model.position.copy(old.position); model.rotation.copy(old.rotation);
      model.visible = old.visible;
      applyPose(model, p.pose);
      this.group.remove(old); this.group.add(model); p.model = model;
    }
  }

  layoutPlayers() {
    const alive = this.alive;
    const n = alive.length;
    alive.forEach((p, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      p.x = Math.cos(a) * this.W * 0.32;
      p.z = Math.sin(a) * this.D * 0.32;
      p.vx = p.vz = 0;
      p.fx = -Math.cos(a); p.fz = -Math.sin(a);
      this.solid(p);
    });
  }

  nextRound(first = false) {
    this.round++;
    const C = this.C;
    if (this.mode.shrink && !first) this.shrink = Math.max(0.4, this.shrink - C('rules.shrinkPerRound'));
    this.arena.setFence(this.shrink, this.mode.shrink);
    for (const b of this.balls) this.group.remove(b.mesh), this.group.remove(b.mesh.userData.ring);
    for (const b of this.decoys) this.group.remove(b.mesh);
    this.balls = [];
    this.decoys = [];
    const alive = this.alive;
    const nb = Math.max(1, Math.min(this.mode.balls, alive.length - 1));
    const holders = [...alive].sort(() => Math.random() - 0.5).slice(0, nb);
    for (const h of holders) {
      const b = this.makeBall();
      this.giveBall(b, h, true);
    }
    this.roundLen = this.mode.timer === 'hidden' ? C('rules.roundTime') * (0.5 + Math.random()) : C('rules.roundTime');
    this.roundT = this.roundLen;
    for (const p of alive) { p.cd.atk = Math.min(p.cd.atk, 1.5); p.cd.def = Math.min(p.cd.def, 1.5); p.lock = 0.8; }
    this.phase = 'intro';
    this.phaseT = first ? 1.6 : 1.1;
    this.emit('round', { round: this.round, alive: alive.length, first });
  }

  makeBall(decoy = false) {
    const mesh = buildBall(this.C('ball.size'));
    this.group.add(mesh);
    if (!decoy) this.group.add(mesh.userData.ring);
    const b = { mesh, decoy, state: 'loose', owner: null, x: 0, y: 0.3, z: 0, vx: 0, vy: 0, vz: 0, lastPasser: null, lastTouch: null, prevHolder: null, immune: new Map(), homing: null, color: '#ffffff', stun: 0, knock: 0, fuse: this.C('rules.fuseTime'), looseT: 0, ts: 1, life: 0 };
    if (decoy) this.decoys.push(b); else this.balls.push(b);
    return b;
  }

  // ── Main loop ──────────────────────────────────────────────────────────
  update(realDt) {
    realDt = Math.min(realDt, 0.1);
    this.inputClock=(this.inputClock||0)+realDt;
    this.bufferHumanInput();
    if (this.paused) { this.updateVisuals(0); return; }
    let scale = 1;
    if (this.slowT > 0) { this.slowT -= realDt; scale = this.C('fx.slowmo'); }
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      this.vfx.update(realDt * 0.15);
      this.updateVisuals(0);
      return;
    }
    this.acc += realDt * scale;
    let n = 0;
    while (this.acc >= STEP && n++ < 8) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.vfx.update(realDt * scale);
    this.arena.update(this.time, realDt * scale, this.vfx);
    this.updateVisuals(realDt * scale);
  }

  step(dt) {
    this.time += dt;
    const C = this.C;
    this.phaseT -= dt;
    if (this.lab) {
      this.phase = 'play';
    } else if (this.phase === 'intro') {
      if (this.phaseT <= 0) { this.phase = 'play'; this.emit('go', {}); }
    } else if (this.phase === 'play') {
      if (this.mode.timer !== 'fuse') {
        this.roundT -= dt;
        if (this.roundT <= 0) this.buzzer();
      }
      this.itemT -= dt;
      if (this.itemT <= 0) { this.itemT = C('rules.itemEvery'); this.spawnItem(); }
    } else if (this.phase === 'boom') {
      if (this.phaseT <= 0) {
        if (this.alive.length <= 1) {
          this.phase = 'over';
          this.phaseT = 999;
          const w = this.alive[0];
          if (w) this.startAction(w, `${w.heroId}.atk`); // victory flourish (anim only)
          this.emit('win', { winner: w });
          this.arena.cheer = 1;
        } else {
          this.phase = 'inter';
          this.phaseT = C('rules.intermission') * 0.5;
        }
      }
    } else if (this.phase === 'inter') {
      if (this.phaseT <= 0) this.nextRound();
    }

    const live = this.phase === 'play';
    for (const p of this.players) this.stepPlayer(p, dt, live);
    this.separate();
    for (const b of this.balls) this.stepBall(b, dt, live);
    for (const b of this.decoys) this.stepBall(b, dt, live);
    this.decoys = this.decoys.filter((b) => {
      if (b.dead) { this.group.remove(b.mesh); return false; }
      return true;
    });
    this.stepWalls(dt);
    this.stepItems(dt);
  }

  // ── Rules ──────────────────────────────────────────────────────────────
  culpritOf(b) {
    if (b.state === 'held') return b.owner;
    return b.lastPasser && b.lastPasser.alive ? b.lastPasser : null;
  }

  buzzer() {
    const out = new Set();
    for (const b of this.balls) {
      const c = this.culpritOf(b);
      if (c) out.add(c);
    }
    if (out.size >= this.alive.length) {
      // Never eliminate everyone at once — the one holding longest survives.
      const keep = [...out][0];
      out.delete(keep);
    }
    for (const b of this.balls) this.explodeBall(b);
    this.emit('buzzer', { out: out.size });
    for (const p of out) this.eliminate(p, 'buzzer');
    this.phase = 'boom';
    this.phaseT = 1.6;
    if (!out.size) this.phaseT = 0.6;
  }

  explodeBall(b) {
    const pos = new THREE.Vector3(b.x, b.y, b.z);
    this.vfx.burst(pos, { count: 50, color: ['#ffffff', '#ffd84a', '#ff5a2a'], glow: true, speed: 12, up: 9, life: 0.7, size: 0.24 });
    this.vfx.contact('elim',{x:pos.x,y:.08,z:pos.z},{x:0,z:1},'#ffd84a',2.5);
    this.vfx.ring(pos, { color: '#ffd84a', r0: 0.3, r1: 5, time: 0.5 });
    b.mesh.visible = false;
    b.mesh.userData.ring.visible = false;
    b.state = 'dead';
    b.owner = null;
  }

  eliminate(p, reason) {
    if (!p.alive) return;
    const C = this.C;
    p.alive = false;
    p.charge = -1;
    p.item = null;
    this.startAction(p, 'elim', {
      burst: () => {
        const fx = C(`hero.${p.heroId}.fx`);
        this.vfx.shatter(p.model, 9, [fx, '#ffffff']);
        this.vfx.pillar(p.model.position, fx, 10, 0.7, 0.6);
        this.vfx.ring(p.model.position, { color: fx, r0: 0.4, r1: 6, time: 0.6 });
        this.vfx.ring(p.model.position, { color: '#ffffff', r0: 0.2, r1: 3.5, time: 0.35 });
        p.model.visible = false;
        p.marker.visible = false;
        this.stage.shake(0.75);
        this.stage.flash('#ffffff', 0.9, 0.22);
        this.stage.zoomPunch(0.08);
        this.arena.cheer = 1;
        this.emit('elimBurst', { player: p });
      },
    });
    this.slowT = C('fx.slowmoTime');
    this.emit('elim', { player: p, reason, left: this.alive.length });
    // Drop any ball they had (fuse mode / skills)
    for (const b of this.balls) if (b.owner === p) this.explodeBall(b);
  }

  // ── Players ────────────────────────────────────────────────────────────
  speedOf(p) {
    const C = this.C;
    let s = C('move.speed') * C(`hero.${p.heroId}.speed`);
    if (p.heroId === 'bolt') s *= C('hero.bolt.passive.speed');
    if (this.holding(p)) s *= C('move.holderMul');
    if (p.t.cleats > 0) s *= C('item.cleats.speed');
    if (p.t.haste > 0) s *= C('hero.nova.def.speed');
    if (p.heroId === 'kaiz' && this.holding(p)) s *= C('hero.kaiz.passive.holdSpeed');
    if (p.zone) s *= p.zone.speed;
    return s;
  }

  holding(p) { return this.balls.find((b) => b.state === 'held' && b.owner === p) || null; }

  stepPlayer(p, rdt, live) {
    if (!p.alive) {
      if (p.action) this.stepAction(p, rdt);
      return;
    }
    const C = this.C;
    const dt = rdt;
    // Timers
    for (const k in p.t) if (p.t[k] > 0) p.t[k] = Math.max(0, p.t[k] - dt);
    const moving = Math.hypot(p.vx, p.vz) > 0.6;
    const regen = p.heroId === 'echo' && !moving ? C('hero.echo.passive.idleRegen') : 1;
    p.cd.atk = Math.max(0, p.cd.atk - dt * regen);
    p.cd.def = Math.max(0, p.cd.def - dt * regen);
    p.cd.dash = Math.max(0, p.cd.dash - dt);
    p.lock = Math.max(0, p.lock - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.freeze = Math.max(0, p.freeze - dt);
    if (p.action) this.stepAction(p, dt);

    // Intent
    let mx = 0, mz = 0;
    let intent = null;
    if (live || this.phase === 'inter' || this.phase === 'over') {
      if (p.human && this.input) intent = this.input;
      else if (!p.human && !this.lab) intent = think(this, p, dt);
    }
    const disabled = p.stun > 0 || p.freeze > 0;
    if (intent && !disabled) {
      mx = intent.mx; mz = intent.mz;
      if (live) this.handleIntent(p, intent);
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // Terrain under your feet
    const zq = this.arena.zones?.length ? zoneAt(this.arena.zones, p.x, p.z) : null;
    p.zone = zq && !p.leap ? ZONES[zq.kind] : null;
    p.zoneKind = p.zone ? zq.kind : null;
    const grip = p.zone ? p.zone.accel : 1, slide = p.zone ? p.zone.friction : 1;

    // Movement
    const previousX=p.x,previousZ=p.z;
    const sp = this.speedOf(p) * (p.charge >= 0 ? C('move.chargeMul') : 1) * (p.action?.moveMul ?? 1);
    if (p.t.blitz > 0) {
      p.vx = p.dashDir.x * C('hero.bolt.atk.speed');
      p.vz = p.dashDir.z * C('hero.bolt.atk.speed');
      if (Math.random() < 0.5) this.vfx.afterimage(p.model, C('hero.bolt.fx'), 0.22, 0.4);
      this.blitzTag(p);
    } else if (p.leap) {
      const L = p.leap;
      L.t += dt;
      const u = Math.min(1, L.t / L.dur);
      p.x = L.x0 + (L.x1 - L.x0) * u;
      p.z = L.z0 + (L.z1 - L.z0) * u;
      p.y = Math.sin(u * Math.PI) * L.h;
      p.vx = p.vz = 0;
      if (Math.random() < 0.6) this.vfx.afterimage(p.model, C('hero.bolt.fx'), 0.2, 0.35);
      if (u >= 1) { p.leap = null; p.y = 0; this.solid(p); this.vfx.dust({ x: p.x, y: 0.1, z: p.z }, 10, this.arena.theme.speck[0]); this.vfx.ring({ x: p.x, z: p.z }, { color: '#ffffff', r0: 0.3, r1: 1.6, time: 0.25 }); }
    } else if (p.t.dash > 0) {
      p.vx = p.dashDir.x * C('move.dashSpeed');
      p.vz = p.dashDir.z * C('move.dashSpeed');
      if (Math.random() < 0.7) this.vfx.afterimage(p.model, C(`hero.${p.heroId}.fx`), 0.18, 0.35);
    } else if (disabled) {
      const f = Math.exp(-C('move.friction') * slide * dt * 0.5);
      p.vx *= f; p.vz *= f;
    } else if (len > 0.05) {
      const a = C('move.accel') * grip * dt;
      const tx = mx * sp, tz = mz * sp;
      const dx = tx - p.vx, dz = tz - p.vz;
      const dl = Math.hypot(dx, dz);
      if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += (dx / dl) * a; p.vz += (dz / dl) * a; }
    } else {
      const f = Math.exp(-C('move.friction') * slide * dt);
      p.vx *= f; p.vz *= f;
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    this.clampToField(p);
    this.collideWalls(p);
    if (!p.leap) this.solid(p);
    if (p.zoneKind === 'ice' && Math.hypot(p.vx, p.vz) > 3 && Math.random() < dt * 10) this.vfx.trail({ x: p.x, y: 0.06, z: p.z }, '#eaf8ff', 0.14, 0.4);
    if (p.zoneKind === 'boost' && Math.random() < dt * 14) this.vfx.trail({ x: p.x + (Math.random() - 0.5) * 0.5, y: 0.1 + Math.random() * 0.8, z: p.z + (Math.random() - 0.5) * 0.5 }, '#5ad8ff', 0.12, 0.3);

    // Facing
    let fx = p.fx, fz = p.fz;
    if (p.charge >= 0 && intent?.aim) { fx = intent.aim.x; fz = intent.aim.z; }
    else if (Math.hypot(p.vx, p.vz) > 0.8 && !(p.action && p.action.lockFacing)) { fx = p.vx; fz = p.vz; }
    const fl = Math.hypot(fx, fz) || 1;
    const turn = Math.min(1, dt * 16);
    p.fx += (fx / fl - p.fx) * turn;
    p.fz += (fz / fl - p.fz) * turn;
    const n = Math.hypot(p.fx, p.fz) || 1;
    p.fx /= n; p.fz /= n;

    const spd = Math.hypot(p.vx, p.vz);
    const distance=Math.hypot(p.x-previousX,p.z-previousZ),previousCycle=p.cyc;
    p.cyc += p.model.userData.artStyle==='master'
      ? distance*2*Math.PI*RUN_STANCE/gaitStepLength(p.heroId,spd/C('move.speed'),C('anim.run.stride'))
      : distance*2.1/C('anim.run.stride');
    if(spd>4 && !p.action && !p.leap && Math.floor(previousCycle/Math.PI)!==Math.floor(p.cyc/Math.PI)){
      const side=Math.floor(p.cyc/Math.PI)%2===0?1:-1,scale=HERO_SCALE[p.heroId]||[1,1,1];
      const forward=gaitStepLength(p.heroId,spd/C('move.speed'),C('anim.run.stride'))/2+.1*scale[2];
      this.vfx.dust({x:p.x+p.fx*forward+p.fz*.18*scale[0]*side,y:.03,z:p.z+p.fz*forward-p.fx*.18*scale[0]*side},2,this.arena.theme.speck[1]);
    }

    // Charging pass
    if (p.charge >= 0) {
      p.charge = Math.min(1.4, p.charge + dt / C('ball.chargeTime'));
      if (p.charge >= 1.4 && !p.human) this.releasePass(p, intent?.aim);
    }
  }

  clampToField(p) {
    const r = this.C('move.radius');
    const hw = this.W / 2 - r, hd = this.D / 2 - r;
    if (p.x < -hw) { p.x = -hw; p.vx = Math.max(0, p.vx); }
    if (p.x > hw) { p.x = hw; p.vx = Math.min(0, p.vx); }
    if (p.z < -hd) { p.z = -hd; p.vz = Math.max(0, p.vz); }
    if (p.z > hd) { p.z = hd; p.vz = Math.min(0, p.vz); }
  }

  // Push a player out of map obstacles and cancel velocity into the surface.
  solid(p) {
    const obs = this.arena.obstacles;
    if (!obs?.length) return;
    const hit = pushOut(obs, p, this.C('move.radius'));
    if (!hit) return;
    const vn = p.vx * hit.nx + p.vz * hit.nz;
    if (vn < 0) { p.vx -= vn * hit.nx; p.vz -= vn * hit.nz; }
  }

  // Ball vs map obstacles: bounce off anything taller than the ball's height.
  ballObstacles(b) {
    const obs = this.arena.obstacles;
    if (!obs?.length) return;
    const r = this.C('ball.size');
    for (const o of obs) {
      if (b.y - r > o.h) continue;
      const pos = { x: b.x, z: b.z };
      const hit = pushOut([o], pos, r);
      if (!hit) continue;
      b.x = pos.x; b.z = pos.z;
      const vn = b.vx * hit.nx + b.vz * hit.nz;
      if (vn < 0) {
        b.vx -= 2 * vn * hit.nx; b.vz -= 2 * vn * hit.nz;
        b.vx *= 0.72; b.vz *= 0.72;
        b.homing = null;
        if (b.state === 'flight') b.state = 'loose';
        if (b.decoy) { this.popDecoy(b); return; }
        if (-vn > 4) {
          this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 10, color: ['#ffffff', this.arena.theme.speck[0]], speed: 4, up: 3, life: 0.3, size: 0.12 });
          this.emit('bounce', {});
          this.stage.shake(0.08);
        }
      }
    }
  }

  separate() {
    const r = this.C('move.radius') * 2;
    const A = this.alive;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.leap || b.leap) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.0001 && d < r) {
        const push = (r - d) / 2;
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        b.x += (dx / d) * push; b.z += (dz / d) * push;
      }
    }
  }

  resetInput() {
    if(this.human){this.human.inputBuffer={};this.human.charge=-1;}
    this.input=null;
  }

  bufferHumanInput() {
    const p=this.human,it=this.input;if(!p)return;
    const q=p.inputBuffer ||= {};
    if(this.paused || this.phase!=='play' || !p.alive){p.inputBuffer={};return;}
    for(const key of Object.keys(q))if(q[key].until<this.inputClock)delete q[key];
    if(!it)return;
    for(const key of ['a','skill','item'])if(it[key+'Pressed']){
      q[key]={until:this.inputClock+.2,aim:it.aim,mx:it.mx,mz:it.mz,released:!it.aHeld,slot:this.holding(p)?'atk':'def'};
      it[key+'Pressed']=false;
    }
    if(q.a && it.aReleased)q.a.released=true;
  }

  handleIntent(p, it) {
    const C = this.C;
    const ball = this.holding(p);
    if(p.human){
      const q=p.inputBuffer||{};
      // Items can be used while running or during a skill animation.
      if(q.item && p.item){this.useItem(p);delete q.item;}
      if(q.skill && q.skill.slot!==(ball?'atk':'def'))delete q.skill;
      if(q.skill && this.useSkill(p))delete q.skill;
      if(q.a){
        if(ball && p.lock<=0 && p.charge<0 && !p.action){p.charge=0;const press=q.a;delete q.a;if(press.released||!it.aHeld)this.releasePass(p,press.aim||it.aim);}
        else if(!ball && p.cd.dash<=0 && !p.action){this.dash(p,it.mx,it.mz);delete q.a;}
      }
      if(ball && p.charge>=0 && (it.aReleased||!it.aHeld))this.releasePass(p,it.aim);
      it.aReleased=false;
      return;
    }
    // A button: charge/pass when holding, dash otherwise
    if (ball) {
      if (it.aPressed && p.lock <= 0 && p.charge < 0 && !p.action) p.charge = 0;
      if (p.charge >= 0 && (it.aReleased || !it.aHeld)) this.releasePass(p, it.aim);
    } else if (it.aPressed && p.cd.dash <= 0 && !p.action) {
      this.dash(p, it.mx, it.mz);
    }
    if (it.skillPressed) this.useSkill(p);
    if (it.itemPressed && p.item) this.useItem(p);
  }

  dash(p, mx, mz) {
    const C = this.C;
    let dx = mx, dz = mz;
    if (Math.hypot(dx, dz) < 0.1) { dx = p.fx; dz = p.fz; }
    const l = Math.hypot(dx, dz);
    p.dashDir = { x: dx / l, z: dz / l };
    p.cd.dash = C('move.dashCd');
    this.startAction(p, 'dash', {
      burst: () => {
        p.t.dash = C('move.dashTime');
        this.vfx.dust({ x: p.x, y: 0.1, z: p.z }, 8, this.arena.theme.speck[0]);
        this.vfx.contact('dash',{x:p.x,y:.06,z:p.z},p.dashDir,'#eee6d2');
      },
    });
    this.emit('dash', { player: p });
  }

  useSkill(p) {
    if (p.action || p.stun > 0) return false;
    const ball = this.holding(p);
    const slot = ball ? 'atk' : 'def';
    if (p.cd[slot] > 0) return false;
    if (ball && p.lock > 0) return false;
    const fn = SKILLS[`${p.heroId}.${slot}`];
    if (!fn) return false;
    p.charge = -1;
    const ok = fn(this, p, ball);
    if (ok === false) return false;
    p.cd[slot] = this.C(`hero.${p.heroId}.${slot}.cd`);
    this.emit('skill', { player: p, slot });
    return true;
  }

  useItem(p) {
    const C = this.C;
    const id = p.item;
    p.item = null;
    if(!ITEMS[id])return;
    let affected=0;
    this.vfx.itemActivation(id,p,C('item.whistle.radius'));
    switch (id) {
      case 'cleats': p.t.cleats = C('item.cleats.dur'); break;
      case 'shield': p.t.shield = C('item.shield.dur'); break;
      case 'magnet': p.magnet = true; break;
      case 'cloak': p.t.cloak = C('item.cloak.dur'); break;
      case 'whistle': {
        const r = C('item.whistle.radius');
        for (const o of this.alive) if (o !== p && Math.hypot(o.x - p.x, o.z - p.z) < r) {
          o.freeze = C('item.whistle.dur');affected++;
          this.vfx.burst({ x: o.x, y: 1, z: o.z }, { count: 14, color: ['#6af0ff', '#ffffff'], speed: 3, up: 3, life: 0.5 });
        }
        this.vfx.ring({ x: p.x, z: p.z }, { color: '#6af0ff', r0: 0.5, r1: r, time: 0.45 });
        this.stage.shake(0.25);
        break;
      }
      case 'overclock': p.cd.atk = p.cd.def = p.cd.dash = 0; break;
    }
    this.emit('item', { player: p, id, affected });
  }

  // ── Actions (animated, phase hooks) ────────────────────────────────────
  startAction(p, id, hooks = {}, opts = {}) {
    const C = this.C;
    const phases = phasesFor(id, C);
    p.action = { id, t: 0, phases, total: totalDuration(phases), amp: ampFor(id, C), hooks, fired: new Set(), from: { ...p.pose }, moveMul: opts.moveMul ?? (id === 'dash' ? 1 : C('move.actionMul')), lockFacing: opts.lockFacing ?? true };
    this.fireHooks(p);
  }

  fireHooks(p) {
    const a = p.action;
    let acc = 0;
    for (const ph of a.phases) {
      if (a.t >= acc && !a.fired.has(ph.name)) {
        a.fired.add(ph.name);
        if(ph.contact)this.syncActionPose(p);
        a.hooks[ph.name]?.();
        if (p.action !== a) return;
      }
      acc += ph.dur;
    }
  }

  syncActionPose(p) {
    const a=p.action;if(!a)return;
    p.pose=actionPose(a.phases,a.t,a.amp,a.from);
    p.poseAcc=0;
    p.model.position.set(p.x,p.y,p.z);
    p.model.rotation.y=Math.atan2(p.fx,p.fz);
    applyPose(p.model,p.pose);
    p.model.updateWorldMatrix(true,true);
  }

  stepAction(p, dt) {
    const a = p.action;
    a.t += dt;
    this.fireHooks(p);
    if (p.action === a && a.t >= a.total) {
      p.action = null;
      a.hooks.end?.();
    }
  }

  // ── Passing ────────────────────────────────────────────────────────────
  aimAssist(p, dir, extraCone = 0) {
    const C = this.C;
    const novaBonus = p.heroId === 'nova' ? C('hero.nova.passive.aimBonus') : 0;
    const cone = (C('ball.aimAssist') + novaBonus + extraCone) * Math.PI / 180;
    const range = C('ball.aimRange') + (novaBonus ? 3 : 0);
    const ball = this.holding(p);
    let best = null, bestScore = Infinity;
    for (const o of this.alive) {
      if (o === p || o.t.cloak > 0 || o.leap) continue;
      if (ball && ball.prevHolder === o && (ball.immune.get(o.id) ?? 0) > this.time) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.01) continue;
      if (o.zoneKind === 'grass' && d > 4) continue; // hidden in the long grass
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * dir.x + dz * dir.z) / d)));
      if (ang > cone) continue;
      let score = ang * 4 + d * 0.15;
      if (this.arena.obstacles?.length && segmentBlocked(this.arena.obstacles, p, o, 1.2)) score += 2.5;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  }

  leadDir(p, target, speed, lead = 0.6) {
    const dx = target.x - p.x, dz = target.z - p.z;
    const t = Math.hypot(dx, dz) / speed;
    const tx = target.x + target.vx * t * lead, tz = target.z + target.vz * t * lead;
    const lx = tx - p.x, lz = tz - p.z;
    const l = Math.hypot(lx, lz) || 1;
    return { x: lx / l, z: lz / l };
  }

  releasePass(p, aim) {
    const C = this.C;
    const ball = this.holding(p);
    const charge = Math.min(1, Math.max(0, p.charge));
    p.charge = -1;
    if (!ball || p.lock > 0) return;
    let dir = aim && Math.hypot(aim.x, aim.z) > 0.1 ? { ...aim } : { x: p.fx, z: p.fz };
    const l = Math.hypot(dir.x, dir.z); dir.x /= l; dir.z /= l;
    p.fx = dir.x; p.fz = dir.z;
    const speedMul = 1 + (C('ball.chargeMul') - 1) * charge;
    this.startAction(p, 'pass', {
      strike: () => {
        if (!this.holding(p)) return;
        const target = this.aimAssist(p, dir);
        const d = target ? this.leadDir(p, target, C('ball.passSpeed') * speedMul) : dir;
        this.kick(p, ball, d, speedMul, { target, charge });
      },
    });
  }

  // Launch the ball from p's foot.
  kick(p, ball, dir, speedMul = 1, o = {}) {
    const C = this.C;
    const now = this.time;
    ball.state = 'flight';
    ball.owner = null;
    if(p.action)this.syncActionPose(p);
    const foot = footWorld(p.model),contactOffset=C('ball.size')*.75;
    ball.x = foot.x + dir.x*contactOffset; ball.z = foot.z + dir.z*contactOffset; ball.y = Math.max(C('ball.size'),foot.y);
    const sp = C('ball.passSpeed') * speedMul;
    ball.vx = dir.x * sp; ball.vz = dir.z * sp;
    ball.vy = o.flat ? 1 : Math.sqrt(2 * G * C('ball.lobApex') * (o.lob ?? 1));
    ball.immune.clear();
    ball.immune.set(p.id, now + C('rules.passerImmune'));
    if (ball.prevHolder && ball.prevHolder !== p) ball.immune.set(ball.prevHolder.id, now + C('rules.passBackImmune'));
    ball.lastPasser = p;
    ball.lastTouch = p;
    ball.stun = o.stun || 0;
    ball.knock = o.knock || 0;
    ball.color = o.color || C(`hero.${p.heroId}.fx`);
    ball.homing = o.homing ? { target: o.target, strength: o.homing } : null;
    if (p.magnet && o.target) { ball.homing = { target: o.target, strength: C('item.magnet.homing') }; p.magnet = false; }
    ball.looseT = 0;
    ball.flightT = 0;
    // FX
    const fpos = new THREE.Vector3(ball.x, ball.y, ball.z);
    this.vfx.contact('kick',fpos,dir,'#fff7e5',1+(o.charge||0)*.3);
    this.vfx.burst(fpos, { count: 4 + Math.round((o.charge || 0) * 6), color: ['#ffffff', ball.color], glow: true, dir, spread: 0.5, speed: 7, up: 2, life: 0.3, size: 0.14 });
    this.vfx.dust({ x: p.x, y: 0.05, z: p.z }, 5, this.arena.theme.speck[0]);
    this.stage.shake(0.12 + (o.charge || 0) * 0.15);
    this.emit('pass', { player: p, target: o.target });
  }

  // ── Ball ───────────────────────────────────────────────────────────────
  stepBall(b, dt, live) {
    if (b.state === 'dead') return;
    const C = this.C;
    const r = C('ball.size');
    const bdt = dt;

    if (b.state === 'held') {
      const p = b.owner;
      if (!p || !p.alive) { b.state = 'loose'; return; }
      const fwd = p.charge >= 0 ? 0.35 : 0.5;
      b.x = p.x + p.fx * fwd; b.z = p.z + p.fz * fwd; b.y = r + p.y;
      b.vx = p.vx; b.vz = p.vz; b.vy = 0;
      if (this.mode.timer === 'fuse' && live) {
        b.fuse -= dt;
        if (b.fuse <= 0) {
          this.explodeBall(b);
          this.emit('buzzer', { out: 1 });
          this.eliminate(p, 'fuse');
          this.phase = 'boom';
          this.phaseT = 1.6;
        }
      }
      return;
    }

    b.life += bdt;
    if (b.decoy && b.life > 1.6) { this.popDecoy(b); return; }
    // Fuse mode: the fuse still smoulders while the ball is loose / in flight
    if (this.mode.timer === 'fuse' && live && !b.decoy) {
      b.fuse -= dt * C('rules.fuseLooseBurn');
      if (b.fuse <= 0) {
        const c = this.culpritOf(b);
        this.explodeBall(b);
        this.emit('buzzer', { out: c ? 1 : 0 });
        if (c) this.eliminate(c, 'fuse');
        this.phase = 'boom';
        this.phaseT = 1.6;
        return;
      }
    }
    // Homing
    if (b.homing && b.state === 'flight' && b.homing.target?.alive) {
      const t = b.homing.target;
      const sp = Math.hypot(b.vx, b.vz);
      const want = Math.atan2(t.z - b.z, t.x - b.x);
      let cur = Math.atan2(b.vz, b.vx);
      let da = want - cur;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cur += Math.max(-1, Math.min(1, da)) * b.homing.strength * bdt;
      b.vx = Math.cos(cur) * sp; b.vz = Math.sin(cur) * sp;
      if (b.vy < 0 && b.y < 1.0) b.vy = 0; // keep it skimming until it arrives
    }
    // Fuse mode: a loose ball drifts back to its kicker
    if (this.mode.timer === 'fuse' && b.state === 'loose' && !b.decoy) {
      b.looseT += bdt;
      const back = b.lastPasser?.alive ? b.lastPasser : this.alive[0];
      if (b.looseT > 1.0 && back) {
        const dx = back.x - b.x, dz = back.z - b.z, d = Math.hypot(dx, dz) || 1;
        b.vx += (dx / d) * 18 * bdt; b.vz += (dz / d) * 18 * bdt;
        b.immune.delete(back.id);
      }
    }

    b.vy -= G * bdt;
    b.x += b.vx * bdt; b.y += b.vy * bdt; b.z += b.vz * bdt;
    if (b.y < r) {
      b.y = r;
      if (b.vy < -2.5) {
        b.vy = -b.vy * 0.42;
        if (b.state === 'flight') { b.state = 'loose'; b.vx *= 0.8; b.vz *= 0.8; }
        this.vfx.dust({ x: b.x, y: 0.05, z: b.z }, 3, this.arena.theme.speck[0]);
        if (b.decoy) { this.popDecoy(b); return; }
      } else b.vy = 0;
    }
    if (b.state === 'loose' && b.y <= r + 0.01) {
      const f = Math.exp(-C('ball.friction') * bdt);
      b.vx *= f; b.vz *= f;
    }
    // Field bounds
    const hw = this.W / 2 - r, hd = this.D / 2 - r, k = C('ball.bounce');
    if (b.x < -hw) { b.x = -hw; b.vx = Math.abs(b.vx) * k; this.bounceFx(b); }
    if (b.x > hw) { b.x = hw; b.vx = -Math.abs(b.vx) * k; this.bounceFx(b); }
    if (b.z < -hd) { b.z = -hd; b.vz = Math.abs(b.vz) * k; this.bounceFx(b); }
    if (b.z > hd) { b.z = hd; b.vz = -Math.abs(b.vz) * k; this.bounceFx(b); }
    this.ballWalls(b);
    this.ballObstacles(b);
    if (b.dead) return;
    if (b.state === 'flight' || Math.hypot(b.vx, b.vz) > 2) {
      b.trailAcc = (b.trailAcc || 0) + bdt;
      if (b.trailAcc > 0.016) { b.trailAcc = 0; this.vfx.trail({ x: b.x, y: b.y, z: b.z }, b.color, 0.24); }
    }

    // Contact with players
    if (!live && this.phase !== 'intro') return;
    for (const p of this.alive) {
      if ((b.immune.get(p.id) ?? 0) > this.time) continue;
      if (p.leap || p.t.invuln > 0) continue;
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d > C('ball.pickup') || b.y > 1.8 + p.y) continue;
      if (b.decoy) { this.popDecoy(b); return; }
      if (p.t.shield > 0 || p.t.crown > 0) { this.deflect(b, p); continue; }
      if (p.t.trap > 0) { this.trapRedirect(b, p); return; }
      this.catchBall(b, p);
      return;
    }
  }

  bounceFx(b) {
    if (Math.hypot(b.vx, b.vz) > 3) this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 5, color: '#ffffff', glow: true, speed: 3, up: 2, life: 0.25, size: 0.1 });
  }

  deflect(b, p) {
    b.lastTouch=p;
    const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz) || 1;
    const sp = Math.max(6, Math.hypot(b.vx, b.vz) * 0.8);
    b.vx = (dx / d) * sp; b.vz = (dz / d) * sp; b.vy = 4;
    b.state = 'loose';
    b.homing = null;
    b.immune.set(p.id, this.time + 0.4);
    const col = p.t.crown > 0 ? this.C('hero.kaiz.fx') : ITEMS.shield.color;
    this.vfx.ring({ x: p.x, z: p.z }, { color: col, r0: 0.6, r1: 2.2, time: 0.3 });
    this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 20, color: [col, '#ffffff'], glow: true, speed: 6, up: 3, life: 0.35 });
    this.stage.shake(0.2);
    const shieldConsumed=p.t.shield>0;
    if (shieldConsumed) p.t.shield = 0;
    this.emit('deflect', { player: p, shieldConsumed });
  }

  trapRedirect(b, p) {
    const C = this.C;
    p.t.trap = 0;
    const targets = this.alive.filter((o) => o !== p && o !== b.lastPasser && o.t.cloak <= 0);
    const pool = targets.length ? targets : this.alive.filter((o) => o !== p);
    let best = null, bd = Infinity;
    for (const o of pool) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } }
    if (!best) { this.catchBall(b, p); return; }
    b.prevHolder = b.lastPasser;
    const dir = this.leadDir(p, best, C('ball.passSpeed') * C('hero.echo.def.speedMul'), 0.8);
    this.hitstop = 0.08;
    this.vfx.ring({ x: p.x, z: p.z }, { color: C('hero.echo.fx'), r0: 0.3, r1: 3, time: 0.35 });
    this.vfx.burst({ x: p.x, y: 1, z: p.z }, { count: 26, color: [C('hero.echo.fx'), '#ffffff'], glow: true, speed: 8, up: 5, life: 0.4 });
    this.stage.flash(C('hero.echo.fx'), 0.4, 0.12);
    this.kick(p, b, dir, C('hero.echo.def.speedMul'), { target: best, homing: 4, color: C('hero.echo.fx') });
    this.emit('trap', { player: p });
  }

  catchBall(b, p) {
    const C = this.C;
    const now = this.time;
    b.state = 'held';
    b.owner = p;
    b.lastTouch = p;
    b.homing = null;
    b.prevHolder = b.lastPasser;
    const lockMul = p.heroId === 'jinx' ? C('hero.jinx.passive.lockMul') : 1;
    p.lock = C('rules.catchLock') * lockMul;
    p.charge = -1;
    const sp = Math.hypot(b.vx, b.vz);
    if (b.stun > 0 && p.heroId !== 'titan') {
      p.stun = b.stun;
      const d = sp || 1;
      p.vx += (b.vx / d) * b.knock; p.vz += (b.vz / d) * b.knock;
      p.lock = Math.max(p.lock, b.stun);
      this.stage.shake(0.5);
      this.vfx.burst({ x: p.x, y: 1.2, z: p.z }, { count: 26, color: [b.color, '#ffffff'], glow: true, speed: 9, up: 6, life: 0.5 });
    } else if (b.state === 'held' && !p.action) {
      this.startAction(p, 'catch', {}, { moveMul: 0.9, lockFacing: false });
    }
    this.hitstop = Math.max(this.hitstop, C('fx.hitstop') * Math.min(1.2, sp / 16));
    this.vfx.contact('catch',{x:b.x,y:Math.max(.08,b.y),z:b.z},{x:p.fx,z:p.fz},'#fff7e5');
    this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 4, color: [b.color, '#ffffff'], glow: true, speed: 4, up: 3, life: 0.3, size: 0.12 });
    b.stun = 0; b.knock = 0;
    this.emit('catch', { player: p, from: b.lastPasser, ball: b, at: now });
  }

  giveBall(b, p, fresh = false) {
    b.state = 'held';
    b.owner = p;
    b.lastTouch = p;
    b.lastPasser = null;
    b.prevHolder = null;
    b.mesh.visible = true;
    b.mesh.userData.ring.visible = true;
    b.fuse = this.C('rules.fuseTime');
    b.x = p.x; b.z = p.z;
    if (fresh) this.vfx.pillar({ x: p.x, z: p.z }, '#ffd84a', 6, 0.5, 0.5);
  }

  popDecoy(b) {
    b.dead = true;
    this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 16, color: ['#c8c0d8', '#ffffff', this.C('hero.jinx.fx')], speed: 3, up: 3, gravity: 3, life: 0.5, size: 0.2 });
    this.vfx.ring({ x: b.x, z: b.z }, { color: this.C('hero.jinx.fx'), r0: 0.2, r1: 1.2, time: 0.2 });
  }

  // Bolt's blitz: touching anyone hands them the ball
  blitzTag(p) {
    const ball = this.holding(p);
    if (!ball) { p.t.blitz = 0; return; }
    for (const o of this.alive) {
      if (o === p || o.leap || o.t.invuln > 0) continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) < 1.0) {
        if (o.t.shield > 0 || o.t.crown > 0) { p.t.blitz = 0; this.kick(p, ball, { x: -p.dashDir.x, z: -p.dashDir.z }, 0.5); this.deflect(ball, o); return; }
        p.t.blitz = 0;
        ball.lastPasser = p;
    ball.lastTouch = p;
        ball.prevHolder = p;
        ball.immune.set(p.id, this.time + this.C('rules.passBackImmune'));
        ball.stun = 0.25;
        ball.knock = this.C('hero.bolt.atk.knock');
        ball.vx = p.dashDir.x * 10; ball.vz = p.dashDir.z * 10;
        ball.color = this.C('hero.bolt.fx');
        this.catchBall(ball, o);
        o.stun = o.heroId === 'titan' ? 0 : 0.25;
        this.vfx.ring({ x: o.x, z: o.z }, { color: this.C('hero.bolt.fx'), r0: 0.4, r1: 2.6, time: 0.3 });
        this.stage.shake(0.35);
        p.vx *= 0.2; p.vz *= 0.2;
        return;
      }
    }
  }

  // ── Walls (Titan) ──────────────────────────────────────────────────────
  addWall(x, z, angle, len, time, color) {
    const vis = this.vfx.makeWall(x, z, angle, len, color);
    this.walls.push({ x, z, angle, len, until: this.time + time, vis });
  }

  stepWalls(dt) {
    this.walls = this.walls.filter((w) => {
      const rem = w.until - this.time;
      w.vis.update(dt, rem);
      if (rem <= 0) { w.vis.dispose(); return false; }
      return true;
    });
  }

  // Segment-local coords
  wallLocal(w, x, z) {
    const c = Math.cos(w.angle), s = Math.sin(w.angle);
    const dx = x - w.x, dz = z - w.z;
    return { u: dx * c - dz * s, v: dx * s + dz * c, c, s };
  }

  collideWalls(p) {
    const r = this.C('move.radius');
    for (const w of this.walls) {
      const { u, v, c, s } = this.wallLocal(w, p.x, p.z);
      if (Math.abs(u) < w.len / 2 + r && Math.abs(v) < 0.3 + r) {
        const push = (0.3 + r) * Math.sign(v || 1) - v;
        p.x += s * push; p.z += c * push;
      }
    }
  }

  ballWalls(b) {
    for (const w of this.walls) {
      if (b.y > 1.6) continue;
      const { u, v, c, s } = this.wallLocal(w, b.x, b.z);
      if (Math.abs(u) < w.len / 2 + 0.2 && Math.abs(v) < 0.35) {
        // reflect the wall-normal component
        const nx = s, nz = c;
        const vn = b.vx * nx + b.vz * nz;
        if (vn * v < 0) {
          b.vx -= 2 * vn * nx; b.vz -= 2 * vn * nz;
          b.vx *= 0.75; b.vz *= 0.75;
          b.homing = null;
          if (b.state === 'flight') b.state = 'loose';
          const push = 0.36 * Math.sign(v || 1) - v;
          b.x += s * push; b.z += c * push;
          this.vfx.burst({ x: b.x, y: b.y, z: b.z }, { count: 12, color: ['#ffffff', '#c8b090'], speed: 5, up: 3, life: 0.35, size: 0.14 });
          this.stage.shake(0.15);
        }
      }
    }
  }

  // ── Items ──────────────────────────────────────────────────────────────
  spawnItem() {
    const C = this.C;
    if (this.items.length >= C('rules.maxItems')) return;
    const ids = ITEM_IDS.filter((id) => C(`item.${id}.on`));
    if (!ids.length) return;
    const id = ids[(Math.random() * ids.length) | 0];
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = (Math.random() - 0.5) * (this.W - 3);
      z = (Math.random() - 0.5) * (this.D - 3);
      const free = !pushOut(this.arena.obstacles || [], { x, z }, 0.6);
      if (free && this.alive.every((p) => Math.hypot(p.x - x, p.z - z) > 2.5)) break;
    }
    const mesh = buildItemCrate(id);
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.items.push({ id, x, z, mesh, t: 0 });
    this.vfx.pillar({ x, z }, ITEMS[id].color, 4, 0.35, 0.4);
  }

  stepItems(dt) {
    this.items = this.items.filter((it) => {
      it.t += dt;
      if (Math.abs(it.x) > this.W / 2 || Math.abs(it.z) > this.D / 2) { this.group.remove(it.mesh); return false; }
      for (const p of this.alive) {
        if (p.item || Math.hypot(p.x - it.x, p.z - it.z) > 0.9) continue;
        p.item = it.id;
        this.group.remove(it.mesh);
        this.vfx.burst({ x: it.x, y: 0.6, z: it.z }, { count: 14, color: [ITEMS[it.id].color, '#ffffff'], glow: true, speed: 4, up: 4, life: 0.4 });
        this.emit('pickup', { player: p, id: it.id });
        if (!p.human && it.id === 'overclock') p.ai.useItemAt = this.time + 0.5;
        return false;
      }
      return true;
    });
  }

  // ── Visuals ────────────────────────────────────────────────────────────
  updateVisuals(dt) {
    const C = this.C;
    const fps = C('render.animFps');
    for (const p of this.players) {
      const m = p.model;
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = Math.atan2(p.fx, p.fz);
      p.marker.position.set(p.x, 0, p.z);
      // Stepped animation (on 2s / 3s etc. when animFps < 60)
      p.poseAcc += dt;
      if (p.poseAcc >= 1 / fps - 1e-4 || dt === 0 || (p.action && phaseAt(p.action.phases,p.action.t).phase.contact)) {
        p.poseAcc = 0;
        const speed = Math.hypot(p.vx, p.vz) / (C('move.speed') || 1);
        let pose = locomotionPose(speed, p.cyc, C('anim.run.stride'), C('anim.run.bob'), {});
        if (p.charge >= 0) pose = lerpPose(pose, POSES.coil, Math.min(1, p.charge) * 0.85, {});
        if (p.stun > 0 || p.freeze > 0) pose = lerpPose(pose, POSES.stun, 0.9, {});
        if (p.action) {
          const blendIn = phaseAt(p.action.phases,p.action.t).phase.contact ? 1 : Math.min(1,p.action.t/.04);
          const ap = actionPose(p.action.phases, p.action.t, p.action.amp, p.action.from);
          const end = p.action.total - p.action.t;
          const blendOut = p.action.id === 'elim' ? 1 : Math.min(1, end / 0.06 + 0.0);
          pose = lerpPose(pose, ap, Math.min(blendIn, Math.max(0.0, blendOut)), {});
        }
        p.pose = pose;
        applyPose(m, pose);
      }
      if (!p.alive) {if(p.shieldFx){p.shieldFx.dispose();p.shieldFx=null;}continue;}
      // Cloak flicker / freeze tint
      m.visible = !(p.t.cloak > 0 && Math.floor(this.time * 20) % 3 === 0) || p.human;
      // Shields
      const shielded = p.t.shield > 0 || p.t.crown > 0;
      if (shielded && !p.shieldFx) p.shieldFx = this.vfx.makeShield(p.t.crown > 0 ? C('hero.kaiz.fx') : ITEMS.shield.color);
      if (!shielded && p.shieldFx) { this.vfx.itemEnd('shield',p);p.shieldFx.dispose(); p.shieldFx = null; }
      if (p.shieldFx) {
        p.shieldFx.mesh.position.set(p.x, 0.95 + p.y, p.z);
        p.shieldFx.update?.(Math.max(p.t.shield,p.t.crown),p.t.crown>p.t.shield?C('hero.kaiz.def.dur'):C('item.shield.dur'),dt);
      }
      if (p.t.trap > 0 && Math.random() < 0.5) this.vfx.trail({ x: p.x + (Math.random() - 0.5), y: 0.2 + Math.random() * 1.5, z: p.z + (Math.random() - 0.5) }, C('hero.echo.fx'), 0.12, 0.3);
    }

    // Balls
    for (const b of [...this.balls, ...this.decoys]) {
      if (b.state === 'dead') continue;
      const g = b.mesh;
      g.position.set(b.x, b.y, b.z);
      const mesh = g.userData.mesh;
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0.05) {
        const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
        mesh.rotateOnWorldAxis(axis, (sp * dt) / C('ball.size'));
      }
      if (b.decoy) continue;
      // Danger glow
      const ring = g.userData.ring;
      ring.position.set(b.x, 0.03, b.z);
      const left = this.mode.timer === 'fuse' ? b.fuse : this.mode.timer === 'hidden' ? 99 : this.roundT;
      const danger = C('ball.danger');
      let heat = this.phase === 'play' && left < danger ? 1 - left / danger : 0;
      if (this.mode.timer === 'hidden' && this.phase === 'play') heat = 0.25 + 0.25 * Math.sin(this.time * 3);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (8 + heat * 18));
      mesh.material.userData.heatColor.setRGB(heat * pulse * 0.9, heat * pulse * 0.15, 0);
      ring.material.opacity = heat * (0.4 + 0.5 * pulse);
      ring.scale.setScalar(1 + pulse * 0.25 * heat);
    }

    // Item crates
    for (const it of this.items) {
      it.mesh.userData.spin.rotation.y += dt * 2;
      it.mesh.userData.spin.position.y = 0.6 + Math.sin(this.time * 3 + it.x) * 0.1;
    }

    this.vfx.syncItemEffects(this.players,dt);
    this.vfx.syncBallWakes(this.balls,dt);
    // Camera
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    if (this.noCamera) return;
    const C = this.C;
    const h = this.human;
    const ball = this.balls.find((b) => b.state !== 'dead');
    const t = new THREE.Vector3();
    if (h && h.alive) {
      t.set(h.x + h.vx * 0.06 * C('camera.lookAhead'), 0, h.z + h.vz * 0.06 * C('camera.lookAhead'));
      if (ball && C('camera.followBall')) t.lerp(new THREE.Vector3(ball.x, 0, ball.z), 0.3);
    } else if (ball && C('camera.followBall')) t.set(ball.x, 0, ball.z);
    else t.set(0, 0, 0);
    const lim = 0.36;
    t.x = Math.max(-this.arena.W * lim, Math.min(this.arena.W * lim, t.x));
    t.z = Math.max(-this.arena.D * lim, Math.min(this.arena.D * lim, t.z));
    const k = 1 - Math.pow(1 - C('camera.follow'), dt * 60);
    this.cam.lerp(t, dt === 0 ? 0 : k);
    this.stage.target.copy(this.cam);
  }

  dispose() {
    for (const p of this.players) p.shieldFx?.dispose();
    for (const w of this.walls) w.vis.dispose();
    this.scene.remove(this.group);
    this.vfx.clear();
  }
}
