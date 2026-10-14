// Renders hero portraits / sprite frames with a single shared offscreen
// WebGL renderer (keeps the context count low on mobile).
import * as THREE from 'three';
import { buildHero, applyPose } from '../engine/hero-model.js';
import { POSES, actionPose, locomotionPose } from '../engine/anim.js';
import { phasesFor, HERO_BY_ID } from '../game/heroes.js';

let R = null;
function rig() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#d8dcff', '#5a4a3a', 1.4));
  const sun = new THREE.DirectionalLight('#fff1d8', 1.8);
  sun.position.set(-2, 4, 3);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  R = { renderer, scene, camera };
  return R;
}

const models = new Map();
function modelFor(heroId, C, loadout = null) {
  const key = `${heroId}|${C?.('art.heroStyle') || 'master'}|${JSON.stringify(loadout)}`;
  if (!models.has(key)) {
    if (models.size > 48) models.clear();
    models.set(key, buildHero(heroId, C, loadout));
  }
  return models.get(key);
}
export function invalidatePortraits() { models.clear(); }

// mode: 'bust' (head & shoulders) | 'full'
export function renderHero(heroId, C, { w = 48, h = 48, mode = 'bust', yaw = 0.5, pitch = 0.12, pose = null, bg = null, loadout = null, out = null } = {}) {
  const { renderer, scene, camera } = rig();
  const m = modelFor(heroId, C, loadout);
  scene.add(m);
  applyPose(m, pose || POSES.idle);
  m.rotation.y = yaw;
  // bust: head & shoulders · full: sprite frames · stage: the select-screen turntable (fits TITAN)
  const bust = mode === 'bust';
  const b = m.userData.artStyle==='master' ? (m.userData.rig.hipsY/.88) : HERO_BY_ID[heroId]?.look.build ?? 1;
  const cy = mode === 'stage' ? 1.32 : (bust ? 1.88 : 1.12) * b, half = mode === 'stage' ? 1.44 : (bust ? 0.42 : 1.25) * b;
  camera.top = half; camera.bottom = -half; camera.left = -half * (w / h); camera.right = half * (w / h);
  camera.position.set(Math.sin(0) * 10, cy + Math.sin(pitch) * 10, Math.cos(pitch) * 10);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setClearColor(bg || '#000000', bg ? 1 : 0);
  renderer.render(scene, camera);
  scene.remove(m);
  // `out`: draw into an existing canvas (menu preview) instead of a new one
  const dst = out || document.createElement('canvas');
  if (!out) { dst.width = w; dst.height = h; }
  const g = dst.getContext('2d');
  if (out) g.clearRect(0, 0, dst.width, dst.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(renderer.domElement, 0, 0, dst.width, dst.height);
  return dst;
}

export function portraitURL(heroId, C, size = 40, loadout = null) {
  return renderHero(heroId, C, { w: size, h: size, mode: 'bust', loadout }).toDataURL();
}

// A strip of frames for an action (sprite-sheet style)
export function actionFrames(heroId, actionId, C, frames = 8, size = 48) {
  const phases = phasesFor(actionId, C);
  const total = phases.reduce((s, p) => s + p.dur, 0);
  const out = [];
  for (let i = 0; i < frames; i++) {
    const t = (i / (frames - 1)) * total;
    const pose = actionPose(phases, t, 1, POSES.idle);
    out.push(renderHero(heroId, C, { w: size, h: size, mode: 'full', yaw: 1.2, pitch: 0.25, pose }));
  }
  return out;
}

export function runFrames(heroId, C, frames = 8, size = 48) {
  const out = [];
  for (let i = 0; i < frames; i++) {
    const pose = locomotionPose(1, (i / frames) * Math.PI * 2, 1, 1, {});
    out.push(renderHero(heroId, C, { w: size, h: size, mode: 'full', yaw: 1.2, pitch: 0.25, pose }));
  }
  return out;
}
