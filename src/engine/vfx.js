// VFX: instanced voxel particles (solid + additive glow), ground rings,
// beams, afterimages and a few persistent effect meshes (walls, shields).
import * as THREE from 'three';
import { ghostClone, voxelsOf } from './hero-model.js';

const MAX = 2600;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

class Pool {
  constructor(scene, material, castShadow) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = castShadow;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.set('#fff'));
    scene.add(this.mesh);
    this.p = [];
  }
  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      o.life -= dt;
      if (o.life <= 0) continue;
      o.vy -= o.g * dt;
      const d = Math.exp(-o.drag * dt);
      o.vx *= d; o.vy *= o.g ? 1 : d; o.vz *= d;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.floor && o.y < o.size * 0.5) {
        o.y = o.size * 0.5;
        o.vy = Math.abs(o.vy) * 0.35;
        o.vx *= 0.6; o.vz *= 0.6;
        o.spin *= 0.5;
      }
      o.rot += o.spin * dt;
      arr[w++] = o;
    }
    arr.length = w;
    const m = this.mesh;
    for (let i = 0; i < w; i++) {
      const o = arr[i];
      const k = o.life / o.max;
      const sz = o.size1 + (o.size - o.size1) * (o.shrinkLate ? Math.min(1, k * 3) : k);
      _e.set(o.rot, o.rot * 0.7, 0);
      _q.setFromEuler(_e);
      _s.set(sz * (o.sx || 1), sz * (o.sy || 1), sz * (o.sz || 1));
      _p.set(o.x, o.y, o.z);
      _m.compose(_p, _q, _s);
      m.setMatrixAt(i, _m);
      m.setColorAt(i, _c.set(o.color));
    }
    m.count = w;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  clear() { this.p.length = 0; this.mesh.count = 0; }
}

export class VFX {
  constructor(scene, C) {
    this.scene = scene;
    this.C = C;
    this.solid = new Pool(scene, new THREE.MeshLambertMaterial(), true);
    this.glow = new Pool(scene, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), false);
    this.items = []; // timed meshes: rings, beams, ghosts
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 28, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 24);
    this.discGeo.rotateX(-Math.PI / 2);
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.enabledSmears = true;
  }

  get mult() { return this.C('fx.particles'); }

  // ── Particles ──────────────────────────────────────────────────────────
  burst(pos, o = {}) {
    const n = Math.round((o.count ?? 16) * this.mult);
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    const pool = o.glow ? this.glow : this.solid;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 6) * (0.4 + Math.random() * 0.8);
      const up = (o.up ?? 4) * (0.5 + Math.random());
      let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp;
      if (o.dir) {
        const spread = o.spread ?? 0.5;
        const da = Math.atan2(o.dir.z, o.dir.x) + (Math.random() - 0.5) * spread * 2;
        vx = Math.cos(da) * sp; vz = Math.sin(da) * sp;
      }
      const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.7);
      pool.add({
        x: pos.x + (Math.random() - 0.5) * (o.jitter ?? 0.2), y: pos.y + (Math.random() - 0.5) * (o.jitter ?? 0.2), z: pos.z + (Math.random() - 0.5) * (o.jitter ?? 0.2),
        vx, vy: up, vz, g: o.gravity ?? 14, drag: o.drag ?? 2, life, max: life,
        size: (o.size ?? 0.18) * (0.6 + Math.random() * 0.8), size1: o.endSize ?? 0,
        color: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18, floor: o.floor ?? true,
        shrinkLate: o.shrinkLate,
      });
    }
  }

  ember(x, y, z, color) {
    this.glow.add({ x: x + (Math.random() - 0.5) * 0.2, y, z: z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.4, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 0.4, g: 0, drag: 0.5, life: 0.9, max: 0.9, size: 0.09, size1: 0, color, rot: 0, spin: 0, floor: false });
  }

  trail(pos, color, size = 0.22, life = 0.28) {
    const k = this.C('fx.trail');
    if (k <= 0) return;
    this.glow.add({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: life * k, max: life * k, size: size * Math.min(1.5, k), size1: 0, color, rot: 0, spin: 0, floor: false });
  }

  dust(pos, n = 4, color = '#d8c49a') {
    this.burst(pos, { count: n, color, speed: 1.6, up: 1.2, gravity: 4, life: 0.4, size: 0.14, drag: 4 });
  }

  // Voxel explosion of a hero model
  shatter(model, force = 9, extra = []) {
    const vox = voxelsOf(model);
    const center = new THREE.Vector3();
    model.getWorldPosition(center);
    center.y += 0.8;
    for (const v of vox) {
      const d = v.pos.clone().sub(center).normalize();
      for (let i = 0; i < 2; i++) {
        const life = 1.4 + Math.random() * 1.2;
        this.solid.add({
          x: v.pos.x, y: v.pos.y, z: v.pos.z,
          vx: d.x * force * (0.5 + Math.random()) + (Math.random() - 0.5) * 3, vy: 5 + Math.random() * 7, vz: d.z * force * (0.5 + Math.random()) + (Math.random() - 0.5) * 3,
          g: 22, drag: 0.6, life, max: life, size: Math.max(0.1, v.size * 0.7) * (0.6 + Math.random() * 0.5), size1: 0.0, shrinkLate: true,
          color: v.color, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 20, floor: true,
        });
      }
    }
    for (const col of extra) this.burst(center, { count: 30, color: col, speed: 12, up: 8, glow: true, life: 0.6, size: 0.2, gravity: 8 });
  }

  // ── Timed meshes ───────────────────────────────────────────────────────
  _timed(mesh, life, update) {
    this.scene.add(mesh);
    this.items.push({ mesh, life, max: life, update });
  }

  ring(pos, o = {}) {
    const m = new THREE.Mesh(o.filled ? this.discGeo : this.ringGeo, new THREE.MeshBasicMaterial({ color: o.color ?? '#ffffff', transparent: true, opacity: o.opacity ?? 0.9, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(pos.x, (o.y ?? 0.04), pos.z);
    const r0 = o.r0 ?? 0.2, r1 = o.r1 ?? 2.5, op = o.opacity ?? 0.9;
    m.scale.setScalar(r0);
    this._timed(m, o.time ?? 0.4, (k) => {
      const u = 1 - k;
      const e = 1 - Math.pow(1 - u, 3);
      m.scale.setScalar(r0 + (r1 - r0) * e);
      m.material.opacity = op * k;
    });
    return m;
  }

  // Vertical light pillar (spawn / elimination)
  pillar(pos, color, height = 8, radius = 0.6, time = 0.5) {
    const m = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(pos.x, height / 2, pos.z);
    this._timed(m, time, (k) => {
      m.scale.set(radius * 2 * k, height * (1 + (1 - k) * 0.3), radius * 2 * k);
      m.material.opacity = 0.85 * k;
    });
  }

  beam(a, b, color, width = 0.25, time = 0.25) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5);
    m.lookAt(b);
    this._timed(m, time, (k) => {
      m.scale.set(width * k, width * k, len);
      m.material.opacity = 0.9 * k;
    });
  }

  // Swept arc "smear" behind a kicking foot: a fan of thin glowing quads
  smear(points, color, time = 0.14) {
    if (!this.C('fx.smears') || !this.enabledSmears || points.length < 2) return;
    for (let i = 1; i < points.length; i++) this.beam(points[i - 1], points[i], color, 0.22 * (i / points.length) + 0.06, time);
  }

  afterimage(model, color, time = 0.25, opacity = 0.45) {
    if (!this.C('fx.smears') || !this.enabledSmears) return;
    model.updateWorldMatrix(true, true);
    const g = ghostClone(model, color, opacity);
    g.position.copy(model.position);
    g.quaternion.copy(model.quaternion);
    g.scale.copy(model.scale);
    this._timed(g, time, (k) => { g.userData.ghostMat.opacity = opacity * k; });
  }

  // ── Persistent effect meshes (owned by the sim) ────────────────────────
  makeWall(x, z, angle, len, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = angle;
    const n = Math.max(2, Math.round(len / 0.5));
    const blocks = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) {
        const shadeK = 0.82 + ((i + j) % 2) * 0.18;
        const c = new THREE.Color(color).multiplyScalar(shadeK);
        const b = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: c }));
        b.scale.set(0.5, 0.5, 0.6);
        b.position.set(-len / 2 + 0.25 + i * (len - 0.5) / (n - 1), -1 + j * 0.5 + 0.25, 0);
        b.castShadow = true;
        b.receiveShadow = true;
        b.userData.target = j * 0.5 + 0.25;
        b.userData.delay = Math.abs(i - (n - 1) / 2) * 0.02 + j * 0.03;
        g.add(b);
        blocks.push(b);
      }
    }
    this.scene.add(g);
    let t = 0;
    return {
      group: g,
      update: (dt, remaining) => {
        t += dt;
        for (const b of blocks) {
          const u = Math.min(1, Math.max(0, (t - b.userData.delay) / 0.12));
          const sink = remaining < 0.3 ? (0.3 - remaining) / 0.3 : 0;
          b.position.y = -1 + (b.userData.target + 1) * (1 - Math.pow(1 - u, 3)) - sink * 1.6;
        }
      },
      dispose: () => { this.scene.remove(g); },
    };
  }

  makeShield(color, radius = 1.2) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false }));
    const w = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.add(w);
    this.scene.add(m);
    return { mesh: m, dispose: () => { this.scene.remove(m); m.geometry.dispose(); } };
  }

  update(dt) {
    this.solid.update(dt);
    this.glow.update(dt);
    const it = this.items;
    let w = 0;
    for (let i = 0; i < it.length; i++) {
      const o = it[i];
      o.life -= dt;
      if (o.life <= 0) {
        this.scene.remove(o.mesh);
        if (o.mesh.material?.dispose) o.mesh.material.dispose();
        continue;
      }
      o.update(o.life / o.max);
      it[w++] = o;
    }
    it.length = w;
  }

  clear() {
    this.solid.clear();
    this.glow.clear();
    for (const o of this.items) this.scene.remove(o.mesh);
    this.items.length = 0;
  }
}
