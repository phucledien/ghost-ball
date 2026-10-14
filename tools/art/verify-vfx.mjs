import {chromium} from '/Users/thohong/Library/Developer/Tools/ghost-ball-qa/node_modules/playwright/index.mjs';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const out='/Users/thohong/Library/Developer/CodexBuilds/ghost-ball-art/qa/revision8',browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE'))errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/?autoplay=1&hero=nova&mode=twin&map=temple&bench=1');await page.waitForFunction(()=>window.__gb?.match?.players.length===14);
const result=await page.evaluate(async()=>{
 const {VFX}=await import('/src/engine/vfx.js'),{SKILLS}=await import('/src/game/skills.js'),{SKILL_ART}=await import('/src/engine/skill-art.js'),{makeSpellArt}=await import('/src/engine/spell-art.js'),THREE=await import('/node_modules/three/build/three.module.js');
 const m=window.__gb.match;m.paused=true;m.phase='play';const fx=new VFX(m.scene,m.C),programs=[];
 for(const motif of [...new Set(Object.values(SKILL_ART).map(s=>s.motif)),'freeze','kick','catch']){
  const art=makeSpellArt(motif,'#77eeff',.78,{radius:4});let finite=true,frames=[];
  for(let i=0;i<=60;i++){art.update(i/60*.78);let checksum=0;art.group.traverse(o=>{if(o.geometry){const a=o.geometry.attributes.position;finite&&=Array.from(a.array).every(Number.isFinite);checksum+=a.array.slice(0,90).reduce((a,b)=>a+b,0);}if(o.isInstancedMesh)finite&&=Array.from(o.instanceMatrix.array).every(Number.isFinite);});if([5,20,40].includes(i))frames.push(checksum);}
  let geometryDisposals=0,materialDisposals=0;art.group.traverse(o=>{o.geometry?.addEventListener('dispose',()=>geometryDisposals++);o.material?.addEventListener('dispose',()=>materialDisposals++);});fx._release(art.group);programs.push({motif,finite,animated:new Set(frames).size>1,geometryDisposals,materialDisposals});
 }
 for(const id of Object.keys(SKILL_ART))fx.skill(id,{x:0,y:.1,z:0});for(const id of ['kick','catch','dash','elim'])fx.contact(id,{x:0,y:.1,z:0});const cues=fx.items.length;fx.update(2);const expired=fx.items.length===0;
 const skills=[];
 for(const id of Object.keys(SKILL_ART)){
  const p=m.players.find(p=>p.heroId===id.split('.')[0]);p.alive=true;p.action=null;p.x=p.z=p.y=0;p.t.cloak=0;p.freeze=p.stun=0;m.giveBall(m.balls[0],p);const before=m.vfx.items.length;
  SKILLS[id](m,p,m.balls[0]);let samples=0;for(let i=0;i<60;i++){if(p.action)m.stepAction(p,1/60);m.vfx.update(1/60);m.updateVisuals(1/60);if(m.vfx.items.some(e=>e.mesh.userData.skill===id))samples++;}
  skills.push({id,samples,windupCreated:before<m.vfx.items.length||samples>0});m.vfx.clear();for(const q of m.players)q.shieldFx=null;
 }
 const wall=fx.makeWall(1,2,.3,4,'#bbaa88');wall.update(.5,2);const block=wall.group.children[0],matrix=new THREE.Matrix4();let wallFinite=true;for(let i=0;i<block.count;i++){block.getMatrixAt(i,matrix);wallFinite&&=matrix.elements.every(Number.isFinite);}const wallDraws=wall.group.children.length;let wallReleased=0;block.addEventListener('dispose',()=>wallReleased++);wall.dispose();wall.dispose();
 const p=m.human;p.action={id:'nova.atk'};fx.skillWindup('nova.atk',p,.2);p.action=null;fx.update(.05);const cancelledHidden=fx.items.every(e=>!e.mesh.visible);fx.clear();
 const ball={state:'flight',x:0,y:.3,z:0,vx:8,vz:0,color:'#ffaa33'};for(let i=0;i<30;i++){ball.x+=.1;fx.syncBallWakes([ball],1/60);}const historyPresent=fx.ballWakes.get(ball).group.children[0].geometry.drawRange.count>0;ball.state='held';fx.syncBallWakes([ball],1/60);const wakeCleared=fx.ballWakes.size===0;
 const player={alive:true,human:false,t:{cleats:2,cloak:1},freeze:0,magnet:false,x:0,y:0,z:0,vx:4,vz:0,fx:1,fz:0};fx.syncItemEffects([player],.1);const cloakedHidden=[...fx.itemEffects.get(player).values()].every(e=>!e.art.group.visible);player.alive=false;fx.syncItemEffects([player],.1);const deadCleared=fx.itemEffects.size===0;fx.clear();m.scene.remove(fx.solid.mesh,fx.glow.mesh);
 return {wallFinite,wallDraws,wallReleased,programs,cues,expired,skills,cancelledHidden,historyPresent,wakeCleared,cloakedHidden,deadCleared};
});
assert(result.wallFinite);assert.equal(result.wallDraws,1);assert.equal(result.wallReleased,1);assert.equal(result.cues,16);assert(result.expired);assert(result.programs.every(x=>x.finite&&x.animated&&x.geometryDisposals===2&&x.materialDisposals===2));assert(result.skills.every(x=>x.samples>0));for(const k of ['cancelledHidden','historyPresent','wakeCleared','cloakedHidden','deadCleared'])assert(result[k],k);
assert.deepEqual(errors,[]);await fs.writeFile(out+'/vfx-runtime-results.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({passed:true,...result}));
}finally{await browser.close()}
