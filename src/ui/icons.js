// Hand-authored 16×16 pixel grids. One logical pixel is one filled cell;
// no smoothing, runtime shape generation, or external image dependency.
//   . transparent   o outline   a main   b highlight   d shade   w cream
// Keep a transparent one-pixel gutter and display at integer multiples.
import { ITEMS } from '../game/items.js';

export const ICON_SIZE = 16;

export const ICONS = {
  // Items
  cleats: [
    '................',
    '................',
    '...oooooo.......',
    '...oddddo.......',
    '...oddddo.......',
    '...owwwwao......',
    '..oaaaaaao......',
    '..oawwwwwaooo...',
    '..oaaaaaaaaaao..',
    '..oaaaaaaaaaaao.',
    '.oabbbbbbbbbbao.',
    '.oddddddddddddo.',
    '..ooooooooooooo.',
    '...wo..wo..wo...',
    '...oo..oo..oo...',
    '................'
  ],
  shield: [
    '................',
    '.......o........',
    '....oooaooo.....',
    '.oooaabadaaooo..',
    '.oabbbbaddddao..',
    '.oabbbbwddddao..',
    '.oaabbwwwdddao..',
    '.oaabwwwwwddao..',
    '.oaabbwwwdddao..',
    '..oaabwwwddao...',
    '..oaaabwddaao...',
    '...oaaaadaao....',
    '....ooaaaoo.....',
    '......oao.......',
    '.......o........',
    '................'
  ],
  magnet: [
    '................',
    '................',
    '..oooo....oooo..',
    '..owwo....owwo..',
    '..owwo....owwo..',
    '..owwo....owwo..',
    '..obbo....oddo..',
    '..obbo....oddo..',
    '..obbo....oddo..',
    '..obbo....oddo..',
    '..oaaaooooaaao..',
    '...oabbbbbbao...',
    '...oaaaaaaaao...',
    '....oooooooo....',
    '................',
    '................'
  ],
  cloak: [
    '................',
    '......oooo......',
    '.....oaaaao.....',
    '....oaooooao....',
    '...oaaooooaao...',
    '...obowoowoao...',
    '...obooooooao...',
    '...obooooooao...',
    '...obaaaaaado...',
    '...obaabaaado...',
    '..obaaabaaaado..',
    '..obaaabaaaado..',
    '.oaaaaooaaaoooo.',
    '.oooao..oao...o.',
    '....o....o......',
    '................'
  ],
  whistle: [
    '................',
    '........o...oo..',
    '.........o......',
    '....ooooooooooo.',
    '...oaddddaawwwo.',
    '..oaaddddaawwwo.',
    '.oabaaaaaaaaaao.',
    '.oabawooaaaoooo.',
    '.oabaoooaao.....',
    '.oabaoooaao.....',
    '.oaaaaaaaao.....',
    '..oaddddao......',
    '...oaaaaao......',
    '....ooooo.......',
    '................',
    '................'
  ],
  overclock: [
    '................',
    '.......ooooooo..',
    '......oabbbao...',
    '......obbbao....',
    '.....obbbaao....',
    '.....obbbao.....',
    '....obbbaaaooo..',
    '...obbbaawwao...',
    '...oaaaawaao....',
    '..oooooaaao.....',
    '.......oao......',
    '.......oao......',
    '......oao.......',
    '......oo........',
    '......o.........',
    '................'
  ],
  // Match UI
  ball: [
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...oowwwwwwwo...',
    '..ooowwwowwdwo..',
    '..owwwoooowwwo..',
    '.owwwwooooowwwo.',
    '.owwwoooooowwwo.',
    '.owwwwoooowwwwo.',
    '..odwwoooowwwo..',
    '..owwwwwwwwooo..',
    '..owwwwwwwwooo..',
    '...oooowwwwwo...',
    '....ooowwwwo....',
    '.....oooooo.....',
    '................'
  ],
  crown: [
    '................',
    '................',
    '.......o........',
    '.o.....o......o.',
    '.oo...oao....oo.',
    '.oao..oao...oao.',
    '..oaooaaaoooao..',
    '..oaaaawaaaaao..',
    '..oaaaaaaaaaao..',
    '..oabbbbbbbbao..',
    '...oaaaaaaaao...',
    '...oddddddddo...',
    '...oooooooooo...',
    '...oaaaaaaaao...',
    '...oooooooooo...',
    '................'
  ],
  skull: [
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...owwwwwwwwo...',
    '..owwwwwwwwwwo..',
    '..owooowwooowo..',
    '..owooowwooowo..',
    '..owooowwooowo..',
    '..owwwwoowwwwo..',
    '..oowwwoowwwoo..',
    '....owoooowo....',
    '....owwwwwwo....',
    '....owowwowo....',
    '....owowwowo....',
    '....oooooooo....',
    '................'
  ],
  // Hero skill glyphs
  volley: [
    '................',
    '.......o......o.',
    '......ooooo..o..',
    '.......owwwo....',
    '......owoowwo...',
    '......owoowwo.o.',
    '......owwwwwoo..',
    '.......owwwo....',
    '..oooo.oooo.....',
    '..owwo..........',
    '..oaaao.........',
    '..oaaaaooo......',
    '..oddddddo......',
    '..oooooooo......',
    '................',
    '................'
  ],
  eye: [
    '................',
    '.......oo.......',
    '................',
    '.......ooo......',
    '....oooaaaooo...',
    '...oawaooawaao..',
    '..oawwawoawwao..',
    '.oawwwaooawwwao.',
    '..oawwaooawwao..',
    '...oawaooawaao..',
    '....oooaaaooo...',
    '.......ooo......',
    '................',
    '.......oo.......',
    '................',
    '................'
  ],
  dash: [
    '................',
    '................',
    '........o.......',
    '.ooooo..oo......',
    '........oao.....',
    '....ooooawaoo...',
    '....oaaaaawaao..',
    '.oo.oaaaaaawaao.',
    '....oaaaaawaao..',
    '....ooooawaoo...',
    '........oao.....',
    '.ooooo..oo......',
    '........o.......',
    '................',
    '................',
    '................'
  ],
  leap: [
    '................',
    '.......o........',
    '......oao.......',
    '.....oawao......',
    '....oaawaao.....',
    '...oaaawaaao....',
    '..oooaawaaooo...',
    '.....oawao......',
    '.....oawao......',
    '.....oaaao......',
    '.....ooooo......',
    '................',
    '..aaa.....aaa...',
    '..a.........a...',
    '..a..ddddd..a...',
    '................'
  ],
  cannon: [
    '................',
    '................',
    '................',
    '..........o.....',
    '.aa....oooao....',
    '...aa.oaawaaoo..',
    '.....oawwwwwao..',
    '.....oawwoowaao.',
    '.aaa.oawwoowwao.',
    '.....oaawwwwao..',
    '.....ooawwwaao..',
    '...aa..oaoooo...',
    '..a.....o.......',
    '................',
    '................',
    '................'
  ],
  wall: [
    '................',
    '....o......o....',
    '....o......o....',
    '.oooooooooooooo.',
    '.obbbbobbbbbbbo.',
    '.oaaaaoaaaaaaao.',
    '.oaaaaoaaaaaaao.',
    '.oooooooooooooo.',
    '.obbbbbbbobbbbo.',
    '.oaaaaaaaoaaaao.',
    '.oaaaaaaaoaaaao.',
    '.oooooooooooooo.',
    '.oddddddddddddo.',
    '.oooooooooooooo.',
    '................',
    '................'
  ],
  split: [
    '................',
    '................',
    '..ooo......ooo..',
    '.owwwo....owwwo.',
    '.owowo....owowo.',
    '.owwwo....owwwo.',
    '..oooaooooaooo..',
    '...oooaooaooo...',
    '.....ooaaoo.....',
    '......oaoo......',
    '......ooo.......',
    '.....owwwo......',
    '.....owowo......',
    '.....owwwo......',
    '......ooo.......',
    '................'
  ],
  blink: [
    '................',
    '................',
    '...d....o.......',
    '..d.d..ooo......',
    '..d.d...o.......',
    '.d.d.d.....o....',
    '..d.d.....oao...',
    '..d.d.....owo...',
    '...d.....oawao..',
    '......o.oaawaao.',
    '.........oaaao..',
    '..........oao...',
    '....o.....oao...',
    '...ooo.....o....',
    '....o...........',
    '................'
  ],
  curve: [
    '................',
    '..........o.....',
    '......ooooooo...',
    '....oaaaaaowooo.',
    '...oaooooooooo..',
    '...oao....oo....',
    '..oao.....o.....',
    '..oao...........',
    '..oooo..........',
    '..owwwo.........',
    '.owoowwo........',
    '.owoowwo........',
    '.owwwwwo........',
    '..owwwo.........',
    '..oooo..........',
    '................'
  ],
  trap: [
    '................',
    '................',
    '................',
    '.....oooo.......',
    '.....owwwo......',
    '....owoowwo.....',
    '..ooowoowwo.oo..',
    '..ooowwwwwo.oo..',
    '..oo.owwwo..oo..',
    '..ooooooo..ooo..',
    '..oo........oo..',
    '..ooa.ooo.aaoo..',
    '...ooaoooaooo...',
    '....ooooooo.....',
    '.....ooooo......',
    '................'
  ],
  impact: [
    '................',
    '.......o........',
    '.......o........',
    '..o....oo....o..',
    '...oo.oao..oo...',
    '...oaoawaooao...',
    '....oawwwaao....',
    '....oawwwwao....',
    '...oawwwwwaao...',
    '.ooooawwwwaoooo.',
    '.....oawaao.....',
    '.....oaoaao.....',
    '.....oo.ooo.....',
    '....oo....oo....',
    '....o......o....',
    '................'
  ],
  guard: [
    '................',
    '....aaa..aaa....',
    '...a........a...',
    '..a..........a..',
    '.a.....o......a.',
    '.a.ooooaoooo..a.',
    '.a.oabaawaao..a.',
    '....obaaaao.....',
    '....oabaaao.....',
    '....oabaaao.....',
    '.d...oabao....d.',
    '..d...oao....d..',
    '..d....o.....d..',
    '...d.......dd...',
    '....dd....d.....',
    '................'
  ],
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
  cv.width = cv.height = ICON_SIZE * px;
  drawIcon(cv.getContext('2d'), name, color, px);
  const url = cv.toDataURL();
  cache.set(key, url);
  return url;
}

export function itemIconURL(id, px = 4) {
  return iconURL(id, ITEMS[id].color, px);
}
