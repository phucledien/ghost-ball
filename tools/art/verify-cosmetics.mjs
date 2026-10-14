// Catalog and animation regression check. Outputs remain in the local QA directory.
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.GHOST_PLAYWRIGHT||`${process.env.HOME}/Library/Developer/Tools/ghost-ball-qa/node_modules/playwright/index.mjs`));
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=(process.env.GHOST_ART_BUILD||`${process.env.HOME}/Library/Developer/CodexBuilds/ghost-ball-art`)+'/qa/revision7';
fs.mkdirSync(root,{recursive:true});
const url=process.env.GHOST_QA_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/');await page.waitForFunction(()=>window.__gb);
 const result=await page.evaluate(async()=>{
  const {buildHero,applyPose,ghostClone,voxelsOf}=await import('/src/engine/hero-model.js');
  const {COSMETIC_SLOTS,resolveLoadout}=await import('/src/game/cosmetics.js');
  const {POSES,locomotionPose}=await import('/src/engine/anim.js');
  const {renderHero}=await import('/src/ui/portrait.js');
  const C=window.__gb.menu.C,rows=[];let count=0,triangles=0,draws=0;
  const hash=m=>{let h=2166136261;m.traverse(o=>{if(o.isMesh)for(const key of ['position','color'])for(const v of o.geometry.attributes[key].array){h^=Math.round(v*10000);h=Math.imul(h,16777619);}});return h>>>0;};
  for(const hero of ['nova','bolt','titan','jinx','echo','kaiz']){
   const slots={};
   for(const slot of COSMETIC_SLOTS){const unique=new Set();for(const option of slot.options){
    const model=buildHero(hero,C,{[slot.id]:option.id});if(model.userData.artStyle!=='master')throw Error(hero+slot.id+option.id+' fallback');
    applyPose(model,POSES.kick);model.updateMatrixWorld(true);let t=0,n=0;model.traverse(o=>{if(o.isMesh){n++;t+=o.geometry.attributes.position.count/3;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))throw Error('invalid geometry');}});triangles=Math.max(triangles,t);draws=Math.max(draws,n);unique.add(hash(model));
    const ghost=ghostClone(model,'#ffffff');if(hash(ghost)!==hash(model))throw Error('ghost mismatch');if(voxelsOf(model).length<20)throw Error('missing fragments');count++;
   }slots[slot.id]={options:slot.options.length,unique:unique.size};}
   rows.push({hero,slots});
  }
  let mixed=0;
  for(const hero of ['nova','bolt','titan','jinx','echo','kaiz'])for(let i=0;i<64;i++){
   const loadout=Object.fromEntries(COSMETIC_SLOTS.map((slot,j)=>[slot.id,slot.options[(i*(j+3)+j)%slot.options.length].id]));
   const m=buildHero(hero,C,loadout);if(m.userData.artStyle!=='master')throw Error('mixed loadout fallback');
   for(const pose of [POSES.kick,POSES.absorb,locomotionPose(1,1.3,1,1,{})]){applyPose(m,pose);m.updateMatrixWorld(true);for(const fragment of voxelsOf(m))if(!fragment.pos.toArray().every(Number.isFinite))throw Error('invalid animated fragment');}
   if(hash(buildHero(hero,C,loadout))!==hash(m))throw Error('unstable cache');mixed++;
  }
  window.__gb.menu.show('title');document.body.innerHTML='<main id="gallery"></main>';document.documentElement.style.cssText='height:auto;overflow:auto';document.body.style.height='auto';Object.assign(document.body.style,{margin:'0',background:'#111c2c',color:'#eee6d2',font:'14px monospace',overflow:'auto'});const gallery=document.querySelector('#gallery');gallery.style.cssText='display:grid;grid-template-columns:repeat(10,1fr);gap:8px;padding:12px';
  for(const hero of ['nova','bolt','titan','jinx','echo','kaiz'])for(const h of COSMETIC_SLOTS[0].options){const card=document.createElement('div');card.style.cssText='background:#203049;text-align:center;padding:4px';const cv=renderHero(hero,C,{w:96,h:120,mode:'stage',yaw:.4,loadout:{hair:h.id}});cv.style.cssText='width:100%;image-rendering:pixelated';card.append(cv,document.createTextNode(hero+' / '+h.id));gallery.append(card);}
  window.cosmeticQA={C,renderHero,COSMETIC_SLOTS};return {count,mixed,triangles,draws,rows};
 });
 await page.screenshot({path:root+'/cosmetics-hair-all.png',fullPage:true});
 await page.evaluate(()=>{const {C,renderHero,COSMETIC_SLOTS}=window.cosmeticQA,g=document.querySelector('#gallery');g.innerHTML='';g.style.gridTemplateColumns='repeat(8,1fr)';for(const slot of COSMETIC_SLOTS.slice(1))for(const o of slot.options){const card=document.createElement('div');card.style.cssText='background:#203049;text-align:center;padding:4px';let cv=renderHero('nova',C,{w:128,h:160,mode:'stage',yaw:.4,loadout:{[slot.id]:o.id}});cv.style.cssText='width:100%;image-rendering:pixelated';card.append(cv,document.createTextNode(slot.id+' / '+o.id));g.append(card);}});
 await page.screenshot({path:root+'/cosmetics-accessories.png',fullPage:true});
 await page.goto(url+'/');await page.waitForFunction(()=>window.__gb);
 await page.evaluate(()=>{window.__gb.menu.picks.hero='bolt';window.__gb.menu.picks.loadouts={bolt:{hair:'buzz'}};window.__gb.menu.show('hero');});await page.locator('.locker-btn').click();await page.waitForTimeout(200);await page.screenshot({path:root+'/cosmetics-bolt-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/cosmetics-bolt-phone.png'});
 assert.equal(result.count,252);assert.deepEqual(errors,[]);for(const row of result.rows){assert.equal(row.slots.hair.unique,10);assert.equal(row.slots.eyewear.unique,6);assert.equal(row.slots.headwear.unique,6);assert.equal(row.slots.accessory.unique,8);assert.equal(row.slots.kit.unique,5);assert(row.slots.boots.unique>=6);}
 fs.writeFileSync(root+'/cosmetics-results.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
