// Design sheet: every colour, font, component, sprite and icon rendered from
// the same modules the game uses. Re-renders live when the editor changes config.
import '../ui/style.css';
import './sheet.css';
import * as THREE from 'three';
import { loadConfig } from '../core/config.js';
import { SCHEMA } from '../core/schema.js';
import { bindTokens } from '../ui/tokens.js';
import { HEROES, phasesFor } from '../game/heroes.js';
import { ITEMS } from '../game/items.js';
import { MODES } from '../game/modes.js';
import { THEMES } from '../engine/themes.js';
import { ICONS, SKILL_ICON, iconURL, itemIconURL } from '../ui/icons.js';
import { renderHero, portraitURL, actionFrames, runFrames, invalidatePortraits } from '../ui/portrait.js';
import { Stage } from '../engine/stage.js';
import { VFX } from '../engine/vfx.js';
import { buildHero, applyPose } from '../engine/hero-model.js';
import { POSES, locomotionPose, actionPose, totalDuration } from '../engine/anim.js';

// Dev serves the game at /, the published artifact ships it as game.html
const GAME_URL = import.meta.env.DEV ? './' : './game.html';

const cfg = await loadConfig();
const C = cfg.get;
bindTokens(cfg);

const SECTIONS = [
  ['colors', 'Colour tokens'],
  ['type', 'Typography'],
  ['components', 'Components'],
  ['hud', 'HUD'],
  ['heroes', 'Heroes'],
  ['items', 'Items'],
  ['icons', 'Icons'],
  ['vfx', 'VFX & motion'],
  ['arenas', 'Arenas & modes'],
];

const root = document.getElementById('sheet');
root.innerHTML = `
  <nav class="sh-nav">
    <div class="brand">GHOST<span>·</span>BALL<br><span class="t-label">design sheet</span></div>
    ${SECTIONS.map(([id, nm], i) => `<a href="#${id}">${String(i + 1).padStart(2, '0')} ${nm}</a>`).join('')}
    <div class="links"><a href="${GAME_URL}">Play</a><a href="./editor.html">Editor</a></div>
  </nav>
  <main class="sh-main">
    <header class="sh-head">
      <div>
        <h1>GHOST<span>·</span>BALL — Design Sheet</h1>
        <p class="t-body">Every swatch, sprite and component below is drawn by the game's own code from the live config. Tweak values in the <a href="./editor.html" style="color:var(--accent)">editor</a> and this page updates in place.</p>
      </div>
      <div class="sh-row"><a class="gb-btn" href="${GAME_URL}" style="text-decoration:none">Play</a><a class="gb-btn primary" href="./editor.html" style="text-decoration:none">Editor</a></div>
    </header>
    ${SECTIONS.map(([id, nm], i) => `<section class="sh-sec" id="${id}"><h2 class="t-h2"><span class="n">${String(i + 1).padStart(2, '0')}</span>${nm}</h2><div data-body="${id}"></div></section>`).join('')}
  </main>`;

const body = (id) => root.querySelector(`[data-body="${id}"]`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : String(v));

// ── 01 Colours ──────────────────────────────────────────────────────────
function swatch(color, name, key) {
  return `<div class="sw"><div class="chip" style="background:${color}"></div><div class="meta"><span class="nm">${esc(name)}</span><code>${esc(key)}</code><code>${esc(String(color).toUpperCase())}</code></div></div>`;
}

function renderColors() {
  const ui = SCHEMA.filter((s) => s.key.startsWith('ui.') && s.type === 'color');
  const heroFx = HEROES.map((h) => swatch(C(`hero.${h.id}.fx`), `${h.name} FX`, `hero.${h.id}.fx`)).join('');
  const items = Object.entries(ITEMS).map(([id, it]) => swatch(it.color, it.name, `ITEMS.${id}.color`)).join('');
  body('colors').innerHTML = `
    <p class="intro">UI tokens are CSS variables (<code>--ink</code>, <code>--accent</code>…) driven by <code>ui.*</code> config keys. Gameplay colours come from heroes, items and arena themes.</p>
    <div class="t-label sh-sub">UI tokens</div>
    <div class="sh-grid sh-swatches">${ui.map((s) => swatch(C(s.key), s.label, s.key)).join('')}</div>
    <div class="t-label sh-sub">Hero FX</div>
    <div class="sh-grid sh-swatches">${heroFx}</div>
    <div class="t-label sh-sub">Items</div>
    <div class="sh-grid sh-swatches">${items}</div>
    <div class="t-label sh-sub">Arena palettes</div>
    <div class="sh-grid">${Object.entries(THEMES).map(([id, T]) => themeStrip(id, T)).join('')}</div>`;
}

function themeColors(T) {
  const out = [];
  for (const [k, v] of Object.entries(T)) {
    if (typeof v === 'string' && v.startsWith('#')) out.push([k, v]);
    else if (Array.isArray(v) && typeof v[0] === 'string') v.forEach((c, i) => out.push([`${k}[${i}]`, c]));
  }
  return out;
}

function themeStrip(id, T) {
  const cols = themeColors(T);
  return `<div class="gb-card theme-row"><div class="hd"><span class="t-h2" style="font-size:15px">${esc(T.name)}</span><code>THEMES.${id}</code></div><div class="t-small">${esc(T.desc)}</div>
    <div class="sh-strip">${cols.map(([k, c]) => `<i style="background:${c}" title="${k} ${c}"></i>`).join('')}</div></div>`;
}

// ── 02 Typography ───────────────────────────────────────────────────────
const TYPE = [
  ['t-hero', 'GHOST·BALL'],
  ['t-h1', 'Egoist Crowned'],
  ['t-h2', 'ROUND 3 · 5 LEFT'],
  ['t-label', 'Attack · with ball'],
  ['t-body', 'Pass it on. Whoever is left holding the ball when the buzzer goes is out.'],
  ['t-small', 'Wider aim assist and longer assist range.'],
  ['t-num', 'F 105 / 196 · 1.75 S'],
];

function cssSpec(cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.textContent = 'x';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '');
  const spec = `${fam} · ${cs.fontSize} / ${cs.lineHeight} · ls ${cs.letterSpacing}${cs.textTransform !== 'none' ? ' · ' + cs.textTransform : ''}`;
  el.remove();
  return spec;
}

function renderType() {
  body('type').innerHTML = `
    <p class="intro">Two pixel families: <b>Silkscreen</b> for display, labels and numbers; <b>Pixelify Sans</b> for body copy. Font smoothing is off so glyph edges stay crisp.</p>
    <div class="sh-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="gb-card fam"><div class="t-label">Display · --font-display</div><div class="big" style="font-family:var(--font-display)">Silkscreen</div><div class="t-small" style="font-family:var(--font-display)">ABCDEFGHIJKLM 0123456789</div></div>
      <div class="gb-card fam"><div class="t-label">Body · --font-body</div><div class="big" style="font-family:var(--font-body)">Pixelify Sans</div><div class="t-small" style="font-family:var(--font-body)">The quick brown fox jumps over 13 lazy defenders.</div></div>
    </div>
    <div class="t-label sh-sub">Type scale</div>
    <div class="sh-typo">${TYPE.map(([c, s]) => `<div class="r"><div><div class="t-label" style="color:var(--accent)">.${c}</div><code>${esc(cssSpec(c))}</code></div><div class="sample ${c}">${esc(s)}</div></div>`).join('')}</div>
    <p class="t-small" style="margin-top:10px">Note: fonts load from Google Fonts in the web prototype. For the iOS / iPadOS build they must be bundled locally (both are OFL-licensed).</p>`;
}

// ── 03 Components ───────────────────────────────────────────────────────
function comp(label, cls, html) {
  return `<div class="gb-card comp"><div class="lbl"><span class="t-label" style="color:var(--ink)">${label}</span><code>${cls}</code></div>${html}</div>`;
}

function renderComponents() {
  const h0 = HEROES[0];
  const fx0 = C(`hero.${h0.id}.fx`);
  const mode = Object.entries(MODES)[0];
  body('components').innerHTML = `
    <p class="intro">The editor and menu chrome. Pressed / selected state is always gold with dark ink; borders are 1px lines, never shadows-only.</p>
    <div class="sh-grid comp-grid">
      ${comp('Buttons', '.gb-btn', `<div class="sh-row"><button class="gb-btn">Default</button><button class="gb-btn on">On</button><button class="gb-btn primary">Primary</button><button class="gb-btn danger">Danger</button><button class="gb-btn ghost">Ghost</button><button class="gb-btn" disabled>Disabled</button></div><div class="sh-row"><button class="gb-btn lg primary">PLAY</button><button class="gb-btn lg">EDITOR</button></div>`)}
      ${comp('Segmented chips', '.gb-seg', `<div class="sh-row"><div class="gb-seg"><button class="gb-btn on">1×</button><button class="gb-btn">½</button><button class="gb-btn">¼</button><button class="gb-btn">⅒</button></div><div class="gb-seg"><button class="gb-btn">Game</button><button class="gb-btn on">Side</button><button class="gb-btn">Top</button></div></div>`)}
      ${comp('Phase tag + caption', '.gb-tag.hold|fast|move · .gb-caption', `<div class="sh-row"><span class="gb-tag hold">COIL</span><span class="gb-caption">Hold the anticipation</span></div><div class="sh-row"><span class="gb-tag fast">STRIKE</span><span class="gb-tag move">FOLLOW</span><span class="gb-tag">GUARD</span></div>`)}
      ${comp('Keycaps', '.gb-kbd', `<div class="sh-row"><span class="gb-kbd">WASD</span><span class="gb-kbd">J</span><span class="gb-kbd">K</span><span class="gb-kbd">L</span><span class="gb-kbd">ESC</span></div>`)}
      ${comp('Cards', '.gb-card · .selected', `<div class="sh-row"><div class="gb-card" style="flex:1">Card</div><div class="gb-card selected" style="flex:1">Selected</div></div>`)}
      ${comp('Pips & bar', '.gb-pips · .gb-bar', `<div class="gb-pips"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div><div class="gb-bar"><b style="width:64%"></b></div><div class="gb-bar"><b style="width:100%;background:var(--green)"></b></div>`)}
      ${comp('Mode card', '.mode-pick', `<div class="gb-card mode-pick selected"><div class="tg">${mode[1].tag}</div><div class="nm">${mode[1].name}</div><div class="ds">${esc(mode[1].desc)}</div></div>`)}
      ${comp('Hero card', '.hero-pick', `<div class="sh-row">${HEROES.slice(0, 2).map((h, i) => `<div class="gb-card hero-pick ${i ? '' : 'selected'}" style="flex:1"><img src="${portraitURL(h.id, C, 48)}"><div class="nm" style="color:${C(`hero.${h.id}.fx`)}">${h.name}</div><div class="rl">${h.title}</div></div>`).join('')}</div>`)}
      ${comp('Skill box', '.skill-box', `<div class="gb-card skill-box"><img src="${iconURL(SKILL_ICON[`${h0.id}.atk`], fx0, 3)}"><div><div class="sk">Attack · with ball</div><div class="sn">${h0.atk.name}</div><div class="sd">${esc(h0.atk.desc)}</div></div></div>`)}
    </div>`;
}

// ── 04 HUD mock ─────────────────────────────────────────────────────────
function renderHud() {
  const me = HEROES[0];
  const p = (id, s) => portraitURL(id, C, s);
  const minis = HEROES.concat(HEROES.slice(0, 2)).map((h, i) => `<img class="mini ${i === 0 ? 'me' : ''} ${i === 3 ? 'it' : ''} ${i === 6 ? 'out' : ''}" src="${p(h.id, 28)}">`).join('');
  body('hud').innerHTML = `
    <p class="intro">In-match overlay, mocked statically here with the real classes. Left thumb: joystick. Right thumb: <b>A</b> pass/dash (gold), <b>B</b> skill (green ring = defense, red = attack), <b>C</b> item.</p>
    <div class="hud-frame">
      <div class="hud">
        <div class="hud-vignette on"></div>
        <div class="hud-top"><div class="hud-timer danger"><div class="big">3.4</div><div class="sub">ROUND 2</div></div></div>
        <div class="hud-card left"><img class="portrait" src="${p(me.id, 48)}"><div class="info"><div class="name"><span class="sq"></span>${me.name}</div><div class="role">${me.title.toLowerCase()} · ${me.role.toLowerCase()}</div><div class="gb-pips"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></div><div class="gb-bar"><b style="width:70%"></b></div></div></div>
        <div class="hud-alive">${minis}</div>
        <div class="hud-feed" style="top:120px"><div class="row"><img src="${iconURL('skull', '#dc4343', 2)}"><img src="${p(HEROES[2].id, 28)}">RIO is out</div></div>
        <div class="hud-banner" style="top:30%"><div class="main red">VEX OUT</div><div class="sub">6 left</div></div>
        <div class="hud-tag" style="left:30%;top:62%">ZEN</div>
        <div class="hud-tag me" style="left:45%;top:68%">YOU</div>
        <div class="hud-tag it" style="left:62%;top:58%">▼ KOA</div>
        <div class="hud-joy"><div class="knob" style="transform:translate(30%,-20%)"></div></div>
        <div class="hud-actions">
          <div class="act a"><div class="cd" style="--cd:0%"></div><div class="k">A</div><div class="l">pass</div><div class="cdn"></div></div>
          <div class="act b"><div class="cd" style="--cd:45%"></div><div class="k"><img src="${iconURL(SKILL_ICON[`${me.id}.def`], C(`hero.${me.id}.fx`), 3)}"></div><div class="l">field</div><div class="cdn">5</div></div>
          <div class="act c"><div class="cd" style="--cd:0%"></div><div class="k"><img src="${itemIconURL('shield', 3)}"></div><div class="l"></div><div class="cdn"></div></div>
        </div>
      </div>
      <span class="note" style="left:8px;top:84px">.hud-card</span>
      <span class="note" style="left:50%;top:78px;transform:translateX(-50%)">.hud-timer.danger</span>
      <span class="note" style="right:8px;top:96px">.hud-alive · .hud-feed</span>
      <span class="note" style="left:8px;bottom:${C('ui.joySize') * C('ui.scale') + 30}px">.hud-joy</span>
      <span class="note" style="right:8px;bottom:${C('ui.btnSize') * 2.3 * C('ui.scale') + 26}px">.act a / b / c</span>
    </div>`;
}

// ── 05 Heroes ───────────────────────────────────────────────────────────
const spinners = [];

function phaseList(actionId) {
  return `<div class="phases">${phasesFor(actionId, C).map((ph) => `<span class="ph-${ph.type}" title="${esc(ph.note)}">${ph.name} ${ph.dur.toFixed(2)}s</span>`).join('')}</div>`;
}

function kit(h, slot, label) {
  const s = h[slot];
  const fx = C(`hero.${h.id}.fx`);
  const icon = slot === 'passive' ? iconURL('crown', fx, 3) : iconURL(SKILL_ICON[`${h.id}.${slot}`], fx, 3);
  const cd = slot === 'passive' ? '' : ` · cd ${fmt(C(`hero.${h.id}.${slot}.cd`))}s`;
  return `<div class="gb-card skill-box"><img src="${icon}"><div style="min-width:0"><div class="sk">${label}${cd}</div><div class="sn">${s.name}</div><div class="sd">${esc(s.desc)}</div>${slot === 'passive' ? '' : phaseList(`${h.id}.${slot}`)}</div></div>`;
}

function renderHeroes(only = null) {
  const host = body('heroes');
  if (!only) {
    host.innerHTML = `<p class="intro">Voxel heroes built from boxes with joint pivots (<code>engine/hero-model.js</code>), posed procedurally (<code>engine/anim.js</code>). Sprites and frames below are rendered live from the same rig.</p>
      <div class="sh-grid" data-heroes></div>`;
    host.querySelector('[data-heroes]').innerHTML = HEROES.map((h) => `<div class="gb-card hero-card" data-hero="${h.id}"></div>`).join('');
    spinners.length = 0;
  }
  for (const h of HEROES) {
    if (only && only !== h.id) continue;
    const card = host.querySelector(`[data-hero="${h.id}"]`);
    const L = h.look;
    const fx = C(`hero.${h.id}.fx`);
    const looks = [['skin', L.skin], ['hair', C(`hero.${h.id}.hair`)], ['jersey', C(`hero.${h.id}.jersey`)], ['trim', L.trim], ['shorts', L.shorts], ['boots', L.boots], ['fx', fx]];
    card.innerHTML = `
      <div class="vis"><canvas class="spin" width="64" height="64"></canvas><img class="bust" src="${portraitURL(h.id, C, 48)}"><div class="looks">${looks.map(([k, c]) => `<i style="background:${c}" title="${k} ${c}"></i>`).join('')}</div></div>
      <div style="min-width:0">
        <div class="t-label" style="color:${fx}">${h.role} · ${h.title}</div>
        <div class="name" style="color:${fx}">${h.name}</div>
        <div class="t-body" style="margin-top:6px">${esc(h.blurb)}</div>
        <div class="stat-row"><span class="stat">speed ×<b>${fmt(C(`hero.${h.id}.speed`))}</b></span><span class="stat">attack cd<b>${fmt(C(`hero.${h.id}.atk.cd`))}s</b></span><span class="stat">defense cd<b>${fmt(C(`hero.${h.id}.def.cd`))}s</b></span><span class="stat">build<b>${L.build}</b></span><span class="stat">hair<b>${L.hairStyle}</b></span></div>
        <div class="kits">${kit(h, 'passive', 'Passive')}${kit(h, 'atk', 'Attack · with ball')}${kit(h, 'def', 'Defense · no ball')}</div>
        <div class="t-label sh-sub" style="margin:12px 0 2px">Run cycle · 8f</div><div class="frames" data-run></div>
        <div class="t-label sh-sub" style="margin:8px 0 2px">${esc(h.atk.name)} · 8f</div><div class="frames" data-atk></div>
      </div>`;
    const put = (sel, frames) => {
      const box = card.querySelector(sel);
      for (const f of frames) { f.className = 'pixel'; box.appendChild(f); }
    };
    put('[data-run]', runFrames(h.id, C, 8, 48));
    put('[data-atk]', actionFrames(h.id, `${h.id}.atk`, C, 8, 48));
    const cv = card.querySelector('canvas.spin');
    const i = spinners.findIndex((s) => s.id === h.id);
    const entry = { id: h.id, cv, phase: HEROES.indexOf(h) * 0.9 };
    if (i >= 0) spinners[i] = entry; else spinners.push(entry);
    drawSpinner(entry, 0);
  }
}

function drawSpinner(s, t) {
  const pose = locomotionPose(0, t * 3 + s.phase, 1, 1, {});
  const img = renderHero(s.id, C, { w: 64, h: 64, mode: 'full', yaw: t * 0.9 + s.phase, pitch: 0.28, pose });
  const g = s.cv.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.drawImage(img, 0, 0);
}

// ── 06 Items ────────────────────────────────────────────────────────────
function renderItems() {
  body('items').innerHTML = `
    <p class="intro">Crates spawn on the pitch every <code>rules.itemEvery</code> = ${fmt(C('rules.itemEvery'))}s (max ${fmt(C('rules.maxItems'))}). One slot; use with the C button.</p>
    <div class="sh-grid item-grid">${Object.entries(ITEMS).map(([id, it]) => `
      <div class="gb-card item-card">
        <div class="icons"><img src="${itemIconURL(id, 2)}" width="24" height="24"><img src="${itemIconURL(id, 3)}" width="36" height="36"><img src="${itemIconURL(id, 5)}" width="60" height="60"></div>
        <div class="sh-row" style="justify-content:space-between"><span class="t-h2" style="font-size:14px;color:${it.color}">${it.name}</span><code>${id}</code></div>
        <div class="t-small">${esc(it.desc)}</div>
        <div>${[`<div class="fx-card" style="padding:0"><div class="kv"><span>enabled</span><b>${C(`item.${id}.on`) ? 'on' : 'off'}</b></div>`, ...Object.entries(it.params).map(([k, d]) => `<div class="kv"><span>${esc(d[4])}</span><b>${fmt(C(`item.${id}.${k}`))}</b></div>`), '</div>'].join('')}</div>
      </div>`).join('')}</div>`;
}

// ── 07 Icons ────────────────────────────────────────────────────────────
function renderIcons() {
  const skillOwner = Object.fromEntries(Object.entries(SKILL_ICON).map(([k, v]) => [v, k]));
  const colorFor = (name) => {
    if (ITEMS[name]) return ITEMS[name].color;
    if (skillOwner[name]) return C(`hero.${skillOwner[name].split('.')[0]}.fx`);
    if (name === 'skull') return C('ui.red');
    return C('ui.accent');
  };
  body('icons').innerHTML = `
    <p class="intro">12×12 character grids (<code>ui/icons.js</code>). Palette: <code>o</code> outline, <code>a</code> main, <code>b</code> highlight, <code>d</code> shade, <code>w</code> white. Shown at 1×, 2×, 4×.</p>
    <div class="sh-grid icon-grid">${Object.keys(ICONS).map((name) => {
      const col = colorFor(name);
      return `<div class="gb-card icon-cell"><div class="sizes">${[1, 2, 4].map((px) => `<img src="${iconURL(name, col, px)}" width="${12 * px}" height="${12 * px}">`).join('')}</div><div><div class="sn" style="font-family:var(--font-display);font-size:12px">${name}</div><code>${skillOwner[name] ? 'skill ' + skillOwner[name] : ITEMS[name] ? 'item' : 'ui'}</code></div></div>`;
    }).join('')}</div>`;
}

// ── 08 VFX ──────────────────────────────────────────────────────────────
const FX_VOCAB = [
  ['Ring', 'Expanding ground ring, additive. Marks kicks, catches, skill origins.', ['fx.particles']],
  ['Pillar', 'Vertical light column. Ball spawn, item drop, elimination.', ['fx.flash']],
  ['Beam', 'Stretched glowing box between two points. Aim lines, Direct Volley, smears.', ['fx.smears']],
  ['Afterimage', 'Flat-coloured clone of the hero that fades. Dashes, leaps, blinks.', ['fx.smears']],
  ['Voxel shatter', 'Hero splits into its own boxes with gravity + floor bounce.', ['fx.particles', 'anim.elim.burst', 'anim.elim.scatter']],
  ['Hitstop', 'Sim freezes for a few frames on impact so hits read.', ['fx.hitstop']],
  ['Shake', 'Camera trauma² shake in screen space.', ['fx.shake']],
  ['Flash', 'Full-screen colour flash (screen blend).', ['fx.flash']],
  ['Slow-mo', 'Global time scale after an elimination.', ['fx.slowmo', 'fx.slowmoTime']],
  ['Ball trail', 'Glow voxels dropped behind a ball in flight.', ['fx.trail']],
  ['Pixel size', 'Render at 1/N resolution, upscale nearest-neighbour.', ['render.pixelScale']],
  ['Stepped anim', 'Pose updates at a lower fps for a hand-animated feel.', ['render.animFps']],
];

function renderVfx() {
  const host = body('vfx');
  const first = !host.querySelector('.demo');
  const cards = `<div class="sh-grid fx-grid" data-fxcards>${FX_VOCAB.map(([n, d, keys]) => `<div class="gb-card fx-card"><div class="t-h2" style="font-size:13px">${n}</div><div class="t-small">${d}</div>${keys.map((k) => `<div class="kv"><code>${k}</code><b>${fmt(C(k))}</b></div>`).join('')}</div>`).join('')}</div>`;
  if (!first) { host.querySelector('[data-fxcards]').outerHTML = cards; return; }
  host.innerHTML = `
    <p class="intro">Every action is a list of phases. Phase type decides the easing and the colour on the editor timeline.</p>
    <div class="legend"><span><i style="background:var(--blue)"></i>HOLD · anticipation, ease-out cubic</span><span><i style="background:var(--red)"></i>FAST · the snap, ease-out quad</span><span><i style="background:var(--tan)"></i>MOVE · follow-through, ease-in-out</span></div>
    <div class="t-label sh-sub">Live loop</div>
    <div class="demo" data-demo><div class="cap"><span class="gb-tag hold" data-demo-tag>RING</span><span class="gb-caption" data-demo-cap>…</span></div></div>
    <div class="t-label sh-sub">Vocabulary</div>
    ${cards}`;
  startDemo(host.querySelector('[data-demo]'));
}

let demo = null;
function startDemo(el) {
  const stage = new Stage(el, C);
  stage.applyTheme('egolab', 10, 10);
  stage.zoomMul = 0.36;
  const vfx = new VFX(stage.scene, C);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: '#a9b0c8' }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const grid = new THREE.GridHelper(40, 40, '#6a74a0', '#6a74a0');
  grid.position.y = 0.01;
  stage.scene.add(floor, grid);
  const heroIds = HEROES.map((h) => h.id);
  let model = null, heroIdx = 0;
  const swapHero = () => {
    if (model) stage.scene.remove(model);
    model = buildHero(heroIds[heroIdx % heroIds.length], C);
    stage.scene.add(model);
  };
  swapHero();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const steps = [
    ['RING', 'hold', 'Expanding ground rings', (fx) => { vfx.ring(V(0, 0, 0), { color: fx, r0: 0.2, r1: 3, time: 0.5 }); vfx.ring(V(0, 0, 0), { color: '#ffffff', r0: 0.2, r1: 1.6, time: 0.3 }); }],
    ['BEAM', 'fast', 'Beam + burst: a volley', (fx) => { vfx.beam(V(0.4, 0.5, 0.4), V(4, 0.5, 4), fx, 0.35, 0.3); vfx.burst(V(0.6, 0.5, 0.6), { count: 24, color: [fx, '#ffffff'], glow: true, dir: { x: 1, z: 1 }, spread: 0.4, speed: 9, up: 2, life: 0.4 }); stage.shake(0.3); }],
    ['AFTERIMAGE', 'move', 'Afterimages on a dash', (fx) => { for (let i = 0; i < 5; i++) setTimeout(() => { model.position.x = -2 + i; vfx.afterimage(model, fx, 0.4, 0.5); }, i * 50); setTimeout(() => (model.position.x = 0), 400); }],
    ['PILLAR', 'hold', 'Pillar + flash', (fx) => { vfx.pillar(V(0, 0, 0), fx, 7, 0.6, 0.6); stage.flash(fx, 0.6, 0.2); }],
    ['SHATTER', 'fast', 'Voxel shatter (elimination)', (fx) => { vfx.shatter(model, 7, [fx, '#ffffff']); model.visible = false; stage.shake(0.6); setTimeout(() => { heroIdx++; swapHero(); }, 1100); }],
  ];
  let t = 0, idx = -1, cyc = 0;
  const tag = el.querySelector('[data-demo-tag]'), cap = el.querySelector('[data-demo-cap]');
  let visible = true;
  new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(el);
  demo = {
    update(dt) {
      if (!visible) return;
      t += dt;
      cyc += dt * 6;
      if (t > 1.4 || idx < 0) {
        t = 0;
        idx = (idx + 1) % steps.length;
        const [name, type, text, run] = steps[idx];
        tag.textContent = name;
        tag.className = `gb-tag ${type}`;
        cap.textContent = text;
        run(C(`hero.${heroIds[heroIdx % heroIds.length]}.fx`));
      }
      const hid = heroIds[heroIdx % heroIds.length];
      const ph = phasesFor(`${hid}.atk`, C);
      const tt = (t * 0.8) % (totalDuration(ph) + 0.6);
      const pose = tt < totalDuration(ph) ? actionPose(ph, tt, 1, POSES.idle) : locomotionPose(0, cyc, 1, 1, {});
      applyPose(model, pose);
      model.rotation.y = 0.8;
      vfx.update(dt);
      stage.update(dt);
      stage.render();
    },
  };
}

// ── 09 Arenas & modes ───────────────────────────────────────────────────
function renderArenas() {
  body('arenas').innerHTML = `
    <p class="intro">Three visual variants of the arena (<code>arena.theme</code>, currently <b>${C('arena.theme')}</b>) and five rule variants (<code>rules.mode</code>, currently <b>${C('rules.mode')}</b>).</p>
    <div class="t-label sh-sub">Arena themes</div>
    <div class="sh-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${Object.entries(THEMES).map(([id, T]) => `
      <div class="gb-card theme-row ${id === C('arena.theme') ? 'selected' : ''}" style="padding:0;overflow:hidden">
        <div style="height:90px;background:${T.sky};position:relative;overflow:hidden">
          <div style="position:absolute;left:12%;right:12%;top:30px;height:44px;background:${T.ground};transform:skewX(-30deg);border:4px solid ${T.curb};box-shadow:inset 0 0 0 3px ${T.lineA}"></div>
          <div style="position:absolute;left:12%;right:12%;top:78px;height:20px;background:${T.plinth};transform:skewX(-30deg)"></div>
        </div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:8px"><div class="hd" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="t-h2" style="font-size:15px">${T.name}</span><code>${id}</code></div>
        <div class="t-small">${esc(T.desc)}</div>
        <div class="sh-strip">${themeColors(T).map(([k, c]) => `<i style="background:${c}" title="${k} ${c}"></i>`).join('')}</div></div>
      </div>`).join('')}</div>
    <div class="t-label sh-sub">Game modes</div>
    <div class="sh-grid mode-grid">${Object.entries(MODES).map(([id, m]) => `<div class="gb-card mode-pick ${id === C('rules.mode') ? 'selected' : ''}"><div class="tg">${m.tag}</div><div class="nm">${m.name}</div><div class="ds">${esc(m.desc)}</div><code>${id} · balls ${m.balls} · timer ${m.timer}${m.shrink ? ' · shrink' : ''}</code></div>`).join('')}</div>`;
}

// ── Render + live updates ───────────────────────────────────────────────
function renderAll() {
  renderColors(); renderType(); renderComponents(); renderHud(); renderHeroes(); renderItems(); renderIcons(); renderVfx(); renderArenas();
}
renderAll();

let pending = new Set(), all = false, timer = 0;
cfg.onChange((key) => {
  if (!key) all = true; else pending.add(key);
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
});

function flush() {
  const keys = [...pending];
  pending = new Set();
  if (all) { all = false; invalidatePortraits(); renderAll(); return; }
  const has = (p) => keys.some((k) => k.startsWith(p));
  if (has('ui.')) { renderColors(); renderHud(); renderType(); }
  if (has('hero.')) {
    const ids = new Set(keys.filter((k) => k.startsWith('hero.')).map((k) => k.split('.')[1]));
    if (keys.some((k) => /\.(jersey|hair)$/.test(k))) invalidatePortraits();
    for (const id of ids) renderHeroes(id);
    renderColors(); renderComponents(); renderIcons();
  }
  if (has('item.') || has('rules.item') || has('rules.maxItems')) renderItems();
  if (has('fx.') || has('anim.') || has('render.')) renderVfx();
  if (has('arena.') || has('rules.mode')) renderArenas();
}

// Nav highlight
const links = [...root.querySelectorAll('.sh-nav a[href^="#"]')];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${e.target.id}`));
}, { rootMargin: '-40% 0px -55% 0px' });
root.querySelectorAll('.sh-sec').forEach((s) => io.observe(s));

// Loop: rotating sprites (~10fps) + VFX demo
let last = performance.now(), spinAcc = 0, spinT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  spinAcc += dt; spinT += dt;
  if (spinAcc > 0.1) {
    spinAcc = 0;
    for (const s of spinners) {
      if (!s.cv.isConnected) continue;
      const r = s.cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      drawSpinner(s, spinT);
    }
  }
  demo?.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
