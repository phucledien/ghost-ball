import '../ui/style.css';
import '../ui/menu.css';
import { loadConfig } from '../core/config.js';
import { Prefs, loadPicks, savePicks } from '../core/settings.js';
import { Stage } from '../engine/stage.js';
import { Arena } from '../engine/arena.js';
import { VFX } from '../engine/vfx.js';
import { Match } from '../game/sim.js';
import { Input } from '../game/input.js';
import { Hud } from '../ui/hud.js';
import { Menu } from '../ui/menu.js';
import { applyTokens } from '../ui/tokens.js';
import { HERO_BY_ID } from '../game/heroes.js';
import { MODES } from '../game/modes.js';
import { MAPS, resolveMap } from '../game/maps.js';
import { invalidatePortraits } from '../ui/portrait.js';
import { think } from '../game/ai.js';
import { Audio } from '../engine/audio.js';
import { PlayerVisibility } from '../engine/player-visibility.js';

const cfg = await loadConfig();
const prefs = new Prefs();
// Player settings sit on top of the tuned config (never written into it).
const baseC = prefs.wrap(cfg.get);
const artParam = new URLSearchParams(location.search).get('art');
const benchmark=new URLSearchParams(location.search).get('bench')==='1';
const phoneView = matchMedia('(max-width: 600px), (max-height: 600px) and (pointer: coarse)');
const C = k => k==='render.pixelScale' && prefs.get('pixel')==='auto' && phoneView.matches ? 1 : benchmark && k==='rules.roundTime'?600:benchmark && k==='rules.players'?12:benchmark && k==='art.benchmark'?true:k === 'art.heroStyle' && ['master', 'legacy'].includes(artParam) ? artParam : baseC(k);
applyTokens(C);

const app = document.getElementById('app');
const stage = new Stage(app, C);
const playerVisibility = new PlayerVisibility(stage.scene);
const arena = new Arena(stage.scene);
const vfx = new VFX(stage.scene, C);
const hud = new Hud(app, C);
const input = new Input(stage, hud.touch);

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const saved = loadPicks();
const picks = {
  mode: params.get('mode') || (saved.mode in MODES ? saved.mode : C('rules.mode')),
  hero: params.get('hero') || (saved.hero in HERO_BY_ID ? saved.hero : 'nova'),
  map: params.get('map') || (saved.map in MAPS ? saved.map : C('arena.map')),
  loadouts: saved.loadouts || {},
};
let match = null;
let worldKey = '';
let world = null;
let stats = null;
let resultTimer = 0;

const audio = new Audio();
const VOL = { off: 0, low: 0.4, auto: 0.8, high: 1 };
const applyVolume = () => audio.setVolumes(VOL[prefs.get('sfx')], VOL[prefs.get('music')] * 0.85);
applyVolume();

// Match events → sound
function wireAudio(m) {
  const human = (p) => p && p.human;
  const near = (p) => {
    // quieter the further from the camera target, so 10 bots don't drown you out
    if (!p || human(p)) return 1;
    const t = stage.target;
    return Math.max(0.25, 1 - Math.hypot(p.x - t.x, p.z - t.z) / 30);
  };
  m.on('pass', ({ player }) => audio.play('kick', near(player)));
  m.on('catch', ({ player }) => { audio.play('catch'); if (human(player)) audio.play('it'); });
  m.on('dash', ({ player }) => { if (near(player) > 0.6) audio.play('dash'); });
  m.on('skill', ({ player, slot }) => {
    const id = `${player.heroId}.${slot}`;
    audio.play(id === 'titan.atk' || id === 'kaiz.atk' ? 'power' : id === 'titan.def' ? 'wall' : 'skill');
  });
  m.on('pickup', ({ player }) => { if (human(player)) audio.play('item'); });
  m.on('item', () => audio.play('useItem'));
  m.on('deflect', () => audio.play('block'));
  m.on('trap', () => audio.play('skill'));
  m.on('bounce', () => audio.play('bounce'));
  m.on('buzzer', () => { audio.play('buzzer'); audio.play('boom'); });
  m.on('elimBurst', () => { audio.play('elim'); audio.play('cheer'); });
  m.on('go', () => audio.play('go'));
  m.on('win', ({ winner }) => { if (human(winner)) audio.play('win'); audio.play('cheer'); });
}

const isTouch = () => hud.activeControls === 'touch';
hud.setControlMode(prefs.get('controls'));

function buildWorld(mapId, modeId) {
  const mode = MODES[modeId] || MODES.classic;
  const key = [mapId, modeId, C('arena.theme'), C('arena.width'), C('arena.depth'), C('arena.crowd'), C('arena.lights')].join('|');
  if (key === worldKey) return;
  worldKey = key;
  world = resolveMap(mapId, C, mode.sizeMul || 1);
  arena.build(world.theme, world.W, world.D, C('arena.crowd'), C('arena.lights'), world);
  stage.applyTheme(world.theme, world.W, world.D);
}

// human: hero id, or null for a bots-only attract match behind the menus
function startMatch(human, { mapId = picks.map, modeId = picks.mode } = {}) {
  match?.dispose();
  clearTimeout(resultTimer);
  buildWorld(mapId, modeId);
  match = new Match({ stage, vfx, arena, C, humanHero: human, modeId, playersBonus: world.playersBonus, loadout: human ? picks.loadouts[human] || null : null });
  match.start();
  hud.attach(match, stage);
  wireAudio(match);
  audio.playMusic(human ? 'match' : 'menu');
  stage.view = human ? 'game' : 'sway';
  stage.zoomMul = human ? 1 : 1.18;
  if (!human) return;
  hud.showBanner('READY', `${MODES[modeId].name} · ${MAPS[mapId].name} · ${match.alive.length} strikers`, 'gold', 1400);
  stats = { passes: 0, catches: 0, skills: 0, time: 0, start: performance.now() };
  match.on('pass', ({ player }) => { if (player.human) stats.passes++; });
  match.on('catch', ({ player }) => { if (player.human) stats.catches++; });
  match.on('skill', ({ player }) => { if (player.human) stats.skills++; });
  if (demo) return;
  match.on('win', ({ winner }) => {
    resultTimer = setTimeout(() => showResults(!!winner?.human, true), 1700);
  });
  match.on('elim', ({ player }) => {
    if (!player.human) return;
    stats.place = match.alive.length + 1;
    stats.round = match.round;
    stats.time = (performance.now() - stats.start) / 1000;
    resultTimer = setTimeout(() => showResults(false, false), 1900);
  });
}

function showResults(won, final) {
  if (!match?.human) return;
  audio.playMusic('menu');
  if (menu.open && menu.screen !== 'results') return;
  if (won) { stats.place = 1; stats.time = (performance.now() - stats.start) / 1000; stats.round = match.round; }
  menu.show('results', { reset: true, won, final, place: stats.place, total: match.players.length, round: stats.round, stats, hero: match.human.heroId });
}

// ── Front-end ──────────────────────────────────────────────────────────
let previewT = 0;
const menu = new Menu(app, {
  C, prefs, picks, isTouch,
  // the world behind the select screens follows the highlighted mode / arena
  onPreview: (p) => {
    clearTimeout(previewT);
    previewT = setTimeout(() => {
      const key = `${p.map}|${p.mode}`;
      if (match && !match.human && match._preview === key) return;
      startMatch(null, { mapId: p.map, modeId: p.mode });
      match._preview = key;
    }, 140);
  },
  onStart: (p) => {
    savePicks(p);
    menu.show('vs', { reset: true, hero: p.hero, map: p.map, mode: p.mode });
    audio.play('uiStart');
    setTimeout(() => {
      menu.hide();
      app.classList.remove('menu-open');
      startMatch(p.hero, { mapId: p.map, modeId: p.mode });
    }, 1100);
  },
  onResume: () => { if (match) match.paused = false; app.classList.remove('menu-open'); },
  onRestart: () => { app.classList.remove('menu-open'); startMatch(picks.hero); },
  onQuit: (to = 'title') => {
    savePicks(picks);
    showTitle();
    if (to === 'hero') { menu.show('mode'); menu.show('hero'); }
  },
  onLoadout: () => savePicks(picks),
});

// Menu clicks and focus moves
let lastMove = 0;
menu.el.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.matches('.sel-back, .x')) audio.play('uiBack');
  else if (b.matches('.sel-next, [data-a=again]') && menu.screen === 'map') audio.play('uiStart');
  else audio.play('ui');
});
menu.el.addEventListener('focusin', () => { const t = performance.now(); if (t - lastMove > 60) { lastMove = t; audio.play('uiMove'); } });

function showTitle() {
  app.classList.add('menu-open');
  startMatch(null);
  menu.show('title', { reset: true });
}

function pause() {
  if (!match?.human || menu.open || match.phase === 'over') return;
  match.paused = true;
  app.classList.add('menu-open');
  menu.show('pause', { reset: true });
}
hud.onPause = pause;
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.defaultPrevented && !menu.open) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// Settings apply live (pixel size, HUD size, controls…)
prefs.onChange((id) => {
  applyTokens(C);
  if (id === 'controls') hud.setControlMode(prefs.get('controls'));
  if (id === 'music' || id === 'sfx') applyVolume();
});

// Live config from the editor: rebuild the world when arena values change; draft badge
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
  if (!key || key.startsWith('ui.')) applyTokens(C);
  if (!key || key === 'art.heroStyle' || /^hero\.[a-z]+\.(jersey|hair|fx)$/.test(key)) { invalidatePortraits(); menu.clearPortraits(); }
  if (!key || key === 'art.heroStyle' || /^hero\.[a-z]+\.(jersey|hair)$/.test(key)) match?.refreshArt();
  if ((!key || key.startsWith('arena.')) && match) {
    worldKey = '';
    buildWorld(picks.map, match.modeId);
  }
});
refreshBadge();

// Debug handle (used by automated screenshots)
window.__gb = { get match() { return match; }, cfg, stage, menu, picks, prefs, audio, playerVisibility, artRevision: 'animated-showcase-8' };

// ── Loop ─────────────────────────────────────────────────────────────────
input.onReset=()=>match?.resetInput();
let wasMenuOpen=menu.open;
let last = performance.now();
let lastTick = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (match && match.human && match.phase === 'play' && match.mode.timer === 'round') {
    // countdown ticks for the last three seconds
    const s = Math.ceil(match.roundT);
    if (s !== lastTick && s <= 3 && s > 0) audio.play('tick');
    lastTick = s;
  }
  if(menu.open!==wasMenuOpen){input.reset();wasMenuOpen=menu.open;}
  if (match) {
    // ?demo=1: a bot drives your striker (for trailers / attract screens)
    match.input = match.human && !menu.open ? (demo ? think(match, match.human, dt) : input.poll(match.human)) : null;
    match.update(dt);
  }
  stage.update(dt);
  playerVisibility.update(match?.human?.alive && !menu.open ? match.human.model : null);
  stage.render();
  hud.update();
  requestAnimationFrame(frame);
}

if (params.get('autoplay')) {
  app.classList.remove('menu-open');
  startMatch(picks.hero);
} else showTitle();
requestAnimationFrame(frame);
