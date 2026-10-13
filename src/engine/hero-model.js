// Voxel hero built from boxes with pivot groups for each joint.
import * as THREE from 'three';
import { HERO_BY_ID } from '../game/heroes.js';

const geoCache = new Map();
function box(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

const matCache = new Map();
export function mat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return matCache.get(hex);
}

function part(parent, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(box(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.baseColor = color;
  parent.add(m);
  return m;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

function hair(head, style, color) {
  const dark = shade(color, 0.78);
  switch (style) {
    case 'spike':
      part(head, 0.46, 0.12, 0.46, color, 0, 0.24, -0.01);
      for (const [x, z, h] of [[-0.14, -0.1, 0.16], [0.02, -0.12, 0.2], [0.16, -0.05, 0.14], [-0.06, 0.1, 0.12], [0.12, 0.12, 0.1]]) part(head, 0.13, h, 0.13, x > 0 ? color : dark, x, 0.3 + h / 2, z);
      part(head, 0.46, 0.24, 0.1, color, 0, 0.08, -0.2);
      part(head, 0.08, 0.2, 0.36, dark, -0.22, 0.08, -0.03);
      part(head, 0.08, 0.2, 0.36, dark, 0.22, 0.08, -0.03);
      break;
    case 'long':
      part(head, 0.48, 0.12, 0.48, color, 0, 0.24, 0);
      part(head, 0.48, 0.62, 0.14, color, 0, -0.08, -0.2);
      part(head, 0.08, 0.5, 0.3, dark, -0.23, -0.02, -0.02);
      part(head, 0.08, 0.5, 0.3, dark, 0.23, -0.02, -0.02);
      part(head, 0.44, 0.08, 0.08, color, 0, 0.17, 0.2);
      break;
    case 'buzz':
      part(head, 0.45, 0.06, 0.45, color, 0, 0.23, 0);
      part(head, 0.45, 0.14, 0.06, dark, 0, 0.15, -0.21);
      break;
    case 'bob':
      part(head, 0.5, 0.14, 0.5, color, 0, 0.23, 0);
      part(head, 0.5, 0.36, 0.12, color, 0, 0.04, -0.2);
      part(head, 0.1, 0.4, 0.46, dark, -0.24, 0.02, 0);
      part(head, 0.1, 0.4, 0.46, dark, 0.24, 0.02, 0);
      part(head, 0.46, 0.12, 0.1, color, 0, 0.16, 0.21);
      break;
    case 'messy':
      part(head, 0.5, 0.16, 0.5, color, 0, 0.24, 0);
      for (const [x, z] of [[-0.18, 0.18], [0.0, 0.22], [0.18, 0.16], [0.2, -0.1], [-0.2, -0.12]]) part(head, 0.14, 0.14, 0.14, x > 0 ? color : dark, x, 0.16, z);
      part(head, 0.48, 0.3, 0.1, color, 0, 0.06, -0.21);
      break;
    case 'swept':
      part(head, 0.48, 0.12, 0.48, color, 0, 0.24, 0);
      part(head, 0.3, 0.12, 0.2, color, 0.1, 0.3, 0.14);
      part(head, 0.48, 0.3, 0.1, color, 0, 0.08, -0.21);
      part(head, 0.08, 0.26, 0.4, dark, -0.23, 0.12, -0.02);
      part(head, 0.14, 0.08, 0.14, '#3b7be0', 0.18, 0.36, 0.18); // dyed tips
      break;
    default:
      part(head, 0.46, 0.1, 0.46, color, 0, 0.23, 0);
  }
}

// Build a hero. `C` is a config getter so jersey/hair colours are tunable.
export function buildHero(heroId, C) {
  const h = HERO_BY_ID[heroId];
  const L = h.look;
  const jersey = C ? C(`hero.${heroId}.jersey`) : L.jersey;
  const hairCol = C ? C(`hero.${heroId}.hair`) : L.hair;
  const root = new THREE.Group();
  root.name = heroId;
  const rig = new THREE.Group(); // scale & squash
  rig.scale.setScalar(L.build);
  root.add(rig);

  const hips = new THREE.Group();
  hips.position.y = 0.78;
  rig.add(hips);

  // Body (leans & twists around the hip pivot)
  const body = new THREE.Group();
  hips.add(body);
  part(body, 0.6, 0.22, 0.34, L.shorts, 0, 0.06, 0);
  part(body, 0.62, 0.5, 0.36, jersey, 0, 0.4, 0);
  part(body, 0.64, 0.08, 0.38, L.trim, 0, 0.18, 0);
  part(body, 0.2, 0.18, 0.04, L.trim, 0, 0.42, -0.19); // number patch
  part(body, 0.24, 0.08, 0.38, L.trim, 0, 0.66, 0); // collar

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.01);
  body.add(head);
  part(head, 0.16, 0.1, 0.16, L.skin, 0, -0.08, 0); // neck
  part(head, 0.42, 0.42, 0.42, L.skin, 0, 0.08, 0);
  part(head, 0.07, 0.08, 0.02, '#14121c', -0.1, 0.1, 0.21);
  part(head, 0.07, 0.08, 0.02, '#14121c', 0.1, 0.1, 0.21);
  part(head, 0.1, 0.03, 0.02, shade(L.skin, 0.7), 0, -0.04, 0.21);
  hair(head, L.hairStyle, hairCol);

  const arms = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const sh = new THREE.Group();
    sh.position.set(0.4 * s, 0.6, 0);
    body.add(sh);
    part(sh, 0.18, 0.2, 0.2, jersey, 0, -0.06, 0);
    part(sh, 0.15, 0.22, 0.16, L.skin, 0, -0.24, 0);
    const el = new THREE.Group();
    el.position.y = -0.34;
    sh.add(el);
    part(el, 0.15, 0.26, 0.16, L.skin, 0, -0.12, 0);
    part(el, 0.17, 0.1, 0.18, shade(L.skin, 0.9), 0, -0.28, 0);
    arms[side] = { sh, el };
  }

  const legs = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(0.16 * s, 0, 0);
    hips.add(hip);
    part(hip, 0.22, 0.4, 0.24, L.skin, 0, -0.2, 0);
    part(hip, 0.24, 0.14, 0.26, L.shorts, 0, -0.06, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    hip.add(knee);
    part(knee, 0.2, 0.26, 0.21, L.trim, 0, -0.14, 0); // sock
    part(knee, 0.22, 0.12, 0.34, L.boots, 0, -0.32, 0.05);
    legs[side] = { hip, knee };
  }

  root.userData.rig = { rig, hips, body, head, arms, legs, build: L.build };
  return root;
}

// Apply a pose (from anim.js) to a built hero.
export function applyPose(model, p) {
  const r = model.userData.rig;
  r.hips.position.y = 0.78 + p.y;
  r.rig.scale.set(r.build * (2 - p.squash) ** 0.5, r.build * p.squash, r.build * (2 - p.squash) ** 0.5);
  r.body.rotation.set(p.lean, p.twist, 0);
  r.head.rotation.x = p.head;
  r.legs.L.hip.rotation.x = -p.hipL;
  r.legs.R.hip.rotation.x = -p.hipR;
  r.legs.L.knee.rotation.x = p.kneeL;
  r.legs.R.knee.rotation.x = p.kneeR;
  r.arms.L.sh.rotation.set(-p.shL, 0, p.shLz);
  r.arms.R.sh.rotation.set(-p.shR, 0, -p.shRz);
  r.arms.L.el.rotation.x = -p.elL;
  r.arms.R.el.rotation.x = -p.elR;
}

// World position of the right boot tip (used for arcs & ball placement).
const _v = new THREE.Vector3();
export function footWorld(model, side = 'R', out = new THREE.Vector3()) {
  const knee = model.userData.rig.legs[side].knee;
  knee.updateWorldMatrix(true, false);
  _v.set(0, -0.34, 0.2);
  return out.copy(_v).applyMatrix4(knee.matrixWorld);
}

// Collect every coloured voxel in world space (for the elimination explosion).
export function voxelsOf(model) {
  const out = [];
  model.updateWorldMatrix(true, true);
  model.traverse((o) => {
    if (o.isMesh && o.userData.baseColor) {
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      const s = o.geometry.parameters;
      out.push({ pos: p, color: o.userData.baseColor, size: Math.cbrt(s.width * s.height * s.depth) });
    }
  });
  return out;
}

// Flat-coloured clone for afterimages / onion skins.
export function ghostClone(model, color, opacity = 0.5) {
  const g = model.clone(true);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  g.traverse((o) => {
    if (o.isMesh) { o.material = m; o.castShadow = false; o.receiveShadow = false; }
  });
  g.userData.ghostMat = m;
  return g;
}
