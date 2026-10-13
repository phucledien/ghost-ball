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
