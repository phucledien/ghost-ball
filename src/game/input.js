// Keyboard + mouse + touch → one intent struct per frame (camera-relative).
//   Move: WASD / arrows / left stick          A (pass/dash): J, Space, left click, A button
//   Skill: K, Q, right click, B button       Item: L, E, C button
export class Input {
  constructor(stage, touch) {
    this.stage = stage;
    this.touch = touch; // { joy:{x,y}, a, skill, item, aimJoy:{x,y}|null }
    this.keys = new Set();
    this.prev = { a: false, skill: false, item: false };
    this.mouse = null;
    this.mouseA = false;
    this.mouseSkill = false;
    const el = stage.container;
    this.onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', () => this.keys.clear());
    // Mouse only: touch taps fire compat mouse events that would hijack aim.
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.target.closest?.('.interactive, button, a, input, select')) return;
      if (e.button === 0) this.mouseA = true;
      if (e.button === 2) this.mouseSkill = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) this.mouseA = false;
      if (e.button === 2) this.mouseSkill = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  axes() {
    const yaw = (this.stage.C('camera.yaw') * Math.PI) / 180;
    const up = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    return { up, right };
  }

  toWorld(sx, sy) {
    const { up, right } = this.axes();
    return { x: right.x * sx + up.x * sy, z: right.z * sx + up.z * sy };
  }

  poll(player) {
    const k = this.keys;
    let sx = 0, sy = 0;
    if (k.has('a') || k.has('arrowleft')) sx -= 1;
    if (k.has('d') || k.has('arrowright')) sx += 1;
    if (k.has('w') || k.has('arrowup')) sy += 1;
    if (k.has('s') || k.has('arrowdown')) sy -= 1;
    const t = this.touch;
    if (t && Math.hypot(t.joy.x, t.joy.y) > 0.12) { sx = t.joy.x; sy = t.joy.y; }
    const len = Math.hypot(sx, sy);
    if (len > 1) { sx /= len; sy /= len; }
    const mv = this.toWorld(sx, sy);

    // Aim: mouse (if recently moved) > touch aim > move direction
    let aim = null;
    if (this.mouse && player && performance.now() - this.mouse.t < 2500) {
      const g = this.stage.toGround(this.mouse.x, this.mouse.y);
      const dx = g.x - player.x, dz = g.z - player.z;
      if (Math.hypot(dx, dz) > 0.3) aim = { x: dx, z: dz };
    }
    if (t?.aimJoy && Math.hypot(t.aimJoy.x, t.aimJoy.y) > 0.3) aim = this.toWorld(t.aimJoy.x, t.aimJoy.y);
    if (!aim && len > 0.1) aim = { x: mv.x, z: mv.z };

    const a = k.has('j') || k.has(' ') || this.mouseA || !!t?.a;
    const skill = k.has('k') || k.has('q') || this.mouseSkill || !!t?.skill;
    const item = k.has('l') || k.has('e') || !!t?.item;
    const out = {
      mx: mv.x, mz: mv.z, aim,
      aPressed: a && !this.prev.a, aReleased: !a && this.prev.a, aHeld: a,
      skillPressed: skill && !this.prev.skill, itemPressed: item && !this.prev.item,
    };
    this.prev = { a, skill, item };
    return out;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }
}
