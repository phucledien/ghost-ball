import {chromium} from '/Users/thohong/Library/Developer/Tools/ghost-ball-qa/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const out='/Users/thohong/Library/Developer/CodexBuilds/ghost-ball-art/qa/revision8';
const browser=await chromium.launch({headless:true});const results=[];
try{const p=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto(process.env.QA_URL||'http://127.0.0.1:5173/showcase.html');await p.waitForFunction(()=>window.__showcase);await p.evaluate(()=>window.__showcase.toggle(false));
for(const section of ['characters','items','skills','arenas','sounds']){
 await p.click(`[data-section="${section}"]`);await p.waitForTimeout(200);
 if(section==='characters'){await p.selectOption('#action','run');await p.locator('.cosmetic summary').click();await p.selectOption('#cosmetic-hair','afro');await p.locator('.cosmetic summary').click();}
 if(section==='items')await p.evaluate(()=>window.__showcase.seek(1.4));
 if(section==='skills')await p.evaluate(()=>window.__showcase.seek(.28));
 if(section==='arenas'){await p.selectOption('#view','orbit');}
 if(section==='sounds'){await p.click('[data-sound="power"]');await p.click('#musicPlay');await p.waitForTimeout(100);assert(await p.evaluate(()=>window.__showcase.audio.track?.name==='menu'));await p.click('#stopAudio');}
 await p.screenshot({path:`${out}/${section}-desktop.png`,fullPage:true});
 results.push({section,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),draws:await p.evaluate(()=>window.__showcase.stage.renderer.info.render.calls)});
}
for(const item of ['shield','cleats','magnet','cloak','whistle','overclock']){
 await p.click('[data-section="items"]');await p.click(`[data-asset="${item}"]`);for(const time of [.18,.4,1.2]){await p.evaluate(t=>window.__showcase.seek(t),time);await p.locator('.stage-wrap').screenshot({path:`${out}/${item}-${time}.png`});}
 await p.evaluate(()=>window.__showcase.seek(window.__showcase.duration));const state=await p.evaluate(()=>({auras:window.__showcase.vfx.itemEffects.size,shields:window.__showcase.vfx.persistentShields.size}));assert.equal(state.auras,0);assert.equal(state.shields,0);
}
for(const hero of ['nova','bolt','titan','jinx','echo','kaiz'])for(const slot of ['atk','def']){await p.click('[data-section="skills"]');await p.click(`[data-asset="${hero}"]`);await p.selectOption('#skill',hero+'.'+slot);await p.evaluate(()=>window.__showcase.seek(.3));await p.locator('.stage-wrap').screenshot({path:`${out}/${hero}-${slot}.png`});}
await p.setViewportSize({width:390,height:844});for(const section of ['characters','items','skills','arenas','sounds']){await p.click(`[data-section="${section}"]`);await p.evaluate(()=>window.__showcase.seek(.6));await p.screenshot({path:`${out}/${section}-phone.png`,fullPage:true});results.push({section,phone:true,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
await fs.writeFile(`${out}/showcase-results.json`,JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));assert.deepEqual(errors,[]);assert(results.every(r=>!r.overflow));
}finally{await browser.close()}
