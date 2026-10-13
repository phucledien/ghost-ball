// Renderer + isometric orthographic camera + pixelation.
// Pixel look: render at (w / pixelScale, h / pixelScale) and upscale the
// canvas with `image-rendering: pixelated`. One tunable, no post pipeline.
import * as THREE from 'three';
import { THEMES } from './themes.js';

const DEG = Math.PI / 180;

export class Stage {
  constructor(container, C, opts = {}) {
    this.C = C;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: !!opts.preserve });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const cv = this.renderer.domElement;
    cv.className = 'stage-canvas';
    Object.assign(cv.style, { width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' });
    container.appendChild(cv);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.target = new THREE.Vector3();
    this.view = 'game'; // game | side | front | top | orbit
    this.orbitT = 0;
    this.zoomMul = 1;
    this.trauma = 0;
    this.punch = 0;
    this.pixelOverride = null;
    this.snap = opts.snap ?? true;

    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.flashEl = document.createElement('div');
    Object.assign(this.flashEl.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', mixBlendMode: 'screen' });
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(this.flashEl);
    this.flashT = 0;
    this.flashPeak = 0;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  applyTheme(themeId, W = 26, D = 16) {
    const T = THEMES[themeId] || THEMES.temple;
    this.scene.background = new THREE.Color(T.sky);
    this.hemi.color.set(T.ambSky);
    this.hemi.groundColor.set(T.ambGround);
    this.sun.color.set(T.sun);
    const [x, y, z] = T.sunDir;
    this.sunDir = new THREE.Vector3(x, y, z).normalize();
    const s = Math.max(W, D) * 0.75 + 6;
    const sc = this.sun.shadow.camera;
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.5; sc.far = 120;
    sc.updateProjectionMatrix();
  }

  get pixelScale() {
    return this.pixelOverride ?? this.C('render.pixelScale');
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const ps = this.pixelScale;
    this.lowW = Math.max(1, Math.floor(w / ps));
    this.lowH = Math.max(1, Math.floor(h / ps));
    this.renderer.setSize(this.lowW, this.lowH, false);
    this.aspect = w / h;
    this._ps = ps;
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  zoomPunch(amount) { this.punch = Math.min(0.3, this.punch + amount); }

  flash(color = '#ffffff', strength = 1, time = 0.18) {
    const s = strength * this.C('fx.flash');
    if (s <= 0) return;
    this.flashEl.style.background = color;
    this.flashPeak = s;
    this.flashT = time;
    this.flashDur = time;
  }

  // Camera angles for each editor view
  angles() {
    const C = this.C;
    switch (this.view) {
      case 'side': return { pitch: 4, yaw: 90 };
      case 'front': return { pitch: 4, yaw: 0 };
      case 'top': return { pitch: 89.5, yaw: 0 };
      case 'orbit': return { pitch: C('camera.pitch'), yaw: C('camera.yaw') + this.orbitT * 25 };
      default: return { pitch: C('camera.pitch'), yaw: C('camera.yaw') };
    }
  }

  update(dt) {
    if (this._ps !== this.pixelScale) this.resize();
    this.orbitT += dt;
    const C = this.C;
    const { pitch, yaw } = this.angles();
    const p = pitch * DEG, y = yaw * DEG;
    const dir = new THREE.Vector3(Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y));
    const fit = this.aspect < 1 ? Math.pow(1 / this.aspect, 0.45) : 1; // see more pitch on tall screens
    const zoom = C('camera.zoom') * this.zoomMul * fit * (1 - this.punch);
    this.punch = Math.max(0, this.punch - dt * 1.2);
    const cam = this.camera;
    cam.top = zoom; cam.bottom = -zoom; cam.left = -zoom * this.aspect; cam.right = zoom * this.aspect;
    cam.updateProjectionMatrix();

    const t = this.target.clone();
    // Shake (trauma²) in screen space
    const shakeAmt = this.trauma * this.trauma * C('fx.shake') * 0.6;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    cam.position.copy(t).addScaledVector(dir, 60);
    cam.up.set(0, 1, 0);
    if (pitch > 89) cam.up.set(-Math.sin(y), 0, -Math.cos(y));
    cam.lookAt(t);
    cam.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    if (shakeAmt > 0) {
      const k = performance.now() / 1000;
      cam.position.addScaledVector(right, Math.sin(k * 71) * shakeAmt).addScaledVector(up, Math.cos(k * 53) * shakeAmt);
    }
    // Snap to the texel grid so pixels don't shimmer as the camera glides
    if (this.snap && this.view !== 'orbit') {
      const texel = (2 * zoom) / this.lowH;
      const pr = cam.position.dot(right), pu = cam.position.dot(up);
      cam.position.addScaledVector(right, Math.round(pr / texel) * texel - pr).addScaledVector(up, Math.round(pu / texel) * texel - pu);
    }
    cam.updateMatrixWorld();

    // Sun follows the target so the shadow map stays tight
    const sd = this.sunDir || new THREE.Vector3(-0.5, 1, 0.4).normalize();
    this.sun.position.copy(t).addScaledVector(sd, 40);
    this.sun.target.position.copy(t);
    this.sun.intensity = C('render.sun');
    this.hemi.intensity = C('render.ambient');
    this.renderer.shadowMap.enabled = C('render.shadows');

    const cv = this.renderer.domElement;
    const filter = `saturate(${C('render.saturate')}) contrast(${C('render.contrast')})${this.extraFilter ? ' ' + this.extraFilter : ''}`;
    if (cv.style.filter !== filter) cv.style.filter = filter;

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashEl.style.opacity = String(Math.max(0, (this.flashT / this.flashDur) * this.flashPeak));
    } else if (this.flashEl.style.opacity !== '0') this.flashEl.style.opacity = '0';
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // World → container CSS pixels (for DOM labels)
  toScreen(v, out = { x: 0, y: 0, visible: true }) {
    const p = v.clone().project(this.camera);
    out.x = (p.x * 0.5 + 0.5) * this.container.clientWidth;
    out.y = (-p.y * 0.5 + 0.5) * this.container.clientHeight;
    out.visible = p.z < 1 && p.z > -1;
    return out;
  }

  // Container CSS pixels → ground plane point (y = 0)
  toGround(x, y) {
    const ndc = new THREE.Vector2((x / this.container.clientWidth) * 2 - 1, -(y / this.container.clientHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
    return hit;
  }

  dispose() {
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.flashEl.remove();
  }
}
