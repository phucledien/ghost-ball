// Ball, item crates, markers.
import * as THREE from 'three';
import { ITEMS } from '../game/items.js';

// Low-poly football: icosphere with "pentagon" faces tinted dark.
export function buildBall(radius = 0.32) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const colors = [];
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const verts = [];
  for (let i = 0; i < ico.attributes.position.count; i++) verts.push(new THREE.Vector3().fromBufferAttribute(ico.attributes.position, i).normalize());
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const n = a.clone().add(b).add(c).normalize();
    const dark = verts.some((v) => v.dot(n) > 0.94);
    const col = dark ? [0.09, 0.09, 0.13] : [0.96, 0.94, 0.9];
    for (let k = 0; k < 3; k++) colors.push(...col);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: '#000000' });
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.setScalar(radius);
  mesh.castShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.mesh = mesh;
  // Danger ring on the ground under the ball
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, opacity: 0, depthWrite: false }));
  ring.position.y = 0.03;
  g.userData.ring = ring;
  return g;
}

export function buildItemCrate(id) {
  const it = ITEMS[id];
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: it.color }));
  box.castShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.54), new THREE.MeshLambertMaterial({ color: '#f3e9d2' }));
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.56), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const core2 = core.clone();
  core2.rotation.y = Math.PI / 2;
  const spin = new THREE.Group();
  spin.add(box, band, core, core2);
  spin.position.y = 0.6;
  g.add(spin);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.y = 0.03;
  g.add(ring);
  g.userData.spin = spin;
  g.userData.ring = ring;
  return g;
}

// Player marker ring + "IT" arrow
export function buildMarker(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.position.y = 0.025;
  g.add(ring);
  return g;
}

export function buildArrow(color = '#ff4a4a') {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const sizes = [[0.5, 0.12], [0.34, 0.12], [0.18, 0.12]];
  sizes.forEach(([w, h], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), m);
    b.position.y = -i * 0.12;
    g.add(b);
  });
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.12), m);
  stem.position.y = 0.18;
  g.add(stem);
  return g;
}
