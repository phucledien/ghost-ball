import '../ui/style.css';
import { loadConfig } from '../core/config.js';
import { Stage } from '../engine/stage.js';
import { Arena } from '../engine/arena.js';
import { VFX } from '../engine/vfx.js';
import { Match } from '../game/sim.js';
import { Input } from '../game/input.js';
import { Hud } from '../ui/hud.js';
import { bindTokens } from '../ui/tokens.js';
import { HEROES, HERO_BY_ID } from '../game/heroes.js';
import { MODES } from '../game/modes.js';
import { renderHero } from '../ui/portrait.js';
import { iconURL, SKILL_ICON } from '../ui/icons.js';
import { think } from '../game/ai.js';

const cfg = await loadConfig();
const C = cfg.get;
bindTokens(cfg);

const app = document.getElementById('app');
const stage = new Stage(app, C);
const arena = new Arena(stage.scene);
const vfx = new VFX(stage.scene, C);
const hud = new Hud(app, C);
const input = new Input(stage, hud.touch);

const params = new URLSearchParams(location.search);
let modeId = params.get('mode') || C('rules.mode');
let heroId = params.get('hero') || 'nova';
const demo = params.has('demo');
let match = null;
let worldKey = '';

function buildWorld() {
  const mode = MODES[modeId] || MODES.classic;
  const mul = mode.sizeMul || 1;
  const key = [C('arena.theme'), C('arena.width'), C('arena.depth'), C('arena.crowd'), C('arena.lights'), mul].join('|');
  if (key === worldKey) return;
  worldKey = key;
  const W = Math.round(C('arena.width') * mul), D = Math.round(C('arena.depth') * mul);
  arena.build(C('arena.theme'), W, D, C('arena.crowd'), C('arena.lights'));
  stage.applyTheme(C('arena.theme'), W, D);
}

function startMatch(human) {
  match?.dispose();
  worldKey = '';
  buildWorld();
  match = new Match({ stage, vfx, arena, C, humanHero: human, modeId });
  match.start();
  hud.attach(match, stage);
  hud.showBanner('READY', `${MODES[modeId].name} · ${match.alive.length} strikers`, 'gold', 1400);
  if (human) {
    if (!demo) {
      match.on('win', () => setTimeout(showEnd, 1600));
      match.on('elim', ({ player }) => { if (player.human) setTimeout(showEnd, 1800); });
    }
  }
}

// ── Menu ─────────────────────────────────────────────────────────────────
const menu = document.createElement('div');
menu.className = 'menu';
app.appendChild(menu);

function heroSkill(h, slot, label) {
  const s = h[slot];
  const icon = slot === 'passive' ? iconURL('crown', C(`hero.${h.id}.fx`), 3) : iconURL(SKILL_ICON[`${h.id}.${slot}`], C(`hero.${h.id}.fx`), 3);
  return `<div class="gb-card skill-box"><img src="${icon}"><div><div class="sk">${label}</div><div class="sn">${s.name}</div><div class="sd">${s.desc}</div></div></div>`;
}

function renderMenu() {
  const h = HERO_BY_ID[heroId];
  menu.innerHTML = `
    <div class="logo">GHOST<span>·</span>BALL</div>
    <div class="tagline">Pass it on. Whoever's left holding the ball when the buzzer goes is out.</div>
    <div class="t-label">Mode</div>
    <div class="grid modes">${Object.entries(MODES).map(([id, m]) => `
      <div class="gb-card mode-pick ${id === modeId ? 'selected' : ''}" data-mode="${id}">
        <div class="tg">${m.tag}</div><div class="nm">${m.name}</div><div class="ds">${m.desc}</div>
      </div>`).join('')}</div>
    <div class="t-label">Striker</div>
    <div class="grid heroes">${HEROES.map((x) => `
      <div class="gb-card hero-pick ${x.id === heroId ? 'selected' : ''}" data-hero="${x.id}">
        <canvas data-sprite="${x.id}" width="64" height="64"></canvas>
        <div class="nm" style="color:${C(`hero.${x.id}.fx`)}">${x.name}</div><div class="rl">${x.title}</div>
      </div>`).join('')}</div>
    <div class="hero-detail">
      ${heroSkill(h, 'passive', 'Passive')}
      ${heroSkill(h, 'atk', 'Attack · with ball')}
      ${heroSkill(h, 'def', 'Defense · without ball')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
      <button class="gb-btn lg primary" id="play">PLAY</button>
      <a class="gb-btn lg" href="./editor.html" style="text-decoration:none">EDITOR</a>
      <a class="gb-btn lg" href="./sheet.html" style="text-decoration:none">DESIGN SHEET</a>
    </div>`;
  menu.querySelectorAll('[data-mode]').forEach((el) => el.addEventListener('click', () => { modeId = el.dataset.mode; renderMenu(); startMatch(null); }));
  menu.querySelectorAll('[data-hero]').forEach((el) => el.addEventListener('click', () => { heroId = el.dataset.hero; renderMenu(); }));
  menu.querySelector('#play').addEventListener('click', play);
  drawSprites();
}

let spriteT = 0;
function drawSprites() {
  menu.querySelectorAll('canvas[data-sprite]').forEach((cv) => {
    const id = cv.dataset.sprite;
    const img = renderHero(id, C, { w: 64, h: 64, mode: 'full', yaw: 0.6 + (id === heroId ? spriteT : 0), pitch: 0.3 });
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.drawImage(img, 0, 0);
  });
}

function play() {
  menu.style.display = 'none';
  app.classList.remove('menu-open');
  startMatch(heroId);
}

function showMenu() {
  menu.style.display = '';
  app.classList.add('menu-open');
  renderMenu();
  startMatch(null);
}

function showEnd() {
  if (!match?.human) return;
  const end = document.createElement('div');
  end.className = 'menu';
  end.style.background = 'rgba(14,21,36,0.55)';
  end.style.justifyContent = 'flex-end';
  end.style.paddingBottom = '18vh';
  end.innerHTML = `<div style="display:flex;gap:8px"><button class="gb-btn lg primary" id="again">PLAY AGAIN</button><button class="gb-btn lg" id="tomenu">MENU</button></div>`;
  app.appendChild(end);
  end.querySelector('#again').onclick = () => { end.remove(); startMatch(heroId); };
  end.querySelector('#tomenu').onclick = () => { end.remove(); showMenu(); };
}

window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.style.display === 'none') showMenu(); });

// Live config: rebuild the world when arena values change; show draft badge
const badge = document.createElement('div');
badge.className = 'badge-draft';
app.appendChild(badge);
const refreshBadge = () => {
  const n = cfg.diff().length;
  badge.style.display = n ? '' : 'none';
  badge.textContent = `DRAFT · ${n} UNLOCKED CHANGE${n === 1 ? '' : 'S'}`;
};
cfg.onChange((key) => {
  refreshBadge();
  if (!key || key.startsWith('arena.')) {
    buildWorld();
    if (match) { match.arena = arena; }
  }
});
refreshBadge();

// Debug handle (used by automated screenshots)
window.__gb = { get match() { return match; }, cfg, stage };

// ── Loop ─────────────────────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (match) {
    // ?demo=1: a bot drives your striker (for trailers / attract screens)
    match.input = match.human ? (demo ? think(match, match.human, dt) : input.poll(match.human)) : null;
    match.update(dt);
  }
  stage.update(dt);
  stage.render();
  hud.update();
  if (menu.style.display !== 'none') {
    spriteT += dt;
    if (Math.floor(spriteT * 8) !== Math.floor((spriteT - dt) * 8)) drawSprites();
  }
  requestAnimationFrame(frame);
}

app.classList.add('menu-open');
renderMenu();
startMatch(null);
if (params.get('autoplay')) play();
requestAnimationFrame(frame);
