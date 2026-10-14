import './showcase.css';
import * as THREE from 'three';
import {Stage} from '../engine/stage.js';
import {Arena} from '../engine/arena.js';
import {VFX} from '../engine/vfx.js';
import {Audio} from '../engine/audio.js';
import {buildHero,applyPose} from '../engine/hero-model.js';
import {buildBall} from '../engine/props.js';
import {POSES,actionPose,locomotionPose,totalDuration} from '../engine/anim.js';
import {HEROES,HERO_BY_ID,phasesFor} from '../game/heroes.js';
import {COSMETIC_SLOTS,resolveLoadout} from '../game/cosmetics.js';
import {ITEMS,itemDetails} from '../game/items.js';
import {MAPS,resolveMap} from '../game/maps.js';
import {SCHEMA} from '../core/schema.js';
import {SKILL_ART} from '../engine/skill-art.js';
import clips from '../../art/specs/roster-clips.json';
const $=s=>document.querySelector(s);
const chapters={characters:['01','Characters','Meet your next striker.','Six distinct rigs. Rotate, dress and animate each character, then compare the pixel sprite bake.'],sounds:['02','Sounds','Hear the game come alive.','Audition the game’s synthesised sound effects and music. Audio starts only when you press play.'],items:['03','Item VFX','Small pickup. Big entrance.','Assembling armor, flowing wind and breaking ice. Replay every item from activation to expiry.'],skills:['04','Skills','Make an impact.','Twelve signature casts. Inspect the windup, contact and recovery, then try the ability in a match.'],arenas:['05','Arenas','Choose your ground.','Explore the actual arena geometry. Orbit the court, inspect its terrain and jump into a match.']};
let section=Object.hasOwn(chapters,location.hash.slice(1))?location.hash.slice(1):'characters';
let hero='nova',item='shield',skill='nova.atk',map='temple',scene='studio',action='idle',facing=180,pixel=2,zoom=3.9,view='game';
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,loop=true,speed=1,elapsed=0,duration=2,castAt=.12,cast=false,shield=null,loadout=resolveLoadout(hero),model=null,phone=false,soundOn=false;
const defaults=Object.fromEntries(SCHEMA.map(s=>[s.key,s.v]));
const C=k=>({'camera.zoom':zoom,'camera.pitch':36,'camera.yaw':45,'render.pixelScale':pixel,'render.shadows':true,'render.contrast':1,'render.saturate':1,'render.sun':1.15,'render.ambient':1,'art.heroStyle':'master'}[k]??defaults[k]);
$('#showcase').innerHTML=`<header><a class="brand" href="./showcase.html#characters">GHOST<br>BALL<span>●</span></a><span class="header-label">INTERACTIVE SHOWCASE</span><div class="links"><a href="https://ghost-ball-art-direction.phucledien.chatgpt.site/plan.html">Art plan ↗</a><a class="primary" href="./index.html">Play game ↗</a></div></header><div class="shell"><nav aria-label="Showcase sections"><p class="nav-label">EXPLORE THE GAME</p>${Object.entries(chapters).map(([id,s])=>`<button data-section="${id}" aria-pressed="false"><b>${s[0]}</b>${s[1]}</button>`).join('')}<p class="nav-note">Built to be played.<br>Live game assets, shared effects.<br>Art revision 08</p></nav><main><div class="intro"><div><p class="eyebrow" id="eyebrow"></p><h1 id="heading"></h1></div><p id="intro"></p></div><div class="workspace"><div><div class="stage-wrap"><div class="stage-toolbar"><span id="stageName" class="stage-name"></span><span class="stage-tag" id="stageTag">LIVE 3D</span></div><div id="viewport"></div><div class="sound-deck" id="soundDeck"></div><div class="stage-caption"><span id="phase">IDLE</span><span id="stageNote">CRISP PIXELS · LIVE GAME RIG</span></div></div><div class="playback" id="playback"><button id="toggle" aria-pressed="true">Pause</button><button id="replay">↻ Replay</button><label class="check"><input type="checkbox" id="loop" checked> Loop</label><label>Speed<select id="speed"><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><div class="timeline"><input id="timeline" aria-label="Animation timeline" type="range" min="0" max="2" step=".0166667" value="0"><output id="time">0.00 / 2.00 s</output></div></div><div id="shelf" class="shelf" aria-label="Asset selection"></div></div><aside class="side-panel"><div id="controls"></div></aside></div><details id="reference" class="reference"><summary>From image-generated keyframes to animated game geometry</summary><img src="./assets/vfx/direction.png" alt="Generated VFX direction sheet: shield, cleats, power shot and freeze, showing windup, impact, active and dissipating states" loading="lazy"><p>The generated sheet sets the art direction. The playable effects are authored geometry with animated facets, tapered ribbons and bright cores. They use the game’s actual status timers; the sheet is a concept, not a screenshot of gameplay.</p><a href="./assets/vfx/direction-prompt.txt">Read the image-generation prompt ↗</a></details><div class="bottom-links"><span>GHOST BALL / ART & PLAY</span><div><a href="./art.html">Sprite comparison lab ↗</a> · <a href="./device.html">Device check ↗</a> · <a href="https://ghost-ball-art-direction.phucledien.chatgpt.site/plan.html">Plan & source files ↗</a></div></div></main></div>`;
const stage=new Stage($('#viewport'),C,{preserve:true});stage.applyTheme('temple');stage.target.set(0,.7,0);
const arena=new Arena(stage.scene),vfx=new VFX(stage.scene,C),audio=new Audio();audio.setVolumes(0,0);
const studio=new THREE.Group();stage.scene.add(studio);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:'#253440'}));floor.receiveShadow=true;floor.position.y=-.035;studio.add(floor);
const grid=new THREE.GridHelper(40,40,'#536573','#344550');grid.material.transparent=true;grid.material.opacity=.28;grid.position.y=-.02;studio.add(grid);
const disc=new THREE.Mesh(new THREE.RingGeometry(2.1,2.12,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#546776'}));disc.position.y=.002;studio.add(disc);
const ball=buildBall(.26);stage.scene.add(ball);
const actor={x:0,y:0,z:0,fx:0,fz:1,vx:0,vz:0,alive:true,human:true,t:{cleats:0,cloak:0},freeze:0,magnet:false,action:null};
const sndNames={kick:'Kick',catch:'Catch',dash:'Dash',skill:'Skill cast',power:'Power shot',wall:'Stone wall',block:'Shield block',item:'Pickup',useItem:'Use item',bounce:'Ball bounce',it:'Last touch',tick:'Timer tick',go:'Kickoff',buzzer:'Buzzer',boom:'Explosion',elim:'Elimination',cheer:'Crowd',win:'Victory',ui:'Select',uiMove:'Navigate',uiBack:'Back',uiStart:'Start'};
const select=(id,label,options,value)=>`<label class="control">${label}<select id="${id}">${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${l}</option>`).join('')}</select></label>`;
function newModel(){if(model)stage.scene.remove(model);model=buildHero(hero,C,loadout);stage.scene.add(model);}
function reset(){
 vfx.clear();shield=null;elapsed=0;cast=false;actor.action=null;actor.x=actor.z=actor.y=actor.vx=actor.vz=0;actor.t={cleats:0,cloak:0};actor.freeze=0;actor.magnet=false;
 if(section==='characters')duration=clips[hero][action].frames.reduce((n,f)=>n+f.duration,0)/1000;
 else if(section==='items'){duration=(item==='shield'?C('item.shield.dur'):item==='cleats'?C('item.cleats.dur'):item==='cloak'?C('item.cloak.dur'):item==='whistle'?C('item.whistle.dur'):item==='magnet'?3:1)+.65;castAt=.12;}
 else if(section==='skills'){
  const phases=phasesFor(skill,C);duration=Math.max(1.6,totalDuration(phases)+.6);castAt=0;
  for(const ph of phases){if(ph.name===SKILL_ART[skill].phase)break;castAt+=ph.dur;}
  actor.action={id:skill,phases};vfx.skillWindup(skill,actor,castAt,SKILL_ART[skill].color);
 }else duration=14.4;
 $('#timeline').max=duration;$('#timeline').value=0;updateScene(0);
}
function buildScene(){
 arena.dispose();const arenaMode=section==='arenas';studio.visible=!arenaMode&&scene==='studio';
 if(!studio.visible){const M=resolveMap(arenaMode?map:scene,C);arena.build(M.theme,M.W,M.D,arenaMode?.55:0,arenaMode,M);stage.applyTheme(M.theme);}
 else stage.applyTheme('egolab');
 stage.scene.background=new THREE.Color('#14202c');
 zoom=arenaMode?20:section==='items'&&item==='whistle'?5.5:section==='skills'?3.8:section==='characters'?2.65:3.25;
 stage.view=arenaMode?view:'game';stage.target.set(0,arenaMode?0:.7,0);stage.zoomMul=1;
 if(model)model.visible=section!=='arenas'&&section!=='sounds';ball.visible=section!=='arenas'&&section!=='sounds';
}
function triggerCast(){
 cast=true;
 if(section==='items'){
  vfx.itemActivation(item,actor,C('item.whistle.radius'));
  if(item==='shield'){shield=vfx.makeShield('#70caff');shield.mesh.position.set(actor.x,.95,actor.z);}
  if(item==='magnet')actor.magnet=true;
 }else if(section==='skills')vfx.skill(skill,actor,{x:0,z:1});
 if(soundOn)audio.play(section==='items'?'useItem':skill.includes('titan')?'power':'skill');
}
function updateScene(dt,render=true){
 if(!model||section==='sounds')return;
 if(section==='characters'){
  let ms=(elapsed*1000)%Math.max(1,duration*1000),frame=clips[hero][action].frames[0];
  for(const f of clips[hero][action].frames){frame=f;if(ms<f.duration)break;ms-=f.duration;}
  applyPose(model,frame.pose);model.position.set(0,0,0);model.rotation.y=facing*Math.PI/180;ball.position.set(.6,.26,.3);
 }else if(section==='items'||section==='skills'){
  if(!cast&&elapsed>=castAt)triggerCast();
  const age=Math.max(0,elapsed-castAt),remaining=Math.max(0,duration-.65-age);
  actor.fx=0;actor.fz=1;
  actor.z=item==='cleats'&&section==='items'?age*1.1:0;actor.vz=section==='items'&&item==='cleats'?4:0;
  model.position.set(actor.x,0,actor.z);model.rotation.y=0;
  if(section==='skills')applyPose(model,actionPose(actor.action.phases,elapsed));
  else applyPose(model,item==='cleats'?locomotionPose(1,elapsed*9):item==='whistle'&&cast&&remaining>0?POSES.stun:POSES.idle);
  if(section==='items'&&cast){
   actor.t.cleats=item==='cleats'?remaining:0;actor.t.cloak=item==='cloak'?remaining:0;actor.freeze=item==='whistle'?remaining:0;actor.magnet=item==='magnet'&&remaining>0;
   vfx.syncItemEffects([actor],dt);
   if(shield){shield.mesh.position.set(actor.x,.95,actor.z);if(remaining>0)shield.update(remaining,C('item.shield.dur'),dt);else{shield.dispose();shield=null;vfx.itemEnd('shield',actor);}}
  }
  const attack=section==='skills'&&skill.endsWith('.atk')&&!['bolt.atk'].includes(skill);
  ball.position.set(actor.x+.18,.28,actor.z+.65+(attack&&cast?Math.min(7,age*7):0));
  // Stable identity is required for the trajectory history.
  if(attack&&cast){Object.assign(demoBall,{x:ball.position.x,y:.28,z:ball.position.z,color:SKILL_ART[skill].color});vfx.syncBallWakes([demoBall],dt);}else vfx.syncBallWakes([],dt);
  stage.target.set(actor.x,.65,actor.z+(attack&&cast?Math.min(1.1,age):0));
 }
 vfx.update(dt);if(!render)return;
 if(section==='arenas')stage.orbitT=elapsed;stage.update(section==='arenas'?0:dt);stage.render();
 const phase=section==='characters'?action.toUpperCase():section==='arenas'?'EXPLORE / '+view.toUpperCase():elapsed<castAt?'WINDUP':elapsed<castAt+.16?'IMPACT':elapsed<duration-.55?'ACTIVE':'DISSIPATE';
 let status=phase;
 if(section==='items'&&cast){const left=Math.max(0,duration-.65-(elapsed-castAt));status=left>0?(item==='magnet'?'READY · NEXT PASS':item==='overclock'?'COOLDOWNS RESET':`ACTIVE · ${left.toFixed(1)} s`):'DISSIPATE';}
 $('#phase').textContent=status;$('#timeline').value=elapsed;$('#time').textContent=`${elapsed.toFixed(2)} / ${duration.toFixed(2)} s`;
}
const demoBall={state:'flight',vx:0,vz:7,x:0,y:.28,z:0,color:'#ffd173'};
function seek(t){const was=playing;reset();const target=Math.min(duration,t);while(elapsed<target-1e-7){const dt=Math.min(1/60,target-elapsed);elapsed+=dt;updateScene(dt,false);}updateScene(0);playing=was;}
function setPlaying(value){playing=value;$('#toggle').textContent=value?'Pause':'Play';$('#toggle').setAttribute('aria-pressed',String(value));}
function shelf(){
 let rows=section==='characters'?HEROES.map(h=>[h.id,h.name,h.role,h.fx]):section==='items'?Object.entries(ITEMS).map(([id,it])=>[id,it.name,id==='magnet'?'Next targeted pass':id==='overclock'?'Instant':'Timed effect',it.color]):section==='skills'?HEROES.map(h=>[h.id,h.name,h.role,h.fx]):section==='arenas'?Object.entries(MAPS).map(([id,m])=>[id,m.name,m.size,'#f1b843']):[];
 const current=section==='characters'?hero:section==='items'?item:section==='skills'?hero:map;
 $('#shelf').innerHTML=rows.map(([id,name,note,color])=>`<button class="asset-card" data-asset="${id}" aria-pressed="${id===current}" style="--card-color:${color}">${section==='arenas'?`<img src="./assets/maps/${id}.png" alt="">`:'<span class="swatch"></span>'}<b>${name}</b><small>${note}</small></button>`).join('');
 $('#shelf').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(section==='items')item=b.dataset.asset;else if(section==='arenas')map=b.dataset.asset;else {hero=b.dataset.asset;loadout=resolveLoadout(hero);skill=hero+'.'+skill.split('.')[1];}renderSection();});
}
function renderSection(){
 audio.stopMusic();audio.wanted=null;if(section!=='sounds')audio.setVolumes(soundOn?.5:0,0);
 const ch=chapters[section];$('#eyebrow').textContent=ch[0]+' / '+ch[1].toUpperCase();$('#heading').textContent=ch[2];$('#intro').textContent=ch[3];
 document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===section)));
 $('#reference').classList.toggle('hidden',!['items','skills'].includes(section));$('#soundDeck').classList.toggle('visible',section==='sounds');$('#playback').classList.toggle('hidden',section==='sounds'||section==='arenas'&&view!=='orbit');
 const sceneControl=select('scene','Backdrop',[['studio','Studio'],['temple','Sun Temple'],['egolab','Ego Lab'],['frost','Frost Peak']],scene);
 const pixelControl=select('pixel','Pixel size',[[1,'Fine · 1 px'],[2,'Crisp · 2 px'],[3,'Classic · 3 px']],pixel);
 const common=`<div class="split">${pixelControl}${select('framing','Framing',[['wide','Wide'],['phone','Phone']],phone?'phone':'wide')}</div>`;
 let html='';
 if(section==='characters'){
  const h=HERO_BY_ID[hero];$('#stageName').textContent=h.name;$('#stageTag').textContent=h.role.toUpperCase();
  html=`<h2>${h.title}</h2><p>${h.blurb}</p>${select('action','Animation',Object.keys(clips[hero]).map(a=>[a,a[0].toUpperCase()+a.slice(1)]),action)}<label class="control">Facing · <output id="facingValue">${facing}°</output><input id="facing" type="range" min="0" max="360" step="45" value="${facing}"></label><details class="cosmetic"><summary>Customize this striker</summary>${COSMETIC_SLOTS.map(s=>select('cosmetic-'+s.id,s.label,s.options.map(o=>[o.id,o.name]),loadout[s.id])).join('')}<button id="resetLook">Reset signature look</button></details>${common}<div class="details"><strong>The same master rig used in matches.</strong><p>All hairstyles, kit colors and accessories stay on the new character.</p><a href="./art.html?hero=${hero}">Compare live rig & pixel sprites ↗</a></div>`;
 }else if(section==='items'){
  const it=ITEMS[item],d=itemDetails(item,C);$('#stageName').textContent=it.name;$('#stageTag').textContent='ITEM EFFECT';
  html=`<h2>${d.short}</h2><p>${d.effect}. ${d.condition}.</p>${sceneControl}${common}<label class="check"><input id="soundOn" type="checkbox" ${soundOn?'checked':''}> Sound on activation</label><button class="primary" id="activate">Activate ${it.name}</button><div class="details"><strong>${d.duration?d.duration+' seconds':d.condition}</strong><p>${item==='magnet'?'Orbit streams show that your guided pass is ready. This preview consumes it after 3 seconds.':item==='overclock'?'The gold pulse confirms that dash and both skills are ready again. This is an instant effect.':'Replay shows activation, the active duration and expiry. Ground segments drain with the timer.'}</p><a href="./index.html?autoplay=1&hero=${hero}&map=${map}">Try items in a match ↗</a></div>`;
 }else if(section==='skills'){
  const h=HERO_BY_ID[hero],slot=skill.split('.')[1],s=h[slot];$('#stageName').textContent=s.name;$('#stageTag').textContent=h.name+' / '+(slot==='atk'?'ATTACK':'DEFENSE');
  html=`<h2>${h.name} / ${h.title.replace('The ','')}</h2><p>${s.desc}</p>${select('skill','Ability',[[hero+'.atk',h.atk.name+' · attack'],[hero+'.def',h.def.name+' · defense']],skill)}${sceneControl}${common}<label class="check"><input id="soundOn" type="checkbox" ${soundOn?'checked':''}> Sound on cast</label><button class="primary" id="activate">Cast ${s.name}</button><div class="details"><strong>Pose & VFX preview</strong><p>Cast timing follows the game’s phase data. Targeting, collisions and tactical effects can be tested in the match.</p><a href="./index.html?autoplay=1&hero=${hero}&map=${map}">Play ${h.name} in a match ↗</a></div>`;
 }else if(section==='arenas'){
  const m=MAPS[map];$('#stageName').textContent=m.name;$('#stageTag').textContent=m.size.toUpperCase()+' ARENA';
  html=`<h2>Explore the court</h2><p>${m.desc}</p>${select('view','Camera',[['game','Game angle'],['orbit','Orbit'],['top','Tactical top view']],view)}<label class="control">Zoom<input id="zoom" type="range" min=".45" max="1.5" step=".05" value="1"></label>${common}<button class="primary" id="resetCamera">Reset camera</button><div class="details"><strong>${m.obstacles.length} obstacles · ${m.zones.length} terrain zones</strong><p>Geometry and terrain are loaded directly from the game.</p><a href="./index.html?autoplay=1&hero=${hero}&map=${map}">Play this arena ↗</a></div>`;
 }else{
  $('#stageName').textContent='The sound board';$('#stageTag').textContent='WEB AUDIO';$('#phase').textContent='PRESS A PAD TO LISTEN';
  html=`<h2>Turn it up.</h2><p>Every pad plays the sound used in the game. Music loops until you stop it or leave this section.</p><label class="control">Effects volume<input id="sfxVolume" type="range" min="0" max="1" step=".05" value=".6"></label><label class="control">Music volume<input id="musicVolume" type="range" min="0" max="1" step=".05" value=".35"></label>${select('music','Music loop',[['menu','Menu groove · 104 BPM'],['match','Match drive · 140 BPM']],'menu')}<button class="primary" id="musicPlay">Play music</button><button id="stopAudio" style="width:100%;margin-top:10px">Stop all audio</button><div class="details"><strong>Original procedural soundtrack</strong><p>Square-wave leads, triangle bass and shaped noise percussion, synthesised in your browser.</p></div>`;
  $('#soundDeck').innerHTML=`<div class="sound-grid">${Object.entries(sndNames).map(([id,name])=>`<button class="sound-pad" data-sound="${id}"><span>▷</span>${name}</button>`).join('')}</div>`;
 }
 $('#controls').innerHTML=html;$('#stageNote').textContent=section==='arenas'?'ACTUAL ARENA GEOMETRY':section==='sounds'?'22 SOUND EFFECTS · 2 MUSIC LOOPS':section==='characters'?'CRISP PIXELS · LIVE GAME RIG':'LIVE ANIMATION · SHARED GAME EFFECTS';
 newModel();buildScene();reset();shelf();bindControls();setPlaying(playing);history.replaceState(null,'',location.pathname+location.search+'#'+section);
}
function bindControls(){
 const on=(id,fn,event='change')=>{const e=$('#'+id);if(e)e.addEventListener(event,fn);};
 on('action',e=>{action=e.target.value;reset();});on('facing',e=>{facing=+e.target.value;$('#facingValue').textContent=facing+'°';updateScene(0);},'input');
 for(const slot of COSMETIC_SLOTS)on('cosmetic-'+slot.id,e=>{loadout[slot.id]=e.target.value;newModel();updateScene(0);});
 on('resetLook',()=>{loadout=resolveLoadout(hero);renderSection();},'click');
 on('scene',e=>{scene=e.target.value;buildScene();reset();});on('pixel',e=>{pixel=+e.target.value;stage.resize();updateScene(0);});
 on('framing',e=>{phone=e.target.value==='phone';$('#viewport').classList.toggle('phone',phone);stage.resize();updateScene(0);});
 on('skill',e=>{skill=e.target.value;renderSection();});on('activate',()=>{reset();setPlaying(true);},'click');
 on('view',e=>{view=e.target.value;stage.view=view;$('#playback').classList.toggle('hidden',view!=='orbit');updateScene(0);});on('zoom',e=>{stage.zoomMul=+e.target.value;updateScene(0);},'input');
 on('resetCamera',()=>{stage.orbitT=0;view='game';renderSection();},'click');
 on('soundOn',e=>{soundOn=e.target.checked;audio.start();audio.setVolumes(soundOn?.5:0,0);});
 const volumes=()=>{audio.start();audio.setVolumes(+$('#sfxVolume').value,+$('#musicVolume').value);};
 on('sfxVolume',volumes,'input');on('musicVolume',volumes,'input');
 on('musicPlay',()=>{volumes();if(audio.track){audio.stopMusic();audio.wanted=null;$('#musicPlay').textContent='Play music';}else{audio.playMusic($('#music').value);$('#musicPlay').textContent='Pause music';}},'click');
 on('music',()=>{if(audio.track){volumes();audio.playMusic($('#music').value);}});
 on('stopAudio',()=>{audio.stopMusic();audio.wanted=null;audio.setVolumes(0,0);$('#musicPlay').textContent='Play music';$('#phase').textContent='AUDIO STOPPED';},'click');
 document.querySelectorAll('[data-sound]').forEach(b=>b.onclick=()=>{volumes();audio.play(b.dataset.sound);$('#phase').textContent='PLAYING / '+sndNames[b.dataset.sound].toUpperCase();b.classList.add('playing');setTimeout(()=>b.classList.remove('playing'),400);});
}
for(const b of document.querySelectorAll('[data-section]'))b.onclick=()=>{section=b.dataset.section;renderSection();};
window.addEventListener('hashchange',()=>{const s=location.hash.slice(1);if(Object.hasOwn(chapters,s)&&s!==section){section=s;renderSection();}});
$('#toggle').onclick=()=>setPlaying(!playing);$('#replay').onclick=()=>{reset();setPlaying(true);};$('#loop').onchange=e=>loop=e.target.checked;$('#speed').onchange=e=>speed=+e.target.value;
$('#timeline').oninput=e=>{setPlaying(false);seek(+e.target.value);};
let last=performance.now();renderSection();
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden&&section!=='sounds'){
 if(playing){elapsed+=dt*speed;if(elapsed>=duration){if(loop)reset();else{elapsed=duration;setPlaying(false);}}updateScene(dt*speed);}else{stage.update(0);stage.render();}
 }requestAnimationFrame(tick);}
requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.stopMusic();audio.wanted=null;audio.setVolumes(0,0);if($('#musicPlay'))$('#musicPlay').textContent='Play music';}});
window.__showcase={stage,vfx,actor,audio,get section(){return section},get elapsed(){return elapsed},get duration(){return duration},seek,toggle:setPlaying,get model(){return model},revision:'animated-showcase-8'};
