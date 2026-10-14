// Cosmetic parts share the authored master's low-poly planes and named pivots.
// The six original hair silhouettes are reused at normalized head proportions;
// the extra silhouettes below are explicit geometry, never a legacy character.
import { HERO_SCALE } from './hero-motion.js';

const HAIR_SOURCE={spike:'nova',long:'bolt',buzz:'titan',bob:'jinx',messy:'echo',swept:'kaiz'};
export const isHairPart=p=>/^(Hair|Ponytail|BuzzCut|Bob|SweptCrest)/.test(p.name);
const scaleFor=(hero,parent)=>{const s=HERO_SCALE[hero];return parent==='head'||(hero==='bolt'&&parent==='secondary')?[s[0]**.38,s[1],s[2]**.5]:[s[0]*(hero==='titan'&&/^(sh|el)\./.test(parent)?1.12:1),s[1],s[2]];};
const GOLD=['#8b612b','#e5b456','#ffe094'], INK=['#0e1724','#243449','#42576e'], ICE=['#277b91','#66d8e5','#b9f6f0'];
export function masterCosmeticParts(heroId,lo,masters) {
 const out=[],own=masters[heroId];
 const transplant=(source,filter,paletteFor=()=>null)=>{
  for(const p of masters[source].meshes.filter(filter)){
   const parent=p.parent==='secondary'?(source==='bolt'?(heroId==='bolt'?'secondary':'head'):(heroId==='echo'?'secondary':'body')):p.parent;
   const from=scaleFor(source,p.parent),to=scaleFor(heroId,parent);
   out.push({...p,parent,positions:p.positions.map((v,i)=>v*to[i%3]/from[i%3]),palette:paletteFor(p)});
  }
 };
 const form=(name,parent,levels,palette,ox=0,bevel=.20)=>{
  const verts=[],positions=[],tones=[],s=scaleFor(heroId,parent);
  for(const [y,w,d,z=0] of levels){const b=Math.min(w,d)*bevel;for(const [x,t] of [[-w/2+b,-d/2],[w/2-b,-d/2],[w/2,-d/2+b],[w/2,d/2-b],[w/2-b,d/2],[-w/2+b,d/2],[-w/2,d/2-b],[-w/2,-d/2+b]])verts.push([(x+ox)*s[0],y*s[1],(t+z)*s[2]]);}
  const tri=(a,b,c,t)=>{for(const i of [a,b,c]){positions.push(...verts[i]);tones.push(t);}};
  for(let j=1;j<7;j++){tri(0,j+1,j,0);const k=(levels.length-1)*8;tri(k,k+j,k+j+1,2);}
  for(let i=0;i<levels.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=b+8,d=a+8,t=[0,0,1,1,2,2,1,0][j];tri(a,b,c,t);tri(a,c,d,t);}
  out.push({name,parent,role:name==='HairTie'?'cream':name.startsWith('Hair')?'hair':'cosmetic',palette,positions,tones});
 };
 const box=(name,parent,x,y,z,w,h,d,palette)=>form(name,parent,[[y-h/2,w,d,z],[y+h/2,w,d,z]],palette,x);
 // Hat takes the top silhouette; short side/back hair remains visible beneath it.
 const hair=lo.headwear==='cap'?'buzz':lo.hair;
 if(HAIR_SOURCE[hair])transplant(HAIR_SOURCE[hair],isHairPart);
 else {
  const col=own.palette.hair;
  form('HairBase','head',[[.33,.445,.37,-.035],[.46,.44,.36,-.035],[.49,.34,.28,-.045]],col);
  if(hair==='mohawk')form('HairMohawk','head',[[.43,.12,.39,-.01],[.69,.14,.36,-.04],[.73,.075,.27,-.07]],col);
  if(hair==='bun'){
   form('HairSlickBack','head',[[.39,.42,.38,-.05],[.54,.37,.40,-.10],[.57,.25,.28,-.17]],col);
   form('HairBun','head',[[.42,.19,.17,-.32],[.52,.28,.25,-.33],[.63,.22,.22,-.31],[.65,.12,.14,-.30]],col);
   box('HairTie','head',0,.47,-.265,.19,.065,.12,own.palette.cream);
  }
  if(hair==='afro')form('HairAfro','head',[[.24,.49,.39,-.08],[.38,.64,.51,-.065],[.59,.62,.50,-.07],[.69,.43,.37,-.08]],col,0,.28);
  if(hair==='slick'){
   form('HairSlick','head',[[.37,.43,.38,-.05],[.52,.44,.42,-.085],[.55,.31,.32,-.15]],col);
   for(const x of [-.12,0,.12])box('HairComb','head',x,.54,-.095,.04,.025,.29,[col[0],col[1],col[2]]);
  }
 }
 if(lo.eyewear==='goggles')transplant('jinx',p=>p.name.startsWith('Goggle'),p=>heroId==='jinx'?null:p.name.includes('Lens')?ICE:INK);
 else if(lo.eyewear==='visor'){
  box('VisorFrame','head',0,.26,.198,.41,.10,.045,INK);
  box('VisorLens','head',0,.267,.225,.35,.061,.012,ICE);
 } else if(lo.eyewear==='round'){
  for(const s of [-1,1]){form('RoundFrame','head',[[.195,.10,.025,.209],[.225,.145,.025,.209],[.285,.145,.025,.209],[.31,.10,.025,.209]],GOLD,s*.105,.3);form('RoundLens','head',[[.213,.07,.008,.226],[.235,.108,.008,.226],[.275,.108,.008,.226],[.294,.07,.008,.226]],ICE,s*.105,.3);}
  box('GlassesBridge','head',0,.26,.215,.075,.025,.025,GOLD);
 } else if(lo.eyewear==='paint'||lo.eyewear==='blacks'){
  const paint=lo.eyewear==='paint';for(const s of [-1,1]){box('CheekMark','head',s*.12,paint?.18:.20,.187,paint?.055:.12,paint?.10:.033,.012,paint?own.palette.blue:INK);if(paint)box('CheekMark2','head',s*.18,.18,.173,.025,.10,.012,own.palette.cream);}
 }
 if(lo.headwear==='circlet')transplant('kaiz',p=>p.name.startsWith('Circlet'),p=>p.name.includes('Gem')?ICE:GOLD);
 else if(['headband','sweatband','bandana'].includes(lo.headwear)){
  const bandana=lo.headwear==='bandana',wide=lo.headwear!=='headband';
  form('HeadBand','head',[[.315,.49,.48,.015],[wide?.41:.36,.49,.48,.015]],bandana?own.palette.blue:own.palette.cream);
  if(bandana){form('BandanaPoint','head',[[.255,.03,.025,.216],[.33,.22,.025,.216]],own.palette.blue);box('BandanaTail','head',.23,.33,-.19,.08,.18,.16,own.palette.blue);}
  else if(!wide)box('HeadBandTie','head',.21,.31,-.19,.055,.16,.12,own.palette.cream);
 } else if(lo.headwear==='cap'){
  form('CapCrown','head',[[.355,.49,.42,-.025],[.51,.49,.42,-.025],[.59,.35,.31,-.025]],own.palette.blue);
  box('CapBackBrim','head',0,.37,-.30,.43,.045,.24,own.palette.navy);
  box('CapStrap','head',0,.375,.195,.20,.055,.02,own.palette.cream);
 }
 if(lo.accessory==='chain')transplant('titan',p=>p.name.startsWith('Chain'),()=>GOLD);
 if(lo.accessory==='scarf')transplant('echo',p=>p.name.startsWith('Scarf'),()=>own.palette.cream);
 if(lo.accessory==='armband')box('CaptainBand','sh.L',0,-.22,0,.26,.09,.26,GOLD);
 if(lo.accessory==='earring'){
  box('EarringStem','head',.257,.18,.045,.035,.08,.04,GOLD);
  box('EarringPendant','head',.257,.135,.045,.07,.06,.045,GOLD);
 }
 return out;
}
