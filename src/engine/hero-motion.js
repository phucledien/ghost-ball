// The same deterministic pose treatment is used by live rigs and Blender bakes.
// Timings and gameplay events remain in the existing action system.
export const HERO_SCALE={nova:[1,1,1],bolt:[.88,1.02,.92],titan:[1.27,1.04,1.18],jinx:[.94,.92,.96],echo:[.90,1.09,.94],kaiz:[.86,1.07,.90]};
export const MOTION_NOTES={
 nova:'Balanced stance, open passing arm and measured follow-through.',
 bolt:'Forward drive, compact elbows and tighter arm carriage.',
 titan:'Low body bounce, broad elbows and controlled upper-body rotation.',
 jinx:'Asymmetric arms, tilted head and a twisting upper body.',
 echo:'Relaxed shoulders, low bounce and a soft backward lean.',
 kaiz:'Upright carriage, narrow elbows and restrained shoulder rotation.',
};
export function heroPose(heroId, input) {
 if(input.authoredFor===heroId || !HERO_SCALE[heroId])return input;
 const p={...input,authoredFor:heroId};
 const moving=Math.min(1,(Math.abs(p.hipL)+Math.abs(p.hipR))*.6);
 if(heroId==='bolt'){p.lean+=.14*moving;p.head-=.08*moving;p.shLz*=.72;p.shRz*=.72;p.elL+=.22*moving;p.elR+=.22*moving;p.twist*=.82;}
 if(heroId==='titan'){p.y*=.55;p.squash=1+(p.squash-1)*.6;p.lean*=.78;p.twist*=.72;p.shLz+=.13;p.shRz+=.13;p.elL*=.85;p.elR*=.85;}
 if(heroId==='jinx'){p.twist=p.twist*1.12+.055;p.head-=.08;p.shLz+=.14;p.shRz+=.025;p.elL+=.12;}
 if(heroId==='echo'){p.y*=.65;p.lean=p.lean*.8-.065;p.shL-=.10;p.shR-=.10;p.head+=.09;p.squash=1+(p.squash-1)*.75;}
 if(heroId==='kaiz'){p.lean*=.67;p.twist*=.8;p.shLz*=.80;p.shRz*=.80;p.head-=.035;}
 // A planted ankle travels backwards by precisely the distance that moves the
 // player forwards. Two-bone IK and counter-rotated boots keep that sole flat.
 if(input.grounded && input.gait){
  const {speed,phase,stride,bob}=input.gait,sy=HERO_SCALE[heroId][1];
  const blend=Math.min(1,speed/.3),step=gaitStepLength(heroId,speed,stride);
  p.squash=1;
  p.y=.006-sy*(.012+.155*blend)+Math.cos(phase*2)*.012*sy*Math.min(1,bob)*blend;
  const hipY=.88*sy+p.y;
  for(const [side,offset] of [['L',0],['R',Math.PI]]){
   const u=((phase+offset)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)/(Math.PI*2);
   const stance=u<RUN_STANCE,t=stance?u/RUN_STANCE:(u-RUN_STANCE)/(1-RUN_STANCE);
   const z=(stance ? .5-t : -.5+(1-Math.cos(t*Math.PI))/2)*step*blend;
   const lift=stance?0:Math.sin(t*Math.PI)*.22*sy*blend;
   const down=hipY-(.06*sy+.006+lift),a=.43*sy,b=.39*sy;
   const knee=Math.acos(Math.max(-1,Math.min(1,(down*down+z*z-a*a-b*b)/(2*a*b))));
   const hip=Math.atan2(z,down)+Math.atan2(b*Math.sin(knee),a+b*Math.cos(knee));
   p['hip'+side]=hip;p['knee'+side]=knee;p['ankle'+side]=hip-knee;
  }
 }
 p.secondary=Math.max(-.22,Math.min(.22,p.lean*.24+p.twist*.12));
 return p;
}

export const RUN_STANCE=.36;
// Each leg has a planted interval followed by recovery and a short flight.
// The same stance distance drives sampling
// and the simulation's distance-based clock (including collisions).
export function gaitStepLength(heroId,speed,stride=1){
 return .88*(HERO_SCALE[heroId]?.[1]||1)*Math.max(.2,Math.min(1.1,stride))*Math.max(.18,Math.min(1,speed));
}
