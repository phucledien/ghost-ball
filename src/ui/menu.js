// Front-end: title, Mode → Striker → Arena select, how to play, settings,
// pause and results. Pure DOM over the live 3D scene; game.js owns the
// world and the match and reacts to the callbacks.
import { HEROES, HERO_BY_ID, phasesFor } from '../game/heroes.js';
import { MODES } from '../game/modes.js';
import { MAPS, MAP_IDS, ZONES } from '../game/maps.js';
import { ITEMS, ITEM_IDS } from '../game/items.js';
import { THEMES } from '../engine/themes.js';
import { POSES, actionPose, locomotionPose, totalDuration } from '../engine/anim.js';
import { SETTINGS } from '../core/settings.js';
import { renderHero, portraitURL } from './portrait.js';
import { drawSchematic } from './schematic.js';
import { iconURL, itemIconURL, SKILL_ICON } from './icons.js';

// Cosmetics are optional so the menu still works without the catalog.
const COS = Object.values(import.meta.glob('../game/cosmetics.js', { eager: true }))[0] || {};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODE_HINTS={classic:'Pass it on before the buzzer.',fuse:'Every second in possession burns.',twin:'Two balls. Two players at risk.',shrink:'Less room after every round.',sudden:'No countdown. Stay alert.'};
const MAP_HINTS={temple:'Cover • lobs • hidden routes',egolab:'Boost lanes • sharp turns',frost:'Sliding • snow • pine cover',pitch:'Open space • pure footwork'};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seg5 = (n) => `<div class="seg5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

export class Menu {
  // deps: { C, prefs, picks, isTouch(), onPreview(picks), onStart(picks), onQuit(), onResume(), onRestart() }
  constructor(app, deps) {
    this.d = deps;
    this.C = deps.C;
    this.picks = deps.picks;
    this.el = document.createElement('div');
    this.el.className = 'fe';
    app.appendChild(this.el);
    this.stack = [];
    this.screen = null;
    this.raf = 0;
    this.portraits = new Map();
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey);
  }

  get open() { return !!this.screen; }

  portrait(id, size = 64) {
    const loadout=this.loadoutFor(id);
    const k = `${id}|${size}|${JSON.stringify(loadout)}`;
    if (!this.portraits.has(k)) this.portraits.set(k, portraitURL(id, this.C, size, loadout));
    return this.portraits.get(k);
  }
  clearPortraits() { this.portraits.clear(); }

  // ── Screen management ──────────────────────────────────────────────
  show(name, opts = {}) {
    if (opts.push !== false && this.screen && this.screen !== name) this.stack.push(this.screen);
    if (opts.reset) this.stack = [];
    this.screen = name;
    cancelAnimationFrame(this.raf);
    this.el.innerHTML = '';
    const node = this[`render_${name}`](opts);
    this.el.appendChild(node);
    this.node = node;
    // keyboard users land on the selected tile / primary button
    const first = node.querySelector('.tile.on, [data-autofocus]');
    if (first && !this.d.isTouch()) first.focus({ preventScroll: true });
  }

  back() {
    const prev = this.stack.pop();
    if (prev) this.show(prev, { push: false });
    else if (this.screen === 'pause') this.resume();
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.screen = null;
    this.stack = [];
    this.el.innerHTML = '';
  }

  resume() { this.hide(); this.d.onResume(); }

  key(e) {
    if (!this.screen) return;
    if (e.target.closest?.('input, textarea, select')) return;
    const k = e.key;
    if (k === 'Escape' || k === 'Backspace') {
      e.preventDefault();
      if (this.screen === 'title') return;
      if (this.screen === 'results') return;
      this.back();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
      e.preventDefault();
      this.spatial(k);
    }
    if (this.screen === 'title' && k === 'Enter' && document.activeElement === document.body) {
      this.node.querySelector('[data-autofocus]')?.click();
    }
  }

  // Arrow keys move focus to the nearest control in that direction.
  spatial(dir) {
    const all = [...this.node.querySelectorAll('button:not([disabled]), a[href]')].filter((b) => b.offsetParent);
    if (!all.length) return;
    const cur = document.activeElement;
    if (!all.includes(cur)) { (this.node.querySelector('.tile.on') || all[0]).focus(); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const b of all) {
      if (b === cur) continue;
      const r = b.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const along = dir === 'ArrowRight' ? dx : dir === 'ArrowLeft' ? -dx : dir === 'ArrowDown' ? dy : -dy;
      const across = dir === 'ArrowRight' || dir === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const s = along + across * 2.5;
      if (s < bs) { bs = s; best = b; }
    }
    best?.focus();
  }

  frag(cls, html) {
    const n = document.createElement('div');
    n.className = `fe-screen ${cls}`;
    n.innerHTML = html;
    return n;
  }

  // ── Title ──────────────────────────────────────────────────────────
  render_title() {
    const p = this.picks;
    const lines = Array.from({ length: 9 }, (_, i) => `<i style="top:${8 + i * 10.5}%;width:${60 + ((i * 53) % 160)}px;animation-duration:${(1.6 + ((i * 7) % 5) * 0.35).toFixed(2)}s;animation-delay:-${(i * 0.37).toFixed(2)}s"></i>`).join('');
    const dust = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${55 + ((i * 23) % 40)}%;animation-duration:${(2.2 + (i % 5) * 0.4).toFixed(1)}s;animation-delay:-${(i * 0.41).toFixed(2)}s;${i % 3 ? '' : 'background:var(--ink)'}"></i>`).join('');
    const word = (w) => [...w].map((c, i) => `<b style="animation-delay:${(i * 0.08).toFixed(2)}s" class="${c === '·' ? 'dot' : ''}">${c}</b>`).join('');
    const quick = `${MODES[p.mode]?.name || 'Ghost Ball'} · ${HERO_BY_ID[p.hero]?.name || 'NOVA'} · ${MAPS[p.map]?.name || ''}`;
    const n = this.frag('ttl', `
      <div class="ttl-lines">${lines}</div><div class="ttl-dust">${dust}</div>
      <div class="ttl-logo">
        <div class="ttl-kicker">FOOTBALL SURVIVAL</div>
        <h1>${word('GHOST·BALL')}</h1>
        <div class="ttl-tag">Pass it on. Whoever's holding the ball at the buzzer is out.</div>
      </div>
      <nav class="ttl-menu">
        <button class="mi primary" data-go="play" data-autofocus><b>PLAY</b><small>Pick a mode, a striker and an arena</small></button>
        <button class="mi" data-go="quick"><b>QUICK MATCH</b><small>${esc(quick)}</small></button>
        <button class="mi" data-go="howto"><b>HOW TO PLAY</b><small>Rules, controls, skills and items</small></button>
        <button class="mi" data-go="settings"><b>SETTINGS</b><small>Controls, graphics, difficulty</small></button>
      </nav>
      <footer class="ttl-foot"><span class="ttl-press">${this.d.isTouch() ? 'TAP PLAY' : 'PRESS ENTER'}</span><span class="sp"></span><span>v0.2 · web prototype</span><a href="./editor.html">EDITOR</a><a href="./sheet.html">DESIGN SHEET</a></footer>`);
    n.querySelector('[data-go=play]').onclick = () => this.show('mode');
    n.querySelector('[data-go=quick]').onclick = () => this.d.onStart(this.picks);
    n.querySelector('[data-go=howto]').onclick = () => this.show('howto');
    n.querySelector('[data-go=settings]').onclick = () => this.show('settings');
    return n;
  }

  // ── Select shell ───────────────────────────────────────────────────
  selShell(step, cls, body, nextLabel) {
    const names = ['MODE', 'STRIKER', 'ARENA'];
    const n = this.frag(`sel ${cls} fe-dim`, `
      <header class="sel-top">
        <button class="sel-back">◀ BACK</button>
        <ol class="steps">${names.map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol>
        <div class="sel-title">${['CHOOSE MODE', 'CHOOSE STRIKER', 'CHOOSE ARENA'][step]}</div>
      </header>
      <main class="sel-body">${body}</main>
      <footer class="sel-bot">
        <div class="keys"><span><span class="gb-kbd">←↑→↓</span> choose</span><span><span class="gb-kbd">ENTER</span> confirm</span><span><span class="gb-kbd">ESC</span> back</span></div>
        <button class="sel-next">${nextLabel}</button>
      </footer>`);
    n.querySelector('.sel-back').onclick = () => this.back();
    return n;
  }

  // tiles: click/focus selects; confirming the selected tile moves on
  bindTiles(n, attr, onPick, onConfirm) {
    for (const t of n.querySelectorAll(`[${attr}]`)) {
      const id = t.getAttribute(attr);
      t.addEventListener('focus', () => onPick(id));
      t.addEventListener('click', () => {
        if (t.classList.contains('on') && t.dataset.armed) onConfirm();
        else {
          for (const o of n.querySelectorAll(`[${attr}]`)) delete o.dataset.armed;
          onPick(id);
          t.dataset.armed = '1';
        }
      });
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onConfirm(); } });
    }
  }

  // ── 1 · Mode ───────────────────────────────────────────────────────
  render_mode() {
    const body = `
      <div class="mode-list">${Object.entries(MODES).map(([id, m]) => `
        <button class="tile mode-tile" data-mode="${id}"><img src="${iconURL(m.icon || 'ball', '#e8a93a', 3)}" alt=""><div><div class="tg">${m.tag}</div><div class="nm">${esc(m.name)}</div><small>${MODE_HINTS[id]}</small></div></button>`).join('')}
      </div>
      <section class="panel mode-info"></section>`;
    const n = this.selShell(0, 'sel-mode', body, 'CHOOSE STRIKER ▶');
    const info = n.querySelector('.mode-info');
    const pick = (id) => {
      this.picks.mode = id;
      for (const t of n.querySelectorAll('[data-mode]')) t.classList.toggle('on', t.dataset.mode === id);
      const m = MODES[id];
      const C = this.C;
      const timer = m.timer === 'fuse' ? `${C('rules.fuseTime')}s fuse` : m.timer === 'hidden' ? '?? hidden' : `${C('rules.roundTime')}s`;
      const players = Math.round(C('rules.players') + (m.playersBonus || 0));
      info.innerHTML = `
        <div class="mode-visual" data-variant="${id}" aria-hidden="true"><div class="mini-pitch"><i class="halfway"></i><i class="centre"></i><span class="demo-player p1">01</span><span class="demo-player p2">02</span><span class="demo-player p3">03</span><span class="demo-player p4">04</span><span class="demo-ball"><img src="${iconURL('ball','#ffffff',2)}" alt=""></span>${m.balls===2?`<span class="demo-ball second"><img src="${iconURL('ball','#ffffff',2)}" alt=""></span>`:''}<i class="pass-route"></i></div><div class="mode-caption"><span>${id==='classic'?'START HERE':m.tag}</span><b>${MODE_HINTS[id]}</b></div><div class="mode-clock">${m.timer==='hidden'?'??':m.timer==='fuse'?'FUSE':'00:03'}</div></div>
        <div class="big"><img src="${iconURL(m.icon || 'ball', '#e8a93a', 6)}" alt=""><div><div class="tg">${m.tag}</div><h2>${esc(m.name)}</h2></div></div>
        <p>${esc(m.desc)}</p>
        <div class="stat-row">
          <div><small>BALLS</small><b>${m.balls}</b></div>
          <div><small>CLOCK</small><b>${timer}</b></div>
          <div><small>STRIKERS</small><b>${players}+</b></div>
          <div><small>PITCH</small><b>${m.shrink ? 'SHRINKS' : m.sizeMul ? `×${m.sizeMul}` : 'FULL'}</b></div>
        </div>
        <h3 class="section-label">HOW YOU SURVIVE</h3><ul class="rules">${(m.rules || []).map((r, i) => `<li><b>${i + 1}</b><span>${esc(r)}</span></li>`).join('')}</ul>`;
      this.d.onPreview(this.picks);
    };
    const next = () => this.show('hero');
    this.bindTiles(n, 'data-mode', pick, next);
    n.querySelector('.sel-next').onclick = next;
    pick(this.picks.mode in MODES ? this.picks.mode : 'classic');
    return n;
  }

  // ── 2 · Striker ────────────────────────────────────────────────────
  heroStats(h) {
    const C = this.C;
    const spd = C(`hero.${h.id}.speed`) * (h.id === 'bolt' ? C('hero.bolt.passive.speed') : 1);
    const avgCd = (C(`hero.${h.id}.atk.cd`) + C(`hero.${h.id}.def.cd`)) / 2;
    const r = h.rating || {};
    return [
      ['SPEED', clamp(Math.round((spd - 0.8) / 0.08 + 1e-6), 1, 5)],
      ['POWER', r.power ?? 3],
      ['CONTROL', r.control ?? 3],
      ['ESCAPE', r.escape ?? 3],
      ['RECHARGE', clamp(Math.round((17 - avgCd) / 2), 1, 5)],
    ];
  }

  loadoutFor(id) {
    const all = this.picks.loadouts || (this.picks.loadouts = {});
    return all[id] || null;
  }

  render_hero() {
    const body = `
      <div class="roster">${HEROES.map((h) => `
        <button class="tile hero-tile" data-hero="${h.id}" style="--hc:${this.C(`hero.${h.id}.fx`)}"><span class="bar" style="background:${this.C(`hero.${h.id}.fx`)}"></span><img src="${this.portrait(h.id, 64)}" alt=""><span class="nm">${h.name}</span><span class="rl">${h.role}</span></button>`).join('')}
      </div>
      <div class="hero-stage"><div class="bigname"></div><div class="plat"></div><canvas width="128" height="160"></canvas></div>
      <section class="panel hero-info"></section>`;
    const n = this.selShell(1, 'sel-hero', body, 'NEXT ▶');
    const info = n.querySelector('.hero-info');
    const stageEl = n.querySelector('.hero-stage');
    const cv = stageEl.querySelector('canvas');
    let locker = false;
    let cur = null;
    const draw = (id) => {
      const h = HERO_BY_ID[id];
      const C = this.C;
      const fx = C(`hero.${id}.fx`);
      n.style.setProperty('--hc', fx);
      stageEl.querySelector('.bigname').textContent = h.name;
      const sk = (slot, label, cls) => {
        const s = h[slot];
        const icon = slot === 'passive' ? iconURL('crown', fx, 3) : iconURL(SKILL_ICON[`${id}.${slot}`], fx, 3);
        const cd = slot === 'passive' ? '' : `<span class="cd">${C(`hero.${id}.${slot}.cd`)}s</span>`;
        return `<div class="skill ${cls}"><img src="${icon}" alt=""><div>${cd}<div class="k">${label}</div><div class="n">${esc(s.name)}</div><div class="d">${esc(s.desc)}</div></div></div>`;
      };
      const diff = h.rating?.difficulty ?? 2;
      info.innerHTML = `
        <div class="hd"><h2 style="color:${fx}">${h.name}</h2><span class="ti">${esc(h.title)}</span></div>
        <div class="chips"><span class="chip gold">${esc(h.role)}</span><span class="chip">Difficulty <span class="stars">${'★'.repeat(diff)}${'☆'.repeat(3 - diff)}</span></span></div>
        <p class="blurb">${esc(h.blurb)}</p>
        <div class="bars">${this.heroStats(h).map(([k, v]) => `<span>${k}</span>${seg5(v)}`).join('')}</div>
        ${locker ? this.lockerHTML(id) : `<div class="skills">${sk('passive', 'PASSIVE', 'pas')}${sk('atk', 'ATTACK · WITH BALL', 'atk')}${sk('def', 'DEFENSE · WITHOUT BALL', 'def')}</div>`}
        ${COS.COSMETIC_SLOTS ? `<button class="locker-btn ${locker ? 'on' : ''}">${locker ? '◀ SKILLS' : 'CUSTOMISE LOOK ▶'}</button>` : ''}`;
      info.querySelector('.locker-btn')?.addEventListener('click', () => { locker = !locker; draw(id); info.querySelector('.locker-btn')?.focus(); });
      if (locker) this.bindLocker(info, id, () => draw(id));
    };
    const pick = (id) => {
      if (cur === id) return;
      cur = id;
      this.picks.hero = id;
      for (const t of n.querySelectorAll('[data-hero]')) t.classList.toggle('on', t.dataset.hero === id);
      draw(id);
      t0 = performance.now();
    };
    const next = () => this.show('map');
    this.bindTiles(n, 'data-hero', pick, next);
    n.querySelector('.sel-next').onclick = next;

    // Turntable preview: idle breathing, then the hero's attack skill in slow motion.
    let t0 = performance.now(), lastDraw = 0;
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      if (now - lastDraw < 1000 / 24) return;
      lastDraw = now;
      const id = cur;
      if (!id) return;
      const t = (now - t0) / 1000;
      const phases = phasesFor(`${id}.atk`, this.C);
      const dur = totalDuration(phases) * 2.2;
      const cyc = 2.4 + dur;
      const u = t % cyc;
      let pose;
      if (u > 2.4) pose = actionPose(phases, (u - 2.4) / 2.2, 1, POSES.idle);
      else pose = locomotionPose(0, t * 3, 1, 1, {});
      const yaw = 0.55 + Math.sin(t * 0.6) * 0.5;
      renderHero(id, this.C, { w: cv.width, h: cv.height, mode: 'stage', yaw, pitch: 0.16, pose, loadout: this.loadoutFor(id), out: cv });
    };
    this.raf = requestAnimationFrame(loop);
    pick(this.picks.hero in HERO_BY_ID ? this.picks.hero : 'nova');
    return n;
  }

  lockerHTML(id) {
    const lo = COS.resolveLoadout ? COS.resolveLoadout(id, this.loadoutFor(id) || {}) : {};
    return `<div class="locker">${COS.COSMETIC_SLOTS.map((s) => {
      const opt = s.options.find((o) => o.id === lo[s.id]) || s.options[0];
      return `<div class="slot" data-slot="${s.id}"><span>${esc(s.label || s.name || s.id).toUpperCase()}</span><button data-d="-1" aria-label="Previous">◀</button><b>${esc(opt?.name || '—')}</b><button data-d="1" aria-label="Next">▶</button></div>`;
    }).join('')}<button class="reset">Reset to ${HERO_BY_ID[id].name}'s default look</button></div>`;
  }

  bindLocker(info, id, redraw) {
    const refresh=()=>{this.clearPortraits();const img=this.node?.querySelector(`[data-hero="${id}"] img`);if(img)img.src=this.portrait(id,64);redraw();};
    for (const row of info.querySelectorAll('.slot')) {
      const slot = COS.COSMETIC_SLOTS.find((s) => s.id === row.dataset.slot);
      for (const b of row.querySelectorAll('button')) {
        b.onclick = () => {
          const lo = COS.resolveLoadout(id, this.loadoutFor(id) || {});
          const i = slot.options.findIndex((o) => o.id === lo[slot.id]);
          const ni = (i + +b.dataset.d + slot.options.length) % slot.options.length;
          const all = this.picks.loadouts || (this.picks.loadouts = {});
          all[id] = { ...(all[id] || {}), [slot.id]: slot.options[ni].id };
          this.d.onLoadout?.(id);
          const focusD = b.dataset.d;
          refresh();
          info.querySelector(`.slot[data-slot="${slot.id}"] button[data-d="${focusD}"]`)?.focus();
        };
      }
    }
    info.querySelector('.reset').onclick = () => {
      if (this.picks.loadouts) delete this.picks.loadouts[id];
      this.d.onLoadout?.(id);
      refresh();
    };
  }

  // ── 3 · Arena ──────────────────────────────────────────────────────
  drawSchematic(cv, mapId, px = 4) {
    const mode = MODES[this.picks.mode] || MODES.classic;
    return drawSchematic(cv, mapId, this.C, mode.sizeMul || 1, px);
  }

  render_map() {
    const body = `
      <div class="map-list">${MAP_IDS.map((id) => `
        <button class="tile map-tile" data-map="${id}"><img class="map-thumb" src="${import.meta.env.BASE_URL}assets/maps/${id}.png" alt=""><div><div class="nm">${esc(MAPS[id].name)}</div><div class="sz">${MAP_HINTS[id]}</div></div></button>`).join('')}
      </div>
      <section class="panel map-info"></section>`;
    const n = this.selShell(2, 'sel-map', body, 'START ▶');

    const info = n.querySelector('.map-info');
    const pick = (id) => {
      this.picks.map = id;
      for (const t of n.querySelectorAll('[data-map]')) t.classList.toggle('on', t.dataset.map === id);
      const MD = MAPS[id];
      info.innerHTML = `<div class="col arena-image"><img class="arena-beauty" src="${import.meta.env.BASE_URL}assets/maps/${id}.png" alt="Isometric view of ${esc(MD.name)}"><div class="chips"><span class="chip gold">${MD.size}</span><span class="chip" data-dims></span><span class="chip">${MD.obstacles.length} obstacles</span></div><details class="tactical"><summary>TACTICAL LAYOUT <span>View terrain & cover +</span></summary><canvas class="schem"></canvas><p>Top-down layout at the selected mode's scale.</p></details></div><div class="col arena-brief"><span class="section-label">${MAP_HINTS[id]}</span><h2>${esc(MD.name)}</h2><p>${esc(MD.desc)}</p><h3 class="section-label">PLAY THE TERRAIN</h3><div class="feats"></div><div class="map-ready"><span>${esc(MODES[this.picks.mode].name)} · ${HERO_BY_ID[this.picks.hero].name}</span><b>Ready for kick-off</b></div></div>`;
      const M = this.drawSchematic(info.querySelector('.schem'), id, 6);
      info.querySelector('[data-dims]').textContent = `${M.W} × ${M.D} m`;
      const T = THEMES[M.theme] || THEMES.temple;
      const feats = [];
      const kinds = [...new Set(M.zones.map((z) => z.kind))];
      for (const k of kinds) feats.push([ (T.zone[k] || ['#888'])[k === 'boost' ? 1 : 0], ZONES[k].name, ZONES[k].desc ]);
      const tall = M.obstacles.filter((o) => o.h >= 1).length, low = M.obstacles.filter((o) => o.h < 1).length;
      if (tall) feats.push(['#1a1f30', 'Cover', `${tall} solid obstacles. Passes and runners can't go through them.`]);
      if (low) feats.push([T.obs.stoneDark, 'Low walls', `${low} knee-high walls. They block flat passes; a charged lob flies over.`]);
      if (!feats.length) feats.push([T.ground, 'Open ground', 'Nothing to hide behind. Pure footwork and timing.']);
      info.querySelector('.feats').innerHTML = feats.map(([c, t, d]) => `<div class="feat"><i style="background:${c}"></i><div><b>${esc(t).toUpperCase()}</b><span>${esc(d)}</span></div></div>`).join('');
      this.d.onPreview(this.picks);
    };
    const go = () => this.d.onStart(this.picks);
    this.bindTiles(n, 'data-map', pick, go);
    n.querySelector('.sel-next').onclick = go;
    pick(this.picks.map in MAPS ? this.picks.map : 'temple');
    return n;
  }

  // ── How to play ────────────────────────────────────────────────────
  render_howto() {
    const tabs = [['rules', 'THE RULE'], ['controls', 'CONTROLS'], ['skills', 'SKILLS & ITEMS'], ['arenas', 'ARENAS']];
    let tab = 'rules';
    const n = this.frag('modal', `<div class="box"><div class="hdr"><h2>HOW TO PLAY</h2><button class="x" aria-label="Close">✕</button></div><div class="bd"><div class="howto-tabs">${tabs.map(([id, l]) => `<button data-tab="${id}">${l}</button>`).join('')}</div><div class="howto-page" style="margin-top:14px"></div></div><div class="ft"><span class="sp"></span><button class="btn primary" data-autofocus>GOT IT</button></div></div>`);
    const page = n.querySelector('.howto-page');
    const touch = this.d.isTouch();
    const render = () => {
      for (const b of n.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
      if (tab === 'rules') page.innerHTML = `
        <h3>HOT POTATO, EGO STRIKER STYLE</h3>
        <p>One ball, a round clock, everyone for themselves. The ball sticks to whoever it touches. Get rid of it before the buzzer.</p>
        <div class="howto-steps">
          <div><b>1</b><img src="${iconURL('ball', '#e8a93a', 3)}" alt=""><span>Got the ball? Pass it into someone. You can't pass straight back to whoever gave it to you.</span></div>
          <div><b>2</b><img src="${iconURL('dash', '#5cc46a', 3)}" alt=""><span>No ball? Run. Dash and use your defense skill to dodge incoming passes.</span></div>
          <div><b>3</b><img src="${iconURL('skull', '#dc4343', 3)}" alt=""><span>Buzzer: whoever holds the ball is out. If it's loose or mid-air, whoever kicked it last is out.</span></div>
        </div>
        <p>Rounds repeat until one striker is left: the egoist.</p>`;
      if (tab === 'controls') page.innerHTML = `
        <h3>${touch ? 'TOUCH' : 'KEYBOARD & MOUSE'}</h3>
        ${touch ? `<div class="pad-demo"><div class="lbl"><span>LEFT THUMB · MOVE</span><span>RIGHT THUMB · ACT</span></div><div class="j"></div><div class="ab"><span class="c">C</span><span class="b">B</span><span class="a">A</span></div></div>
        <div class="ctl-grid"><span class="k"><span class="gb-kbd">A</span></span><span>Pass when you have the ball (hold to charge, drag to aim). Dash when you don't.</span><span class="k"><span class="gb-kbd">B</span></span><span>Skill: attack skill with the ball, defense skill without.</span><span class="k"><span class="gb-kbd">C</span></span><span>Use your item.</span><span class="k"><span class="gb-kbd">II</span></span><span>Pause (top of the screen).</span></div>`
        : `<div class="ctl-grid">
          <span class="k"><span class="gb-kbd">W</span><span class="gb-kbd">A</span><span class="gb-kbd">S</span><span class="gb-kbd">D</span></span><span>Move (arrow keys work too)</span>
          <span class="k"><span class="gb-kbd">MOUSE</span></span><span>Aim your pass at the cursor</span>
          <span class="k"><span class="gb-kbd">J</span><span class="gb-kbd">SPACE</span><span class="gb-kbd">CLICK</span></span><span>Pass with the ball (hold to charge) · dash without it</span>
          <span class="k"><span class="gb-kbd">K</span><span class="gb-kbd">Q</span><span class="gb-kbd">R-CLICK</span></span><span>Skill: attack with the ball, defense without</span>
          <span class="k"><span class="gb-kbd">L</span><span class="gb-kbd">E</span></span><span>Use item</span>
          <span class="k"><span class="gb-kbd">ESC</span></span><span>Pause</span></div>`}
        <p style="color:var(--ink-dim);font-size:13px">Controls switch automatically with the device you use. Force one in Settings.</p>`;
      if (tab === 'skills') page.innerHTML = `
        <h3>TWO SKILLS, ONE BUTTON</h3>
        <p>Every striker has a passive, an <b style="color:#ff9a9a">attack skill</b> that works while you hold the ball and a <b style="color:var(--green)">defense skill</b> for when you don't. The skill button swaps automatically.</p>
        <h3>ITEMS</h3>
        <p>Crates drop onto the pitch. Run over one to carry it (one slot), use it with the item key.</p>
        <div class="item-grid">${ITEM_IDS.map((id) => `<div><img src="${itemIconURL(id, 3)}" alt=""><div><b>${esc(ITEMS[id].name).toUpperCase()}</b><span>${esc(ITEMS[id].desc)}</span></div></div>`).join('')}</div>`;
      if (tab === 'arenas') page.innerHTML = `
        <h3>COVER AND TERRAIN</h3>
        <p>The big arenas have obstacles that block runners and passes. Knee-high walls stop flat passes, but a charged pass is lobbed over them. The ground changes how you move:</p>
        <div class="item-grid">${Object.entries(ZONES).map(([k, z]) => `<div><i style="width:30px;height:30px;display:block;background:${(THEMES.temple.zone[k] || THEMES.egolab.zone[k])[k === 'boost' ? 1 : 0]};border:2px solid var(--panel);box-shadow:0 0 0 1px var(--line)"></i><div><b>${esc(z.name).toUpperCase()}</b><span>${esc(z.desc)}</span></div></div>`).join('')}</div>
        <p>When the ball is off screen, an arrow on the edge points at it. It turns red when someone's holding it.</p>`;
    };
    for (const b of n.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; render(); };
    n.querySelector('.x').onclick = () => this.back();
    n.querySelector('.btn.primary').onclick = () => this.back();
    render();
    return n;
  }

  // ── Settings ───────────────────────────────────────────────────────
  render_settings() {
    const prefs = this.d.prefs;
    const groups = [...new Set(SETTINGS.map((s) => s.group))];
    const n = this.frag('modal', `<div class="box"><div class="hdr"><h2>SETTINGS</h2><button class="x" aria-label="Close">✕</button></div><div class="bd">${groups.map((g) => `
      <div class="set-group"><h3>${g.toUpperCase()}</h3>${SETTINGS.filter((s) => s.group === g).map((s) => `
        <div class="set-row" data-set="${s.id}"><div class="lb">${esc(s.label)}${s.hint ? `<small>${esc(s.hint)}</small>` : ''}</div><div class="opts">${s.options.map(([v, l]) => `<button data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
      </div><div class="ft"><button class="btn" data-reset>RESET ALL</button><span class="sp"></span><button class="btn primary" data-autofocus>DONE</button></div></div>`);
    const sync = () => {
      for (const row of n.querySelectorAll('[data-set]')) {
        const v = prefs.get(row.dataset.set);
        for (const b of row.querySelectorAll('[data-v]')) b.classList.toggle('on', b.dataset.v === v);
      }
    };
    for (const row of n.querySelectorAll('[data-set]')) for (const b of row.querySelectorAll('[data-v]')) b.onclick = () => { prefs.set(row.dataset.set, b.dataset.v); sync(); };
    n.querySelector('[data-reset]').onclick = () => { prefs.reset(); sync(); };
    n.querySelector('.x').onclick = () => this.back();
    n.querySelector('.btn.primary').onclick = () => this.back();
    sync();
    return n;
  }

  // ── Pause ──────────────────────────────────────────────────────────
  render_pause() {
    const n = this.frag('modal', `<div class="box sm"><div class="hdr"><h2>PAUSED</h2></div><div class="bd"><div class="pause-list">
      <button class="btn primary wide" data-a="resume" data-autofocus>RESUME</button>
      <button class="btn wide" data-a="restart">RESTART MATCH</button>
      <button class="btn wide" data-a="howto">HOW TO PLAY</button>
      <button class="btn wide" data-a="settings">SETTINGS</button>
      <button class="btn wide" data-a="quit">QUIT TO TITLE</button></div></div></div>`);
    n.querySelector('[data-a=resume]').onclick = () => this.resume();
    n.querySelector('[data-a=restart]').onclick = () => { this.hide(); this.d.onRestart(); };
    n.querySelector('[data-a=howto]').onclick = () => this.show('howto');
    n.querySelector('[data-a=settings]').onclick = () => this.show('settings');
    n.querySelector('[data-a=quit]').onclick = () => { this.hide(); this.d.onQuit(); };
    return n;
  }

  // ── Results ────────────────────────────────────────────────────────
  render_results({ won, place, total, round, stats, hero, final }) {
    const n = this.frag('modal', `<div class="box sm" style="width:min(520px,100%)"><div class="bd">
      <div class="res-head"><div class="t ${won ? 'gold' : 'red'}">${won ? 'EGOIST CROWNED' : 'ELIMINATED'}</div><div class="s">${won ? 'Last striker standing' : `Out in round ${round}`}</div></div>
      <div class="res-place"><img src="${this.portrait(hero, 72)}" alt=""><div class="n">#${place}<small> / ${total}</small></div></div>
      <div class="res-stats"><div><b>${stats.passes}</b><small>PASSES</small></div><div><b>${stats.catches}</b><small>TIMES IT</small></div><div><b>${stats.skills}</b><small>SKILLS</small></div><div><b>${Math.round(stats.time)}s</b><small>SURVIVED</small></div></div>
      </div><div class="ft">${!final ? '<button class="btn" data-a="watch">WATCH</button>' : ''}<span class="sp"></span><button class="btn" data-a="menu">TITLE</button><button class="btn" data-a="change">CHANGE STRIKER</button><button class="btn primary" data-a="again" data-autofocus>PLAY AGAIN</button></div></div>`);
    n.querySelector('[data-a=again]').onclick = () => { this.hide(); this.d.onStart(this.picks); };
    n.querySelector('[data-a=change]').onclick = () => { this.hide(); this.d.onQuit('hero'); };
    n.querySelector('[data-a=menu]').onclick = () => { this.hide(); this.d.onQuit(); };
    n.querySelector('[data-a=watch]')?.addEventListener('click', () => this.hide());
    return n;
  }

  // ── VS splash ──────────────────────────────────────────────────────
  render_vs({ hero, map, mode }) {
    return this.frag('vs', `<div class="row"><img src="${this.portrait(hero, 120)}" alt=""><div><div class="s">${esc(MODES[mode].name).toUpperCase()} · ${esc(MAPS[map].name).toUpperCase()}</div><div class="t">${HERO_BY_ID[hero].name}</div><div class="s" style="color:var(--ink)">${esc(HERO_BY_ID[hero].title)}</div></div></div>`);
  }
}
