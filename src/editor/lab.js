// Skill Lab: loops one action on a real (lab-mode) Match so the preview uses
// the exact gameplay code — kicks, ball flight, catches, walls, VFX.
// Up to two lanes run side by side: LOCKED values vs DRAFT values.
import { Match } from '../game/sim.js';
import { phasesFor, ampFor, HERO_BY_ID } from '../game/heroes.js';
import { totalDuration, actionPose, POSES } from '../engine/anim.js';
import { applyPose } from '../engine/hero-model.js';

const TAIL = 0.9;

export class SkillLab {
  constructor({ stage, arena, vfx, cfg }) {
    this.stage = stage;
    this.arena = arena;
    this.vfx = vfx;
    this.cfg = cfg;
    this.lanes = [];
    this.actionId = 'pass';
    this.heroId = 'nova';
    this.compare = 'draft';
    this.playing = true;
    this.speed = 1;
    this.scrubT = null;
    this.clock = 0;
  }

  get C() { return this.cfg.get; }

  // Hero performing the action
  get actorHero() {
    const [a, slot] = this.actionId.split('.');
    return slot ? a : this.heroId;
  }

  phases(C = this.C) { return phasesFor(this.actionId, C); }
  total(C = this.C) { return totalDuration(this.phases(C)); }

  set(actionId, heroId) {
    if (actionId) this.actionId = actionId;
    if (heroId) this.heroId = heroId;
    this.rebuild();
  }

  setCompare(mode) { this.compare = mode; this.rebuild(); }

  rebuild() {
    for (const l of this.lanes) l.m.dispose();
    this.vfx.clear();
    this.lanes = [];
    const defs = this.compare === 'both'
      ? [{ C: this.cfg.getLocked, label: 'LOCKED', ox: -3.2 }, { C: this.cfg.get, label: 'DRAFT', ox: 3.2 }]
      : [{ C: this.compare === 'locked' ? this.cfg.getLocked : this.cfg.get, label: this.compare === 'locked' ? 'LOCKED' : 'DRAFT', ox: 0 }];
    for (const d of defs) {
      const m = new Match({ stage: this.stage, vfx: this.vfx, arena: this.arena, C: d.C, lab: true });
      m.noCamera = true;
      m.phase = 'play';
      m.roundT = m.roundLen = 1e9; // no clock in the lab
      const actor = m.addPlayer(this.actorHero, false, 'ACTOR');
      const dummyHero = this.actorHero === 'titan' ? 'echo' : 'titan';
      const dummy = m.addPlayer(dummyHero, false, 'DUMMY');
      dummy.marker.visible = false;
      actor.marker.children[0].material.color.set('#e8a93a');
      actor.marker.children[0].material.opacity = 0.9;
      const ball = m.makeBall();
      this.lanes.push({ ...d, m, actor, dummy, ball, t: 0, started: false, done: 0 });
    }
    this.stage.target.set(0, 0, -1);
    this.restart();
  }

  restart() {
    this.clock = 0;
    for (const l of this.lanes) this.startLane(l);
  }

  startLane(l) {
    const { m, actor, dummy, ball } = l;
    const C = l.C;
    // Reset world state
    for (const w of m.walls) w.vis.dispose();
    m.walls = [];
    for (const d of m.decoys) m.group.remove(d.mesh);
    m.decoys = [];
    m.fieldRead = null;
    m.hitstop = 0; m.slowT = 0; m.acc = 0;
    for (const [p, x, z, fz] of [[actor, l.ox, 2.2, -1], [dummy, l.ox, -4.2, 1]]) {
      Object.assign(p, { alive: true, x, z, y: 0, vx: 0, vz: 0, fx: 0, fz, action: null, charge: -1, lock: 0, stun: 0, freeze: 0, leap: null, timeScale: 1, item: null, magnet: false });
      for (const k in p.t) p.t[k] = 0;
      p.cd = { atk: 0, def: 0, dash: 0 };
      p.model.visible = true;
      p.marker.visible = p === actor;
      p.shieldFx?.dispose(); p.shieldFx = null;
      p.ai = { t: 0, move: { x: 1, z: 0 }, aim: { x: 0, z: z > 0 ? -1 : 1 } };
    }
    ball.immune.clear();
    ball.mesh.visible = true;
    ball.mesh.userData.ring.visible = true;
    ball.state = 'held';
    l.t = 0; l.started = false; l.done = 0; l.pending = null;
    const id = this.actionId;
    const [, slot] = id.split('.');
    const toward = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d }; };

    if (id === 'pass') {
      m.giveBall(ball, actor);
      actor.charge = 0.4;
      m.releasePass(actor, toward(actor, dummy));
    } else if (id === 'catch') {
      m.giveBall(ball, dummy);
      l.pending = { at: 0.05, fn: () => m.kick(dummy, ball, toward(dummy, actor), 0.9, { target: actor }) };
    } else if (id === 'dash') {
      m.giveBall(ball, dummy);
      m.dash(actor, 1, 0);
    } else if (id === 'elim') {
      m.giveBall(ball, actor);
      m.eliminate(actor, 'lab');
      m.slowT = 0;
    } else if (slot === 'atk') {
      m.giveBall(ball, actor);
      actor.ai.aim = toward(actor, dummy);
      m.useSkill(actor);
    } else if (slot === 'def') {
      m.giveBall(ball, dummy);
      dummy.fz = 1;
      l.pending = { at: 0.04, fn: () => m.kick(dummy, ball, toward(dummy, actor), 1, { target: actor }) };
      actor.ai.move = { x: 1, z: 0 };
      m.useSkill(actor);
    }
    if (actor.action?.id === id) l.started = true;
  }

  // Time within the action for a lane (for the playhead)
  laneTime(l) {
    if (this.scrubT != null) return this.scrubT;
    const a = l.actor.action;
    if (a && a.id === this.actionId) return a.t;
    return l.started ? this.total(l.C) : 0;
  }

  get time() { return this.lanes.length ? this.laneTime(this.lanes[this.lanes.length - 1]) : 0; }

  update(dt) {
    if (this.scrubT != null) {
      for (const l of this.lanes) {
        const phases = this.phases(l.C);
        const pose = actionPose(phases, Math.min(this.scrubT, totalDuration(phases)), ampFor(this.actionId, l.C), POSES.idle);
        l.actor.model.visible = true;
        applyPose(l.actor.model, pose);
      }
      this.vfx.update(0);
      return;
    }
    if (!this.playing) { for (const l of this.lanes) l.m.update(0); return; }
    const sdt = dt * this.speed;
    this.clock += sdt;
    let allDone = true;
    for (const l of this.lanes) {
      l.t += sdt;
      if (l.pending && l.t >= l.pending.at) { const f = l.pending.fn; l.pending = null; f(); }
      l.m.update(sdt);
      const a = l.actor.action;
      if (a && a.id === this.actionId) l.started = true;
      const busy = (a && a.id === this.actionId) || !l.started;
      if (!busy) l.done += sdt;
      const tail = this.actionId === 'elim' ? 1.6 : TAIL;
      if (!(l.started && l.done > tail) && l.t < 8) allDone = false;
    }
    if (allDone) this.restart();
  }

  get heroName() { return HERO_BY_ID[this.actorHero].name; }

  dispose() { for (const l of this.lanes) l.m.dispose(); this.lanes = []; }
}
