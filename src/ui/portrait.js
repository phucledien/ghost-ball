// Renders hero portraits / sprite frames with a single shared offscreen
// WebGL renderer (keeps the context count low on mobile).
import * as THREE from 'three';
import { buildHero, applyPose } from '../engine/hero-model.js';
import { POSES, actionPose, locomotionPose } from '../engine/anim.js';
import { phasesFor } from '../game/heroes.js';

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
function modelFor(heroId, C) {
  const key = heroId;
  if (!models.has(key)) models.set(key, buildHero(heroId, C));
  return models.get(key);
}
export function invalidatePortraits() { models.clear(); }

// mode: 'bust' (head & shoulders) | 'full'
export function renderHero(heroId, C, { w = 48, h = 48, mode = 'bust', yaw = 0.5, pitch = 0.12, pose = null, bg = null } = {}) {
  const { renderer, scene, camera } = rig();
  const m = modelFor(heroId, C);
  scene.add(m);
  applyPose(m, pose || POSES.idle);
  m.rotation.y = yaw;
  const bust = mode === 'bust';
  const cy = bust ? 1.75 : 1.0, half = bust ? 0.52 : 1.15;
  camera.top = half; camera.bottom = -half; camera.left = -half * (w / h); camera.right = half * (w / h);
  camera.position.set(Math.sin(0) * 10, cy + Math.sin(pitch) * 10, Math.cos(pitch) * 10);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setClearColor(bg || '#000000', bg ? 1 : 0);
  renderer.render(scene, camera);
  scene.remove(m);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return out;
}

export function portraitURL(heroId, C, size = 40) {
  return renderHero(heroId, C, { w: size, h: size, mode: 'bust' }).toDataURL();
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
