import { heroPose } from './hero-motion.js';
// Stylised footballer hero: smooth low-poly parts (spheres / capsules / lathes)
// baked into ONE vertex-coloured mesh per joint pivot, cel-shaded with a shared
// 3-step toon ramp. Cosmetics (hair, eyewear, headwear, boots, accessory, kit)
// come from game/cosmetics.js and are merged into the same pivot meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildHeroMaster, supportsHeroMaster } from './hero-master.js';
import { HERO_BY_ID } from '../game/heroes.js';
import { resolveLoadout, loadoutKey, kitColors, BOOT_COLORS } from '../game/cosmetics.js';

// ── Materials ──────────────────────────────────────────────────────────────
// Lambert cache (arena.js boxes use this).
const matCache = new Map();
export function mat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return matCache.get(hex);
}

let _ramp = null;
function toonRamp() {
  if (_ramp) return _ramp;
  _ramp = new THREE.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.generateMipmaps = false;
  _ramp.needsUpdate = true;
  return _ramp;
}
// Toon cache by colour (single-colour hero bits) + the shared vertex-colour one.
const toonCache = new Map();
export function toonMat(hex = null) {
  const k = hex ?? '__vc';
  if (!toonCache.has(k)) {
    toonCache.set(k, hex ? new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp() })
      : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  }
  return toonCache.get(k);
}

// ── Geometry primitives (unit shapes, cached; parts are placed by matrix) ──
const prim = new Map();
function cached(k, make) {
  if (!prim.has(k)) {
    const g = make();
    g.deleteAttribute('uv');
    if (!g.index) throw new Error('non-indexed prim ' + k);
    prim.set(k, g);
  }
  return prim.get(k);
}
const SPH = (w = 10, h = 7) => cached(`s${w}.${h}`, () => new THREE.SphereGeometry(1, w, h));
const DOME = (t = 0.55, w = 12, h = 6) => cached(`d${t}.${w}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI * t));
const CAP = (r, len, seg = 8) => cached(`c${r}.${len}.${seg}`, () => new THREE.CapsuleGeometry(r, len, 3, seg));
const CYL = (rt, rb, seg = 8) => cached(`y${rt}.${rb}.${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
const CONE = (seg = 5) => cached(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1));
const BOX = () => cached('b', () => new THREE.BoxGeometry(1, 1, 1));
const TOR = (tube, seg = 12, rs = 4) => cached(`t${tube}.${seg}`, () => new THREE.TorusGeometry(1, tube, rs, seg));
const LATHE = (name, pts, seg = 10) => cached(`l${name}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// Transform: position, rotation (xyz euler), scale.
function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
function mix(a, b, u) {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), u);
  return '#' + c.getHexString();
}

// ── Per-hero character: face, bulk, number ─────────────────────────────────
// brow: inner-end tilt (+ = angry/determined, - = worried/raised); browY: height;
// lid: 0..1 upper-lid closure; eye: [w, h]; mouth: 'smirk' | 'grin' | 'flat' | 'small' | 'open'.
const CHAR = {
  nova: { brow: 0.28, browL: 0.28, browY: 0, lid: 0.15, eye: [1, 1], iris: '#2a4a9a', mouth: 'smirk', bulk: [1, 1], num: '10', beard: null },
  bolt: { brow: 0.4, browL: 0.4, browY: 0.01, lid: 0.3, eye: [1.1, 0.8], iris: '#b0283a', mouth: 'grin', bulk: [0.93, 1.02], num: '7', beard: null },
  titan: { brow: 0.45, browL: 0.45, browY: -0.012, lid: 0.35, eye: [0.9, 0.8], iris: '#c8862a', mouth: 'flat', bulk: [1.14, 0.98], num: '4', beard: '#141218' },
  jinx: { brow: -0.2, browL: 0.25, browY: 0.02, lid: 0, eye: [1.15, 1.2], iris: '#3aa84a', mouth: 'open', bulk: [0.95, 1], num: '11', beard: null },
  echo: { brow: 0.0, browL: 0.0, browY: 0.0, lid: 0.55, eye: [1, 1], iris: '#2ab8c8', mouth: 'small', bulk: [0.98, 1.03], num: '8', beard: null },
  kaiz: { brow: 0.3, browL: -0.12, browY: 0.008, lid: 0.4, eye: [1.1, 0.85], iris: '#7a4ae0', mouth: 'smirk', bulk: [1, 1.02], num: '9', beard: null },
};
const DEF_CHAR = CHAR.nova;

// 7-segment digit layout (a b c d e f g)
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

// ── Rig dimensions (unscaled; feet on y=0 in idle) ─────────────────────────
const HIPS_Y = 0.78; // hips pivot
const BODY_Y = 0.14; // body (lean) pivot above hips → pelvis at ~0.92
const LEG_Y = 0.12, LEG_X = 0.11; // leg joints relative to hips
const THIGH = 0.46; // hip → knee
const SHIN = 0.44; // knee → sole
const SH_X = 0.29, SH_Y = 0.62; // shoulder pivot (body local)
const UPPER = 0.31; // shoulder → elbow
const HEAD_Y = 0.74; // head pivot (body local; neck base)
const SK = { y: 0.3, rx: 0.172, ry: 0.198, rz: 0.182 }; // skull ellipsoid (head local)
const FOOT_TIP = new THREE.Vector3(0, -SHIN + 0.05, 0.215);

// ── Part collection ────────────────────────────────────────────────────────
const GROUPS = ['body', 'head', 'sh.L', 'el.L', 'sh.R', 'el.R', 'hip.L', 'knee.L', 'hip.R', 'knee.R'];

function makeCollector() {
  const g = {};
  for (const n of GROUPS) g[n] = { main: [], fine: [] };
  // add(group, geo, color, matrix, fine?)
  const add = (grp, geo, color, m, fine = false) => g[grp][fine ? 'fine' : 'main'].push({ geo, color, m });
  return { g, add };
}

const _c = new THREE.Color();
const _bb = new THREE.Box3(), _ctr = new THREE.Vector3(), _sz = new THREE.Vector3();
function bake(list) {
  if (!list.length) return null;
  const geos = [], parts = [];
  for (const { geo, color, m } of list) {
    const g = geo.clone().applyMatrix4(m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingBox();
    _bb.copy(g.boundingBox).getCenter(_ctr);
    _bb.getSize(_sz);
    const size = Math.cbrt(Math.max(1e-4, _sz.x) * Math.max(1e-4, _sz.y) * Math.max(1e-4, _sz.z));
    if (size > 0.045) parts.push([+_ctr.x.toFixed(4), +_ctr.y.toFixed(4), +_ctr.z.toFixed(4), color, +size.toFixed(4)]);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  merged.computeBoundingSphere();
  return { geo: merged, parts };
}

// ── Hair styles (head-local; skull centre (0, SK.y, 0)) ────────────────────
function hairCap(add, col, { t = 0.5, tilt = -0.52, k = 1.07, ky = 1.05, y = 0, z = -0.01 } = {}) {
  add('head', DOME(t), col, T(0, SK.y + y, z, tilt, 0, 0, SK.rx * k, SK.ry * ky, SK.rz * k));
}
// A cone tuft from a point on the scalp pointing along (rx, rz) rotations.
// With `tip`, the last 40% is a separate dyed cone.
const _dir = new THREE.Vector3();
function tuft(add, col, x, y, z, rx, rz, r = 0.055, h = 0.16, fine = false, tip = null) {
  if (!tip) { add('head', CONE(5), col, T(x, y, z, rx, 0, rz, r, h, r), fine); return; }
  _dir.set(0, 1, 0).applyEuler(_e.set(rx, 0, rz));
  const hb = h * 0.6, ht = h * 0.45;
  add('head', CYL(0.45, 1, 5), col, T(x - _dir.x * h * 0.2, y - _dir.y * h * 0.2, z - _dir.z * h * 0.2, rx, 0, rz, r, hb, r), fine);
  const o = h * 0.1 + ht * 0.5;
  add('head', CONE(5), tip, T(x + _dir.x * o, y + _dir.y * o, z + _dir.z * o, rx, 0, rz, r * 0.46, ht, r * 0.46), fine);
}

function buildHair(add, style, col) {
  const dark = shade(col, 0.72), light = mix(col, '#ffffff', 0.22);
  const top = SK.y + SK.ry;
  switch (style) {
    case 'spike':
      hairCap(add, col, { t: 0.5, tilt: -0.5 });
      for (const [x, z, rx, rz, h] of [[0, 0.06, 0.5, 0, 0.2], [-0.08, 0.04, 0.4, 0.5, 0.18], [0.08, 0.04, 0.4, -0.5, 0.18], [-0.04, -0.06, -0.3, 0.25, 0.2],
        [0.05, -0.08, -0.4, -0.3, 0.19], [-0.13, -0.04, -0.1, 0.9, 0.15], [0.13, -0.04, -0.1, -0.9, 0.15], [0, -0.14, -0.9, 0, 0.17]]) {
        tuft(add, Math.abs(x) > 0.1 ? dark : col, x, top - 0.04, z, rx, rz, 0.06, h);
      }
      // fringe spikes over the brow
      for (const x of [-0.08, 0, 0.08]) tuft(add, col, x, SK.y + 0.13, 0.15, 2.3, x * -3, 0.04, 0.1);
      break;
    case 'long':
      hairCap(add, col, { t: 0.52, tilt: -0.55, k: 1.09 });
      add('head', SPH(8, 6), col, T(0, SK.y + 0.14, 0.11, 0.3, 0, 0, 0.16, 0.06, 0.08)); // fringe
      add('head', SPH(8, 6), dark, T(-0.15, SK.y - 0.02, 0.06, 0.1, 0, 0.1, 0.05, 0.13, 0.06)); // side locks
      add('head', SPH(8, 6), dark, T(0.15, SK.y - 0.02, 0.06, 0.1, 0, -0.1, 0.05, 0.13, 0.06));
      add('head', SPH(6, 5), '#1a1a22', T(0, SK.y + 0.1, -0.19, 0, 0, 0, 0.045), true); // tie
      add('head', CAP(0.062, 0.24, 7), col, T(0, SK.y - 0.06, -0.24, 0.3, 0, 0, 1, 1, 0.85)); // ponytail
      add('head', CONE(6), dark, T(0, SK.y - 0.27, -0.31, Math.PI + 0.3, 0, 0, 0.05, 0.12, 0.045));
      break;
    case 'buzz':
      hairCap(add, col, { t: 0.47, tilt: -0.42, k: 1.05, ky: 1.07 });
      add('head', SPH(12, 7), mix(col, '#6a6a70', 0.25), T(0, SK.y - 0.01, -0.03, 0, 0, 0, SK.rx * 1.015, SK.ry * 0.72, SK.rz * 1.0)); // fade
      add('head', BOX(), shade(col, 0.6), T(0.17, SK.y + 0.06, -0.04, 0, 0, 0.35, 0.02, 0.012, 0.09), true); // shaved line
      break;
    case 'bob':
      hairCap(add, col, { t: 0.62, tilt: -0.6, k: 1.13, ky: 1.07 });
      add('head', BOX(), col, T(0, SK.y + 0.13, 0.15, 0.35, 0, 0, 0.3, 0.07, 0.07)); // straight fringe
      add('head', SPH(8, 6), dark, T(-0.17, SK.y - 0.07, 0.02, 0, 0, 0.12, 0.05, 0.12, 0.13));
      add('head', SPH(8, 6), dark, T(0.17, SK.y - 0.07, 0.02, 0, 0, -0.12, 0.05, 0.12, 0.13));
      break;
    case 'messy':
      hairCap(add, col, { t: 0.52, tilt: -0.5, k: 1.09 });
      add('head', SPH(9, 6), col, T(0, SK.y + 0.13, 0.0, 0, 0, 0, 0.19, 0.12, 0.19));
      for (const [x, y, z, rx, rz, h] of [[-0.1, 0.2, 0.08, 1.2, 0.6, 0.15], [0.03, 0.22, 0.1, 1.4, -0.3, 0.16], [0.12, 0.18, 0.06, 1.1, -1.0, 0.14], [0.12, 0.2, -0.08, -0.6, -0.9, 0.15],
        [-0.12, 0.2, -0.08, -0.7, 0.9, 0.15], [0, 0.24, -0.04, -0.4, 0.3, 0.16], [0.06, 0.25, 0.0, 0.2, -0.5, 0.14], [-0.17, 0.08, -0.02, 0, 1.6, 0.12], [0.17, 0.08, -0.02, 0, -1.6, 0.12], [0, 0.1, -0.18, -1.7, 0, 0.13]]) {
        tuft(add, x > 0.05 ? light : col, x, SK.y + y, z, rx, rz, 0.06, h);
      }
      for (const [x, rz] of [[-0.09, 0.5], [0.02, -0.1], [0.1, -0.5]]) tuft(add, col, x, SK.y + 0.14, 0.16, 2.1, rz, 0.045, 0.13);
      break;
    case 'swept': {
      const dye = '#3b7be0';
      hairCap(add, col, { t: 0.5, tilt: -0.55, k: 1.07, ky: 1.06 });
      add('head', SPH(9, 6), col, T(0, SK.y + 0.13, -0.03, -0.3, 0, 0, 0.17, 0.09, 0.18)); // volume
      for (const [x, y, z, rx, rz, h] of [[0, 0.22, 0.02, -0.85, 0, 0.26], [-0.09, 0.19, 0.0, -0.95, 0.45, 0.23], [0.09, 0.19, 0.0, -0.95, -0.45, 0.23],
        [0, 0.15, -0.12, -1.4, 0, 0.22], [-0.14, 0.1, -0.08, -1.3, 0.8, 0.18], [0.14, 0.1, -0.08, -1.3, -0.8, 0.18]]) {
        tuft(add, Math.abs(x) > 0.1 ? dark : col, x, SK.y + y, z, rx, rz, 0.065, h, false, dye);
      }
      tuft(add, col, 0.06, SK.y + 0.14, 0.15, 2.5, -0.45, 0.04, 0.16, false, dye); // forelock
      break;
    }
    case 'mohawk':
      hairCap(add, dark, { t: 0.48, tilt: -0.45, k: 1.02, ky: 1.02 });
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.36, r = SK.ry + 0.01;
        tuft(add, i % 2 ? col : light, 0, SK.y + Math.cos(a) * r, Math.sin(a) * SK.rz * 1.02, a, 0, 0.05, 0.17);
      }
      break;
    case 'bun':
      hairCap(add, col, { t: 0.5, tilt: -0.5, k: 1.06, ky: 1.04 });
      add('head', SPH(8, 6), col, T(0, top + 0.03, -0.1, 0, 0, 0, 0.085, 0.075, 0.085));
      add('head', TOR(0.3, 8), dark, T(0, top - 0.01, -0.08, 1.2, 0, 0, 0.055), true);
      break;
    case 'afro':
      add('head', SPH(10, 8), col, T(0, SK.y + 0.1, -0.03, 0, 0, 0, 0.27, 0.25, 0.25));
      add('head', SPH(8, 6), dark, T(0, SK.y + 0.02, -0.12, 0, 0, 0, 0.24, 0.2, 0.18));
      break;
    case 'slick':
      hairCap(add, col, { t: 0.5, tilt: -0.6, k: 1.06, ky: 1.04 });
      add('head', SPH(8, 6), col, T(0, SK.y + 0.13, 0.1, 0.4, 0, 0, 0.16, 0.08, 0.1)); // pompadour
      add('head', BOX(), light, T(0.05, top + 0.01, 0.0, -0.3, 0, 0, 0.03, 0.02, 0.2), true); // shine
      break;
    default:
      hairCap(add, col);
  }
}

// ── Builder ────────────────────────────────────────────────────────────────
const SKIN_EDGE = 0.86;
function collect(heroId, look, jerseyIn, hairCol, lo) {
  const { g, add } = makeCollector();
  const ch = CHAR[heroId] || DEF_CHAR;
  const kit = kitColors(lo.kit, look, jerseyIn);
  const jersey = kit.jersey, trim = kit.trim, shorts = kit.shorts;
  const skin = look.skin, skinD = shade(skin, SKIN_EDGE);
  const [bw, bd] = ch.bulk; // width / depth-ish bulk

  // Boots: [upper, sole, swoosh]
  const boots = lo.boots === 'classic' ? [look.boots, shade(look.boots, 0.45), look.trim === look.boots ? '#f3efe6' : look.trim] : BOOT_COLORS[lo.boots];

  // ── Body (pelvis/shorts + torso) ──
  add('body', LATHE('shorts', [[0, -0.2], [0.2, -0.19], [0.215, -0.08], [0.2, 0.06], [0.18, 0.1], [0, 0.1]], 10), shorts, T(0, 0, 0, 0, 0, 0, bw, 1, 0.74 * bd));
  add('body', LATHE('torso', [[0, 0.02], [0.19, 0.04], [0.205, 0.18], [0.235, 0.36], [0.255, 0.5], [0.25, 0.6], [0.205, 0.68], [0.12, 0.73], [0, 0.745]], 10), jersey, T(0, 0, 0, 0, 0, 0, bw, 1, 0.64 * bd));
  add('body', CYL(0.196, 0.192, 10), trim, T(0, 0.06, 0, 0, 0, 0, bw, 0.035, 0.66 * bd)); // hem
  add('body', CYL(0.215, 0.215, 10), shade(shorts, 0.8), T(0, 0.085, 0, 0, 0, 0, bw * 0.92, 0.03, 0.7 * bd), true); // waistband
  // Side stripe on shorts
  for (const s of [1, -1]) add('body', BOX(), trim, T(0.208 * s * bw, -0.07, 0, 0, 0, 0, 0.02, 0.2, 0.06), true);
  // Collar (V-neck ring) + chest badge
  add('body', TOR(0.32, 12), trim, T(0, 0.715, 0.0, Math.PI / 2 - 0.25, 0, 0, 0.1 * bw, 0.09 * bd, 0.1), true);
  add('body', SPH(6, 4), trim, T(0.1 * bw, 0.53, 0.15 * bd, 0, 0, 0, 0.032, 0.036, 0.012), true); // badge
  // Back number (7-segment digits)
  {
    const zb = -0.152 * bd - 0.004, y0 = 0.4, dh = 0.075, dw = 0.065, th = 0.024;
    const digits = String(ch.num);
    digits.split('').forEach((d, i) => {
      const cx = (i - (digits.length - 1) / 2) * (dw + 0.04);
      const seg = SEG[d] || '';
      const S = {
        a: [cx, y0 + dh, dw, th], d: [cx, y0 - dh, dw, th], g: [cx, y0, dw, th],
        b: [cx + dw / 2, y0 + dh / 2, th, dh], c: [cx + dw / 2, y0 - dh / 2, th, dh],
        f: [cx - dw / 2, y0 + dh / 2, th, dh], e: [cx - dw / 2, y0 - dh / 2, th, dh],
      };
      for (const k of seg) { const [x, y, w, h] = S[k]; add('body', BOX(), trim, T(x, y, zb, 0, 0, 0, w + th * 0.5, h + th * 0.5, 0.02), true); }
    });
  }

  // ── Head ──
  add('head', CYL(0.07, 0.078, 8), skinD, T(0, 0.04, -0.005, 0, 0, 0, 1, 0.2, 1)); // neck
  add('head', SPH(16, 12), skin, T(0, SK.y, 0, 0, 0, 0, SK.rx, SK.ry, SK.rz)); // skull
  add('head', SPH(14, 9), skin, T(0, SK.y - 0.1, 0.035, 0.25, 0, 0, 0.135, 0.12, 0.14)); // jaw / chin
  for (const s of [1, -1]) add('head', SPH(6, 5), skinD, T(0.168 * s, SK.y - 0.01, -0.01, 0, 0, 0, 0.03, 0.05, 0.035), true); // ears
  add('head', CONE(4), skinD, T(0, SK.y - 0.035, 0.185, 1.25, Math.PI / 4, 0, 0.026, 0.06, 0.026), true); // nose
  if (ch.beard) {
    const bc = mix(ch.beard, skin, 0.25);
    add('head', SPH(10, 6), bc, T(0, SK.y - 0.17, 0.09, 0.5, 0, 0, 0.065, 0.06, 0.08), true); // goatee / chin beard
    add('head', BOX(), bc, T(0, SK.y - 0.075, 0.17, -0.2, 0, 0, 0.085, 0.016, 0.02), true); // moustache
    for (const s of [1, -1]) add('head', BOX(), bc, T(0.155 * s, SK.y - 0.05, 0.02, 0, 0, 0, 0.02, 0.1, 0.07), true); // sideburns
  }
  // Eyes
  const eyeY = SK.y + 0.015, eyeX = 0.068, eyeZ = 0.158;
  const [ew, eh] = ch.eye;
  for (const s of [1, -1]) {
    const side = s === 1 ? 'L' : 'R';
    // Almond eye: white, big iris, pupil + glint. Lid closure squashes it from the top.
    const oh = eh * (1 - ch.lid * 0.55), oy = eyeY - 0.02 * ch.lid;
    const ry = 0.3 * s;
    add('head', SPH(10, 6), '#f6f4ee', T(eyeX * s, oy, eyeZ, 0, ry, 0, 0.042 * ew, 0.036 * oh, 0.02), true);
    add('head', SPH(8, 6), ch.iris, T((eyeX - 0.006) * s, oy - 0.002, eyeZ + 0.01, 0, ry, 0, 0.026, 0.031 * Math.min(1, oh * 1.05), 0.014), true);
    add('head', SPH(6, 4), '#0e0c16', T((eyeX - 0.006) * s, oy - 0.002, eyeZ + 0.017, 0, ry, 0, 0.013, 0.018 * Math.min(1, oh), 0.01), true);
    add('head', SPH(4, 3), '#ffffff', T((eyeX - 0.015) * s, oy + 0.01 * oh, eyeZ + 0.022, 0, ry, 0, 0.006), true); // glint
    add('head', BOX(), '#1a1220', T(eyeX * s, oy + 0.033 * oh, eyeZ + 0.01, -0.2, ry, 0.1 * s, 0.088 * ew, 0.011, 0.016), true); // upper lash
    // Brow (inner end tilted down for attitude)
    const tilt = side === 'L' ? ch.browL : ch.brow;
    add('head', BOX(), shade(hairCol === '#eef2f6' ? '#9aa4b0' : hairCol, 0.85), T((eyeX + 0.005) * s, eyeY + 0.065 + ch.browY, eyeZ + 0.01, -0.15, 0.3 * s, tilt * s, 0.075, 0.02, 0.025), true);
  }
  // Mouth
  const mY = SK.y - 0.105, mZ = 0.165, lip = shade(skin, 0.58);
  switch (ch.mouth) {
    case 'grin':
      add('head', SPH(8, 4), '#5a1a22', T(0, mY - 0.004, mZ - 0.004, -0.25, 0, 0, 0.042, 0.02, 0.014), true);
      add('head', BOX(), '#f6f4ee', T(0, mY + 0.006, mZ + 0.006, -0.25, 0, 0, 0.06, 0.011, 0.01), true);
      for (const s of [1, -1]) add('head', BOX(), lip, T(0.043 * s, mY + 0.008, mZ - 0.004, -0.25, 0, 0.6 * s, 0.018, 0.008, 0.016), true);
      break;
    case 'open':
      add('head', SPH(6, 4), '#5a1a22', T(0.01, mY - 0.002, mZ - 0.002, -0.25, 0, 0, 0.034, 0.024, 0.014), true);
      add('head', BOX(), '#f6f4ee', T(0.01, mY + 0.014, mZ + 0.006, -0.25, 0, 0, 0.05, 0.01, 0.01), true);
      break;
    case 'flat': add('head', BOX(), lip, T(0, mY, mZ, -0.25, 0, 0, 0.08, 0.012, 0.02), true); break;
    case 'small': add('head', BOX(), lip, T(0, mY, mZ, -0.25, 0, 0, 0.04, 0.011, 0.02), true); break;
    default: // smirk
      add('head', BOX(), lip, T(0.008, mY, mZ, -0.25, 0, 0.18, 0.065, 0.012, 0.02), true);
  }

  // Cap / bandana hide tall styles: keep only a hair cap peeking out underneath.
  const covered = (lo.headwear === 'cap' || lo.headwear === 'bandana') && !['long', 'bob', 'buzz'].includes(lo.hair);
  if (covered) hairCap(add, hairCol, { t: 0.56, tilt: -0.5, k: 1.06, ky: 1.04 });
  else buildHair(add, lo.hair, hairCol);
  addEyewear(add, lo.eyewear, { jersey, trim, eyeY, eyeX, eyeZ });
  addHeadwear(add, lo.headwear, { jersey, trim, hairCol });

  // ── Arms ──
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, sh = 'sh.' + side, el = 'el.' + side;
    const ab = Math.sqrt(bw);
    add(sh, SPH(10, 7), jersey, T(-0.025 * s, -0.035, 0, 0, 0, 0, 0.088 * ab, 0.07, 0.085 * ab)); // deltoid
    add(sh, CYL(0.084, 0.076, 9), jersey, T(-0.005 * s, -0.095, 0, 0, 0, 0.05 * s, ab, 0.15, ab)); // sleeve
    add(sh, CYL(0.081, 0.081, 9), trim, T(0, -0.17, 0, 0, 0, 0.05 * s, ab, 0.025, ab), true); // cuff
    add(sh, CAP(0.064, 0.17, 8), skin, T(0, -0.19, 0, 0, 0, 0, ab, 1, ab)); // upper arm
    add(el, CAP(0.058, 0.15, 8), skin, T(0, -0.11, 0.005, 0, 0, 0, ab, 1, ab)); // forearm
    const gloves = lo.accessory === 'gloves';
    const handCol = gloves ? '#1d1b24' : skin;
    add(el, SPH(8, 6), handCol, T(0, -0.29, 0.01, 0.1, 0, 0, 0.05 * ab, 0.07, 0.04 * ab)); // hand
    add(el, SPH(6, 4), gloves ? '#1d1b24' : skinD, T(-0.035 * s, -0.27, 0.035, 0, 0, 0.4 * s, 0.018, 0.04, 0.018), true); // thumb
    if (gloves) add(el, CYL(0.058, 0.058, 8), '#f0c040', T(0, -0.235, 0.005, 0, 0, 0, ab, 0.03, ab), true);
    if (lo.accessory === 'wristbands') add(el, CYL(0.062, 0.062, 8), side === 'L' ? '#f3efe6' : trim, T(0, -0.215, 0.005, 0, 0, 0, ab, 0.06, ab));
    if (lo.accessory === 'armband' && side === 'L') add(sh, CYL(0.07, 0.068, 9), '#f0c040', T(0, -0.21, 0, 0, 0, 0, ab, 0.055, ab));
  }

  // ── Legs ──
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, hip = 'hip.' + side, knee = 'knee.' + side;
    const lb = Math.sqrt(bw);
    let socks = kit.socks;
    if (lo.accessory === 'mismatch') socks = side === 'L' ? jersey : trim;
    const band = socks === jersey ? trim : jersey;
    add(hip, CYL(0.118, 0.112, 9), shorts, T(0.01 * s, -0.1, 0, 0, 0, 0.06 * s, lb, 0.26, lb * 1.02)); // shorts leg
    add(hip, CAP(0.09, 0.27, 8), skin, T(0, -0.25, 0.005, 0, 0, 0, lb, 1, lb * 1.06)); // thigh
    add(knee, SPH(8, 6), skin, T(0, 0, 0.01, 0, 0, 0, 0.074 * lb)); // knee cap
    add(knee, LATHE('sock', [[0, -0.36], [0.05, -0.36], [0.052, -0.3], [0.068, -0.2], [0.078, -0.12], [0.074, -0.05], [0.07, -0.03], [0, -0.03]], 9), socks, T(0, 0, -0.004, 0, 0, 0, lb, 1, lb));
    add(knee, CYL(0.076, 0.076, 9), band, T(0, -0.065, -0.004, 0, 0, 0, lb, 0.03, lb), true); // sock stripe
    if (lo.accessory === 'mismatch') add(knee, CYL(0.078, 0.078, 9), band, T(0, -0.11, -0.004, 0, 0, 0, lb, 0.02, lb), true);
    // Boot
    const sy = -SHIN;
    add(knee, SPH(10, 7), boots[0], T(0, sy + 0.065, 0.06, -0.06, 0, 0, 0.068 * lb, 0.062, 0.155)); // upper
    add(knee, SPH(8, 6), boots[0], T(0, sy + 0.08, -0.03, 0, 0, 0, 0.064 * lb, 0.07, 0.07)); // heel / ankle collar
    add(knee, BOX(), boots[1], T(0, sy + 0.014, 0.065, 0, 0, 0, 0.12 * lb, 0.028, 0.29)); // sole
    for (const zz of [0.16, 0.06, -0.05]) add(knee, BOX(), shade(boots[1], 0.7), T(0, sy + 0.004, zz, 0, 0, 0, 0.1 * lb, 0.012, 0.03), true); // studs hint
    add(knee, BOX(), boots[2], T(0.066 * s * lb, sy + 0.06, 0.07, -0.35, 0, 0, 0.012, 0.022, 0.13), true); // swoosh outside
    add(knee, BOX(), boots[2], T(0, sy + 0.115, 0.075, -0.5, 0, 0, 0.05, 0.012, 0.07), true); // laces
  }

  addAccessory(add, lo.accessory, { jersey, trim, bw, bd });
  return g;
}

function addEyewear(add, id, { jersey, eyeY, eyeX, eyeZ }) {
  switch (id) {
    case 'visor':
      add('head', SPH(12, 5), '#1a1a2a', T(0, eyeY + 0.005, 0.0, 0, 0, 0, 0.185, 0.04, 0.195), true);
      add('head', BOX(), '#7a5af0', T(-0.05, eyeY + 0.015, eyeZ + 0.03, 0, 0, 0.3, 0.05, 0.008, 0.01), true);
      add('head', BOX(), '#3ad0f0', T(0.06, eyeY - 0.005, eyeZ + 0.03, 0, 0, 0.3, 0.04, 0.008, 0.01), true);
      break;
    case 'round':
      for (const s of [1, -1]) add('head', TOR(0.18, 10), '#1a1820', T(eyeX * s, eyeY, eyeZ + 0.03, 0, 0.3 * s, 0, 0.045), true);
      add('head', BOX(), '#1a1820', T(0, eyeY + 0.01, eyeZ + 0.038, 0, 0, 0, 0.05, 0.008, 0.008), true);
      for (const s of [1, -1]) add('head', BOX(), '#1a1820', T(0.17 * s, eyeY + 0.005, 0.07, 0, 0, 0, 0.008, 0.008, 0.16), true);
      break;
    case 'goggles': {
      const y = SK.y + 0.13;
      add('head', CYL(1, 1, 12), '#2a2430', T(0, y, -0.01, -0.35, 0, 0, SK.rx * 1.14, 0.032, SK.rz * 1.12), true); // strap
      for (const s of [1, -1]) {
        add('head', CYL(1, 1, 8), '#3a3440', T(0.065 * s, y + 0.01, 0.165, 1.2, 0.3 * s, 0, 0.05, 0.04, 0.05), true);
        add('head', CYL(1, 1, 8), '#ff9a2a', T(0.068 * s, y + 0.018, 0.185, 1.2, 0.3 * s, 0, 0.038, 0.012, 0.038), true);
      }
      break;
    }
    case 'paint':
      for (const s of [1, -1]) for (const k of [0, 1]) add('head', BOX(), k ? '#f3efe6' : jersey, T((eyeX + 0.005) * s, eyeY - 0.045 - k * 0.022, eyeZ + 0.002, 0, 0.32 * s, 0.1 * s, 0.07, 0.014, 0.02), true);
      break;
    case 'blacks':
      for (const s of [1, -1]) add('head', BOX(), '#141218', T((eyeX + 0.004) * s, eyeY - 0.048, eyeZ + 0.0, 0, 0.32 * s, 0, 0.06, 0.016, 0.02), true);
      break;
    default:
  }
}

function addHeadwear(add, id, { jersey, trim }) {
  switch (id) {
    case 'headband':
      add('head', CYL(1, 1, 12), '#e8303a', T(0, SK.y + 0.1, -0.01, -0.3, 0, 0, SK.rx * 1.1, 0.04, SK.rz * 1.1));
      add('head', BOX(), '#e8303a', T(-0.03, SK.y + 0.02, -0.23, -0.6, 0, 0.5, 0.03, 0.12, 0.012), true); // knot tails
      add('head', BOX(), '#c8202a', T(0.03, SK.y + 0.0, -0.22, -0.4, 0, -0.3, 0.03, 0.13, 0.012), true);
      break;
    case 'sweatband':
      add('head', CYL(1, 1, 12), '#f3efe6', T(0, SK.y + 0.1, -0.01, -0.25, 0, 0, SK.rx * 1.12, 0.06, SK.rz * 1.12));
      add('head', CYL(1, 1, 12), jersey, T(0, SK.y + 0.1, -0.01, -0.25, 0, 0, SK.rx * 1.13, 0.016, SK.rz * 1.13), true);
      break;
    case 'bandana':
      add('head', DOME(0.45, 12, 5), jersey, T(0, SK.y + 0.03, -0.02, -0.3, 0, 0, SK.rx * 1.16, SK.ry * 1.12, SK.rz * 1.16));
      add('head', SPH(6, 4), shade(jersey, 0.8), T(0, SK.y + 0.02, -0.21, 0, 0, 0, 0.04), true);
      add('head', BOX(), jersey, T(-0.03, SK.y - 0.06, -0.22, -0.3, 0, 0.3, 0.035, 0.12, 0.012), true);
      add('head', BOX(), jersey, T(0.03, SK.y - 0.07, -0.21, -0.2, 0, -0.25, 0.03, 0.11, 0.012), true);
      break;
    case 'cap':
      add('head', DOME(0.5, 12, 5), jersey, T(0, SK.y + 0.05, -0.01, -0.15, 0, 0, SK.rx * 1.16, SK.ry * 1.05, SK.rz * 1.16));
      add('head', CYL(1, 1, 10), trim, T(0, SK.y + 0.07, -0.21, -0.25, 0, 0, 0.12, 0.012, 0.11)); // brim (backwards)
      add('head', SPH(6, 4), trim, T(0, SK.y + 0.255, -0.03, 0, 0, 0, 0.022), true);
      break;
    case 'circlet':
      add('head', TOR(0.12, 14, 4), '#d89a20', T(0, SK.y + 0.09, 0.0, Math.PI / 2 - 0.3, 0, 0, SK.rx * 1.14, SK.rz * 1.14, 0.2));
      add('head', CONE(4), '#f0c040', T(0, SK.y + 0.2, 0.2, 0.3, Math.PI / 4, 0, 0.045, 0.12, 0.03), true); // crest
      add('head', SPH(6, 4), '#e8303a', T(0, SK.y + 0.155, 0.215, 0, 0, 0, 0.026, 0.026, 0.015), true); // gem
      for (const s of [1, -1]) add('head', CONE(4), '#f0c040', T(0.11 * s, SK.y + 0.17, 0.165, 0.3, Math.PI / 4, -0.4 * s, 0.03, 0.08, 0.025), true);
      break;
    default:
  }
}

function addAccessory(add, id, { jersey, trim, bw, bd }) {
  switch (id) {
    case 'scarf': {
      const c = trim, c2 = '#f3efe6';
      add('body', TOR(0.42, 12, 6), c, T(0, 0.72, -0.005, Math.PI / 2 - 0.15, 0, 0, 0.13 * bw, 0.105 * bd, 0.13));
      add('body', BOX(), c, T(0.09, 0.53, 0.15 * bd, -0.12, 0, 0.12, 0.08, 0.3, 0.025)); // front tail
      add('body', BOX(), c2, T(0.083, 0.46, 0.155 * bd, -0.12, 0, 0.12, 0.081, 0.025, 0.027), true);
      add('body', BOX(), c2, T(0.087, 0.53, 0.165 * bd, -0.12, 0, 0.12, 0.081, 0.025, 0.027), true);
      add('body', BOX(), c, T(-0.06, 0.56, -0.17 * bd, 0.2, 0, -0.3, 0.075, 0.24, 0.025)); // back tail
      break;
    }
    case 'chain':
      add('body', TOR(0.16, 14, 4), '#f0c040', T(0, 0.665, 0.03, Math.PI / 2 - 0.6, 0, 0, 0.13 * bw, 0.13 * bd, 0.14));
      add('body', CYL(1, 1, 6), '#f0c040', T(0, 0.55, 0.16 * bd, Math.PI / 2 - 0.15, 0, 0, 0.042, 0.016, 0.042), true); // medallion
      add('body', SPH(4, 3), '#e8303a', T(0, 0.55, 0.172 * bd, 0, 0, 0, 0.016, 0.016, 0.008), true);
      break;
    case 'earring':
      add('head', SPH(6, 4), '#f0c040', T(0.172, SK.y - 0.06, 0.0, 0, 0, 0, 0.018), true);
      break;
    default:
  }
}

// ── Geometry cache: (hero, loadout, colours) → baked pivot meshes ──────────
const bakeCache = new Map();
const BAKE_MAX = 40;
function bakedFor(heroId, look, jersey, hairCol, lo) {
  const key = `${heroId}|${loadoutKey(lo)}|${jersey}|${hairCol}|${look.skin}|${look.trim}|${look.shorts}|${look.boots}`;
  let b = bakeCache.get(key);
  if (b) { bakeCache.delete(key); bakeCache.set(key, b); return b; } // LRU touch
  const g = collect(heroId, look, jersey, hairCol, lo);
  b = {};
  for (const n of GROUPS) b[n] = { main: bake(g[n].main), fine: bake(g[n].fine) };
  bakeCache.set(key, b);
  if (bakeCache.size > BAKE_MAX) {
    const [k0, old] = bakeCache.entries().next().value;
    bakeCache.delete(k0);
    for (const n of GROUPS) { old[n].main?.geo.dispose(); old[n].fine?.geo.dispose(); }
  }
  return b;
}

const SHADOW_GROUPS = new Set(['body', 'head', 'hip.L', 'hip.R', 'knee.L', 'knee.R']);
function attach(pivot, name, baked) {
  for (const kind of ['main', 'fine']) {
    const b = baked[name][kind];
    if (!b) continue;
    const m = new THREE.Mesh(b.geo, toonMat());
    m.castShadow = kind === 'main' && SHADOW_GROUPS.has(name);
    m.receiveShadow = kind === 'main';
    m.userData.parts = b.parts; // [[x, y, z, color, size], ...] in mesh-local space
    m.userData.baseColor = b.parts[0]?.[3] || '#ffffff';
    m.userData.size = b.parts[0]?.[4] || 0.2;
    pivot.add(m);
  }
}

// Build a hero. `C` is a config getter so jersey/hair colours are tunable (may be null).
// `loadout` is a (partial) cosmetics loadout; see game/cosmetics.js.
export function buildHero(heroId, C, loadout = null) {
  const h = HERO_BY_ID[heroId];
  const L = h.look;
  const resolved = resolveLoadout(heroId, loadout);
  if (C?.('art.heroStyle') !== 'legacy' && supportsHeroMaster(heroId, resolved)) return buildHeroMaster(heroId, C, resolved);
  const jersey = C ? C(`hero.${heroId}.jersey`) : L.jersey;
  const hairCol = C ? C(`hero.${heroId}.hair`) : L.hair;
  const lo = resolveLoadout(heroId, loadout);
  const baked = bakedFor(heroId, L, jersey, hairCol, lo);

  const root = new THREE.Group();
  root.name = heroId;
  root.userData.loadout = lo;
  const rig = new THREE.Group(); // scale & squash
  rig.scale.setScalar(L.build);
  root.add(rig);

  const hips = new THREE.Group();
  hips.position.y = HIPS_Y;
  rig.add(hips);

  const body = new THREE.Group(); // leans & twists around the pelvis
  body.position.y = BODY_Y;
  hips.add(body);
  attach(body, 'body', baked);

  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0.0);
  body.add(head);
  attach(head, 'head', baked);

  const arms = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const sh = new THREE.Group();
    sh.position.set(SH_X * s * Math.sqrt(CHAR[heroId]?.bulk[0] ?? 1), SH_Y, 0);
    body.add(sh);
    attach(sh, 'sh.' + side, baked);
    const el = new THREE.Group();
    el.position.y = -UPPER;
    sh.add(el);
    attach(el, 'el.' + side, baked);
    arms[side] = { sh, el };
  }

  const legs = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(LEG_X * s * Math.sqrt(CHAR[heroId]?.bulk[0] ?? 1), LEG_Y, 0);
    hips.add(hip);
    attach(hip, 'hip.' + side, baked);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    hip.add(knee);
    attach(knee, 'knee.' + side, baked);
    legs[side] = { hip, knee };
  }

  root.userData.rig = { rig, hips, body, head, arms, legs, build: L.build };
  return root;
}

// Apply a pose (from anim.js) to a built hero.
export function applyPose(model, p) {
  if(model.userData.artStyle==='master')p=heroPose(model.name,p);
  const r = model.userData.rig;
  r.hips.position.y = (r.hipsY ?? HIPS_Y) + p.y;
  r.rig.scale.set(r.build * (2 - p.squash) ** 0.5, r.build * p.squash, r.build * (2 - p.squash) ** 0.5);
  r.body.rotation.set(p.lean, p.twist, 0);
  r.head.rotation.x = p.head;
  if(r.secondary)r.secondary.rotation.x=p.secondary??0;
  r.legs.L.hip.rotation.x = -p.hipL;
  r.legs.R.hip.rotation.x = -p.hipR;
  r.legs.L.knee.rotation.x = p.kneeL;
  r.legs.R.knee.rotation.x = p.kneeR;
  if(r.legs.L.ankle)r.legs.L.ankle.rotation.x=p.ankleL??0;
  if(r.legs.R.ankle)r.legs.R.ankle.rotation.x=p.ankleR??0;
  r.arms.L.sh.rotation.set(-p.shL, 0, p.shLz);
  r.arms.R.sh.rotation.set(-p.shR, 0, -p.shRz);
  r.arms.L.el.rotation.x = -p.elL;
  r.arms.R.el.rotation.x = -p.elR;
}

// World position of the boot tip (used for arcs & ball placement).
export function footWorld(model, side = 'R', out = new THREE.Vector3()) {
  const leg = model.userData.rig.legs[side];
  if(leg.boot){leg.boot.updateWorldMatrix(true,false);return out.setFromMatrixPosition(leg.boot.matrixWorld);}
  const knee = leg.knee;
  knee.updateWorldMatrix(true, false);
  const tip = model.userData.rig.footTip;
  return (tip ? out.fromArray(tip) : out.copy(FOOT_TIP)).applyMatrix4(knee.matrixWorld);
}

// Collect every coloured part in world space (for the elimination shatter).
const _ws = new THREE.Vector3();
export function voxelsOf(model) {
  const out = [];
  model.updateWorldMatrix(true, true);
  model.traverse((o) => {
    if (!o.isMesh || !o.userData.baseColor) return;
    o.getWorldScale(_ws);
    const k = (Math.abs(_ws.x) + Math.abs(_ws.y) + Math.abs(_ws.z)) / 3;
    const parts = o.userData.parts;
    if (!parts) {
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      out.push({ pos: p, color: o.userData.baseColor, size: (o.userData.size ?? 0.2) * k });
      return;
    }
    for (const [x, y, z, color, size] of parts) {
      out.push({ pos: new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld), color, size: size * k });
    }
  });
  return out;
}

// Flat-coloured clone for afterimages / onion skins.
export function ghostClone(model, color, opacity = 0.5) {
  // Object3D.clone JSON-roundtrips userData; the rig holds live Object3Ds whose
  // toJSON would serialise every merged geometry, so detach it while cloning.
  const rigRef = model.userData.rig;
  model.userData.rig = null;
  let g;
  try { g = model.clone(true); } finally { model.userData.rig = rigRef; }
  delete g.userData.rig;
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  g.traverse((o) => {
    if (o.isMesh) { o.material = m; o.castShadow = false; o.receiveShadow = false; }
  });
  g.userData.ghostMat = m;
  return g;
}
