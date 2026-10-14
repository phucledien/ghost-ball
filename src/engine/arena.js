// Procedural voxel arena: painted pitch with terrain zones, obstacles,
// curbs, plinth, stands with a bobbing crowd, torches and lantern strings.
// Rebuilt when the map / theme / size change.
//
// Static geometry is merged into a handful of vertex-coloured meshes (one per
// material/shadow combination) so a big map with lots of cover still costs
// only a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { THEMES } from './themes.js';
import { isCircle } from '../game/maps.js';

const PX = 8; // texture pixels per world unit

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ── Static geometry batching ─────────────────────────────────────────────
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

class Batch {
  constructor() { this.parts = { cast: [], flat: [], glow: [] }; }

  add(geo, color, x, y, z, { sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0, cast = true, glow = false } = {}) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.deleteAttribute('uv');
    _m4.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(_m4);
    _c.set(color); // Color.set converts sRGB hex → linear working space
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts[glow ? 'glow' : cast ? 'cast' : 'flat'].push(g);
  }

  box(w, h, d, color, x, y, z, o = {}) { this.add(UNIT_BOX, color, x, y, z, { ...o, sx: w, sy: h, sz: d }); }

  build(parent) {
    const out = [];
    for (const [k, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const material = k === 'glow'
        ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : new THREE.MeshLambertMaterial({ vertexColors: true });
      const m = new THREE.Mesh(geo, material);
      m.castShadow = k === 'cast';
      m.receiveShadow = k !== 'glow';
      parent.add(m);
      out.push(m);
    }
    this.parts = { cast: [], flat: [], glow: [] };
    return out;
  }
}

const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CONE6 = new THREE.ConeGeometry(1, 1, 6);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const DODECA = new THREE.DodecahedronGeometry(1, 0);

// ── Pitch texture ────────────────────────────────────────────────────────
function paintField(W, D, T, zones) {
  const cw = W * PX, ch = D * PX;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  const r = rng(7);
  g.fillStyle = T.ground; g.fillRect(0, 0, cw, ch);
  for (let i = 0; i < cw * ch * 0.05; i++) {
    g.fillStyle = T.speck[(r() * T.speck.length) | 0];
    const x = (r() * cw) | 0, y = (r() * ch) | 0;
    g.fillRect(x, y, 1, 1);
    if (r() < 0.25) g.fillRect(x + 1, y, 1, 1);
  }
  if (T === THEMES.egolab) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < cw; x += PX * 4) if ((x / (PX * 4)) % 2 === 0) g.fillRect(x, 0, PX * 2, ch);
  }
  const U = (u) => Math.round(u * PX);
  const toPx = (x, z) => [cw / 2 + x * PX, ch / 2 + z * PX];

  // Terrain zones (under the lines so the pitch markings stay readable)
  for (const q of zones) {
    const cols = T.zone[q.kind] || ['#888'];
    const [x0, y0] = toPx(q.x - q.w / 2, q.z - q.d / 2);
    const w = q.w * PX, h = q.d * PX;
    // pixel-rounded corners
    g.fillStyle = cols[0];
    g.fillRect(x0 + 2, y0, w - 4, h); g.fillRect(x0, y0 + 2, w, h - 4); g.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
    if (q.kind === 'boost') {
      // chevrons pointing along the long axis
      g.fillStyle = cols[1];
      const along = q.w >= q.d;
      const len = along ? w : h, thick = along ? h : w;
      for (let s = 6; s < len - 6; s += 12) {
        for (let k = 0; k < thick - 4; k++) {
          const off = Math.abs(k - (thick - 4) / 2) * 0.6;
          if (along) g.fillRect(x0 + s + off, y0 + 2 + k, 3, 1);
          else g.fillRect(x0 + 2 + k, y0 + s + off, 1, 3);
        }
      }
      g.fillStyle = cols[2];
      if (along) { g.fillRect(x0 + 2, y0 + 1, w - 4, 1); g.fillRect(x0 + 2, y0 + h - 2, w - 4, 1); }
      else { g.fillRect(x0 + 1, y0 + 2, 1, h - 4); g.fillRect(x0 + w - 2, y0 + 2, 1, h - 4); }
    } else if (q.kind === 'ice') {
      for (let i = 0; i < w * h * 0.03; i++) { g.fillStyle = cols[1]; g.fillRect(x0 + 2 + r() * (w - 4), y0 + 2 + r() * (h - 4), 2, 1); }
      g.fillStyle = cols[2];
      for (let s = 0; s < w + h; s += 9) for (let k = 0; k < 5; k++) {
        const x = x0 + s - k, y = y0 + 2 + k * 2;
        if (x > x0 + 2 && x < x0 + w - 3) g.fillRect(x, y, 1, 2);
      }
    } else {
      for (let i = 0; i < w * h * 0.12; i++) { g.fillStyle = cols[1 + ((r() * (cols.length - 1)) | 0)] || cols[0]; g.fillRect(x0 + 1 + r() * (w - 2), y0 + 1 + r() * (h - 2), 1, 1); }
    }
  }

  // Boundary bands — blue half / red half like a versus pitch
  const inset = 0.45, band = 0.4;
  g.fillStyle = T.lineA;
  g.fillRect(U(inset), U(inset), U(W / 2 - inset), U(band));
  g.fillRect(U(inset), ch - U(inset + band), U(W / 2 - inset), U(band));
  g.fillRect(U(inset), U(inset), U(band), ch - U(inset * 2));
  g.fillStyle = T.lineB;
  g.fillRect(U(W / 2), U(inset), U(W / 2 - inset), U(band));
  g.fillRect(U(W / 2), ch - U(inset + band), U(W / 2 - inset), U(band));
  g.fillRect(cw - U(inset + band), U(inset), U(band), ch - U(inset * 2));
  g.fillStyle = T.lane;
  const li = 1.6;
  g.fillRect(U(li), U(li), cw - U(li * 2), U(0.12));
  g.fillRect(U(li), ch - U(li + 0.12), cw - U(li * 2), U(0.12));
  g.fillStyle = T.lineMid;
  g.fillRect(cw / 2 - 1, U(inset + band), 3, ch - U((inset + band) * 2));
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

// ── Obstacles ────────────────────────────────────────────────────────────
function buildObstacle(B, o, T, r) {
  const O = T.obs;
  switch (o.kind) {
    case 'pillar': {
      // fluted column with a cracked top drum and a base plinth
      B.add(CYL8, O.stoneDark, o.x, 0.15, o.z, { sx: o.r * 1.25, sy: 0.3, sz: o.r * 1.25 });
      const h = o.h - 0.3;
      B.add(CYL8, O.stone, o.x, 0.3 + h / 2, o.z, { sx: o.r, sy: h, sz: o.r, ry: 0.2 });
      for (let k = 0; k < 4; k++) B.box(0.08, h * 0.9, 0.08, O.stoneDark, o.x + Math.cos(k * 1.57 + 0.6) * o.r * 0.97, 0.3 + h / 2, o.z + Math.sin(k * 1.57 + 0.6) * o.r * 0.97, { cast: false });
      B.add(CYL8, O.stoneTop, o.x, o.h + 0.1, o.z, { sx: o.r * 1.15, sy: 0.22, sz: o.r * 1.15, rz: (r() - 0.5) * 0.2 });
      if (r() < 0.6) B.box(0.5, 0.18, 0.4, O.moss, o.x + o.r * 0.4, o.h + 0.25, o.z, { cast: false });
      // fallen chunk next to some columns
      if (r() < 0.5) B.add(DODECA, O.stone, o.x + o.r + 0.45, 0.22, o.z - 0.3, { sx: 0.3, sy: 0.24, sz: 0.3, ry: r() * 3 });
      break;
    }
    case 'rock':
      B.add(DODECA, O.stoneDark, o.x, o.h * 0.45, o.z, { sx: o.r, sy: o.h * 0.6, sz: o.r * 0.9, ry: r() * 3 });
      B.add(DODECA, O.stone, o.x - o.r * 0.3, o.h * 0.7, o.z + 0.1, { sx: o.r * 0.6, sy: o.h * 0.4, sz: o.r * 0.6, ry: r() * 3 });
      break;
    case 'tree': {
      B.add(CYL6, O.trunk, o.x, 0.4, o.z, { sx: 0.18, sy: 0.8, sz: 0.18 });
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const rr = o.r * (1.45 - i * 0.35), hh = o.h * 0.38;
        const y = 0.7 + i * o.h * 0.24 + hh / 2;
        B.add(CONE6, i % 2 ? O.leaf2 : O.leaf, o.x, y, o.z, { sx: rr, sy: hh, sz: rr, ry: i * 0.5 });
        if (T.obs.ice) B.add(CONE6, '#f6fafd', o.x, y + hh * 0.28, o.z, { sx: rr * 0.55, sy: hh * 0.45, sz: rr * 0.55, ry: i * 0.5, cast: false });
      }
      break;
    }
    case 'block': {
      B.box(o.w, o.h, o.d, O.stone, o.x, o.h / 2, o.z);
      B.box(o.w + 0.08, 0.16, o.d + 0.08, O.stoneTop, o.x, o.h - 0.08, o.z, { cast: false });
      B.box(o.w + 0.12, 0.18, o.d + 0.12, O.stoneDark, o.x, 0.09, o.z, { cast: false });
      break;
    }
    case 'low': {
      // knee-high wall: blocks flat passes, lobs fly over
      const n = Math.max(1, Math.round(Math.max(o.w, o.d) / 0.7));
      const along = o.w >= o.d;
      for (let i = 0; i < n; i++) {
        const u = -0.5 + (i + 0.5) / n;
        const x = o.x + (along ? u * o.w : 0), z = o.z + (along ? 0 : u * o.d);
        const sw = along ? o.w / n - 0.04 : o.w, sd = along ? o.d : o.d / n - 0.04;
        B.box(sw, o.h - 0.05 * (i % 2), sd, i % 2 ? O.stoneDark : O.stone, x, (o.h - 0.05 * (i % 2)) / 2, z);
      }
      B.box(o.w + 0.06, 0.08, o.d + 0.06, O.stoneTop, o.x, o.h + 0.02, o.z, { cast: false });
      break;
    }
    case 'crate': {
      B.box(o.w, o.h, o.d, O.crate, o.x, o.h / 2, o.z);
      // trim bands + a glowing stencil stripe
      B.box(o.w + 0.06, 0.12, o.d + 0.06, O.crateTrim, o.x, o.h - 0.1, o.z, { cast: false });
      B.box(o.w + 0.06, 0.12, o.d + 0.06, O.crateTrim, o.x, 0.12, o.z, { cast: false });
      const glow = T === THEMES.egolab;
      B.box(o.w + 0.04, 0.08, o.d + 0.04, glow ? '#5ad8ff' : O.crateTrim, o.x, o.h * 0.55, o.z, { cast: false, glow });
      break;
    }
    case 'ice': {
      const c = T.obs.ice || '#a6dcf2';
      B.box(o.w, o.h, o.d, c, o.x, o.h / 2, o.z, { ry: 0 });
      B.box(o.w * 0.6, o.h * 0.5, o.d * 0.6, '#eaf8ff', o.x + o.w * 0.15, o.h + o.h * 0.2, o.z - o.d * 0.1, { ry: 0.4 });
      B.box(o.w + 0.1, 0.12, o.d + 0.1, '#ffffff', o.x, o.h, o.z, { cast: false });
      break;
    }
    default:
      if (isCircle(o)) B.add(CYL8, O.stone, o.x, o.h / 2, o.z, { sx: o.r, sy: o.h, sz: o.r });
      else B.box(o.w, o.h, o.d, O.stone, o.x, o.h / 2, o.z);
  }
}

// Zone dressing (3D bits on top of the painted ground)
function dressZone(B, q, T, r) {
  if (q.kind === 'grass') {
    const cols = T.zone.grass;
    const n = Math.round(q.w * q.d * 2.6);
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.3), z = q.z + (r() - 0.5) * (q.d - 0.3);
      const h = 0.55 + r() * 0.5;
      B.add(CONE6, cols[(r() * cols.length) | 0], x, h / 2, z, { sx: 0.16, sy: h, sz: 0.16, ry: r() * 3, rx: (r() - 0.5) * 0.3, cast: false });
    }
  } else if (q.kind === 'snow') {
    const n = Math.round(q.w * q.d * 0.5);
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.6), z = q.z + (r() - 0.5) * (q.d - 0.6);
      B.add(DODECA, T.zone.snow[(r() * T.zone.snow.length) | 0], x, 0.05, z, { sx: 0.35 + r() * 0.3, sy: 0.18 + r() * 0.12, sz: 0.35 + r() * 0.3, ry: r() * 3, cast: false });
    }
  } else if (q.kind === 'mud') {
    const n = Math.round(q.w * q.d * 0.25);
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.6), z = q.z + (r() - 0.5) * (q.d - 0.6);
      B.add(DODECA, T.zone.mud[(r() * T.zone.mud.length) | 0], x, 0.02, z, { sx: 0.3 + r() * 0.3, sy: 0.1, sz: 0.3 + r() * 0.3, ry: r() * 3, cast: false });
    }
  } else if (q.kind === 'boost') {
    // emitter posts at both ends
    const along = q.w >= q.d;
    for (const s of [-1, 1]) {
      const x = q.x + (along ? s * (q.w / 2 + 0.25) : 0), z = q.z + (along ? 0 : s * (q.d / 2 + 0.25));
      B.box(0.3, 0.5, 0.3, '#1d2a4c', x, 0.25, z);
      B.box(0.32, 0.1, 0.32, T.zone.boost[1], x, 0.45, z, { cast: false, glow: true });
    }
  }
}

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.flames = [];
    this.crowd = null;
    this.cheer = 0;
    this.obstacles = [];
    this.zones = [];
  }

  // layout: { obstacles, zones } from resolveMap (optional)
  build(themeId, W, D, crowdDensity = 1, lights = true, layout = null) {
    this.dispose();
    const T = THEMES[themeId] || THEMES.temple;
    this.theme = T;
    this.W = W; this.D = D;
    this.obstacles = layout?.obstacles || [];
    this.zones = layout?.zones || [];
    const G = this.group;
    const B = new Batch();
    const r = rng(42);

    // Pitch
    const field = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: paintField(W, D, T, this.zones) }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    G.add(field);

    // Obstacles + zone dressing
    const ro = rng(9);
    for (const o of this.obstacles) buildObstacle(B, o, T, ro);
    for (const q of this.zones) dressZone(B, q, T, ro);

    // Plinth the pitch sits on
    const M = 2.2;
    B.box(W + M * 2, 0.5, D + M * 2, T.plinthTop, 0, -0.27, 0, { cast: false });
    B.box(W + M * 2 + 0.6, 3.5, D + M * 2 + 0.6, T.plinth, 0, -2.3, 0, { cast: false });
    const chunks = Math.round(18 + (W + D) * 0.25);
    for (let i = 0; i < chunks; i++) {
      const w = 2 + r() * 5, h = 3 + r() * 8, d = 2 + r() * 5;
      const side = r() < 0.5;
      const x = side ? (r() - 0.5) * (W + 10) : (W / 2 + M + 1 + r() * 4) * (r() < 0.7 ? 1 : -1);
      const z = side ? (D / 2 + M + 1 + r() * 4) * (r() < 0.7 ? 1 : -1) : (r() - 0.5) * (D + 10);
      B.box(w, h, d, i % 3 ? T.rock : T.plinth, x, -2.5 - h / 2 + r(), z, { cast: false });
    }

    // Curbs
    const cw = 0.55, chh = 0.32;
    const curb = (w, d, x, z) => {
      B.box(w, chh, d, T.curb, x, chh / 2, z);
      B.box(w, 0.06, d, T.curbTop, x, chh + 0.03, z, { cast: false });
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
        if (axis === 'z') B.box(len, h, depth, t % 2 ? T.stand : T.standTop, 0, h / 2 - 0.02, -off - depth / 2);
        else B.box(depth, h, len, t % 2 ? T.stand : T.standTop, -off - depth / 2, h / 2 - 0.02, 0);
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
    B.box(W + M * 2 + 0.6, 0.5, 0.4, T.stand, 0, 0.0, D / 2 + M + 0.1);
    B.box(0.4, 0.5, D + M * 2 + 0.6, T.stand, W / 2 + M + 0.1, 0.0, 0);

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
      G.add(bodies, heads);
      this.crowd = { bodies, heads, seats, phase: seats.map(() => r() * 6.28), hype: seats.map(() => 0.4 + r() * 0.6), m: new THREE.Matrix4() };
      this.updateCrowd(0);
    }

    // Torches along the curbs + lantern strings on the far sides
    this.flames = [];
    if (lights) {
      const flameMats = T.flame.map((c) => new THREE.MeshBasicMaterial({ color: c }));
      const torch = (x, z) => {
        B.box(0.14, 0.9, 0.14, T.post, x, 0.45, z);
        B.box(0.38, 0.14, 0.38, T.post, x, 0.95, z);
        const fl = new THREE.Group();
        fl.position.set(x, 1.05, z);
        const part = (w, h, d, m, y) => { const b = new THREE.Mesh(UNIT_BOX, m); b.scale.set(w, h, d); b.position.y = y; fl.add(b); return b; };
        const f1 = part(0.3, 0.3, 0.3, flameMats[2], 0.12);
        const f2 = part(0.2, 0.32, 0.2, flameMats[1], 0.24);
        const f3 = part(0.1, 0.2, 0.1, flameMats[0], 0.4);
        G.add(fl);
        this.flames.push({ g: fl, parts: [f1, f2, f3], seed: r() * 10, x, z });
      };
      const ex = W / 2 + 0.9, ez = D / 2 + 0.9;
      const nx = Math.max(4, Math.round(W / 8)), nz = Math.max(4, Math.round(D / 6));
      for (let i = 0; i <= nx; i++) { const x = -W / 2 + (W * i) / nx; torch(x, -ez); torch(x, ez); }
      for (let i = 1; i < nz; i++) { const z = -D / 2 + (D * i) / nz; torch(-ex, z); torch(ex, z); }

      const string = (a, b, sag, n) => {
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const p = a.clone().lerp(b, t);
          p.y -= Math.sin(t * Math.PI) * sag;
          B.box(0.16, 0.16, 0.16, T.lantern, p.x, p.y, p.z, { glow: true });
        }
      };
      const hz = -(D / 2 + M + 0.6 + tiers * 0.95) + 0.4, hx = -(W / 2 + M + 0.6 + tiers * 0.95) + 0.4;
      const poleH = 4.2;
      const poles = [];
      const npx = Math.max(3, Math.round(W / 9));
      for (let i = 0; i <= npx; i++) poles.push(new THREE.Vector3(-W / 2 - M + ((W + M * 2) * i) / npx, poleH, hz));
      for (const p of poles) B.box(0.18, poleH, 0.18, T.post, p.x, poleH / 2, p.z);
      for (let i = 0; i < poles.length - 1; i++) string(poles[i], poles[i + 1], 0.9, 16);
      const poles2 = [];
      const npz = Math.max(2, Math.round(D / 9));
      for (let i = 0; i <= npz; i++) poles2.push(new THREE.Vector3(hx, poleH, -D / 2 - M + ((D + M * 2) * i) / npz));
      for (const p of poles2) B.box(0.18, poleH, 0.18, T.post, p.x, poleH / 2, p.z);
      for (let i = 0; i < poles2.length - 1; i++) string(poles2[i], poles2[i + 1], 0.9, 16);
    }

    B.build(G);

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
    const m = c.m;
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
    // the crowd animates at 30 Hz — plenty for a bob, half the matrix uploads
    this.crowdAcc = (this.crowdAcc || 0) + dt;
    if (this.crowdAcc > 1 / 30) { this.crowdAcc = 0; this.updateCrowd(t); }
    for (const f of this.flames) {
      const k = Math.sin(t * 13 + f.seed) * 0.5 + Math.sin(t * 7.3 + f.seed * 2) * 0.5;
      f.parts[0].scale.setScalar(0.3 * (1 + k * 0.12));
      f.parts[1].scale.set(0.2 * (1 - k * 0.1), 0.32 * (1 + k * 0.25), 0.2 * (1 - k * 0.1));
      f.parts[2].position.y = 0.4 + k * 0.06;
      if (vfx && Math.random() < dt * 2.5) vfx.ember(f.x, 1.5, f.z, this.theme.flame[(Math.random() * 2) | 0]);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        if (o.geometry !== UNIT_BOX) o.geometry.dispose?.();
        if (o.material?.map) o.material.map.dispose();
        if (o.material?.vertexColors) o.material.dispose();
      }
    });
    this.group.clear();
    this.crowd = null;
  }
}

