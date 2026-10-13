// Procedural voxel arena: painted pitch, curbs, plinth, stands with a
// bobbing crowd, torches and lantern strings. Rebuilt when theme/size change.
import * as THREE from 'three';
import { THEMES } from './themes.js';
import { mat } from './hero-model.js';

const PX = 8; // texture pixels per world unit

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paintField(W, D, T) {
  const cw = W * PX, ch = D * PX;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  const r = rng(7);
  g.fillStyle = T.ground; g.fillRect(0, 0, cw, ch);
  // Speckles / grain clusters
  for (let i = 0; i < cw * ch * 0.05; i++) {
    g.fillStyle = T.speck[(r() * T.speck.length) | 0];
    const x = (r() * cw) | 0, y = (r() * ch) | 0;
    g.fillRect(x, y, 1, 1);
    if (r() < 0.25) g.fillRect(x + 1, y, 1, 1);
  }
  // Mow stripes (subtle) for turf themes
  if (T === THEMES.egolab) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < cw; x += PX * 4) if ((x / (PX * 4)) % 2 === 0) g.fillRect(x, 0, PX * 2, ch);
  }
  const U = (u) => Math.round(u * PX);
  const inset = 0.45, band = 0.4;
  // Boundary bands — blue half / red half like a versus pitch
  g.fillStyle = T.lineA;
  g.fillRect(U(inset), U(inset), U(W / 2 - inset), U(band));
  g.fillRect(U(inset), ch - U(inset + band), U(W / 2 - inset), U(band));
  g.fillRect(U(inset), U(inset), U(band), ch - U(inset * 2));
  g.fillStyle = T.lineB;
  g.fillRect(U(W / 2), U(inset), U(W / 2 - inset), U(band));
  g.fillRect(U(W / 2), ch - U(inset + band), U(W / 2 - inset), U(band));
  g.fillRect(cw - U(inset + band), U(inset), U(band), ch - U(inset * 2));
  // Inner lane
  g.fillStyle = T.lane;
  const li = 1.6;
  g.fillRect(U(li), U(li), cw - U(li * 2), U(0.12));
  g.fillRect(U(li), ch - U(li + 0.12), cw - U(li * 2), U(0.12));
  // Mid line
  g.fillStyle = T.lineMid;
  g.fillRect(cw / 2 - 1, U(inset + band), 3, ch - U((inset + band) * 2));
  // Centre circle (pixel ring)
  g.fillStyle = T.circle;
  const R = 2.2 * PX, cx = cw / 2, cy = ch / 2;
  for (let a = 0; a < 720; a++) {
    const t = (a / 720) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(t) * R) - 1, Math.round(cy + Math.sin(t) * R) - 1, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
}

function addBox(parent, w, h, d, color, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.flames = [];
    this.crowd = null;
    this.cheer = 0;
  }

  build(themeId, W, D, crowdDensity = 1, lights = true) {
    this.dispose();
    const T = THEMES[themeId] || THEMES.temple;
    this.theme = T;
    this.W = W; this.D = D;
    const G = this.group;
    const r = rng(42);

    // Pitch
    const field = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: paintField(W, D, T) }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    G.add(field);

    // Plinth the pitch sits on
    const M = 2.2;
    addBox(G, W + M * 2, 0.5, D + M * 2, T.plinthTop, 0, -0.27, 0, false);
    addBox(G, W + M * 2 + 0.6, 3.5, D + M * 2 + 0.6, T.plinth, 0, -2.3, 0, false);
    // Cliff chunks below for depth
    for (let i = 0; i < 26; i++) {
      const w = 2 + r() * 5, h = 3 + r() * 8, d = 2 + r() * 5;
      const side = r() < 0.5;
      const x = side ? (r() - 0.5) * (W + 10) : (W / 2 + M + 1 + r() * 4) * (r() < 0.7 ? 1 : -1);
      const z = side ? (D / 2 + M + 1 + r() * 4) * (r() < 0.7 ? 1 : -1) : (r() - 0.5) * (D + 10);
      addBox(G, w, h, d, i % 3 ? T.rock : T.plinth, x, -2.5 - h / 2 + r(), z, false);
    }

    // Curbs
    const cw = 0.55, chh = 0.32;
    const curb = (w, d, x, z) => {
      addBox(G, w, chh, d, T.curb, x, chh / 2, z);
      addBox(G, w, 0.06, d, T.curbTop, x, chh + 0.03, z, false);
    };
    curb(W + cw * 2, cw, 0, -D / 2 - cw / 2);
    curb(W + cw * 2, cw, 0, D / 2 + cw / 2);
    curb(cw, D, -W / 2 - cw / 2, 0);
    curb(cw, D, W / 2 + cw / 2, 0);

    // Stands on the far sides (-z and -x), stepped tiers with crowd
    const seats = [];
    const tiers = 5;
    const standFar = (along, axis) => {
      for (let t = 0; t < tiers; t++) {
        const h = 0.55 * (t + 1), depth = 0.95;
        const off = (axis === 'z' ? D : W) / 2 + M + 0.6 + t * depth;
        const len = along + (M + 1 + t * depth) * 2;
        if (axis === 'z') addBox(G, len, h, depth, t % 2 ? T.stand : T.standTop, 0, h / 2 - 0.02, -off - depth / 2);
        else addBox(G, depth, h, len, t % 2 ? T.stand : T.standTop, -off - depth / 2, h / 2 - 0.02, 0);
        for (let s = -len / 2 + 0.5; s < len / 2 - 0.4; s += 0.55) {
          if (r() > crowdDensity * 0.85) continue;
          const jitter = (r() - 0.5) * 0.12;
          if (axis === 'z') seats.push([s + jitter, h, -off - depth / 2 + 0.1]);
          else seats.push([-off - depth / 2 + 0.1, h, s + jitter]);
        }
      }
    };
    standFar(W, 'z');
    standFar(D, 'x');
    // Near sides: a low wall only, so the camera can see the pitch
    addBox(G, W + M * 2 + 0.6, 0.5, 0.4, T.stand, 0, 0.0, D / 2 + M + 0.1);
    addBox(G, 0.4, 0.5, D + M * 2 + 0.6, T.stand, W / 2 + M + 0.1, 0.0, 0);

    // Crowd (instanced bodies + heads)
    if (seats.length) {
      const n = seats.length;
      const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.46, 0.3), new THREE.MeshLambertMaterial(), n);
      const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshLambertMaterial(), n);
      const c = new THREE.Color();
      seats.forEach((s, i) => {
        bodies.setColorAt(i, c.set(T.crowd[(r() * T.crowd.length) | 0]));
        heads.setColorAt(i, c.set(T.skin[(r() * T.skin.length) | 0]));
      });
      bodies.castShadow = true;
      G.add(bodies, heads);
      this.crowd = { bodies, heads, seats, phase: seats.map(() => r() * 6.28), hype: seats.map(() => 0.4 + r() * 0.6) };
      this.updateCrowd(0);
    }

    // Torches along the curbs + lantern strings on the far sides
    this.flames = [];
    if (lights) {
      const torch = (x, z) => {
        addBox(G, 0.14, 0.9, 0.14, T.post, x, 0.45, z);
        addBox(G, 0.38, 0.14, 0.38, T.post, x, 0.95, z);
        const fl = new THREE.Group();
        fl.position.set(x, 1.05, z);
        const cols = T.flame;
        const f1 = addBox(fl, 0.3, 0.3, 0.3, cols[2], 0, 0.12, 0, false);
        const f2 = addBox(fl, 0.2, 0.32, 0.2, cols[1], 0, 0.24, 0, false);
        const f3 = addBox(fl, 0.1, 0.2, 0.1, cols[0], 0, 0.4, 0, false);
        for (const f of [f1, f2, f3]) f.material = new THREE.MeshBasicMaterial({ color: f.material.color });
        G.add(fl);
        this.flames.push({ g: fl, parts: [f1, f2, f3], seed: r() * 10, x, z });
      };
      const ex = W / 2 + 0.9, ez = D / 2 + 0.9;
      for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 4) { torch(x, -ez); torch(x, ez); }
      for (let z = -D / 2 + D / 4; z < D / 2 - 0.01; z += D / 4) { torch(-ex, z); torch(ex, z); }

      const string = (a, b, sag, n) => {
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const p = a.clone().lerp(b, t);
          p.y -= Math.sin(t * Math.PI) * sag;
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: T.lantern }));
          m.position.copy(p);
          G.add(m);
        }
      };
      const hz = -(D / 2 + M + 0.6 + tiers * 0.95) + 0.4, hx = -(W / 2 + M + 0.6 + tiers * 0.95) + 0.4;
      const poleH = 4.2;
      const poles = [];
      for (let x = -W / 2 - M; x <= W / 2 + M + 0.01; x += (W + M * 2) / 3) poles.push(new THREE.Vector3(x, poleH, hz));
      for (const p of poles) addBox(G, 0.18, poleH, 0.18, T.post, p.x, poleH / 2, p.z);
      for (let i = 0; i < poles.length - 1; i++) string(poles[i], poles[i + 1], 0.9, 16);
      const poles2 = [];
      for (let z = -D / 2 - M; z <= D / 2 + M + 0.01; z += (D + M * 2) / 2) poles2.push(new THREE.Vector3(hx, poleH, z));
      for (const p of poles2) addBox(G, 0.18, poleH, 0.18, T.post, p.x, poleH / 2, p.z);
      for (let i = 0; i < poles2.length - 1; i++) string(poles2[i], poles2[i + 1], 0.9, 16);
    }

    // Shrink fence (hidden unless the mode uses it)
    const fm = new THREE.MeshBasicMaterial({ color: '#ff4a6a', transparent: true, opacity: 0.55, depthWrite: false });
    this.fence = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.08), fm);
      m.position.y = 0.3;
      this.fence.add(m);
    }
    this.fence.visible = false;
    G.add(this.fence);
  }

  setFence(scale, visible) {
    this.fence.visible = visible;
    if (!visible) return;
    const w = this.W * scale, d = this.D * scale;
    const [a, b, c, e] = this.fence.children;
    a.scale.x = w; a.position.set(0, 0.3, -d / 2); a.rotation.y = 0;
    b.scale.x = w; b.position.set(0, 0.3, d / 2); b.rotation.y = 0;
    c.scale.x = d; c.position.set(-w / 2, 0.3, 0); c.rotation.y = Math.PI / 2;
    e.scale.x = d; e.position.set(w / 2, 0.3, 0); e.rotation.y = Math.PI / 2;
  }

  updateCrowd(t) {
    const c = this.crowd;
    if (!c) return;
    const m = new THREE.Matrix4();
    const hype = 0.05 + this.cheer * 0.35;
    for (let i = 0; i < c.seats.length; i++) {
      const [x, y, z] = c.seats[i];
      const b = Math.max(0, Math.sin(t * (6 + c.hype[i] * 4) + c.phase[i])) * hype * c.hype[i];
      m.makeTranslation(x, y + 0.23 + b, z);
      c.bodies.setMatrixAt(i, m);
      m.makeTranslation(x, y + 0.6 + b, z);
      c.heads.setMatrixAt(i, m);
    }
    c.bodies.instanceMatrix.needsUpdate = true;
    c.heads.instanceMatrix.needsUpdate = true;
  }

  update(t, dt, vfx) {
    this.cheer = Math.max(0, this.cheer - dt * 0.5);
    this.updateCrowd(t);
    for (const f of this.flames) {
      const k = Math.sin(t * 13 + f.seed) * 0.5 + Math.sin(t * 7.3 + f.seed * 2) * 0.5;
      f.parts[0].scale.setScalar(1 + k * 0.12);
      f.parts[1].scale.set(1 - k * 0.1, 1 + k * 0.25, 1 - k * 0.1);
      f.parts[2].position.y = 0.4 + k * 0.06;
      if (vfx && Math.random() < dt * 2.5) vfx.ember(f.x, 1.5, f.z, this.theme.flame[(Math.random() * 2) | 0]);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry.dispose?.();
        if (o.material?.map) o.material.map.dispose();
      }
    });
    this.group.clear();
    this.crowd = null;
  }
}
