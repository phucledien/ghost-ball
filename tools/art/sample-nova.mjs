// Bake source poses once; the runtime and Blender master share this exact data.
import fs from 'node:fs';
import { POSES, locomotionPose, lerpPose } from '../../src/engine/anim.js';
const clips={
 idle:{loop:true,frames:Array.from({length:4},(_,i)=>({pose:locomotionPose(0,i*Math.PI/2),duration:150}))},
 run:{loop:true,frames:Array.from({length:8},(_,i)=>({pose:locomotionPose(1,i*Math.PI/4),duration:75}))},
 pass:{loop:false,frames:[
  {pose:lerpPose(POSES.idle,POSES.coil,.5),duration:45},
  {pose:POSES.coil,duration:45},
  {pose:POSES.kick,duration:50,event:'strike'},
  {pose:lerpPose(POSES.kick,POSES.follow,.6),duration:70},
  {pose:POSES.follow,duration:70},
  {pose:lerpPose(POSES.follow,POSES.idle,.75),duration:120}
 ]},
 catch:{loop:false,frames:[
  {pose:lerpPose(POSES.idle,POSES.absorb,.55),duration:30,event:'catch'},
  {pose:POSES.absorb,duration:30},
  {pose:lerpPose(POSES.absorb,POSES.idle,.5),duration:90},
  {pose:POSES.idle,duration:90}
 ]}
};
fs.writeFileSync(new URL('../../art/specs/nova-clips.json',import.meta.url),JSON.stringify(clips,null,2)+'\n');
