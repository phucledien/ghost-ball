// Extract original cue recipes without running or changing the browser game.
import fs from 'node:fs';
import vm from 'node:vm';
const file = new URL('../../src/engine/audio.js', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const sandbox = {};
vm.runInNewContext(source.replace('export class Audio', 'class Audio') + '\nthis.cues = SFX;', sandbox);
const mapping = {pass:'kick',catch:'catch',dash:'dash',countdown:'tick',elimination:'elim',victory:'win'};
const cues = {};
for (const [event, name] of Object.entries(mapping)) {
 const recipe=[];
 sandbox.cues[name]({tone:p=>recipe.push({kind:'tone',...p}),noise:p=>recipe.push({kind:'noise',...p})},1);
 cues[event] = {sourceCue:name,recipe};
}
process.stdout.write(JSON.stringify(cues));
