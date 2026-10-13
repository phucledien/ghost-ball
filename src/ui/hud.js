// In-match HUD (DOM). Timer, player card, roster strip, kill feed, banners,
// name tags, pop text, touch joystick + action buttons with cooldown sweeps.
import { HERO_BY_ID } from '../game/heroes.js';
import { ITEMS } from '../game/items.js';
import { MODES } from '../game/modes.js';
import { portraitURL } from './portrait.js';
import { iconURL, itemIconURL, SKILL_ICON } from './icons.js';
import * as THREE from 'three';

const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export class Hud {
  constructor(container, C) {
    this.C = C;
    this.root = h('div', 'hud');
    container.appendChild(this.root);
    this.touch = { joy: { x: 0, y: 0 }, a: false, skill: false, item: false, aimJoy: null };
    this.vignette = h('div', 'hud-vignette');
    this.top = h('div', 'hud-top');
    this.timer = h('div', 'hud-timer', '<div class="big">15</div><div class="sub">ROUND 1</div>');
    this.top.appendChild(this.timer);
    this.card = h('div', 'hud-card left');
    this.alive = h('div', 'hud-alive');
    this.feed = h('div', 'hud-feed');
    this.banner = h('div', 'hud-banner');
    this.tags = h('div');
    this.pops = h('div');
    this.help = h('div', 'hud-help', '<span><span class="gb-kbd">WASD</span> move</span><span><span class="gb-kbd">J</span>/<span class="gb-kbd">CLICK</span> pass · dash</span><span><span class="gb-kbd">K</span>/<span class="gb-kbd">R-CLICK</span> skill</span><span><span class="gb-kbd">L</span> item</span>');
    this.root.append(this.vignette, this.tags, this.pops, this.top, this.card, this.alive, this.feed, this.banner, this.help);
    this.buildControls();
    this.tagEls = new Map();
    this.portraits = new Map();
  }

  portrait(heroId, size = 40) {
    const k = `${heroId}|${size}`;
    if (!this.portraits.has(k)) this.portraits.set(k, portraitURL(heroId, this.C, size));
    return this.portraits.get(k);
  }

  buildControls() {
    const joy = h('div', 'hud-joy interactive', '<div class="knob"></div>');
    const knob = joy.firstChild;
    let jid = null;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x = (e.clientX - cx) / (r.width / 2), y = -(e.clientY - cy) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.touch.joy = { x, y };
      knob.style.transform = `translate(${x * 60}%, ${-y * 60}%)`;
    };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; this.touch.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);

    const acts = h('div', 'hud-actions interactive');
    const mk = (cls, key, label) => {
      const b = h('div', `act ${cls}`, `<div class="cd"></div><div class="k">${key}</div><div class="l">${label}</div><div class="cdn"></div>`);
      acts.appendChild(b);
      return b;
    };
    this.btnA = mk('a', 'A', 'pass');
    this.btnB = mk('b', 'B', 'skill');
    this.btnC = mk('c', '', 'item');
    const bind = (el, key) => {
      let pid = null, origin = null;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pid = e.pointerId;
        el.setPointerCapture(pid);
        this.touch[key] = true;
        el.classList.add('pressed');
        origin = { x: e.clientX, y: e.clientY };
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pid || key !== 'a') return;
        const dx = e.clientX - origin.x, dy = -(e.clientY - origin.y);
        this.touch.aimJoy = Math.hypot(dx, dy) > 18 ? { x: dx, y: dy } : null;
      });
      const up = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        this.touch[key] = false;
        el.classList.remove('pressed');
        setTimeout(() => { if (key === 'a') this.touch.aimJoy = null; }, 50);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    bind(this.btnA, 'a');
    bind(this.btnB, 'skill');
    bind(this.btnC, 'item');
    this.root.append(joy, acts);
    this.joyEl = joy;
    this.actsEl = acts;
  }

  setControlsVisible(v) {
    this.joyEl.style.display = v ? '' : 'none';
    this.actsEl.style.display = v ? '' : 'none';
    this.help.style.display = v ? '' : 'none';
  }

  attach(match, stage) {
    this.match = match;
    this.stage = stage;
    this.feed.innerHTML = '';
    this.banner.innerHTML = '';
    this.tags.innerHTML = '';
    this.pops.innerHTML = '';
    this.tagEls.clear();
    const me = match.human;
    this.card.innerHTML = '';
    if (me) {
      const hero = HERO_BY_ID[me.heroId];
      this.card.innerHTML = `<img class="portrait" src="${this.portrait(me.heroId, 48)}"><div class="info"><div class="name"><span class="sq"></span>${hero.name}</div><div class="role">${hero.title.toLowerCase()} · ${hero.role.toLowerCase()}</div><div class="gb-pips"></div><div class="gb-bar"><b></b></div></div>`;
      this.card.style.display = '';
    } else this.card.style.display = 'none';
    this.setControlsVisible(!!me);
    this.alive.innerHTML = '';
    for (const p of match.players) {
      const m = h('img', 'mini' + (p.human ? ' me' : ''));
      m.src = this.portrait(p.heroId, 28);
      m.title = p.name;
      p._mini = m;
      this.alive.appendChild(m);
    }
    match.on('round', ({ round, first }) => this.showBanner(first ? 'READY' : `ROUND ${round}`, MODES[match.modeId].name + ' · ' + match.alive.length + ' left', 'gold', 1100));
    match.on('go', () => this.showBanner('GO!', null, '', 600));
    match.on('elim', ({ player, left }) => {
      this.addFeed(player, player.human ? 'You are out' : `${player.name} is out`);
      this.showBanner(player.human ? 'ELIMINATED' : `${player.name} OUT`, `${left} left`, 'red', 1400);
      this.pop(player, 'OUT', '#ff6a6a');
    });
    match.on('win', ({ winner }) => {
      const mine = winner && winner.human;
      this.showBanner(mine ? 'EGOIST CROWNED' : `${winner ? winner.name : 'NOBODY'} WINS`, mine ? 'You are the last striker standing' : 'Tap PLAY AGAIN', 'gold', 999999);
    });
    match.on('catch', ({ player }) => { this.pop(player, player.human ? 'YOU\'RE IT!' : 'IT!', '#ff8a8a'); });
    match.on('skill', ({ player, slot }) => { this.pop(player, HERO_BY_ID[player.heroId][slot].name.toUpperCase(), this.C(`hero.${player.heroId}.fx`)); });
    match.on('pickup', ({ player, id }) => { if (player.human) this.pop(player, ITEMS[id].name.toUpperCase(), ITEMS[id].color); });
    match.on('trap', ({ player }) => this.pop(player, 'PERFECT TRAP', this.C('hero.echo.fx')));
    match.on('deflect', ({ player }) => this.pop(player, 'BLOCKED', '#8fd0ff'));
  }

  showBanner(main, sub, cls = '', ms = 1200) {
    this.banner.innerHTML = `<div class="main ${cls}">${main}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => (this.banner.innerHTML = ''), ms);
  }

  addFeed(p, text) {
    const row = h('div', 'row', `<img src="${iconURL('skull', '#dc4343', 2)}"><img src="${this.portrait(p.heroId, 28)}">${text}`);
    this.feed.prepend(row);
    while (this.feed.children.length > 5) this.feed.lastChild.remove();
    setTimeout(() => row.remove(), 6000);
  }

  pop(p, text, color) {
    const el = h('div', 'hud-pop', text);
    el.style.color = color;
    el._p = p;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  update() {
    const m = this.match;
    if (!m) return;
    const C = this.C;
    // Timer
    const big = this.timer.firstChild, sub = this.timer.lastChild;
    let left = m.roundT;
    let label = `ROUND ${m.round}`;
    if (m.mode.timer === 'fuse') {
      const b = m.balls.find((x) => x.state !== 'dead');
      left = b ? b.fuse : 0;
      label = `FUSE · R${m.round}`;
    }
    if (m.phase === 'intro') left = m.mode.timer === 'fuse' ? C('rules.fuseTime') : m.roundLen;
    const hidden = m.mode.timer === 'hidden';
    big.textContent = hidden ? '??' : Math.max(0, left).toFixed(left < 5 ? 1 : 0);
    sub.textContent = label;
    this.timer.classList.toggle('danger', !hidden && m.phase === 'play' && left < C('ball.danger'));

    // Me
    const me = m.human;
    if (me) {
      const ball = m.holding(me);
      this.vignette.classList.toggle('on', !!ball && m.phase === 'play');
      const slot = ball ? 'atk' : 'def';
      const hero = HERO_BY_ID[me.heroId];
      const pips = this.card.querySelector('.gb-pips');
      if (pips) {
        const n = m.alive.length;
        pips.innerHTML = m.players.map((p) => `<i class="${p.alive ? 'on' : ''}"></i>`).slice(0, 12).join('');
        const bar = this.card.querySelector('.gb-bar > b');
        const cd = me.cd[slot] / C(`hero.${me.heroId}.${slot}.cd`);
        bar.style.width = `${(1 - cd) * 100}%`;
        bar.style.background = cd <= 0 ? 'var(--green)' : 'var(--ink)';
        void n;
      }
      // A
      this.btnA.querySelector('.l').textContent = ball ? (me.lock > 0 ? 'wait' : me.charge >= 0 ? 'release' : 'pass') : 'dash';
      const aCd = ball ? me.lock / Math.max(0.01, C('rules.catchLock')) : me.cd.dash / C('move.dashCd');
      this.btnA.querySelector('.cd').style.setProperty('--cd', `${Math.min(1, aCd) * 100}%`);
      this.btnA.classList.toggle('disabled', !me.alive);
      // B
      const sk = hero[slot];
      const iconName = SKILL_ICON[`${me.heroId}.${slot}`];
      const bKey = `${me.heroId}.${slot}`;
      if (this.btnB._key !== bKey) {
        this.btnB._key = bKey;
        this.btnB.querySelector('.k').innerHTML = `<img src="${iconURL(iconName, C(`hero.${me.heroId}.fx`), 3)}">`;
        this.btnB.querySelector('.l').textContent = sk.name.split(' ')[0].toLowerCase();
        this.btnB.style.borderColor = slot === 'atk' ? 'var(--red)' : 'var(--green)';
        this.btnB.style.color = slot === 'atk' ? '#ff9a9a' : 'var(--green)';
      }
      const bcd = me.cd[slot] / C(`hero.${me.heroId}.${slot}.cd`);
      this.btnB.querySelector('.cd').style.setProperty('--cd', `${bcd * 100}%`);
      this.btnB.querySelector('.cdn').textContent = me.cd[slot] > 0 ? Math.ceil(me.cd[slot]) : '';
      // C
      if (this.btnC._item !== me.item) {
        this.btnC._item = me.item;
        this.btnC.querySelector('.k').innerHTML = me.item ? `<img src="${itemIconURL(me.item, 3)}">` : '';
        this.btnC.querySelector('.l').textContent = me.item ? '' : 'item';
        this.btnC.classList.toggle('disabled', !me.item);
      }
    }

    // Roster minis
    for (const p of m.players) {
      const el = p._mini;
      if (!el) continue;
      el.classList.toggle('out', !p.alive);
      el.classList.toggle('it', !!m.holding(p));
    }

    // Name tags & pops follow players
    const v = new THREE.Vector3();
    const pt = {};
    for (const p of m.players) {
      let el = this.tagEls.get(p);
      if (!el) {
        el = h('div', 'hud-tag');
        this.tags.appendChild(el);
        this.tagEls.set(p, el);
      }
      if (!p.alive || !p.model.visible) { el.style.display = 'none'; continue; }
      const it = !!m.holding(p);
      el.style.display = '';
      el.className = 'hud-tag' + (p.human ? ' me' : '') + (it ? ' it' : '');
      el.textContent = it ? (p.human ? '▼ YOU · IT' : `▼ ${p.name}`) : p.human ? 'YOU' : p.name;
      v.set(p.x, 2.55 * HERO_BY_ID[p.heroId].look.build + p.y, p.z);
      this.stage.toScreen(v, pt);
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
    }
    for (const el of this.pops.children) {
      const p = el._p;
      v.set(p.x, 3.1 + p.y, p.z);
      this.stage.toScreen(v, pt);
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
    }
  }

  dispose() { this.root.remove(); }
}
