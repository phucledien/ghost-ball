// Faceted, animated item effects. Four draws per aura; all buffers are reused.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ITEM_FX_COLORS = {
  cleats: '#79ed89', shield: '#70caff', magnet: '#ff78ce',
  cloak: '#b5a0ff', freeze: '#9cf5ff', overclock: '#ffc759',
};

const turn = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
function material(color, opacity = 1, vertexColors = false) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
    side: THREE.DoubleSide, vertexColors });
}
function bar(parts, x, y, z, w, h, d, angle = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(angle); g.translate(x, y, z); parts.push(g);
}
function merged(parts) {
  const g = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return g;
}
function disposeGroup(group) {
  group.removeFromParent();
  group.traverse(node => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
    else node.material?.dispose();
    if (node.isInstancedMesh) node.dispose();
  });
}
function timerRing(color, radius = .84) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .028, .065), material(color, .8), 16);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) {
    const a = i * turn / 16;
    matrix.makeRotationY(-a); matrix.setPosition(Math.cos(a) * radius, .035, Math.sin(a) * radius);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
  return mesh;
}
function crystalGeometry() {
  const g = new THREE.OctahedronGeometry(1, 0);
  const colors = new Float32Array(g.attributes.position.count * 3);
  // Flat, deliberately different facets survive the game's low-resolution pass.
  for (let i = 0; i < g.attributes.position.count; i++) {
    const shade = [.45, .76, 1, .62, .86, .52, .94, .7][Math.floor(i / 3) % 8];
    colors.set([shade, shade, shade], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
function crystals(color, count) {
  const mesh = new THREE.InstancedMesh(crystalGeometry(), material(color, .92, true), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
  return mesh;
}

// A strip has a colored silhouette and a thin bright core in the same draw call.
// Coarse segments are intentional: angular wind, not a soft glow particle cloud.
function ribbons(color, count, segments = 12) {
  const positions = new Float32Array(count * segments * 12 * 3);
  const colors = new Float32Array(positions.length);
  const base = new THREE.Color(color), core = base.clone().lerp(new THREE.Color('#ffffff'), .80);
  for (let strip = 0; strip < count; strip++) for (let n = 0; n < segments; n++) for (let layer = 0; layer < 2; layer++) {
    const c = layer ? core : base;
    for (let v = 0; v < 6; v++) colors.set([c.r, c.g, c.b], ((strip * segments + n) * 12 + layer * 6 + v) * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, material('#ffffff', .92, true)); mesh.frustumCulled = false;
  const points = Array.from({ length: count }, () => Array.from({ length: segments + 1 }, () => ({ x: 0, y: 0, z: 0, width: 0 })));
  return {
    mesh, points,
    write(vertical = false) {
      let offset = 0;
      for (const row of points) for (let n = 0; n < segments; n++) {
        const a = row[n], b = row[n + 1];
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
        const nx = vertical ? 0 : -dz / length, ny = vertical ? 1 : 0, nz = vertical ? 0 : dx / length;
        for (let layer = 0; layer < 2; layer++) {
          const weight = layer ? .24 : 1;
          const aw = a.width * weight, bw = b.width * weight;
          const ax = a.x - nx * aw, ay = a.y - ny * aw, az = a.z - nz * aw;
          const bx = a.x + nx * aw, by = a.y + ny * aw, bz = a.z + nz * aw;
          const cx = b.x - nx * bw, cy = b.y - ny * bw, cz = b.z - nz * bw;
          const dx2 = b.x + nx * bw, dy = b.y + ny * bw, dz2 = b.z + nz * bw;
          positions[offset++] = ax; positions[offset++] = ay; positions[offset++] = az;
          positions[offset++] = bx; positions[offset++] = by; positions[offset++] = bz;
          positions[offset++] = cx; positions[offset++] = cy; positions[offset++] = cz;
          positions[offset++] = bx; positions[offset++] = by; positions[offset++] = bz;
          positions[offset++] = dx2; positions[offset++] = dy; positions[offset++] = dz2;
          positions[offset++] = cx; positions[offset++] = cy; positions[offset++] = cz;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
function envelope(age, remaining, duration) {
  const inTime = clamp(age / .22, 0, 1);
  // Actual simulation time drives the fade and ring, including freeze refreshes.
  const outTime = duration > 0 ? clamp(remaining / .28, 0, 1) : 1;
  return { enter: 1 - (1 - inTime) ** 3, fade: outTime,
    fraction: duration > 0 ? clamp(remaining / duration, 0, 1) : 1 };
}

export function makeItemAura(id, colorOverride = null) {
  const group = new THREE.Group(); group.userData.itemEffect = id;
  const color = colorOverride || ITEM_FX_COLORS[id] || '#ffffff';
  const parts = [];
  if (id === 'magnet') {
    // The held-item identity stays above the head while energy flows into it.
    bar(parts, -.19, 2.61, 0, .12, .34, .11); bar(parts, .19, 2.61, 0, .12, .34, .11);
    bar(parts, 0, 2.46, 0, .38, .12, .11);
  } else if (id === 'cleats') {
    for (const side of [-1, 1]) for (let n = 0; n < 2; n++) {
      bar(parts, side * .32 - .08, .13, -.12 - n * .22, .07, .06, .22, -.7);
      bar(parts, side * .32 + .08, .13, -.12 - n * .22, .07, .06, .22, .7);
    }
  } else if (id === 'freeze') {
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.BoxGeometry(.045, .40, .06);
      spoke.rotateZ(i * Math.PI / 3); spoke.translate(0, 2.64, 0); parts.push(spoke);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const a = i * turn / 4 + Math.PI / 4;
      bar(parts, Math.cos(a) * .65, .06, Math.sin(a) * .65, .22, .025, .045, -a);
    }
  }
  const symbol = new THREE.Mesh(merged(parts), material(color)); group.add(symbol);
  const timer = timerRing(color); group.add(timer);
  const flow = ribbons(color, id === 'cloak' ? 3 : 2); group.add(flow.mesh);
  const shardCount = id === 'freeze' ? 10 : 8;
  const shards = crystals(color, shardCount); group.add(shards);
  const transform = new THREE.Object3D();
  let age = 0, disposed = false;
  function update(dt, remaining, duration) {
    if (disposed) return;
    age += Math.max(0, dt || 0);
    const { enter, fade, fraction } = envelope(age, remaining, duration);
    timer.count = Math.ceil(16 * fraction);
    timer.material.opacity = .85 * Math.min(1, fade * 2);
    symbol.material.opacity = .95 * fade;
    symbol.scale.setScalar(.72 + .28 * enter);
    if (id === 'magnet') symbol.position.y = Math.sin(age * 3.6) * .065;
    flow.mesh.material.opacity = (id === 'cloak' ? .50 : .88) * enter * fade;
    shards.material.opacity = (id === 'cloak' ? .55 : .92) * fade;
    for (let strip = 0; strip < flow.points.length; strip++) {
      const row = flow.points[strip];
      for (let n = 0; n < row.length; n++) {
        const t = n / (row.length - 1), p = row[n];
        if (id === 'cleats') {
          const side = strip ? 1 : -1;
          p.x = side * (.32 + t * .24) + Math.sin(t * 9 - age * 13 + strip * 2) * .11 * t;
          p.y = .14 + t * .38 + Math.sin(t * 11 - age * 12) * .07 * t;
          p.z = -.10 - t * (1.25 + .20 * Math.sin(age * 7 + strip));
          p.width = .095 * (1 - t) ** .7 * enter;
        } else if (id === 'magnet') {
          const a = age * 3.8 + t * turn * .65 + strip * Math.PI;
          const r = .77 * (1 - t) + .16;
          p.x = Math.cos(a) * r; p.z = Math.sin(a) * r;
          p.y = .45 + t * 2.04; p.width = .052 * Math.sin(t * Math.PI) * enter;
        } else {
          const frost = id === 'freeze';
          const a = (frost ? -3.0 : 1.8) * age + t * turn * .62 + strip * turn / flow.points.length;
          const r = (frost ? .63 : .67) + Math.sin(t * 6 - age * 3 + strip) * .08;
          p.x = Math.cos(a) * r; p.z = Math.sin(a) * r;
          p.y = frost ? .10 + Math.sin(t * Math.PI) * .16 : .2 + t * 1.5 + Math.sin(age * 2 + strip) * .08;
          p.width = (frost ? .095 : .055) * Math.sin(t * Math.PI) * enter;
        }
      }
    }
    flow.write(id === 'cleats');
    for (let i = 0; i < shardCount; i++) {
      const seed = i / shardCount, a = seed * turn;
      let x, y, z, width, height;
      if (id === 'freeze') {
        const rise = clamp((age - (i % 4) * .035) / .15, 0, 1);
        const r = .55 + (i % 2) * .16;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        height = (.20 + (i % 3) * .10) * rise * (.7 + .3 * fade);
        y = height * .77 + Math.sin(age * 4 + i) * .025;
        width = .10 + (i % 2) * .035;
        transform.rotation.set(Math.cos(a) * .23, a + age * .15, -Math.sin(a) * .23);
      } else if (id === 'cleats') {
        const travel = (age * 2.4 + seed) % 1;
        x = (i % 2 ? 1 : -1) * (.32 + travel * .35); z = -.05 - travel * 1.65;
        y = .16 + Math.sin(travel * Math.PI) * .25;
        width = .045 * (1 - travel); height = width * 2;
        transform.rotation.set(.8, a, age * 4 + i);
      } else {
        const orbit = a + age * (id === 'magnet' ? 3 : -.9);
        const travel = (age * .5 + seed) % 1;
        const r = id === 'magnet' ? .78 * (1 - travel) + .12 : .68;
        x = Math.cos(orbit) * r; z = Math.sin(orbit) * r;
        y = id === 'magnet' ? .25 + travel * 2.30 : .18 + travel * 1.9;
        width = .045 * Math.sin(travel * Math.PI); height = width * 2.6;
        transform.rotation.set(0, orbit, Math.sin(age * 3 + i) * .4);
      }
      transform.position.set(x, y, z); transform.scale.set(width * enter, height * enter, width * enter);
      transform.updateMatrix(); shards.setMatrixAt(i, transform.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
  }
  update(0, 1, 1);
  return { group, update, dispose() { if (!disposed) { disposed = true; disposeGroup(group); } } };
}

export function makeShieldArt(color, radius) {
  const mesh = new THREE.Group(); mesh.userData.itemEffect = 'shield';
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), material(color, .045)); mesh.add(shell);
  const petals = crystals(color, 12); mesh.add(petals);
  const flow = ribbons(color, 3, 14); mesh.add(flow.mesh);
  const timer = timerRing(color, radius * .78); timer.position.y = -.90; mesh.add(timer);
  const transform = new THREE.Object3D();
  let age = 0, disposed = false;
  function update(remaining, duration, dt = 0) {
    if (disposed) return;
    age += Math.max(0, dt || 0);
    const { enter, fade, fraction } = envelope(age, remaining, duration);
    shell.scale.setScalar(.55 + .45 * enter);
    shell.material.opacity = (.035 + .012 * Math.sin(age * 4)) * enter * fade;
    timer.count = Math.ceil(16 * fraction); timer.material.opacity = .85 * Math.min(1, fade * 2);
    petals.material.opacity = (.50 + .12 * Math.sin(age * 3)) * fade;
    flow.mesh.material.opacity = .90 * enter * fade;
    for (let i = 0; i < 12; i++) {
      const a = i * turn / 6 + (i >= 6 ? Math.PI / 6 : 0) + age * .12;
      const assemble = clamp((age - (i % 6) * .022) / .22, 0, 1);
      const upper = i >= 6;
      const r = radius * (upper ? .74 : .91) * (.7 + .3 * assemble + (1 - fade) * .20);
      const y = radius * (upper ? .58 : -.22) - (1 - assemble) * radius * .8;
      transform.position.set(Math.cos(a) * r, y + Math.sin(age * 2.2 + i) * .025, Math.sin(a) * r);
      transform.rotation.set(Math.sin(a) * (upper ? -.45 : .18), a, -Math.cos(a) * (upper ? -.45 : .18));
      transform.scale.set(radius * .20 * assemble, radius * (upper ? .35 : .42) * assemble, radius * .045);
      transform.updateMatrix(); petals.setMatrixAt(i, transform.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    for (let strip = 0; strip < flow.points.length; strip++) {
      const row = flow.points[strip], tilt = strip === 0 ? .10 : (strip === 1 ? .62 : -.55);
      for (let n = 0; n < row.length; n++) {
        const t = n / (row.length - 1), a = t * turn * .74 + age * (strip % 2 ? -1.6 : 1.9) + strip * 2;
        const p = row[n], r = radius * (1.02 + (1 - fade) * .14);
        const z = Math.sin(a) * r;
        p.x = Math.cos(a) * r; p.y = z * Math.sin(tilt); p.z = z * Math.cos(tilt);
        p.width = (.025 + .018 * Math.sin(t * Math.PI)) * Math.sin(t * Math.PI) * enter;
      }
    }
    flow.write();
  }
  update(1, 1, 0);
  return { mesh, update, dispose() { if (!disposed) { disposed = true; disposeGroup(mesh); } } };
}
