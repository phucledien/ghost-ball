import '../ui/style.css';
import '../editor/editor.css';
import * as THREE from 'three';
import { loadConfig } from '../core/config.js';
import { SCHEMA } from '../core/schema.js';
import { Stage } from '../engine/stage.js';
import { Arena } from '../engine/arena.js';
import { VFX } from '../engine/vfx.js';
import { buildHero, applyPose, footWorld } from '../engine/hero-model.js';
import { POSES, actionPose, totalDuration, phaseAt, poseDelta } from '../engine/anim.js';
import { HEROES, HERO_BY_ID, ACTIONS, phasesFor, ampFor, actionLabel } from '../game/heroes.js';
import { MODES } from '../game/modes.js';
import { Match } from '../game/sim.js';
import { Input } from '../game/input.js';
import { Hud } from '../ui/hud.js';
import { resolveMap } from '../game/maps.js';
import { bindTokens } from '../ui/tokens.js';
import { invalidatePortraits } from '../ui/portrait.js';
import { SkillLab } from '../editor/lab.js';

// Relative index route works in development and in the published /play/ directory.
const GAME_URL = './';

const cfg = await loadConfig();
const C = cfg.get;
bindTokens(cfg);

const qs = new URLSearchParams(location.search);
const state = {
  mode: qs.get('view') === 'match' ? 'match' : 'lab', // lab | match
  compare: 'draft', // draft | locked | both
  camView: 'game',
  frame: 'desk', // desk | phone | phone-l
  pixels: true, smears: true, onion: false, arcs: true, arena: true, beats: true, shake: true,
  action: qs.get('action') || 'titan.atk',
  hero: 'nova',
  selPhase: null,
  matchHero: 'nova',
  matchMode: C('rules.mode'),
  spectate: false,
};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const root = document.getElementById('editor');

// ── Layout ────────────────────────────────────────────────────────────────
const top = el('div', 'ed-top');
const main = el('div', 'ed-main');
const side = el('aside', 'ed-side');
const center = el('div', 'ed-center');
const view = el('div', 'ed-view');
const frame = el('div', 'ed-frame');
const overlay = el('div', 'ed-overlay');
const tl = el('div', 'ed-tl');
view.append(frame);
frame.append(overlay);
center.append(view, tl);
main.append(side, center);
root.append(top, main);

// Chip-group helper
function seg(options, get, set, cls = '') {
  const s = el('div', 'gb-seg ' + cls);
  const render = () => {
    s.innerHTML = '';
    for (const [val, label] of options) {
      const b = el('button', 'gb-btn' + (get() === val ? ' on' : ''), label);
      b.onclick = () => { set(val); render(); };
      s.append(b);
    }
  };
  render();
  s.refresh = render;
  return s;
}
function toggle(label, key, onChange) {
  const b = el('button', 'gb-btn' + (state[key] ? ' on' : ''), label);
  b.onclick = () => { state[key] = !state[key]; b.classList.toggle('on', state[key]); onChange?.(); };
  return b;
}

// ── Engine ────────────────────────────────────────────────────────────────
const stage = new Stage(frame, C);
const arena = new Arena(stage.scene);
const vfx = new VFX(stage.scene, C);
const realShake = stage.shake.bind(stage);
stage.shake = (a) => { if (state.shake) realShake(a); };

// Grid floor for "Arena off" (like the reference's light grid)
const grid = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#c4c7d6'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#b8bbcc';
  for (let i = 0; i < 64; i += 2) for (let j = i % 4 === 0 ? 0 : 1; j < 64; j += 2) g.fillRect(i, j, 1, 1);
  g.fillStyle = '#8b90b0'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  stage.scene.add(m);
  return m;
})();

let worldKey = '';
let world = null;
function buildWorld(force = false) {
  const key = [C('arena.map'), C('arena.theme'), C('arena.width'), C('arena.depth'), C('arena.crowd'), C('arena.lights'), state.mode].join('|');
  if (key === worldKey && !force) return applyArenaToggle();
  worldKey = key;
  world = resolveMap(C('arena.map'), C);
  // The Skill Lab keeps a clear floor: obstacles only exist in Live Match
  const layout = state.mode === 'lab' ? null : world;
  arena.build(world.theme, world.W, world.D, C('arena.crowd'), C('arena.lights'), layout);
  stage.applyTheme(world.theme, world.W, world.D);
  applyArenaToggle();
}
function applyArenaToggle() {
  arena.group.visible = state.arena;
  grid.visible = !state.arena;
  if (!state.arena) stage.scene.background = new THREE.Color('#aeb2c8');
  else stage.applyTheme(world.theme, world.W, world.D);
}

const lab = new SkillLab({ stage, arena, vfx, cfg });
let match = null, hud = null, input = null;

// ── Top bar ───────────────────────────────────────────────────────────────
function actionOptions() {
  const out = Object.keys(ACTIONS).map((id) => [id, `${ACTIONS[id].name} (any hero)`]);
  for (const h of HEROES) for (const slot of ['atk', 'def']) out.push([`${h.id}.${slot}`, `${h.name} · ${h[slot].name}`]);
  return out;
}
function select(options, value, onChange) {
  const s = el('select');
  for (const [v, l] of options) { const o = el('option', null, l); o.value = v; s.append(o); }
  s.value = value;
  s.onchange = () => onChange(s.value);
  return s;
}

const sideToggle = el('button', 'gb-btn ed-side-toggle', '☰ Params');
sideToggle.onclick = () => side.classList.toggle('open');
const row1 = el('div', 'ed-row');
const row2 = el('div', 'ed-row');
top.append(row1, row2);

const modeSeg = seg([['lab', 'Skill Lab'], ['match', 'Live Match']], () => state.mode, (v) => { state.mode = v; enterMode(); });
const compareSeg = seg([['locked', 'Locked'], ['draft', 'Draft'], ['both', 'Both']], () => state.compare, (v) => { state.compare = v; lab.setCompare(v); afterRebuild(); });
const camSeg = seg([['game', 'Game'], ['side', 'Side'], ['front', 'Front'], ['top', 'Top'], ['orbit', 'Orbit']], () => state.camView, (v) => { state.camView = v; stage.view = v; });
const frameSeg = seg([['desk', 'Desk'], ['phone', 'Phone'], ['phone-l', 'Phone ⟷']], () => state.frame, (v) => { state.frame = v; view.className = 'ed-view ' + (v === 'desk' ? '' : v); hud?.setControlMode(v === 'desk' ? 'auto' : 'touch'); });
row1.append(el('div', 'ed-logo', 'GHOST<span>·</span>BALL EDITOR'), sideToggle, modeSeg, compareSeg, camSeg, frameSeg, el('div', 'ed-spacer'));
const links = el('div', 'ed-row', `<a class="gb-btn" href="${GAME_URL}">Game ↗</a><a class="gb-btn" href="./sheet.html">Design sheet ↗</a>`);
row1.append(links);

const pixelSeg = seg([[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], () => C('render.pixelScale'), (v) => cfg.set('render.pixelScale', v));
const actionSel = select(actionOptions(), state.action, (v) => { state.action = v; state.selPhase = null; lab.set(v); afterRebuild(); renderParams(); });
const heroSel = select(HEROES.map((h) => [h.id, h.name]), state.hero, (v) => { state.hero = v; lab.set(null, v); afterRebuild(); });
const labControls = el('div', 'ed-row');
labControls.append(el('span', 't-label', 'Action'), actionSel, el('span', 't-label', 'Hero'), heroSel);
const matchControls = el('div', 'ed-row');
const matchModeSel = select(Object.entries(MODES).map(([id, m]) => [id, `${m.tag} · ${m.name}`]), state.matchMode, (v) => { state.matchMode = v; startMatch(); });
const matchHeroSel = select(HEROES.map((h) => [h.id, h.name]), state.matchHero, (v) => { state.matchHero = v; startMatch(); });
const restartBtn = el('button', 'gb-btn primary', 'Restart');
restartBtn.onclick = () => startMatch();
const specBtn = toggle('Spectate', 'spectate', () => startMatch());
matchControls.append(el('span', 't-label', 'Mode'), matchModeSel, el('span', 't-label', 'Play as'), matchHeroSel, restartBtn, specBtn);

row2.append(
  labControls, matchControls, el('div', 'ed-sep'),
  el('span', 't-label', 'Pixel'), pixelSeg,
  toggle('Pixels', 'pixels', () => { stage.pixelOverride = state.pixels ? null : 1; }),
  toggle('Smears', 'smears', () => { vfx.enabledSmears = state.smears; }),
  toggle('Onion', 'onion'),
  toggle('Arcs', 'arcs'),
  toggle('Arena', 'arena', applyArenaToggle),
  toggle('Beats', 'beats'),
  toggle('Shake', 'shake'),
);

// ── Params sidebar ────────────────────────────────────────────────────────
const sideHead = el('div', 'ed-side-head');
const search = el('input');
search.type = 'search';
search.placeholder = 'Search params…';
const collapseBtn = el('button', 'gb-btn', 'Collapse');
const closeParams = el('button', 'gb-btn ed-side-close', 'Close');
closeParams.setAttribute('aria-label', 'Close parameters');
function closeParameterDrawer() {
  side.classList.remove('open');
  sideToggle.focus({ preventScroll: true });
}
closeParams.onclick = closeParameterDrawer;
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && side.classList.contains('open') && matchMedia('(max-width: 980px)').matches) {
    event.preventDefault();
    closeParameterDrawer();
  }
});
sideHead.append(search, collapseBtn, closeParams);
const params = el('div', 'ed-params');
const foot = el('div', 'ed-foot');
side.append(sideHead, params, foot);

const GROUP_TITLES = { rules: 'Rules', move: 'Movement', ball: 'Ball', camera: 'Camera', render: 'Render', fx: 'FX & juice', anim: 'Animation · shared', arena: 'Arena', ui: 'UI & design tokens', item: 'Items' };
function groupOf(key) {
  const [a, b] = key.split('.');
  return a === 'hero' ? `hero.${b}` : a;
}
function groupTitle(g) {
  if (g.startsWith('hero.')) { const h = HERO_BY_ID[g.slice(5)]; return `Hero · ${h.name}`; }
  return GROUP_TITLES[g] || g;
}
function actionKeys(id) {
  if (ACTIONS[id]) return SCHEMA.filter((s) => s.key.startsWith(`anim.${id}.`)).map((s) => s.key);
  const [hid, slot] = id.split('.');
  return [`hero.${hid}.fx`, ...SCHEMA.filter((s) => s.key.startsWith(`hero.${hid}.${slot}.`)).map((s) => s.key)];
}
function phaseKey(id, phase) {
  if (ACTIONS[id]) return `anim.${id}.${phase}`;
  const [hid, slot] = id.split('.');
  return `hero.${hid}.${slot}.${phase}`;
}

const rows = new Map(); // key -> [{row, sync}]
const openGroups = new Set(['__action', 'fx']);
function fmt(v, step) {
  const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return Number(v).toFixed(d);
}

function paramRow(s) {
  const row = el('div', 'prm');
  row.dataset.key = s.key;
  const lab = el('div', 'prm-l', `<span class="dot" title="Revert to locked"></span><span>${s.label}</span><code>${s.key}</code>`);
  lab.querySelector('.dot').onclick = () => cfg.revert(s.key);
  lab.ondblclick = () => cfg.resetToDefault(s.key);
  lab.title = 'Double-click: reset to default';
  row.append(lab);
  let sync;
  if (s.type === 'num') {
    const r = el('input'); r.type = 'range'; r.min = s.min; r.max = s.max; r.step = s.step;
    const n = el('input'); n.type = 'number'; n.min = s.min; n.max = s.max; n.step = s.step;
    r.oninput = () => cfg.set(s.key, +r.value);
    n.onchange = () => cfg.set(s.key, +n.value);
    row.append(r, n);
    sync = () => { const v = C(s.key); r.value = v; if (document.activeElement !== n) n.value = fmt(v, s.step); };
  } else if (s.type === 'bool') {
    const b = el('button', 'gb-btn');
    b.onclick = () => cfg.set(s.key, !C(s.key));
    row.append(b);
    sync = () => { const v = C(s.key); b.textContent = v ? 'On' : 'Off'; b.classList.toggle('on', v); };
  } else if (s.type === 'color') {
    const c = el('input'); c.type = 'color';
    const t = el('input'); t.type = 'text';
    c.oninput = () => cfg.set(s.key, c.value);
    t.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) cfg.set(s.key, t.value.toLowerCase()); };
    row.append(c, t);
    sync = () => { const v = C(s.key); c.value = v; if (document.activeElement !== t) t.value = v; };
  } else if (s.type === 'enum') {
    const sg = seg(s.options.map((o) => [o, o]), () => C(s.key), (v) => cfg.set(s.key, v));
    row.append(sg);
    sync = () => sg.refresh();
  }
  const full = () => { sync(); row.classList.toggle('changed', s.key in cfg.draft); };
  full();
  if (!rows.has(s.key)) rows.set(s.key, []);
  rows.get(s.key).push({ row, sync: full });
  return row;
}

function group(id, title, entries, pinned = false) {
  const d = el('details', 'ed-group' + (pinned ? ' pinned' : ''));
  d.dataset.group = id;
  if (openGroups.has(id)) d.open = true;
  d.ontoggle = () => (d.open ? openGroups.add(id) : openGroups.delete(id));
  const changed = entries.filter((s) => s.key in cfg.draft).length;
  d.append(el('summary', null, `${title}<span class="cnt">${changed ? '● ' + changed : ''}</span>`));
  for (const s of entries) d.append(paramRow(s));
  return d;
}

function renderParams() {
  rows.clear();
  params.innerHTML = '';
  const q = search.value.trim().toLowerCase();
  const match = (s) => !q || s.key.toLowerCase().includes(q) || s.label.toLowerCase().includes(q);
  if (state.mode === 'lab') {
    const keys = actionKeys(state.action);
    const entries = keys.map((k) => SCHEMA.find((s) => s.key === k)).filter(Boolean).filter(match);
    if (entries.length) params.append(group('__action', `★ ${actionLabel(state.action)}`, entries, true));
  }
  const groups = new Map();
  for (const s of SCHEMA) {
    if (!match(s)) continue;
    const g = groupOf(s.key);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  for (const [g, entries] of groups) {
    if (q) openGroups.add(g);
    params.append(group(g, groupTitle(g), entries));
  }
}
search.oninput = renderParams;
collapseBtn.onclick = () => { openGroups.clear(); renderParams(); };

function syncParams(key) {
  if (key && rows.has(key)) rows.get(key).forEach((r) => r.sync());
  else for (const list of rows.values()) list.forEach((r) => r.sync());
  for (const d of params.querySelectorAll('.ed-group')) {
    const n = [...d.querySelectorAll('.prm')].filter((r) => r.dataset.key in cfg.draft).length;
    d.querySelector('summary .cnt').textContent = n ? '● ' + n : '';
  }
}

function highlight(key) {
  side.classList.add('open');
  const r = rows.get(key)?.[0]?.row;
  if (!r) return;
  r.closest('details').open = true;
  r.scrollIntoView({ block: 'center' });
  r.classList.add('hl');
  setTimeout(() => r.classList.remove('hl'), 1200);
}

// Footer: diff + lock
const diffEl = el('div', 'ed-diff');
const note = el('input', 'ed-note');
note.placeholder = 'Lock note (optional) — e.g. "snappier cannon"';
const lockBtn = el('button', 'gb-btn primary', 'LOCK ▣');
const revertBtn = el('button', 'gb-btn', 'Revert all');
const copyBtn = el('button', 'gb-btn', 'Copy JSON');
const diffTitle = el('div', 't-label');
foot.append(diffTitle, diffEl, note, (() => { const r = el('div', 'ed-row'); r.append(lockBtn, copyBtn, revertBtn); return r; })());

function renderDiff() {
  const d = cfg.diff();
  diffTitle.textContent = d.length ? `${d.length} unlocked change${d.length === 1 ? '' : 's'}` : 'In sync with locked config';
  diffEl.innerHTML = d.map((x) => `<div data-k="${x.key}"><span>${x.key}</span><span style="margin-left:auto">${x.from} → <b>${x.to}</b></span></div>`).join('');
  diffEl.querySelectorAll('[data-k]').forEach((r) => (r.onclick = () => highlight(r.dataset.k)));
  lockBtn.disabled = !d.length;
  revertBtn.disabled = !d.length;
}

function toast(msg, err = false) {
  const t = el('div', 'ed-toast' + (err ? ' err' : ''), msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

lockBtn.onclick = async () => {
  const n = cfg.diff().length;
  const r = await cfg.lock(note.value);
  if (r.ok) { toast(`Locked ${n} change${n === 1 ? '' : 's'} → <b>${r.file}</b> (history: ${r.history})`); note.value = ''; }
  else toast(`Lock failed — dev server API not reachable. Use Copy JSON instead.<br><small>${r.error || ''}</small>`, true);
};
revertBtn.onclick = () => cfg.revert();
copyBtn.onclick = async () => {
  const payload = { note: note.value, changes: cfg.diff(), values: Object.fromEntries(cfg.diff().map((d) => [d.key, d.to])) };
  try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); toast('Copied draft changes as JSON'); } catch { toast('Clipboard blocked', true); }
};

// ── Timeline ──────────────────────────────────────────────────────────────
const tlRow1 = el('div', 'ed-row');
const tlRow2 = el('div', 'ed-row');
const tlCanvas = el('canvas');
tl.append(tlRow1, tlRow2, tlCanvas);
const tBtn = (label, fn) => { const b = el('button', 'gb-btn', label); b.onclick = fn; return b; };
const playBtn = tBtn('Pause', () => setPlaying(!lab.playing || lab.scrubT != null));
function setPlaying(p) {
  lab.playing = p;
  if (p && lab.scrubT != null) { lab.scrubT = null; lab.restart(); }
  playBtn.textContent = p ? 'Pause' : 'Play';
  playBtn.classList.toggle('on', !p);
}
const stepBy = (d) => { lab.playing = false; lab.scrubT = Math.max(0, Math.min(lab.total(), (lab.scrubT ?? lab.time) + d)); setPlaying(false); };
const transport = el('div', 'gb-seg');
transport.append(
  tBtn('⏮', () => { lab.restart(); lab.scrubT = 0; setPlaying(false); }),
  tBtn('◀', () => stepBy(-1 / 60)),
  playBtn,
  tBtn('▶', () => stepBy(1 / 60)),
  tBtn('⏭', () => { lab.scrubT = lab.total(); setPlaying(false); }),
);
const speedSeg = seg([[1, '1×'], [0.5, '½'], [0.25, '¼'], [0.1, '⅒']], () => lab.speed, (v) => (lab.speed = v));
const fpsSeg = seg([[60, '60'], [30, '30'], [15, '15'], [12, '12']], () => C('render.animFps'), (v) => cfg.set('render.animFps', v));
tlRow1.append(transport, speedSeg, el('span', 't-label', 'Anim fps'), fpsSeg);
const legend = el('div', 'ed-legend', '<span><i style="background:var(--blue)"></i>HOLD</span><span><i style="background:var(--red)"></i>FAST</span><span><i style="background:var(--tan)"></i>MOVE</span><span style="color:var(--accent)">— draft</span><span>- - locked</span>');
const readout = el('div', 'ed-readout t-num', 'F 000 / 000 · 0.00 S');
tlRow2.append(legend, readout);

const TYPE_COL = { hold: () => C('ui.blue'), fast: () => C('ui.red'), move: () => C('ui.tan') };
const tlGeom = { pad: 16, barY: 6, barH: 26, curveY: 42, curveH: 70, rulerY: 0 };
let drag = null;

function curveFor(Cg) {
  const phases = phasesFor(state.action, Cg);
  const total = totalDuration(phases);
  const amp = ampFor(state.action, Cg);
  const N = 160;
  const pts = [];
  let prev = actionPose(phases, 0, amp, POSES.idle);
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * total;
    const p = actionPose(phases, t, amp, POSES.idle);
    pts.push([t, poseDelta(prev, p) / (total / N)]);
    prev = p;
  }
  return { pts, total, phases };
}

function drawTimeline() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
  if (tlCanvas.width !== w * dpr || tlCanvas.height !== h * dpr) { tlCanvas.width = w * dpr; tlCanvas.height = h * dpr; }
  const g = tlCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  const draft = curveFor(cfg.get), locked = curveFor(cfg.getLocked);
  const span = Math.max(draft.total, locked.total, 0.05) * 1.04;
  const { pad, barY, barH } = tlGeom;
  const curveY = barY + barH + 10, rulerY = h - 16, curveH = rulerY - curveY - 4;
  const X = (t) => pad + (t / span) * (w - pad * 2);
  tlGeom.X = X; tlGeom.span = span; tlGeom.curveY = curveY; tlGeom.rulerY = rulerY;

  // Phase bar
  let acc = 0;
  draft.phases.forEach((ph, i) => {
    const x0 = X(acc), x1 = X(acc + ph.dur);
    g.fillStyle = TYPE_COL[ph.type]();
    g.fillRect(x0 + 1, barY, Math.max(1, x1 - x0 - 2), barH);
    if (state.selPhase === i) { g.strokeStyle = C('ui.ink'); g.lineWidth = 2; g.strokeRect(x0 + 1, barY + 1, Math.max(1, x1 - x0 - 2), barH - 2); }
    g.fillStyle = '#0e1524';
    g.font = '10px Silkscreen, monospace';
    const label = ph.name.toUpperCase();
    if (x1 - x0 > g.measureText(label).width + 10) { g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillText(label, x0 + 7, barY + 17); }
    acc += ph.dur;
  });
  // Locked boundaries
  acc = 0;
  g.fillStyle = '#a9a6b8';
  for (const ph of locked.phases) { acc += ph.dur; g.fillRect(Math.round(X(acc)) - 1, barY + barH + 1, 2, 5); }

  // Curve grid
  const maxV = Math.max(...draft.pts.map((p) => p[1]), ...locked.pts.map((p) => p[1]), 1);
  const Y = (v) => curveY + curveH - Math.sqrt(v / maxV) * curveH;
  g.strokeStyle = 'rgba(169,166,184,0.12)';
  g.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(pad, curveY + curveH * f); g.lineTo(w - pad, curveY + curveH * f); g.stroke(); }
  g.fillStyle = '#a9a6b8';
  g.font = '11px "Pixelify Sans", sans-serif';
  g.fillText('pose speed', pad + 4, curveY + 11);
  // Draft fill + line
  g.beginPath();
  g.moveTo(X(0), curveY + curveH);
  for (const [t, v] of draft.pts) g.lineTo(X(t), Y(v));
  g.lineTo(X(draft.total), curveY + curveH);
  g.closePath();
  g.fillStyle = 'rgba(140,123,88,0.45)';
  g.fill();
  g.beginPath();
  draft.pts.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v))));
  g.strokeStyle = C('ui.accent');
  g.lineWidth = 2;
  g.stroke();
  // Locked dashed
  g.setLineDash([4, 4]);
  g.beginPath();
  locked.pts.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v))));
  g.strokeStyle = 'rgba(200,196,220,0.7)';
  g.lineWidth = 1.5;
  g.stroke();
  g.setLineDash([]);

  // Ruler (frames @60)
  g.fillStyle = '#a9a6b8';
  g.font = '10px Silkscreen, monospace';
  const frames = Math.ceil(span * 60);
  const stepF = frames > 120 ? 20 : frames > 50 ? 10 : 5;
  for (let f = 0; f <= frames; f += stepF) {
    const x = Math.round(X(f / 60));
    g.fillRect(x, rulerY - 4, 1, 4);
    g.fillText(f % 60 === 0 ? `${f / 60}S` : String(f), x - 6, rulerY + 10);
  }
  g.fillRect(pad, rulerY - 4, w - pad * 2, 1);

  // Playhead
  const t = lab.time;
  const px = Math.round(X(Math.min(t, span)));
  g.fillStyle = C('ui.accent');
  g.fillRect(px - 1, barY - 4, 3, rulerY - barY + 4);
  g.fillRect(px - 5, barY - 6, 11, 5);

  const F = Math.round(t * 60), TF = Math.round(draft.total * 60);
  readout.textContent = `F ${String(F).padStart(3, '0')} / ${String(TF).padStart(3, '0')} · ${t.toFixed(2)} S`;
}

function tlHit(e) {
  const r = tlCanvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const { X, span, pad } = tlGeom;
  const t = ((x - pad) / (tlCanvas.clientWidth - pad * 2)) * span;
  return { x, y, t };
}
tlCanvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'lab') return;
  tlCanvas.setPointerCapture(e.pointerId);
  const { x, y, t } = tlHit(e);
  const phases = phasesFor(state.action, C);
  if (y <= tlGeom.barY + tlGeom.barH + 4) {
    // Boundary drag?
    let acc = 0;
    for (let i = 0; i < phases.length; i++) {
      acc += phases[i].dur;
      if (Math.abs(tlGeom.X(acc) - x) < 7) { drag = { type: 'edge', i, start: acc - phases[i].dur }; return; }
    }
    const { index } = phaseAt(phases, Math.max(0, t));
    state.selPhase = index;
    highlight(phaseKey(state.action, phases[index].name));
    drag = { type: 'scrub' };
  } else drag = { type: 'scrub' };
  lab.scrubT = Math.max(0, Math.min(lab.total(), t));
  setPlaying(false);
});
tlCanvas.addEventListener('pointermove', (e) => {
  const { x, t } = tlHit(e);
  if (!drag) {
    if (state.mode !== 'lab') return;
    let acc = 0, near = false;
    for (const ph of phasesFor(state.action, C)) { acc += ph.dur; if (Math.abs(tlGeom.X(acc) - x) < 7) near = true; }
    tlCanvas.style.cursor = near ? 'ew-resize' : 'crosshair';
    return;
  }
  if (drag.type === 'edge') {
    const ph = phasesFor(state.action, C)[drag.i];
    const v = Math.max(0, Math.min(1.5, Math.round((t - drag.start) / 0.005) * 0.005));
    cfg.set(phaseKey(state.action, ph.name), +v.toFixed(3));
    lab.scrubT = Math.max(0, Math.min(lab.total(), t));
  } else lab.scrubT = Math.max(0, Math.min(lab.total(), t));
});
tlCanvas.addEventListener('pointerup', () => { drag = null; });

// ── Onion skins & arcs ────────────────────────────────────────────────────
const onion = { models: [], hero: null };
function ghostModel(heroId, color, opacity) {
  const m = buildHero(heroId, C);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  m.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
  stage.scene.add(m);
  return m;
}
function ensureOnion() {
  const hid = lab.actorHero;
  if (onion.hero === hid) return;
  for (const m of onion.models) stage.scene.remove(m);
  onion.hero = hid;
  onion.models = [ghostModel(hid, '#5aa8ff', 0.28), ghostModel(hid, '#5aa8ff', 0.18), ghostModel(hid, '#ff6a6a', 0.22)];
}
const arcLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffd84a' }));
arcLine.frustumCulled = false;
stage.scene.add(arcLine);
const arcDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false }));
arcDots.frustumCulled = false;
stage.scene.add(arcDots);

function updateOnionArcs() {
  const lane = lab.lanes[lab.lanes.length - 1];
  const showOn = state.mode === 'lab' && state.onion && lane;
  ensureOnion();
  const phases = phasesFor(state.action, C), total = totalDuration(phases), amp = ampFor(state.action, C);
  const t = lab.time;
  onion.models.forEach((m, i) => {
    m.visible = !!showOn;
    if (!showOn) return;
    const dt = i < 2 ? -(i + 1) * 0.06 : 0.06;
    const tt = Math.max(0, Math.min(total, t + dt));
    m.position.copy(lane.actor.model.position);
    m.rotation.copy(lane.actor.model.rotation);
    applyPose(m, actionPose(phases, tt, amp, POSES.idle));
  });
  const showArc = state.mode === 'lab' && state.arcs && lane && lane.actor.alive;
  arcLine.visible = arcDots.visible = !!showArc;
  if (!showArc) return;
  // Sample the right foot over the whole action on a hidden ghost
  const m = onion.models[0];
  const wasVisible = m.visible;
  m.position.copy(lane.actor.model.position);
  m.rotation.copy(lane.actor.model.rotation);
  const pts = [];
  for (let i = 0; i <= 36; i++) {
    applyPose(m, actionPose(phases, (i / 36) * total, amp, POSES.idle));
    m.updateWorldMatrix(true, true);
    pts.push(footWorld(m).clone());
  }
  m.visible = wasVisible;
  if (wasVisible) applyPose(m, actionPose(phases, Math.max(0, t - 0.06), amp, POSES.idle));
  arcLine.geometry.setFromPoints(pts);
  arcDots.geometry.setFromPoints(pts.filter((_, i) => i % 3 === 0));
}

// ── Overlay: lane tags & phase caption ────────────────────────────────────
const caption = el('div', 'ed-caption');
const hint = el('div', 'ed-hint');
overlay.append(caption, hint);
const laneTags = [];
function updateOverlay() {
  laneTags.forEach((t) => t.remove());
  laneTags.length = 0;
  if (state.mode === 'lab') {
    for (const l of lab.lanes) {
      const tag = el('div', 'ed-lane-tag' + (l.label === 'LOCKED' ? ' locked' : ''), l.label);
      const p = stage.toScreen(new THREE.Vector3(l.actor.x, 2.9, l.actor.z));
      tag.style.left = `${p.x}px`; tag.style.top = `${p.y}px`;
      overlay.append(tag);
      laneTags.push(tag);
    }
    const phases = phasesFor(state.action, C);
    const { phase } = phaseAt(phases, Math.min(lab.time, totalDuration(phases) - 1e-6));
    caption.style.display = state.beats ? '' : 'none';
    caption.innerHTML = `<span class="gb-tag ${phase.type}">${phase.name}</span><span class="gb-caption">${phase.note || ''}</span>`;
    const overlap = state.compare === 'both' && (state.camView === 'side' || state.camView === 'front');
    hint.textContent = overlap ? 'Both lanes overlap in Side/Front — use Game, Top or Orbit to compare' : `${actionLabel(state.action)} · drag phase edges · click a phase to edit`;
  } else {
    caption.style.display = 'none';
    hint.textContent = state.spectate ? 'Spectating bots · values update live' : 'WASD move · J pass/dash · K skill · L item · values update live';
  }
}

// ── Modes ─────────────────────────────────────────────────────────────────
function afterRebuild() { onion.hero = null; }

function startMatch() {
  match?.dispose();
  hud?.dispose();
  buildWorld(true);
  match = new Match({ stage, vfx, arena, C, humanHero: state.spectate ? null : state.matchHero, modeId: state.matchMode, playersBonus: world.playersBonus });
  match.start();
  hud = new Hud(frame, C);
  hud.setControlMode(state.frame === 'desk' ? 'auto' : 'touch');
  hud.attach(match, stage);
  if (!input) input = new Input(stage, hud.touch);
  input.touch = hud.touch;
}

function enterMode() {
  labControls.style.display = state.mode === 'lab' ? '' : 'none';
  matchControls.style.display = state.mode === 'match' ? '' : 'none';
  tl.style.display = state.mode === 'lab' ? '' : 'none';
  compareSeg.style.display = state.mode === 'lab' ? '' : 'none';
  if (state.mode === 'lab') {
    match?.dispose(); match = null;
    hud?.dispose(); hud = null;
    buildWorld();
    lab.compare = state.compare;
    lab.set(state.action, state.hero);
    stage.target.set(0, 0, -1);
    stage.zoomMul = 0.55;
  } else {
    lab.dispose();
    stage.zoomMul = 1;
    startMatch();
  }
  renderParams();
  afterRebuild();
}

// ── Live config reactions ─────────────────────────────────────────────────
cfg.onChange((key) => {
  syncParams(key);
  renderDiff();
  if (!key || key.startsWith('arena.')) buildWorld();
  if (!key || key === 'art.heroStyle' || /^hero\.[a-z]+\.(jersey|hair)$/.test(key)) {
    invalidatePortraits();
    if (state.mode === 'lab') { lab.rebuild(); afterRebuild(); }
    else match?.refreshArt();
  }
  if (key === 'render.pixelScale') pixelSeg.refresh();
  if (key === 'render.animFps') fpsSeg.refresh();
});

// ── Loop ──────────────────────────────────────────────────────────────────
let last = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.mode === 'lab') {
    lab.update(dt);
    drawTimeline();
    stage.target.lerp(new THREE.Vector3(0, 0, -1), 0.1);
  } else if (match) {
    match.input = match.human ? input.poll(match.human) : null;
    match.update(dt);
    hud?.update();
  }
  updateOnionArcs();
  stage.update(dt);
  stage.render();
  updateOverlay();
  requestAnimationFrame(frameLoop);
}

window.__ed = { cfg, lab, state, stage, get match() { return match; } };
buildWorld(true);
enterMode();
renderDiff();
requestAnimationFrame(frameLoop);
