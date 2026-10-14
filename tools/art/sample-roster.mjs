import fs from 'node:fs';
import {POSES,locomotionPose,lerpPose,actionPose} from '../../src/engine/anim.js';
import {heroPose,HERO_SCALE} from '../../src/engine/hero-motion.js';
import {HEROES,phasesFor} from '../../src/game/heroes.js';
import {SCHEMA} from '../../src/core/schema.js';
const defaults=Object.fromEntries(SCHEMA.map(s=>[s.key,s.v])),C=k=>defaults[k];
const f=(pose,duration,event)=>({pose,duration,...event?{event}:{}});
const actions={
 idle:{loop:true,frames:Array.from({length:4},(_,i)=>f(locomotionPose(0,i*Math.PI/2),150))},
 run:{loop:true,frames:Array.from({length:8},(_,i)=>f(locomotionPose(1,i*Math.PI/4),75))},
 pass:{loop:false,frames:[f(lerpPose(POSES.idle,POSES.coil,.5),45),f(POSES.coil,45),f(POSES.kick,50,'strike'),f(lerpPose(POSES.kick,POSES.follow,.6),70),f(POSES.follow,70),f(lerpPose(POSES.follow,POSES.idle,.75),120)]},
 catch:{loop:false,frames:[f(POSES.absorb,30,'catch'),f(POSES.absorb,30),f(lerpPose(POSES.absorb,POSES.idle,.5),90),f(POSES.idle,90)]},
 dash:{loop:false,frames:[f(lerpPose(POSES.idle,POSES.crouch,.5),40),f(POSES.crouch,40),f(POSES.sprint,70,'burst'),f(POSES.sprint,70),f(POSES.skid,90),f(lerpPose(POSES.skid,POSES.idle,.7),90)]},
 hit:{loop:false,frames:[f(POSES.stun,60,'hit'),f(POSES.stun,80),f(lerpPose(POSES.stun,POSES.idle,.5),100),f(POSES.idle,100)]},
 out:{loop:false,frames:Array.from({length:8},(_,i)=>f(i<3?lerpPose(POSES.idle,POSES.shock,(i+1)/3):lerpPose(POSES.shock,POSES.blown,(i-2)/5),80,i===3?'burst':undefined))},
 win:{loop:true,frames:Array.from({length:6},(_,i)=>f(lerpPose(POSES.idle,POSES.flex,.65+.35*Math.sin(i/6*Math.PI*2)),140))},
};
// Split phase intervals rather than uniform sampling: short event phases cannot disappear.
function skillClip(hero,slot,count){
 const phases=phasesFor(`${hero}.${slot}`,C),counts=phases.map(()=>1);
 while(counts.reduce((a,b)=>a+b,0)<count){let j=0;for(let i=1;i<phases.length;i++)if(phases[i].dur/counts[i]>phases[j].dur/counts[j])j=i;counts[j]++;}
 let start=0;const frames=[];
 phases.forEach((phase,i)=>{const duration=Math.round(phase.dur*1000),n=counts[i];for(let j=0;j<n;j++){
  const ms=Math.round((j+1)*duration/n)-Math.round(j*duration/n);
  frames.push(f(actionPose(phases,start+phase.dur*j/n),ms,j===0?phase.name:undefined));
 }start+=phase.dur;});return {loop:false,frames};
}
const roster={};
for(const hero of HEROES){
 const clips={...actions,attack:skillClip(hero.id,'atk',8),defense:skillClip(hero.id,'def',6)};
 roster[hero.id]=Object.fromEntries(Object.entries(clips).map(([id,clip])=>[id,{...clip,frames:clip.frames.map(fr=>({...fr,basePose:fr.pose,pose:heroPose(hero.id,fr.pose)}))}]));
 fs.writeFileSync(new URL(`../../art/specs/${hero.id}-clips.json`,import.meta.url),JSON.stringify(roster[hero.id],null,2)+'\n');
}
fs.writeFileSync(new URL('../../art/specs/roster-clips.json',import.meta.url),JSON.stringify(roster)+'\n');
console.log('Six heroes × 60 frames × 8 directions = 2880 frames.');
