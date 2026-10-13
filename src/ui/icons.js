// Pixel-art icons as 12×12 character grids. Rendered to canvas / data URLs
// so the HUD, editor and design sheet all share the same sprites.
//   . transparent   o outline   a main   b highlight   d shade   w white
import { ITEMS } from '../game/items.js';

export const ICONS = {
  // ── Items ──
  cleats: [
    '............',
    '............',
    '...ooooo....',
    '..oaaaaao...',
    '..oabbaao...',
    '..oaaaaaoo..',
    '..oaaaaaaaoo',
    '.oaaaaaaaaao',
    '.oddddddddo.',
    '.owowowowo..',
    '..o.o.o.o...',
    '............'],
  shield: [
    '............',
    '..oooooooo..',
    '.oaaaaaaaao.',
    '.oabbaaaaao.',
    '.oabaawaaao.',
    '.oaaawwwaao.',
    '.oaaaawaaao.',
    '..oaaaaaao..',
    '..odaaaado..',
    '...odaado...',
    '....oddo....',
    '.....oo.....'],
  magnet: [
    '............',
    '..ooo..ooo..',
    '..owo..owo..',
    '..oao..oao..',
    '..oao..oao..',
    '..oao..oao..',
    '..oaaooaao..',
    '..oaaaaaao..',
    '...oaaaao...',
    '....oooo....',
    '............',
    '............'],
  cloak: [
    '............',
    '....oooo....',
    '...oaaaao...',
    '..oabaaaao..',
    '..oawaawao..',
    '..oaaaaaao..',
    '..oaaaaaao..',
    '..oaaaaaao..',
    '..oadaadao..',
    '..oo.oo.oo..',
    '............',
    '............'],
  whistle: [
    '............',
    '............',
    '.......ooo..',
    '..ooooooao..',
    '.oaaaaaaao..',
    'oabbaaaaaoo.',
    'oaawaaaao...',
    'oaaaaaaao...',
    '.oddddddo...',
    '..oooooo....',
    '............',
    '............'],
  overclock: [
    '............',
    '.....ooo....',
    '....oaao....',
    '...oaao.....',
    '..oaaoooo...',
    '.oaaaaaaao..',
    '..ooooaao...',
    '.....oao....',
    '....oao.....',
    '....oo......',
    '............',
    '............'],
  // ── Generic ──
  ball: [
    '............',
    '....oooo....',
    '..oowwwwoo..',
    '..owoowwwo..',
    '.owoooowwwo.',
    '.owwoowwoow.',
    '.owwwwwoooo.',
    '.owoowwwoow.',
    '..ooowwwwo..',
    '..oowwoooo..',
    '....oooo....',
    '............'],
  crown: [
    '............',
    '............',
    '.o...oo...o.',
    '.oo.oaao.oo.',
    '.oaooaaooao.',
    '.oaaaaaaaao.',
    '.oabaawaaao.',
    '.oaaaaaaaao.',
    '.oddddddddo.',
    '.oooooooooo.',
    '............',
    '............'],
  skull: [
    '............',
    '...oooooo...',
    '..owwwwwwo..',
    '.owwwwwwwwo.',
    '.owoowwoowo.',
    '.owoowwoowo.',
    '.owwwoowwwo.',
    '..owwwwwwo..',
    '...owowow...',
    '...oooooo...',
    '............',
    '............'],
  // ── Skill glyphs ──
  volley: [
    '............',
    '.........oo.',
    '........oao.',
    '.......oao..',
    '..oo..oao...',
    '.oaaooao....',
    '.oaaaao.....',
    '..oaao......',
    '.oaooao.....',
    'oao..oo.....',
    'oo..........',
    '............'],
  eye: [
    '............',
    '............',
    '....oooo....',
    '..ooaaaaoo..',
    '.oaaawwaaao.',
    'oaaawooaaaao',
    'oaaawooaaaao',
    '.oaaaaaaaao.',
    '..ooaaaaoo..',
    '....oooo....',
    '............',
    '............'],
  dash: [
    '............',
    '............',
    '.......oo...',
    '.oooo..oao..',
    '.......oaao.',
    '..ooooooaaao',
    '.......oaao.',
    '.oooo..oao..',
    '.......oo...',
    '............',
    '............',
    '............'],
  leap: [
    '............',
    '.....oo.....',
    '....oaao....',
    '...oaaaao...',
    '..oaaaaaao..',
    '....oaao....',
    '....oaao....',
    '....oaao....',
    '............',
    '..oooooooo..',
    '..oddddddo..',
    '............'],
  cannon: [
    '............',
    '..o..o..o...',
    '...o.o.o....',
    '....ooo.....',
    '.oooowoooo..',
    '....oooaaao.',
    '...o.oaaaaao',
    '..o..oaaaaao',
    '......oaaao.',
    '.......ooo..',
    '............',
    '............'],
  wall: [
    '............',
    '............',
    '.oooooooooo.',
    '.oaaoaaaoao.',
    '.oooooooooo.',
    '.oaoaaaoaao.',
    '.oooooooooo.',
    '.oaaoaaaoao.',
    '.oooooooooo.',
    '.oddddddddo.',
    '............',
    '............'],
  split: [
    '............',
    '.oo......oo.',
    'owwo....owwo',
    '.oo......oo.',
    '....oooo....',
    '...owwwwo...',
    '...owoowo...',
    '...owwwwo...',
    '....oooo....',
    '.....oo.....',
    '....oaao....',
    '.....oo.....'],
  blink: [
    '............',
    '..o.....oo..',
    '.o.o...oaao.',
    '..o...oaaaao',
    '.......oaao.',
    '..o.o...oo..',
    '...o........',
    '..o.o..o.o..',
    '........o...',
    '.......o.o..',
    '............',
    '............'],
  curve: [
    '............',
    '.ooo........',
    'owwwo.......',
    'owwwo.......',
    '.ooo.o......',
    '......o.....',
    '.......o....',
    '.......o....',
    '......o..oo.',
    '.....o..oaao',
    '.........oo.',
    '............'],
  trap: [
    '............',
    '.o........o.',
    '.oo......oo.',
    '.oao....oao.',
    '..oaooooao..',
    '..oaawwaao..',
    '..oawoowao..',
    '..oaawwaao..',
    '...oaaaao...',
    '....oooo....',
    '............',
    '............'],
  impact: [
    '............',
    '.....oo.....',
    '..o..oo..o..',
    '...oo..oo...',
    '...oaaaao...',
    'oooaawwaaooo',
    'oooaawwaaooo',
    '...oaaaao...',
    '...oo..oo...',
    '..o..oo..o..',
    '.....oo.....',
    '............'],
  guard: [
    '............',
    '....oooo....',
    '..oo....oo..',
    '.o..oooo..o.',
    '.o.oaaaao.o.',
    'o.oaabbaao.o',
    'o.oaaaaaao.o',
    '.o.oaaaao.o.',
    '.o..oooo..o.',
    '..oo....oo..',
    '....oooo....',
    '............'],
};

export const SKILL_ICON = {
  'nova.atk': 'volley', 'nova.def': 'eye',
  'bolt.atk': 'dash', 'bolt.def': 'leap',
  'titan.atk': 'cannon', 'titan.def': 'wall',
  'jinx.atk': 'split', 'jinx.def': 'blink',
  'echo.atk': 'curve', 'echo.def': 'trap',
  'kaiz.atk': 'impact', 'kaiz.def': 'guard',
};

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

export function drawIcon(ctx, name, color = '#e8a93a', px = 4, ox = 0, oy = 0, outline = '#0e1524') {
  const grid = ICONS[name];
  if (!grid) return;
  const pal = { o: outline, a: color, b: shadeHex(color, 1.35), d: shadeHex(color, 0.65), w: '#f3e9d2' };
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
    const c = grid[y][x];
    if (c === '.') continue;
    ctx.fillStyle = pal[c];
    ctx.fillRect(ox + x * px, oy + y * px, px, px);
  }
}

const cache = new Map();
export function iconURL(name, color, px = 4) {
  const key = `${name}|${color}|${px}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 12 * px;
  drawIcon(cv.getContext('2d'), name, color, px);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

export function itemIconURL(id, px = 4) {
  return iconURL(id, ITEMS[id].color, px);
}
