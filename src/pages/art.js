import './art.css';
import * as THREE from 'three';
import { Stage } from '../engine/stage.js';
import { Arena } from '../engine/arena.js';
import { buildHero, applyPose, footWorld } from '../engine/hero-model.js';
import { buildBall, buildMarker } from '../engine/props.js';
import { loadHeroAtlas, buildNovaSprite, frameAt } from '../engine/nova-sprite.js';
import { HERO_SIGNATURES, masterStats } from '../engine/hero-master.js';
import { VFX } from '../engine/vfx.js';
import { SCHEMA } from '../core/schema.js';
import rosterClips from '../../art/specs/roster-clips.json';
import {MOTION_NOTES} from '../engine/hero-motion.js';
import {SKILL_ART} from '../engine/skill-art.js';
const app = document.querySelector('#art-app');
app.innerHTML = `
<header><a href="./">GHOST<span>●</span>BALL</a><span>ART LAB / FULL ROSTER</span><a href="https://ghost-ball-art-direction.phucledien.chatgpt.site">Art plan ↗</a></header>
<main><div class="intro"><div><p class="eyebrow">SIX HEROES / TEN ACTIONS / EIGHT DIRECTIONS</p><h1>From concept<br>to <em>character.</em></h1></div><div class="intro-note"><p>Six Blender masters and 2,880 baked frames. Compare the original motion, the authored rig and the finished pixel bake.</p><p class="status"><span></span> Live 3D integrated · sprites under review</p></div></div>
<section class="controls" aria-label="Art comparison controls"><label>Hero<select id="hero"><option value="nova">Nova / playmaker</option><option value="bolt">Bolt / speedster</option><option value="titan">Titan / bruiser</option><option value="jinx">Jinx / trickster</option><option value="echo">Echo / genius</option><option value="kaiz">Kaiz / assassin</option></select></label><label>Action<select id="action"><option>idle</option><option>run</option><option>pass</option><option>catch</option><option>dash</option><option>hit</option><option>out</option><option>win</option><option>attack</option><option>defense</option></select></label><label>Facing<select id="facing">${Array.from({length:8},(_,i)=>`<option value="${i}">${i*45}°</option>`).join('')}</select></label><label>Pixel density<select id="density"><option value="18">18 px / unit</option><option value="24" selected>24 px / unit</option><option value="30">30 px / unit</option><option value="48">48 px / unit · 2× inspect</option></select></label><label>Scene<select id="scene"><option value="studio">Studio floor</option><option value="temple">Temple corner</option><option value="egolab">Ego Lab corner</option><option value="frost">Frost corner</option><option value="cover">Cover test</option></select></label><button id="play" aria-pressed="true">Pause</button><label class="check"><input type="checkbox" id="silhouette">Silhouette</label></section>
<div class="effect-controls"><label for="effect">EFFECT</label><select id="effect"><option value="kick">Kick / directional slash</option><option value="catch">Catch / closing brackets</option><option value="dash">Dash / ground chevrons</option><option value="elim">Elimination / star pop</option>${Object.entries(SKILL_ART).map(([id,s])=>`<option value="${id}">${s.label}</option>`).join('')}</select><button id="trigger">Replay effect</button><span><label><input id="finished" type="checkbox" checked> Pixel finishing</label><span id="loading" role="status"></span></span></div><section class="compare"><article><div class="panel-title"><b>01 / ORIGINAL</b><span>Procedural mesh</span></div><div class="viewport" id="legacy"></div><p>Original geometry and shared motion baseline.</p></article><article><div class="panel-title"><b>02 / BLENDER MASTER</b><span>Live 3D · integrated</span></div><div class="viewport" id="master"></div><p>Broader forms, restrained shading, named joints.</p></article><article><div class="panel-title"><b>03 / PIXEL BAKE</b><span>Review candidate</span></div><div class="viewport" id="sprite"></div><p>96×96 cells · hard palette · editable contour and cluster finish.</p></article></section>
<p id="motionNote" class="motion-note"></p><div class="timeline"><label for="scrub">POSE TIMELINE <output id="frameInfo">Loading…</output></label><input id="scrub" type="range" min="0" max="599" value="0" step="1"><p>24 px/unit is the native bake scale; 48 is exact 2×. Other densities test size fit. Contact frames are explicitly held. Playback loops for review; production pass/catch events remain driven by the game’s phase timeline.</p></div>
<div class="play-links"><a id="playMaster" class="primary" href="./?autoplay=1&hero=nova&map=temple&art=master">Play with Nova ↗</a><a id="playLegacy" href="./?autoplay=1&hero=nova&map=temple&art=legacy">Compare original ↗</a><a href="./editor.html">Open phase editor ↗</a></div>
<section class="notes"><div><p class="eyebrow">WHAT CHANGED</p><h2>One source. Two outputs.</h2><p>Each Blender master exports the live rigid-part geometry and its sprite frames. Each hero has distinct proportions, hair and motion. Secondary scarf and ponytail motion is shared by the live rig and bake. The game keeps its existing actions, boot contact point, collisions and editor controls. All six signature outfits follow the concept boards. Every catalog hairstyle, hat, eyewear and accessory now attaches to these same master rigs. The baked sheets remain signature-outfit references; customization uses the live geometry.</p><div class="stats"><div><b id="triangleCount">1,530</b><span>triangles</span></div><div><b>480</b><span>baked frames</span></div><div><b id="paletteCount">16</b><span>palette entries</span></div><div><b>20 MiB</b><span>selected hero pages</span></div></div></div><div><p class="eyebrow">GATE DECISION / ROSTER SLICE</p><h2>Keep live 3D for gameplay.</h2><p>The new master improves shape and supports the existing free-facing animation system. The baked route is available here for comparison, but it is not yet a replacement for the game’s camera and depth model.</p><ul><li>Try <b>Cover test</b>: a flat sprite has one depth plane, so partial intersections need a better depth strategy.</li><li>The bake locks pitch to 36°. Orbiting previews and continuous zoom need the master.</li><li>Kit recolours are supported in live 3D. The current bake contains the signature kit only.</li><li>Pixel finishing is an editable layer: one-pixel contours and selective cluster corrections. It is a controlled render finish, not a claim of 2,880 individually hand-painted frames. <a href="./device.html">Run the device check ↗</a></li></ul></div></section>
<section class="download"><h2>Inspect the source assets.</h2><a id="atlasDownload" href="./assets/heroes/nova/nova-atlas.png" target="_blank">PNG atlas ↗</a><a id="metadataDownload" href="./assets/heroes/nova/nova-atlas.json" target="_blank">Frame metadata ↗</a><a id="modelDownload" href="./assets/heroes/nova/nova-preview.glb" download>3D reference (.glb) ↓</a></section>
<footer>Six-hero art pass / 2026 · Camera 36° pitch, 45° yaw · Generated concept → authored Blender geometry → controlled bake.</footer></main>`;
const $ = s=>document.querySelector(s);
let heroId=Object.hasOwn(HERO_SIGNATURES,new URLSearchParams(location.search).get('hero'))?new URLSearchParams(location.search).get('hero'):'nova';
$('#hero').value=heroId;
let atlas,clips=rosterClips[heroId];
try {atlas=await loadHeroAtlas(heroId);} catch(error){$('#frameInfo').textContent=error.message;throw error;}
let playing=true,elapsed=0,last=performance.now();
const states=[];
const defaults = Object.fromEntries(SCHEMA.map(s=>[s.key,s.v]));
for(const mode of ['legacy','master','sprite']){
 let zoom=4;
 const C = k=>({'camera.zoom':zoom,'camera.pitch':36,'camera.yaw':45,'render.pixelScale':2,'render.contrast':1,'render.saturate':1,'render.sun':1.2,'render.ambient':1,'art.heroStyle':mode==='legacy'?'legacy':'master'}[k]??defaults[k]);
 const stage=new Stage($('#'+mode),C,{preserve:true});stage.target.set(0,.8,0);stage.applyTheme('temple',14,10);
 const model=buildHero(heroId,C,HERO_SIGNATURES[heroId]);stage.scene.add(model);
 const sprite=mode==='sprite'?buildNovaSprite(atlas):null;
 if(sprite)stage.scene.add(sprite.sprite);
 const ball=buildBall(.26);stage.scene.add(ball);
 const marker=buildMarker('#dca541');stage.scene.add(marker);
 const studio=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshBasicMaterial({color:'#dcdccb'}));studio.rotation.x=-Math.PI/2;studio.position.y=-.02;stage.scene.add(studio);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.38,16).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#777965',transparent:true,opacity:.3,depthWrite:false}));shadow.scale.set(1,.75,1);shadow.position.y=.005;stage.scene.add(shadow);
 const arena=new Arena(stage.scene);arena.build('temple',14,10,0,false,{obstacles:[{kind:'pillar',x:1.5,z:1.1,r:.52,h:2.1},{kind:'low',x:-2.5,z:1,w:2.5,d:.5,h:.6}],zones:[{kind:'grass',x:3.5,z:-2,w:2,d:2}]});arena.group.visible=false;
 const cover=new THREE.Mesh(new THREE.BoxGeometry(.9,1.5,.9),new THREE.MeshLambertMaterial({color:'#9f957b'}));cover.position.set(.45,.75,.45);cover.castShadow=true;stage.scene.add(cover);cover.visible=false;
 const materials=new Map();model.traverse(o=>{if(o.isMesh)materials.set(o,o.material)});
 const black=new THREE.MeshBasicMaterial({color:'#182338'});
 const vfx=new VFX(stage.scene,C);
 states.push({mode,C,stage,model,sprite,ball,marker,studio,shadow,arena,cover,materials,black,vfx,setZoom:z=>{zoom=z}});
}
let requestId=0;
async function updateHero(reload=true){
 const requested=$('#hero').value,version=++requestId;
 if(reload){
  $('#loading').textContent='Loading selected hero…';
  try{
   const next=await loadHeroAtlas(requested,$('#finished').checked);
   if(version!==requestId){next.dispose();return;}
   for(const s of states)if(s.sprite){s.stage.scene.remove(s.sprite.sprite);s.sprite.dispose();s.sprite=null;}
   atlas.dispose();atlas=next;
  }catch(error){$('#loading').textContent='Could not load assets. Choose the hero again to retry.';$('#hero').value=heroId;return;}
 }
 heroId=requested;clips=rosterClips[heroId];elapsed=0;
 for(const s of states){
  s.stage.scene.remove(s.model);s.model=buildHero(heroId,s.C,HERO_SIGNATURES[heroId]);s.stage.scene.add(s.model);
  s.materials.clear();s.model.traverse(o=>{if(o.isMesh)s.materials.set(o,o.material)});
  if(s.mode==='sprite'){if(s.sprite){s.stage.scene.remove(s.sprite.sprite);s.sprite.dispose();}s.sprite=buildNovaSprite(atlas);s.stage.scene.add(s.sprite.sprite);}
  s.vfx.clear();
 }
 $('#silhouette').dispatchEvent(new Event('change'));
 $('#triangleCount').textContent=masterStats(heroId).triangles.toLocaleString();$('#paletteCount').textContent=atlas.manifest.palette.length;
 $('#motionNote').textContent=MOTION_NOTES[heroId];$('#loading').textContent='';
 $('#playMaster').href=`./?autoplay=1&hero=${heroId}&map=temple&art=master`;$('#playMaster').textContent=`Play with ${heroId[0].toUpperCase()+heroId.slice(1)} ↗`;
 $('#playLegacy').href=`./?autoplay=1&hero=${heroId}&map=temple&art=legacy`;
 for(const [id,file] of [['atlasDownload','atlas.png'],['metadataDownload','atlas.json'],['modelDownload','preview.glb']])$('#'+id).href=`./assets/heroes/${heroId}/${heroId}-${file}`;
 history.replaceState(null,'',`?hero=${heroId}`);$('#scrub').max=clips[$('#action').value].frames.reduce((n,f)=>n+f.duration,0)-1;
 if(window.__artLab){window.__artLab.atlas=atlas;window.__artLab.clips=clips;}
}
$('#hero').addEventListener('change',()=>updateHero());
$('#finished').addEventListener('change',()=>updateHero());
$('#trigger').addEventListener('click',()=>{
 const facing=Number($('#facing').value)*Math.PI/4,dir={x:Math.sin(facing),z:Math.cos(facing)},kind=$('#effect').value;
 for(const s of states){s.vfx.clear();if(SKILL_ART[kind]){s.vfx.skill(kind,{x:0,y:.08,z:0},dir);continue;}s.vfx.contact(kind,kind==='kick'||kind==='catch'?s.ball.position.clone():{x:0,y:.08,z:0},dir,kind==='elim'?'#dca541':'#fff7e5',kind==='elim'?1.6:1);}
});
function sceneChanged(){const v=$('#scene').value,arenaView=['temple','egolab','frost'].includes(v);for(const s of states){
 if(arenaView){
  const obstacle=v==='frost'?{kind:'tree',x:1.7,z:1.1,r:.52,h:2.1}:v==='egolab'?{kind:'crate',x:1.7,z:1.1,w:1,d:1,h:1.6}:{kind:'pillar',x:1.7,z:1.1,r:.52,h:2.1};
  s.arena.build(v,14,10,0,false,{obstacles:[obstacle,{kind:'low',x:-2.5,z:1,w:2.5,d:.5,h:.6}],zones:[{kind:v==='frost'?'snow':v==='egolab'?'boost':'grass',x:3.5,z:-2,w:2,d:2}]});s.stage.applyTheme(v,14,10);
 }
 s.arena.group.visible=arenaView;s.studio.visible=!arenaView;s.cover.visible=v==='cover';s.shadow.visible=!arenaView||!!s.sprite;
}}
$('#scene').addEventListener('change',sceneChanged);
$('#play').addEventListener('click',()=>{playing=!playing;$('#play').textContent=playing?'Pause':'Play';$('#play').setAttribute('aria-pressed',String(playing));});
$('#action').addEventListener('change',()=>{elapsed=0;$('#scrub').max=clips[$('#action').value].frames.reduce((sum,f)=>sum+f.duration,0)-1;});
$('#scrub').addEventListener('input',()=>{elapsed=Number($('#scrub').value);playing=false;$('#play').textContent='Play';$('#play').setAttribute('aria-pressed','false');});
$('#silhouette').addEventListener('change',()=>{const on=$('#silhouette').checked;for(const s of states){for(const [o,m] of s.materials)o.material=on?s.black:m;if(s.sprite)s.sprite.sprite.material.color.set(on?'#000000':'#ffffff');}});
const foot=new THREE.Vector3();
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;const action=$('#action').value,clip=clips[action],total=clip.frames.reduce((sum,f)=>sum+f.duration,0);if(playing)elapsed=(elapsed+dt*1000)%total;const facing=Number($('#facing').value),frame=frameAt(atlas.manifest,action,facing,elapsed);const pose=clip.frames[frame.index].pose;
 for(const s of states){
  s.model.rotation.y=facing*Math.PI/4;applyPose(s.model,s.mode==='legacy'?clip.frames[frame.index].basePose:pose);s.model.visible=!s.sprite;
  if(s.sprite)s.sprite.setFrame(frame);
  const ppu=Number($('#density').value),fit=s.stage.aspect<1?Math.pow(1/s.stage.aspect,.45):1;s.setZoom(s.stage.lowH/(2*ppu)/fit);
  footWorld(s.model,'R',foot);s.ball.position.copy(foot);s.ball.position.y=Math.max(.26,s.ball.position.y);s.ball.position.x+=.18;
  if(action==='pass'&&elapsed>=90){const t=(elapsed-90)/1000;s.ball.position.set(Math.sin(facing*Math.PI/4)*(t*9+.6),.3+Math.sin(t*6)*.55,Math.cos(facing*Math.PI/4)*(t*9+.6));}
  s.vfx.update(dt);s.stage.update(dt);s.stage.render();
 }
 $('#scrub').value=String(Math.round(elapsed));$('#frameInfo').textContent=`${action.toUpperCase()} · ${frame.index+1}/${clip.frames.length} · ${Math.round(elapsed)} ms${frame.event?' · '+frame.event.toUpperCase():''}`;
 requestAnimationFrame(tick);
}
await updateHero(false);sceneChanged();requestAnimationFrame(tick);
// Read-only inspection surface for repeatable visual regression captures.
window.__artLab={states,atlas,clips,rosterClips};
