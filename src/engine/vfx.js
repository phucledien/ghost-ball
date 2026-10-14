// VFX: instanced voxel particles (solid + additive glow), ground rings,
// beams, afterimages and a few persistent effect meshes (walls, shields).
import * as THREE from 'three';
import {makeSpellArt,makeBallWake} from './spell-art.js';
import {SKILL_ART} from './skill-art.js';
import { ghostClone, voxelsOf } from './hero-model.js';
import { makeItemAura, makeShieldArt, ITEM_FX_COLORS } from './item-art.js';

const MAX = 2600;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

class Pool {
  constructor(scene, material, castShadow) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = castShadow;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.set('#fff'));
    scene.add(this.mesh);
    this.p = [];
  }
  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push(o);
  }
  update(dt) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      o.life -= dt;
      if (o.life <= 0) continue;
      o.vy -= o.g * dt;
      const d = Math.exp(-o.drag * dt);
      o.vx *= d; o.vy *= o.g ? 1 : d; o.vz *= d;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.floor && o.y < o.size * 0.5) {
        o.y = o.size * 0.5;
        o.vy = Math.abs(o.vy) * 0.35;
        o.vx *= 0.6; o.vz *= 0.6;
        o.spin *= 0.5;
      }
      o.rot += o.spin * dt;
      arr[w++] = o;
    }
    arr.length = w;
    const m = this.mesh;
    for (let i = 0; i < w; i++) {
      const o = arr[i];
      const k = o.life / o.max;
      const sz = o.size1 + (o.size - o.size1) * (o.shrinkLate ? Math.min(1, k * 3) : k);
      _e.set(o.rot, o.rot * 0.7, 0);
      _q.setFromEuler(_e);
      _s.set(sz * (o.sx || 1), sz * (o.sy || 1), sz * (o.sz || 1));
      _p.set(o.x, o.y, o.z);
      _m.compose(_p, _q, _s);
      m.setMatrixAt(i, _m);
      m.setColorAt(i, _c.set(o.color));
    }
    m.count = w;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  clear() { this.p.length = 0; this.mesh.count = 0; }
}

export class VFX {
  constructor(scene, C) {
    this.scene = scene;
    this.C = C;
    this.solid = new Pool(scene, new THREE.MeshLambertMaterial(), true);
    this.glow = new Pool(scene, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), false);
    this.items = []; // timed meshes: rings, beams, ghosts
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 28, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 24);
    this.discGeo.rotateX(-Math.PI / 2);
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.enabledSmears = true;
    this.itemEffects = new Map();
    this.persistentShields = new Set();
  }

  get mult() { return this.C('fx.particles'); }

  // ── Particles ──────────────────────────────────────────────────────────
  burst(pos, o = {}) {
    const n = Math.round((o.count ?? 16) * this.mult);
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    const pool = o.glow ? this.glow : this.solid;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 6) * (0.4 + Math.random() * 0.8);
      const up = (o.up ?? 4) * (0.5 + Math.random());
      let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp;
      if (o.dir) {
        const spread = o.spread ?? 0.5;
        const da = Math.atan2(o.dir.z, o.dir.x) + (Math.random() - 0.5) * spread * 2;
        vx = Math.cos(da) * sp; vz = Math.sin(da) * sp;
      }
      const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.7);
      pool.add({
        x: pos.x + (Math.random() - 0.5) * (o.jitter ?? 0.2), y: pos.y + (Math.random() - 0.5) * (o.jitter ?? 0.2), z: pos.z + (Math.random() - 0.5) * (o.jitter ?? 0.2),
        vx, vy: up, vz, g: o.gravity ?? 14, drag: o.drag ?? 2, life, max: life,
        size: (o.size ?? 0.18) * (0.6 + Math.random() * 0.8), size1: o.endSize ?? 0,
        color: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, spin: (Math.random() - 0.5) * 18, floor: o.floor ?? true,
        shrinkLate: o.shrinkLate,
      });
    }
  }

  ember(x, y, z, color) {
    this.glow.add({ x: x + (Math.random() - 0.5) * 0.2, y, z: z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.4, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 0.4, g: 0, drag: 0.5, life: 0.9, max: 0.9, size: 0.09, size1: 0, color, rot: 0, spin: 0, floor: false });
  }

  trail(pos, color, size = 0.22, life = 0.28) {
    const k = this.C('fx.trail');
    if (k <= 0) return;
    this.glow.add({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: life * k, max: life * k, size: size * Math.min(1.5, k), size1: 0, color, rot: 0, spin: 0, floor: false });
  }

  dust(pos, n = 4, color = '#d8c49a') {
    this.burst(pos, { count: n, color, speed: 1.6, up: 1.2, gravity: 4, life: 0.4, size: 0.14, drag: 4 });
  }

  // Voxel explosion of a hero model
  shatter(model, force = 9, extra = []) {
    const vox = voxelsOf(model);
    const center = new THREE.Vector3();
    model.getWorldPosition(center);
    center.y += 0.8;
    for (const v of vox) {
      const d = v.pos.clone().sub(center).normalize();
      for (let i = 0; i < 2; i++) {
        const life = 1.4 + Math.random() * 1.2;
        this.solid.add({
          x: v.pos.x, y: v.pos.y, z: v.pos.z,
          vx: d.x * force * (0.5 + Math.random()) + (Math.random() - 0.5) * 3, vy: 5 + Math.random() * 7, vz: d.z * force * (0.5 + Math.random()) + (Math.random() - 0.5) * 3,
          g: 22, drag: 0.6, life, max: life, size: Math.max(0.1, v.size * 0.7) * (0.6 + Math.random() * 0.5), size1: 0.0, shrinkLate: true,
          color: v.color, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 20, floor: true,
        });
      }
    }
    for (const col of extra) this.burst(center, { count: 30, color: col, speed: 12, up: 8, glow: true, life: 0.6, size: 0.2, gravity: 8 });
  }

  // ── Timed meshes ───────────────────────────────────────────────────────
  // Both gameplay and the showcase use these time-based effect programmes.
  playArt(motif,pos,dir,color,scale=1,life=.72,options={}) {
    const art=makeSpellArt(motif,color,life,options);
    art.group.position.set(pos.x,pos.y??.06,pos.z);
    art.group.rotation.y=Math.atan2(dir?.x||0,dir?.z??1);
    art.group.scale.setScalar(scale);
    this._timed(art.group,life,k=>art.update((1-k)*life));
    return art.group;
  }
  contact(kind,pos,dir={x:0,z:1},color='#fff0cc',power=1){
    const motif={kick:'kick',catch:'catch',dash:'chevrons',elim:'cross'}[kind]||'cross';
    const group=this.playArt(motif,pos,dir,color,power,kind==='elim'?.72:.44);
    group.userData.cue=kind;return group;
  }
  skill(id,pos,dir={x:0,z:1},color=null,scale=1){
    const spec=SKILL_ART[id];if(!spec||scale<=0)return;
    const group=this.playArt(spec.motif,pos,dir,color||spec.color,scale,.78);
    group.userData.skill=id;return group;
  }
  skillWindup(id,player,duration,color,scale=1){
    if(duration<=0||scale<=0)return;
    const spec=SKILL_ART[id],art=makeSpellArt(spec.motif,color||spec.color,duration,{windup:true});
    const action=player.action;
    art.group.scale.setScalar(scale);
    this._timed(art.group,duration,k=>{
      art.group.visible=player.alive!==false&&player.action===action&&(player.human||!(player.t?.cloak>0));
      art.group.position.set(player.x,(player.y||0)+.04,player.z);
      art.update((1-k)*duration);
    });
  }
  syncBallWakes(balls,dt){
    this.ballWakes??=new Map();
    const active=new Set(balls.filter(b=>b.state==='flight'&&Math.hypot(b.vx,b.vz)>4));
    for(const [ball,art] of this.ballWakes)if(!active.has(ball)){art.dispose();this.ballWakes.delete(ball);}
    for(const ball of active){
      let art=this.ballWakes.get(ball);
      if(!art){art=makeBallWake(ball.color);this.scene.add(art.group);this.ballWakes.set(ball,art);}
      art.update(new THREE.Vector3(ball.x,ball.y,ball.z),dt,ball.color);
    }
  }

  _release(mesh) {
    this.scene.remove(mesh);
    const materials=new Set();
    mesh.traverse(o=>{if(o.material)for(const m of [o.material].flat())materials.add(m);if(o.userData.disposeGeometry)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});
    for(const material of materials)material.dispose();
  }

  _timed(mesh, life, update) {
    this.scene.add(mesh);
    this.items.push({ mesh, life, max: life, update });
  }

  ring(pos, o = {}) {
    const m = new THREE.Mesh(o.filled ? this.discGeo : this.ringGeo, new THREE.MeshBasicMaterial({ color: o.color ?? '#ffffff', transparent: true, opacity: o.opacity ?? 0.9, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(pos.x, (o.y ?? 0.04), pos.z);
    const r0 = o.r0 ?? 0.2, r1 = o.r1 ?? 2.5, op = o.opacity ?? 0.9;
    m.scale.setScalar(r0);
    this._timed(m, o.time ?? 0.4, (k) => {
      const u = 1 - k;
      const e = 1 - Math.pow(1 - u, 3);
      m.scale.setScalar(r0 + (r1 - r0) * e);
      m.material.opacity = op * k;
    });
    return m;
  }

  // Vertical light pillar (spawn / elimination)
  pillar(pos, color, height = 8, radius = 0.6, time = 0.5) {
    const m = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(pos.x, height / 2, pos.z);
    this._timed(m, time, (k) => {
      m.scale.set(radius * 2 * k, height * (1 + (1 - k) * 0.3), radius * 2 * k);
      m.material.opacity = 0.85 * k;
    });
  }

  beam(a, b, color, width = 0.25, time = 0.25) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5);
    m.lookAt(b);
    this._timed(m, time, (k) => {
      m.scale.set(width * k, width * k, len);
      m.material.opacity = 0.9 * k;
    });
  }

  // Swept arc "smear" behind a kicking foot: a fan of thin glowing quads
  smear(points, color, time = 0.14) {
    if (!this.C('fx.smears') || !this.enabledSmears || points.length < 2) return;
    for (let i = 1; i < points.length; i++) this.beam(points[i - 1], points[i], color, 0.22 * (i / points.length) + 0.06, time);
  }

  afterimage(model, color, time = 0.25, opacity = 0.45) {
    if (!this.C('fx.smears') || !this.enabledSmears) return;
    model.updateWorldMatrix(true, true);
    const g = ghostClone(model, color, opacity);
    g.position.copy(model.position);
    g.quaternion.copy(model.quaternion);
    g.scale.copy(model.scale);
    this._timed(g, time, (k) => { g.userData.ghostMat.opacity = opacity * k; });
  }

  // ── Persistent effect meshes (owned by the sim) ────────────────────────
  makeWall(x,z,angle,len,color){
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;
    const n=Math.max(2,Math.round(len/.5)),count=n*3;
    const material=new THREE.MeshLambertMaterial();
    const mesh=new THREE.InstancedMesh(this.boxGeo,material,count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    group.add(mesh);this.scene.add(group);
    const blocks=[],transform=new THREE.Object3D();let t=0,disposed=false;
    for(let i=0;i<n;i++)for(let j=0;j<3;j++){
      blocks.push({x:-len/2+.25+i*(len-.5)/(n-1),target:j*.5+.25,delay:Math.abs(i-(n-1)/2)*.02+j*.03});
      mesh.setColorAt(i*3+j,new THREE.Color(color).multiplyScalar(.82+((i+j)%2)*.18));
    }
    const update=(dt,remaining)=>{
      t+=dt;const sink=remaining<.3?(.3-remaining)/.3:0;
      blocks.forEach((b,i)=>{const u=Math.min(1,Math.max(0,(t-b.delay)/.12));transform.position.set(b.x,-1+(b.target+1)*(1-Math.pow(1-u,3))-sink*1.6,0);transform.scale.set(.5,.5,.6);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
      mesh.instanceMatrix.needsUpdate=true;
    };
    update(0,1);
    return {group,update,dispose:()=>{if(disposed)return;disposed=true;group.removeFromParent();mesh.dispose();material.dispose();}};
  }

  makeShield(color, radius = 1.2) {
    const effect = makeShieldArt(color, radius);
    this.scene.add(effect.mesh); this.persistentShields.add(effect);
    const release = effect.dispose;
    effect.dispose = () => { release(); this.persistentShields.delete(effect); };
    return effect;
  }

  // Call after simulation timers/positions update. Effects read actual state;
  // they cannot outlive a consumed magnet, expired buff, removed or dead player.
  syncItemEffects(players, dt = 0) {
    const present = new Set(players);
    for (const [player, effects] of this.itemEffects) {
      if (!present.has(player) || !player.alive) {
        for (const effect of effects.values()) effect.art.dispose();
        this.itemEffects.delete(player);
      }
    }
    for (const p of players) {
      if (!p.alive) continue;
      let effects = this.itemEffects.get(p);
      const states = { cleats: p.t.cleats, cloak: p.human ? p.t.cloak : 0, magnet: p.magnet ? 1 : 0, freeze: p.freeze };
      for (const [id, remaining] of Object.entries(states)) {
        let effect = effects?.get(id);
        if (!(remaining > 0)) {
          if (effect) {
            // Collapse inward when a timer runs out; magnet consumption snaps.
            if(p.human||!(p.t.cloak>0))this.itemEnd(id,p);
            effect.art.dispose(); effects.delete(id);
          }
          continue;
        }
        if (!effect) {
          if (!effects) { effects = new Map(); this.itemEffects.set(p, effects); }
          const art = makeItemAura(id); this.scene.add(art.group);
          effect = { art, duration: id === 'magnet' ? 0 : Math.max(remaining, this.C(`item.${id === 'freeze' ? 'whistle' : id}.dur`) || 0), trailClock: 0 };
          effects.set(id, effect);
          this.ring(p, { color: ITEM_FX_COLORS[id], r0: .25, r1: .92, time: .22, additive: false });
        }
        effect.duration = id === 'magnet' ? 0 : Math.max(effect.duration, remaining);
        effect.art.group.position.set(p.x, p.y || 0, p.z);
        effect.art.group.rotation.y = id === 'magnet' ? 0 : Math.atan2(p.fx || 0, p.fz ?? 1);
        // Don't reveal opponents while their cloak is active.
        effect.art.group.visible = p.human || !(p.t.cloak > 0);
        effect.art.update(dt, remaining, effect.duration);
        if (id === 'cleats' && Math.hypot(p.vx, p.vz) > 2 && effect.art.group.visible) {
          effect.trailClock += dt;
          if (effect.trailClock >= 1 / 12) {
            effect.trailClock %= 1 / 12;
            const a = Math.atan2(p.fx || 0, p.fz ?? 1);
            for (const side of [-1, 1]) this.trail({ x: p.x + Math.cos(a) * .26 * side, y: .10 + (p.y || 0), z: p.z - Math.sin(a) * .26 * side }, ITEM_FX_COLORS.cleats, .13, .25);
          }
        }
      }
      if (effects?.size === 0) this.itemEffects.delete(p);
    }
  }

  itemActivation(id,pos,radius=1){
    const color=ITEM_FX_COLORS[id==='whistle'?'freeze':id]||'#ffffff';
    const motif={whistle:'freeze',cleats:'chevrons',shield:'crown',cloak:'blink',magnet:'trap',overclock:'scan'}[id]||'scan';
    return this.playArt(motif,{x:pos.x,y:.04+(pos.y||0),z:pos.z},{x:pos.fx||0,z:pos.fz??1},color,1,.72,{radius});
  }
  itemEnd(id,pos){
    const color=ITEM_FX_COLORS[id==='whistle'?'freeze':id]||'#b6f5ff';
    return this.playArt(id==='shield'?'crown':'blink',{x:pos.x,y:.08,z:pos.z},{x:0,z:1},color,.7,.38);
  }

  update(dt) {
    this.solid.update(dt);
    this.glow.update(dt);
    const it = this.items;
    let w = 0;
    for (let i = 0; i < it.length; i++) {
      const o = it[i];
      o.life -= dt;
      if (o.life <= 0) {
        this._release(o.mesh);
        continue;
      }
      o.update(o.life / o.max);
      it[w++] = o;
    }
    it.length = w;
  }

  clear() {
    for(const art of this.ballWakes?.values()||[])art.dispose();this.ballWakes?.clear();
    for (const effects of this.itemEffects.values()) for (const effect of effects.values()) effect.art.dispose();
    this.itemEffects.clear();
    for (const shield of [...this.persistentShields]) shield.dispose();
    this.solid.clear();
    this.glow.clear();
    for (const o of this.items) this._release(o.mesh);
    this.items.length = 0;
  }
}
