// Run against the local Vite server. QA dependencies and outputs live outside the repo.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const qaRoot=process.env.GHOST_ART_BUILD||`${process.env.HOME}/Library/Developer/CodexBuilds/ghost-ball-art`;
const modulePath=process.env.GHOST_PLAYWRIGHT||`${process.env.HOME}/Library/Developer/Tools/ghost-ball-qa/node_modules/playwright/index.mjs`;
const {chromium}=await import(pathToFileURL(modulePath));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.GHOST_QA_URL||'http://127.0.0.1:5173')+'/art.html');
 await page.waitForFunction(()=>window.__artLab);
 await page.locator('#play').click();
 const result=await page.evaluate(async()=>{
  const {buildHero,applyPose,footWorld,ghostClone,voxelsOf}=await import('/src/engine/hero-model.js');
  const {frameAt}=await import('/src/engine/nova-sprite.js');
  const {SCHEMA}=await import('/src/core/schema.js');
  const {Match}=await import('/src/game/sim.js');
  const defaults=Object.fromEntries(SCHEMA.map(s=>[s.key,s.v]));
  const C=k=>defaults[k];
  const lab=window.__artLab,model=buildHero('nova',C);
  const roster={};
  for(const heroId of ['nova','bolt','titan','jinx','echo','kaiz']){
   const master=buildHero(heroId,C),atlas={manifest:await (await fetch(`/assets/heroes/${heroId}/${heroId}-atlas.json`)).json()};let error=0;
   for(const frame of Object.values(atlas.manifest.frames)){
    applyPose(master,lab.rosterClips[heroId][frame.action].frames[frame.index].pose);master.rotation.y=frame.facing*Math.PI/4;master.updateMatrixWorld(true);
    const actual=footWorld(master).toArray();error=Math.max(error,...actual.map((v,i)=>Math.abs(v-frame.bootWorld[i])));
   }
   roster[heroId]={error,frames:Object.keys(atlas.manifest.frames).length,master:master.userData.artStyle,alternate:buildHero(heroId,C,{kit:'away'}).userData.artStyle,customUsesMaster:buildHero(heroId,C,{hair:'afro'}).userData.artStyle==='master',fragments:voxelsOf(master).length};
  }
  const {VFX}=await import('/src/engine/vfx.js');const fx=new VFX(lab.states[0].stage.scene,C);
  for(const kind of ['kick','catch','dash','elim'])fx.contact(kind,{x:0,y:.1,z:0});
  const cues=fx.items.map(o=>o.mesh.userData.cue);fx.update(1);const effectsExpire=fx.items.length===0;
  lab.states[0].stage.scene.remove(fx.solid.mesh,fx.glow.mesh);
  let maxSocketError=0;
  for(const frame of Object.values(lab.atlas.manifest.frames)){
   applyPose(model,lab.clips[frame.action].frames[frame.index].pose);
   model.rotation.y=frame.facing*Math.PI/4;model.updateMatrixWorld(true);
   const actual=footWorld(model).toArray();
   maxSocketError=Math.max(maxSocketError,...actual.map((v,i)=>Math.abs(v-frame.bootWorld[i])));
  }
  const alternate=buildHero('nova',C,{kit:'away'});
  const custom=buildHero('nova',C,{hair:'afro'});
  const legacy=buildHero('nova',k=>k==='art.heroStyle'?'legacy':C(k));
  const clone=ghostClone(model,'#ffffff');
  const player={heroId:'nova',model,pose:lab.clips.idle.frames[0].pose,x:7,alive:true};
  model.position.set(7,0,2);model.visible=false;
  Match.prototype.refreshArt.call({players:[player],group:lab.states[0].stage.scene,C:k=>k==='art.heroStyle'?'legacy':C(k)});
  const refreshPreservesState=player.x===7&&player.model.position.x===7&&!player.model.visible&&!player.model.userData.artStyle;
  lab.states[0].stage.scene.remove(player.model);
  return {roster,cues,effectsExpire,refreshPreservesState,maxSocketError,frameCount:Object.keys(lab.atlas.manifest.frames).length,master:model.userData.artStyle,alternate:alternate.userData.artStyle,customUsesMaster:custom.userData.artStyle==='master',legacy:!legacy.userData.artStyle,ghost:clone.isGroup,fragments:voxelsOf(model).length,contact:frameAt(lab.atlas.manifest,'pass',0,90).event,beforeContact:frameAt(lab.atlas.manifest,'pass',0,89).index,afterContact:frameAt(lab.atlas.manifest,'pass',0,140).index};
 });
 for(const row of Object.values(result.roster)){assert.equal(row.frames,480);assert.equal(row.master,'master');assert.equal(row.alternate,'master');assert(row.customUsesMaster);assert(row.fragments>10);assert(row.error<.00002);}
 assert.deepEqual(result.cues,['kick','catch','dash','elim']);assert(result.effectsExpire);
 assert(result.refreshPreservesState);assert.equal(result.frameCount,480);assert.equal(result.master,'master');assert.equal(result.alternate,'master');assert(result.customUsesMaster&&result.legacy&&result.ghost);assert(result.fragments>10);assert.equal(result.contact,'strike');assert.equal(result.beforeContact,1);assert.equal(result.afterContact,3);assert(result.maxSocketError<.00002,JSON.stringify(result));
 await page.locator('#action').selectOption('pass');await page.locator('#scrub').fill('90');
 await page.waitForFunction(()=>document.querySelector('#frameInfo').textContent.includes('STRIKE'));
 await page.locator('#density').selectOption('48');
 await page.screenshot({path:qaRoot+'/qa/art-inspect.png',fullPage:true});
 for(const scene of ['temple','egolab','frost','cover']){await page.locator('#scene').selectOption(scene);await page.screenshot({path:qaRoot+'/qa/art-'+scene+'-final.png'});}
 for(const hero of ['bolt','titan','jinx','echo','kaiz']){
  await page.locator('#hero').selectOption(hero);await page.waitForFunction(id=>window.__artLab.states[1].model.name===id,hero);
  await page.locator('#scene').selectOption('studio');await page.locator('#action').selectOption('idle');
  await page.screenshot({path:qaRoot+'/qa/art-'+hero+'.png',fullPage:true});
  await page.locator('#finished').uncheck();await page.waitForFunction(()=>!document.querySelector('#loading').textContent);await page.locator('#finished').check();await page.waitForFunction(()=>!document.querySelector('#loading').textContent);
  await page.locator('#silhouette').check();await page.screenshot({path:qaRoot+'/qa/silhouette-'+hero+'.png'});await page.locator('#silhouette').uncheck();
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:qaRoot+'/qa/art-phone-final.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(qaRoot+'/qa/asset-contract-results.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({pass:true,...result}));
}finally{await browser.close()}
