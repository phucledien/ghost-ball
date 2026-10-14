// Field items. Picked up by walking over them; one slot; used with the item button.
import { addSchema, schemaHelpers as H } from '../core/schema.js';

export const ITEMS = {
  cleats: { name: 'Spring Cleats', color: '#5cc46a', desc: 'Big speed boost for a few seconds.', params: { dur: [3.5, 0.5, 10, 0.1, 'Duration (s)'], speed: [1.45, 1, 2.5, 0.05, 'Speed ×'] } },
  shield: { name: 'Ego Shield', color: '#5aa8ff', desc: 'The next ball that touches you bounces off.', params: { dur: [6, 1, 15, 0.5, 'Lasts up to (s)'] } },
  magnet: { name: 'Magnet Lace', color: '#ff5ab4', desc: 'Your next pass homes in on its target.', params: { homing: [9, 0, 20, 0.5, 'Homing strength'] } },
  cloak: { name: 'Cloak Flare', color: '#9a8cff', desc: 'Aim assist and bots ignore you for a while.', params: { dur: [3, 0.5, 8, 0.1, 'Duration (s)'] } },
  whistle: { name: 'Freeze Whistle', color: '#6af0ff', desc: 'Freeze everyone nearby for a moment.', params: { radius: [4, 1, 10, 0.25, 'Radius'], dur: [1, 0.2, 3, 0.05, 'Freeze (s)'] } },
  overclock: { name: 'Overclock', color: '#e8a93a', desc: 'Instantly reset your skill and dash cooldowns.', params: {} },
};

export const ITEM_IDS = Object.keys(ITEMS);

const entries = [];
for (const [id, it] of Object.entries(ITEMS)) {
  entries.push(H.bool(`item.${id}.on`, true, `${it.name} · enabled`));
  for (const [k, d] of Object.entries(it.params)) entries.push(H.num(`item.${id}.${k}`, ...d));
}
addSchema(entries);

// Shared, configuration-backed copy for held-item help and active timers.
export function itemDetails(id,C){
 const n=k=>Number(C(`item.${id}.${k}`));
 switch(id){
  case 'cleats':return {short:'Speed boost',effect:`Move ${n('speed').toFixed(2)}× faster`,duration:n('dur'),condition:'Starts when used'};
  case 'shield':return {short:'Block one ball',effect:'Reflect the next ball that hits you',duration:n('dur'),condition:'Ends on a block or timeout'};
  case 'magnet':return {short:'Guided pass',effect:'Your next targeted pass curves toward its receiver',condition:'Stays ready until a targeted pass'};
  case 'cloak':return {short:'Break targeting',effect:'Bots and aim assist cannot target you',duration:n('dur'),condition:'You can still be hit by a loose ball'};
  case 'whistle':return {short:'Freeze nearby',effect:`Freeze rivals within ${n('radius')} m for ${n('dur')} s`,condition:'Instant area effect'};
  case 'overclock':return {short:'Reset cooldowns',effect:'Make dash and both skills ready now',condition:'Instant · best used while cooling down'};
  default:return {short:'No item',effect:'Walk over a pickup to equip it',condition:''};
 }
}
export function activeItemStates(p,C){
 const rows=[];
 for(const id of ['cleats','shield','cloak'])if(p.t[id]>0)rows.push({id,name:ITEMS[id].name,color:ITEMS[id].color,left:p.t[id],total:C(`item.${id}.dur`),label:id==='shield'?'1 BLOCK':id==='cleats'?`${Number(C('item.cleats.speed')).toFixed(2)}× SPEED`:'UNTARGETABLE'});
 if(p.magnet)rows.push({id:'magnet',name:ITEMS.magnet.name,color:ITEMS.magnet.color,label:'NEXT TARGETED PASS',ready:true});
 if(p.freeze>0)rows.push({id:'freeze',name:'Frozen',color:'#6af0ff',left:p.freeze,total:C('item.whistle.dur'),label:'MOVEMENT LOCKED'});
 for(const [key,label,total] of [['crown','Crown guard',C('hero.kaiz.def.dur')],['trap','Perfect trap',C('hero.echo.def.window')],['invuln','Dodge window',.15],['haste','Skill speed',C('hero.nova.def.dur')],['blitz','Blitz drive',C('hero.bolt.atk.dur')]])if(p.t[key]>0)rows.push({id:key,name:label,color:'#e8a93a',left:p.t[key],total:total||p.t[key],label:'ACTIVE'});
 return rows;
}
