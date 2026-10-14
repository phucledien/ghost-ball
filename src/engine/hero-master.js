// Blender-authored rigid parts. Shared pivots retain the procedural phase editor.
import * as THREE from 'three';
import nova from './assets/nova-master.json';
import bolt from './assets/bolt-master.json';
import titan from './assets/titan-master.json';
import jinx from './assets/jinx-master.json';
import echo from './assets/echo-master.json';
import kaiz from './assets/kaiz-master.json';
const MASTERS={nova,bolt,titan,jinx,echo,kaiz};
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { masterCosmeticParts, isHairPart } from './master-cosmetics.js';
import { kitColors, BOOT_COLORS, COSMETIC_SLOTS, loadoutKey } from '../game/cosmetics.js';
import { HERO_BY_ID } from '../game/heroes.js';

const cache = new Map();
const material = new THREE.MeshBasicMaterial({ vertexColors: true });
const center = new THREE.Vector3(), size = new THREE.Vector3();
export const HERO_SIGNATURES = {
 nova:{hair:'spike',eyewear:'none',headwear:'none',boots:'classic',accessory:'none',kit:'home'},
 bolt:{hair:'long',eyewear:'none',headwear:'none',boots:'classic',accessory:'wristbands',kit:'home'},
 titan:{hair:'buzz',eyewear:'none',headwear:'none',boots:'blackgold',accessory:'chain',kit:'home'},
 jinx:{hair:'bob',eyewear:'goggles',headwear:'none',boots:'crimson',accessory:'mismatch',kit:'home'},
 echo:{hair:'messy',eyewear:'none',headwear:'none',boots:'ice',accessory:'scarf',kit:'home'},
 kaiz:{hair:'swept',eyewear:'none',headwear:'circlet',boots:'classic',accessory:'gloves',kit:'home'},
};
export const NOVA_SIGNATURE=HERO_SIGNATURES.nova;
export function supportsHeroMaster(heroId,lo) {
 return !!MASTERS[heroId] && COSMETIC_SLOTS.every(slot=>slot.options.some(option=>option.id===lo[slot.id]));
}
export const supportsNovaMaster=lo=>supportsHeroMaster('nova',lo);
export const masterStats=heroId=>({triangles:MASTERS[heroId].meshes.reduce((n,m)=>n+m.positions.length/9,0),source:MASTERS[heroId].source});
function shades(hex) {
  const c = new THREE.Color(hex);
  return [c.clone().multiplyScalar(.54), c, c.clone().lerp(new THREE.Color('#fff7e5'), .27)];
}
function bake(heroId, C, lo) {
  const master=MASTERS[heroId],look = HERO_BY_ID[heroId].look;
  const jersey = C?.(`hero.${heroId}.jersey`) || look.jersey;
  const hair = C?.(`hero.${heroId}.hair`) || look.hair;
  const key = [heroId,loadoutKey(lo),jersey,hair].join('|');
  if (cache.has(key)) return cache.get(key);
  const kit = kitColors(lo.kit, look, jersey);
  const changed = lo.kit !== 'home' || jersey !== look.jersey;
  const byPivot = {};
  for (const part of [...master.meshes.filter(p=>!isHairPart(p)&&! /^(Chain|Scarf|Goggle|Circlet)/.test(p.name)),...masterCosmeticParts(heroId,lo,MASTERS)]) {
    if(part.name.startsWith('WristTape')&&!['wristbands','gloves'].includes(lo.accessory))continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
    let palette = (part.palette || master.palette[part.role]).map(h => new THREE.Color(h));
    if (/^Hand\./.test(part.name)) palette = master.palette[lo.accessory==='gloves'?'ink':'skin'].map(h=>new THREE.Color(h));
    if (/^WristTape/.test(part.name)) palette = lo.accessory==='gloves'?master.palette.ink.map(h=>new THREE.Color(h)):shades(kit.trim);
    if (/^Sock\./.test(part.name)) {
      if(lo.accessory==='mismatch'&&part.name==='Sock.R')palette=heroId==='jinx'&&!changed?master.palette.navy.map(h=>new THREE.Color(h)):shades(kit.jersey===kit.socks?kit.shorts:kit.jersey);
      else if(changed)palette=shades(kit.socks);
      else if(heroId==='jinx')palette=master.palette.cream.map(h=>new THREE.Color(h));
    }
    if (changed && /^(Jersey|Sleeve\.)/.test(part.name)) palette = shades(kit.jersey);
    if (changed && /^(Shorts\.|ShortsWaist|WaistBand)/.test(part.name)) palette = shades(kit.shorts);
    if (changed && /^(ChestBand|Collar|SleeveBand|ShortsStripe|RaisedCollar)/.test(part.name)) palette = shades(kit.trim);
    if (part.role === 'hair' && !part.name.startsWith('Circlet') && hair !== look.hair) palette = shades(hair);
    if (lo.boots!=='classic' && lo.boots!==HERO_SIGNATURES[heroId].boots && BOOT_COLORS[lo.boots] && /^(Boot|Sole)/.test(part.name)) palette = shades(BOOT_COLORS[lo.boots][/Sole/.test(part.name)?1:/Tongue/.test(part.name)?2:0]);
    const colors = [];
    for (const tone of part.tones) colors.push(...palette[tone].toArray());
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();g.computeBoundingBox();
    g.boundingBox.getCenter(center);g.boundingBox.getSize(size);
    const row = byPivot[part.parent] ||= { geometries: [], fragments: [] };
    row.geometries.push(g);
    if (size.length() > .15) row.fragments.push([...center.toArray(), '#' + palette[1].getHexString(), Math.min(.26, Math.max(.06, Math.cbrt(size.x * size.y * size.z)))]);
  }
  const result = {};
  for (const [pivot, row] of Object.entries(byPivot)) {
    result[pivot] = { geometry: mergeGeometries(row.geometries), fragments: row.fragments };
    row.geometries.forEach(g => g.dispose());
  }
  cache.set(key, result);
  return result;
}
export function buildHeroMaster(heroId, C, lo) {
  const master=MASTERS[heroId];
  const root = new THREE.Group();root.name = heroId;
  root.userData.loadout = lo;root.userData.artStyle = 'master';
  const nodes = {}, baked = bake(heroId, C, lo);
  for (const spec of master.nodes) {
    const n = new THREE.Group();n.name = spec.name;n.position.fromArray(spec.position);
    (spec.parent ? nodes[spec.parent] : root).add(n);nodes[spec.name] = n;
    const part = baked[spec.name];
    if (part) {
      const m = new THREE.Mesh(part.geometry, material);m.castShadow = true;
      m.userData.parts = part.fragments;m.userData.baseColor = part.fragments[0]?.[3] || '#2f6fe0';n.add(m);
    }
  }
  root.userData.rig = {
    secondary:nodes.secondary,rig: nodes.rig, hips: nodes.hips, body: nodes.body, head: nodes.head, build: 1,
    hipsY: master.hipsY, footTip: master.footTip,
    arms: { L: { sh: nodes['sh.L'], el: nodes['el.L'] }, R: { sh: nodes['sh.R'], el: nodes['el.R'] } },
    legs: { L: { hip: nodes['hip.L'], knee: nodes['knee.L'], ankle:nodes['ankle.L'], boot:nodes['boot.L'] }, R: { hip: nodes['hip.R'], knee: nodes['knee.R'], ankle:nodes['ankle.R'], boot:nodes['boot.R'] } },
  };
  return root;
}

export const buildNovaMaster=(C,lo)=>buildHeroMaster('nova',C,lo);
