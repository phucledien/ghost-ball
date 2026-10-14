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
// One fractured shoulder on an eight-sided drum, bounded by the unit cylinder.
const BROKEN_CYL8 = CYL8.clone();
for (let i = 0; i < BROKEN_CYL8.attributes.position.count; i++) {
  const p = BROKEN_CYL8.attributes.position;
  if (p.getY(i) > 0) p.setY(i, .5 - Math.max(0, p.getX(i) + p.getZ(i)) * .24);
}
BROKEN_CYL8.computeVertexNormals();
const PEAK5 = new THREE.ConeGeometry(1, 1, 5);

// ── Pitch texture ────────────────────────────────────────────────────────
function paintField(W, D, T, zones) {
  const cw = W * PX, ch = D * PX;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  g.fillStyle = T.ground; g.fillRect(0, 0, cw, ch);
  const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const polygon = (points, color) => {
    g.fillStyle = color; g.beginPath();
    points.forEach(([x,y], i) => i ? g.lineTo(Math.round(x),Math.round(y)) : g.moveTo(Math.round(x),Math.round(y)));
    g.closePath(); g.fill();
  };
  if (T === THEMES.temple) {
    // Large worn slabs and a stepped sand wash. No high-frequency random speckle.
    const tile = PX * 4;
    for (let y = 0; y < ch; y += tile) for (let x = -((y / tile) % 2) * tile / 2; x < cw; x += tile) {
      rect(x, y, tile - 1, tile - 1, ((x / (tile / 2) + y / tile) % 3) ? T.paving : T.speck[0]);
    }
    const e = PX * 2.3;
    polygon([[e+8,e],[cw-e-15,e],[cw-e-15,e+7],[cw-e,e+7],[cw-e,ch-e-12],[cw-e-9,ch-e-12],[cw-e-9,ch-e],[e+15,ch-e],[e+15,ch-e-7],[e,ch-e-7],[e,e+12],[e+8,e+12]],T.ground);
    polygon([[cw*.17,ch*.17],[cw*.73,ch*.17],[cw*.73,ch*.23],[cw*.85,ch*.23],[cw*.85,ch*.66],[cw*.79,ch*.66],[cw*.79,ch*.82],[cw*.25,ch*.82],[cw*.25,ch*.75],[cw*.15,ch*.75],[cw*.15,ch*.35],[cw*.17,ch*.35]],T.sand);
    // A continuous inset belongs to the perimeter, leaving player lanes quiet.
    rect(2,2,cw-4,2,T.inset);rect(2,ch-4,cw-4,2,T.inset);
    rect(2,2,2,ch-4,T.inset);rect(cw-4,2,2,ch-4,T.inset);
  } else if (T === THEMES.egolab) {
    const tile = PX * 6;
    for (let y=0;y<ch;y+=tile) for(let x=0;x<cw;x+=tile) {
      rect(x+1,y+1,tile-2,tile-2,((x+y)/tile)%2 ? T.ground : T.paving);
      // Short recessed panel corner slots, not a bright full-floor grid.
      rect(x+2,y+2,5,1,T.grout);rect(x+2,y+2,1,5,T.grout);
    }
    for(let x=PX*2;x<cw-PX*2;x+=PX*6){rect(x,2,PX*2,2,T.inset);rect(x,ch-4,PX*2,2,T.inset);}
  } else if (T === THEMES.frost) {
    // Packed central snow with broad wind-loaded margins, always inside the pitch.
    for (let x=0;x<cw;x+=PX*4) {
      const depth=PX*(1.4+((x/(PX*4))%3)*.35);
      rect(x,0,PX*4,depth,T.speck[1]);rect(x,ch-depth,PX*4,depth,T.speck[1]);
    }
    rect(0,0,PX*1.4,ch,T.speck[1]);rect(cw-PX*1.4,0,PX*1.4,ch,T.speck[1]);
    // Two deliberately sparse creases in packed snow.
    for (const [u,v] of [[.19,.35],[.72,.66]]) polygon([[cw*u,ch*v],[cw*u+PX*3,ch*v-2],[cw*u+PX*4,ch*v+1],[cw*u+PX*2,ch*v]],T.speck[0]);
  }
  const U = (u) => Math.round(u * PX);
  const toPx = (x, z) => [cw / 2 + x * PX, ch / 2 + z * PX];

  // Terrain zones (under the lines so the pitch markings stay readable)
  for (const q of zones) {
    const cols = T.zone[q.kind] || ['#888'];
    const [x0, y0] = toPx(q.x - q.w / 2, q.z - q.d / 2);
    const w = q.w * PX, h = q.d * PX;
    // The full subdued footprint retains the exact rectangular terrain boundary.
    rect(x0,y0,w,h,cols[0]);
    if (q.kind === 'mud' || q.kind === 'snow' || q.kind === 'grass') {
      // Grouped stepped lobes soften the interior without implying extra collision.
      polygon([[x0+3,y0+5],[x0+w*.35,y0+5],[x0+w*.35,y0+2],[x0+w-5,y0+2],[x0+w-5,y0+h*.45],[x0+w-2,y0+h*.45],[x0+w-2,y0+h-4],[x0+w*.6,y0+h-4],[x0+w*.6,y0+h-2],[x0+5,y0+h-2],[x0+5,y0+h*.65],[x0+2,y0+h*.65],[x0+2,y0+5]],cols[2] || cols[1]);
    }
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
      // Three large reflections read as an ice sheet at the gameplay camera.
      g.fillStyle = cols[1];
      g.fillRect(x0 + 2, y0 + h - 4, w - 4, 2);
      g.fillRect(x0 + w - 4, y0 + 2, 2, h - 6);
      if (T === THEMES.frost) {
        for(const [u,v,flip] of [[.24,.28,1],[.62,.64,-1]]) {
          const x=x0+w*u,y=y0+h*v;
          polygon([[x,y],[x+w*.13,y+flip*3],[x+w*.19,y+flip*2],[x+w*.27,y+flip*8],[x+w*.19,y+flip*4],[x+w*.12,y+flip*5]],cols[1]);
        }
      }
      g.fillStyle = cols[2];
      for (let i = 0; i < 3; i++) {
        const x = Math.round(x0 + w * (.17 + i * .27));
        const y = Math.round(y0 + h * (.27 + (i % 2) * .3));
        g.fillRect(x, y, Math.max(3, Math.round(w * .15)), 1);
        g.fillRect(x - 2, y + 1, 3, 1);
      }
    } else if (q.kind === 'snow' && T === THEMES.frost) {
      g.fillStyle = cols[2];
      g.fillRect(x0 + 2, y0 + h - 3, w - 4, 2);
      g.fillStyle = cols[1];
      g.fillRect(x0 + 3, y0 + 2, w - 6, Math.max(1, h * .3 | 0));
    } else {
      // A few broad contour ridges replace random stipple inside sand and grass.
      for (let i=0;i<3;i++) rect(x0+w*(.13+i*.22),y0+h*(.27+(i%2)*.35),Math.max(3,w*.17),1,cols[1]);
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
      if(T===THEMES.temple){
        const turn = ((Math.round(Math.abs(o.x)+Math.abs(o.z)) % 3)-1)*Math.PI/4;
        B.add(CYL8,O.stoneDark,o.x,.12,o.z,{sx:o.r,sy:.24,sz:o.r,ry:Math.PI/8});
        B.add(CYL8,O.stone,o.x,o.h*.49,o.z,{sx:o.r*.84,sy:o.h*.76,sz:o.r*.84,ry:Math.PI/8});
        B.add(CYL8,O.inset,o.x,.30,o.z,{sx:o.r*.91,sy:.13,sz:o.r*.91,ry:Math.PI/8});
        B.add(CYL8,O.stoneDark,o.x,o.h*.72,o.z,{sx:o.r*.86,sy:.14,sz:o.r*.86,ry:Math.PI/8});
        B.add(CYL8,O.inset,o.x,o.h*.72,o.z,{sx:o.r*.865,sy:.065,sz:o.r*.865,ry:Math.PI/8});
        B.add(BROKEN_CYL8,O.stoneTop,o.x,o.h-.20,o.z,{sx:o.r*.97,sy:.40,sz:o.r*.97,ry:turn});
        // Recessed panels face the four cardinal directions and stay inside the radius.
        for(let k=0;k<4;k++) {
          const a=k*Math.PI/2,rad=o.r*.777;
          B.box(o.r*.32,o.h*.32,.025,O.stoneDark,o.x+Math.sin(a)*rad,o.h*.45,o.z+Math.cos(a)*rad,{ry:a,cast:false});
          B.box(o.r*.11,o.h*.23,.028,O.inset,o.x+Math.sin(a)*rad,o.h*.45,o.z+Math.cos(a)*rad,{ry:a,cast:false});
        }
        break;
      }
      if (T === THEMES.egolab) {
        // A sealed octagonal terminal, fully inside its circular collision radius.
        B.add(CYL8, O.stoneDark, o.x, .10, o.z, { sx: o.r, sy: .20, sz: o.r, ry: Math.PI / 8 });
        B.add(CYL8, O.stone, o.x, o.h / 2, o.z, { sx: o.r * .9, sy: o.h - .20, sz: o.r * .9, ry: Math.PI / 8 });
        B.add(CYL8, O.stoneTop, o.x, o.h - .08, o.z, { sx: o.r, sy: .16, sz: o.r, ry: Math.PI / 8 });
        B.box(o.r * .65, .12, .025, O.light, o.x, o.h * .70, o.z + o.r * .83, { glow: true });
        break;
      }
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
      if (T === THEMES.frost || T === THEMES.temple) {
        B.add(DODECA, O.stoneDark, o.x, o.h * .43, o.z, { sx: o.r * .98, sy: o.h * .48, sz: o.r * .98, ry: Math.PI / 5 });
        B.add(DODECA, O.stoneTop, o.x, o.h * .76, o.z, { sx: o.r * .82, sy: o.h * .24, sz: o.r * .82, ry: Math.PI / 5 });
        break;
      }
      B.add(DODECA, O.stoneDark, o.x, o.h * 0.45, o.z, { sx: o.r, sy: o.h * 0.6, sz: o.r * 0.9, ry: r() * 3 });
      B.add(DODECA, O.stone, o.x - o.r * 0.3, o.h * 0.7, o.z + 0.1, { sx: o.r * 0.6, sy: o.h * 0.4, sz: o.r * 0.6, ry: r() * 3 });
      break;
    case 'tree': {
      if (T === THEMES.frost) {
        // Three overlapping, aligned boughs make one pine silhouette. No random rotation.
        B.add(CYL6, O.trunk, o.x, o.h * .20, o.z, { sx: o.r * .22, sy: o.h * .40, sz: o.r * .22 });
        const tiers = [[.38, .48, 1], [.60, .43, .76], [.81, .38, .50]];
        for (const [y, h, radius] of tiers) {
          B.add(CONE6, y < .5 ? O.leaf2 : O.leaf, o.x, o.h * y, o.z, { sx: o.r * radius, sy: o.h * h, sz: o.r * radius, ry: Math.PI / 6 });
          B.add(CONE6, O.stoneTop, o.x, o.h * (y + h * .24), o.z, { sx: o.r * radius * .52, sy: o.h * h * .52, sz: o.r * radius * .52, ry: Math.PI / 6, cast: false });
        }
        break;
      }
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
      if (T === THEMES.egolab) {
        B.box(o.w, o.h-.12, o.d*.92, O.stoneDark, o.x, (o.h-.12) / 2, o.z);
        B.box(o.w * .82, o.h * .84, o.d, O.stone, o.x, o.h * .5, o.z);
        B.box(o.w, .12, o.d, O.stoneTop, o.x, o.h - .06, o.z, { cast: false });
        B.box(o.w * .50, .09, .015, O.light, o.x, o.h * .76, o.z + o.d / 2 - .0075, { glow: true });
        break;
      }
      if(T===THEMES.temple) {
        const bandY=o.h*.72;
        B.box(o.w,bandY-.05,o.d,O.stone,o.x,(bandY-.05)/2,o.z);
        const upper=o.h-.16-bandY-.05;
        B.box(o.w,upper,o.d,O.stone,o.x,bandY+.05+upper/2,o.z);
      } else B.box(o.w, o.h-.16, o.d, O.stone, o.x, (o.h-.16) / 2, o.z);
      B.box(o.w, 0.16, o.d, O.stoneTop, o.x, o.h - 0.08, o.z, { cast: false });
      B.box(o.w, 0.18, o.d, O.stoneDark, o.x, 0.09, o.z, { cast: false });
      if(T===THEMES.temple) B.box(o.w,.10,o.d,O.inset,o.x,o.h*.72,o.z,{cast:false});
      break;
    }
    case 'low': {
      if(T===THEMES.temple){
        const bandY=o.h*.65,bandH=.07;
        B.box(o.w,bandY-bandH/2,o.d,O.stone,o.x,(bandY-bandH/2)/2,o.z);
        const upper=o.h-.10-bandY-bandH/2;
        B.box(o.w,upper,o.d,O.stone,o.x,bandY+bandH/2+upper/2,o.z);
        B.box(o.w,.10,o.d,O.stoneTop,o.x,o.h-.05,o.z,{cast:false});
        B.box(o.w,.07,o.d,O.stoneDark,o.x,.035,o.z,{cast:false});
        B.box(o.w,.07,o.d,O.inset,o.x,o.h*.65,o.z,{cast:false});
        // Inlaid joints, not alternating-height checkerboard blocks.
        const along=o.w>=o.d,n=Math.max(1,Math.round(Math.max(o.w,o.d)/.95));
        for(let i=1;i<n;i++){
          const u=i/n-.5;
          B.box(along?.026:o.w,o.h-.15,along?o.d:.026,O.stoneDark,o.x+(along?u*o.w:0),o.h*.48,o.z+(along?0:u*o.d),{cast:false});
        }
        break;
      }
      if (T === THEMES.egolab) {
        B.box(o.w, o.h, o.d, O.stoneDark, o.x, o.h / 2, o.z);
        B.box(o.w, .10, o.d, O.stoneTop, o.x, o.h - .05, o.z, { cast: false });
        const along = o.w >= o.d;
        B.box(along ? o.w * .60 : .07, .012, along ? .07 : o.d * .60, O.light, o.x, o.h - .006, o.z, { glow: true });
        break;
      }
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
      if (T === THEMES.egolab) {
        B.box(o.w*.88, o.h-.12, o.d*.88, O.crateTrim, o.x, (o.h-.12) / 2, o.z);
        for(const a of [-1,1])for(const b of [-1,1]) B.box(o.w*.06,o.h-.12,o.d*.06,O.crateTrim,o.x+a*o.w*.47,(o.h-.12)/2,o.z+b*o.d*.47);
        B.box(o.w * .88, o.h * .72, o.d, O.crate, o.x, o.h * .50, o.z);
        B.box(o.w, o.h * .72, o.d * .88, O.crate, o.x, o.h * .50, o.z);
        B.box(o.w, .12, o.d, O.stoneTop, o.x, o.h - .06, o.z, { cast: false });
        // A single inset status strip on two faces, rather than a neon outline.
        B.box(o.w * .38, .08, .012, O.light, o.x, o.h * .66, o.z + o.d / 2 - .006, { glow: true });
        B.box(.012, .08, o.d * .38, O.light, o.x + o.w / 2 - .006, o.h * .66, o.z, { glow: true });
        break;
      }
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
      B.box(o.w, o.h-.12, o.d*.90, O.stoneDark, o.x, (o.h-.12) / 2, o.z);
      B.box(o.w * .88, o.h-.24, o.d, c, o.x, o.h*.5, o.z);
      B.box(o.w, .12, o.d, O.stoneTop, o.x, o.h - .06, o.z, { cast: false });
      B.box(.07, o.h * .45, .012, '#d4eaf2', o.x - o.w * .18, o.h * .60, o.z + o.d / 2 - .006, { cast: false });
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
    const n = Math.round(q.w * q.d * (T===THEMES.temple?.65:2.6));
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.3), z = q.z + (r() - 0.5) * (q.d - 0.3);
      const h = T===THEMES.temple ? .40+r()*.38 : .55+r()*.5;
      if(T===THEMES.temple){
        // Three broad blades make one readable clump, with visible gaps between clumps.
        for(let blade=-1;blade<=1;blade++)B.box(.10,h*(blade===0?1:.72),.11,cols[blade+1],x+blade*.12,h*(blade===0?.5:.36),z,{rz:-blade*.20,ry:.35,cast:false});
        continue;
      }
      B.add(CONE6, cols[(r() * cols.length) | 0], x, h / 2, z, { sx: 0.16, sy: h, sz: 0.16, ry: r() * 3, rx: (r() - 0.5) * 0.3, cast: false });
    }
  } else if (q.kind === 'snow') {
    if (T === THEMES.frost) {
      // Four broad shallow drifts; clear gaps reveal the zone footprint underneath.
      for (const [u, v, size] of [[-.27, -.24, .8], [.22, -.18, 1], [-.18, .24, 1], [.29, .26, .65]]) {
        B.add(DODECA, T.zone.snow[1], q.x + u * q.w, .03, q.z + v * q.d, {
          sx: q.w * .22 * size, sy: .15 * size, sz: q.d * .24 * size, ry: Math.PI / 6, cast: false,
        });
      }
      return;
    }
    const n = Math.round(q.w * q.d * 0.5);
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.6), z = q.z + (r() - 0.5) * (q.d - 0.6);
      B.add(DODECA, T.zone.snow[(r() * T.zone.snow.length) | 0], x, 0.05, z, { sx: 0.35 + r() * 0.3, sy: 0.18 + r() * 0.12, sz: 0.35 + r() * 0.3, ry: r() * 3, cast: false });
    }
  } else if (q.kind === 'mud') {
    const n = Math.max(2,Math.round(q.w * q.d * .10));
    for (let i = 0; i < n; i++) {
      const x = q.x + (r() - 0.5) * (q.w - 0.6), z = q.z + (r() - 0.5) * (q.d - 0.6);
      B.add(DODECA, T.zone.mud[(r() * T.zone.mud.length) | 0], x, 0.02, z, { sx: 0.6 + r() * 0.3, sy: 0.055, sz: 0.35 + r() * 0.3, ry: r() * 3, cast: false });
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

// Architectural identity sits outside the playable rectangle. It shares the
// existing static batches and casts no shadow into the playable court.
function dressPerimeter(B, T, W, D) {
  const far = -D / 2 - 8.6, O = T.obs;
  const flat = { cast: false };
  if (T === THEMES.temple) {
    // A tiered sandstone entry gate, its negative space framing a teal sun seal.
    B.box(12.6,4.5,4.8,T.plinth,0,.45,far,flat);
    B.box(12,.45,4.4,O.stoneDark,0,2.7,far,flat);
    for(const side of [-1,1]) {
      const x=side*4.3;
      B.box(2.1,5.2,2.1,O.stone,x,5.5,far,flat);
      B.box(2.5,.38,2.5,O.stoneTop,x,3.05,far,flat);
      B.box(2.5,.40,2.5,O.stoneTop,x,8.05,far,flat);
      B.box(2.12,.32,2.12,O.inset,x,6.65,far,flat);
      B.box(.9,2.7,.10,O.stoneDark,x,5.45,far+1.06,flat);
      B.box(.40,2.25,.12,O.inset,x,5.45,far+1.07,flat);
    }
    B.box(11.6,.70,2.8,O.stoneTop,0,8.50,far,flat);
    B.box(10.4,.22,2.55,O.inset,0,8.06,far,flat);
    B.box(9.4,.45,2.2,O.stone,0,9.05,far,flat);
    B.add(CYL8,O.inset,0,8.55,far+1.43,{sx:1.02,sy:.14,sz:1.02,rx:Math.PI/2,cast:false});
    B.add(CYL8,O.stoneTop,0,8.55,far+1.52,{sx:.52,sy:.09,sz:.52,rx:Math.PI/2,cast:false});
    // Fixed heraldic cloth, two broad tails; no animated geometry or bright foreground props.
    for(const side of [-1,1]) {
      const x=side*(W*.34),z=-D/2-2.05;
      B.box(.17,4.4,.17,T.post,x,2.2,z,flat);
      B.box(1.7,.12,.12,O.stoneTop,x,4.25,z,flat);
      B.box(1.35,2.1,.07,O.inset,x,3.12,z,flat);
      B.box(.53,.36,.07,O.inset,x-.41,1.89,z,flat);
      B.box(.53,.36,.07,O.inset,x+.41,1.89,z,flat);
      B.box(.15,1.28,.08,O.stoneTop,x,3.12,z+.01,flat);
      B.box(.72,.16,.08,O.stoneTop,x,3.12,z+.015,flat);
    }
  } else if(T===THEMES.egolab) {
    // A modular technical gantry, with only small status panels emitting light.
    const span=W*.86,height=7.1;
    for(const x of [-span/2,0,span/2]) {
      B.box(.75,height,1.1,O.stoneDark,x,height/2,far,flat);
      B.box(1.4,.40,1.6,O.stone,x,.20,far,flat);
      B.box(.16,3,.13,O.stoneTop,x,height*.62,far+.59,flat);
    }
    B.box(span+1.6,.75,1.4,O.stoneDark,0,height,far,flat);
    B.box(span+1.6,.18,1.5,O.stoneTop,0,height+.43,far,flat);
    for(let i=-2;i<=2;i++) {
      const x=i*span/5;
      B.box(span/5-.4,1.8,.45,O.stoneDark,x,height-1.2,far,flat);
      B.box(span/5-.8,1.30,.08,T.ground,x,height-1.2,far+.26,flat);
      B.box(span/5-1.4,.09,.09,O.light,x,height-.70,far+.31,{glow:true});
      for(let k=0;k<3;k++)B.box(.15,.42+k*.12,.10,O.stoneTop,x-.55+k*.45,height-1.35,far+.31,flat);
    }
    // Low service rails only on the far perimeter, never inside the playing rectangle.
    B.box(W,.16,.22,O.stoneDark,0,1.6,-D/2-1.7,flat);
    for(let x=-W/2;x<=W/2;x+=5.5)B.box(.14,1.6,.14,O.stone,x,.8,-D/2-1.7,flat);
  } else if(T===THEMES.frost) {
    // Three large, faceted alpine masses beyond the stands. Snow stays in broad caps.
    for(const [u,h,width] of [[-.38,10,9],[.02,14,11],[.39,9,8]]) {
      const x=W*u,z=far-6;
      B.add(DODECA,T.rock,x,-2.4,z,{sx:width*1.1,sy:4,sz:width*.7,ry:.35,cast:false});
      B.add(PEAK5,T.rock,x,1.5,z,{sx:width,sy:h,sz:width*.68,ry:Math.PI/4,cast:false});
      B.add(PEAK5,O.stoneTop,x,1.5+h*.34,z,{sx:width*.32,sy:h*.32,sz:width*.68*.32,ry:Math.PI/4,cast:false});
    }
    // Broad snow shoulders behind the playable curb, not scatter across the foreground.
    for(let x=-W/2;x<=W/2;x+=6)B.add(DODECA,T.speck[1],x,.15,-D/2-1.5,{sx:2.3,sy:.38,sz:.7,ry:.4,cast:false});
    for(const side of [-1,1]) {
      const x=side*W*.36,z=-D/2-2.1;
      B.box(.14,3.8,.14,T.post,x,1.9,z,flat);
      B.box(1.35,1.7,.06,O.leaf2,x,2.65,z,flat);
      B.box(.16,1.25,.08,O.stoneTop,x,2.65,z+.01,flat);
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
    if (T === THEMES.egolab) {
      // Engineered foundation bays, all below the pitch and outside gameplay bounds.
      for (let x = -W / 2; x <= W / 2; x += 6) B.box(1, 3.5, D + M * 2 + .8, T.rock, x, -2.3, 0, { cast: false });
      for (let z = -D / 2; z <= D / 2; z += 6) B.box(W + M * 2 + .8, 3.5, 1, T.rock, 0, -2.3, z, { cast: false });
    }
    if(T !== THEMES.egolab) {
      // Interlocking cliff columns share the arena footprint instead of scattered floating cubes.
      const cliff = (x,z,i) => {
        const height=5+(i%3)*1.5;
        B.add(CYL6,i%3===0?T.plinth:T.rock,x,-.48-height/2-(i%3)*.10,z,{sx:2.7,sy:height,sz:2.5,ry:Math.PI/6+(i%3)*.025,cast:false});
      };
      let i=0;
      for(let x=-W/2;x<=W/2;x+=4.6){cliff(x,D/2+M-.5,i++);cliff(x,-D/2-M+.5,i++);}
      for(let z=-D/2+3;z<D/2;z+=4.6){cliff(W/2+M-.5,z,i++);cliff(-W/2-M+.5,z,i++);}
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
        if (T === THEMES.egolab) {
          B.box(.22, 1.0, .22, T.post, x, .5, z);
          B.box(.55, .18, .32, T.obs.stone, x, 1.05, z);
          B.box(.40, .07, .34, T.obs.light, x, 1.06, z, { glow: true });
          return;
        }
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
        if (T === THEMES.egolab) {
          const p = a.clone().lerp(b, .5), alongX = Math.abs(a.x - b.x) > .01;
          B.box(alongX ? Math.abs(b.x - a.x) : .20, .20, alongX ? .20 : Math.abs(b.z - a.z), T.post, p.x, p.y, p.z);
          B.box(alongX ? 1.8 : .36, .18, alongX ? .36 : 1.8, T.obs.light, p.x, p.y - .12, p.z, { glow: true });
          return;
        }
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

    dressPerimeter(B, T, W, D);
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

