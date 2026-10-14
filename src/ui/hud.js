// In-match HUD (DOM). Timer, player card, roster strip, kill feed, banners,
// name tags, pop text, touch joystick + action buttons with cooldown sweeps.
import { HERO_BY_ID } from '../game/heroes.js';
import { ITEMS, itemDetails, activeItemStates } from '../game/items.js';
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
    this.pauseBtn = h('button', 'hud-pause interactive', '<i></i><i></i>');
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.addEventListener('click', () => this.onPause?.());
    this.onPause = null;
    this.top.append(this.pauseBtn, this.timer);
    this.card = h('div', 'hud-card left');
    this.alive = h('div', 'hud-alive');
    this.feed = h('div', 'hud-feed');
    this.banner = h('div', 'hud-banner');
    this.tags = h('div');
    this.pops = h('div');
    this.help = h('div', 'hud-help', '<span><span class="gb-kbd">WASD</span> move</span><span><span class="gb-kbd">MOUSE</span> aim</span><span><span class="gb-kbd">J</span>/<span class="gb-kbd">CLICK</span> pass · dash</span><span><span class="gb-kbd">K</span>/<span class="gb-kbd">R-CLICK</span> skill</span><span><span class="gb-kbd">L</span> item</span><span><span class="gb-kbd">ESC</span> pause</span>');
    this.ballTrack=h('div','hud-ball-track');
    this.itemHelp=h('div','hud-item-help');
    this.statuses=h('div','hud-statuses');
    this.notice=h('div','hud-notice');
    this.root.append(this.ballTrack,this.itemHelp,this.statuses,this.notice);
    this.offball = h('div', 'hud-offball', '<i></i><b></b>');
    this.offballs = [this.offball];
    this.root.append(this.vignette, this.tags, this.pops, this.offball, this.top, this.card, this.alive, this.feed, this.banner, this.help);
    this.buildControls();
    this.initControlMode();
    this.tagEls = new Map();
    this.portraits = new Map();
  }

  portrait(heroId, size = 40, loadout = null) {
    const k = `${heroId}|${size}|${JSON.stringify(loadout)}`;
    if (!this.portraits.has(k)) this.portraits.set(k, portraitURL(heroId, this.C, size, loadout));
    return this.portraits.get(k);
  }

  buildControls() {
    const joy = h('div', 'hud-joy interactive', '<div class="knob"></div>');
    const knob = joy.firstChild;
    let jid = null;const resets=[];
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x = (e.clientX - cx) / (r.width / 2), y = -(e.clientY - cy) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      this.touch.joy = { x, y };
      knob.style.transform = `translate(${x * 60}%, ${-y * 60}%)`;
    };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); if(jid!==null)return; jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; this.touch.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);
    joy.addEventListener('lostpointercapture',endJoy);
    resets.push(()=>{jid=null;knob.style.transform='';});

    const acts = h('div', 'hud-actions interactive');
    const mk = (cls, key, label) => {
      const hot = { a: 'J', b: 'K', c: 'L' }[cls];
      const b = h('div', `act ${cls}`, `<div class="cd"></div><div class="k">${key}</div><div class="l">${label}</div><div class="cdn"></div><div class="hot">${hot}</div>`);
      acts.appendChild(b);
      return b;
    };
    this.btnA = mk('a', 'A', 'pass');
    this.btnB = mk('b', 'B', 'skill');
    this.btnC = mk('c', '', 'item');
    const bind = (el, key) => {
      let pid = null, origin = null, aimTimer=null;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(pid!==null)return;
        clearTimeout(aimTimer);pid = e.pointerId;
        el.setPointerCapture(pid);
        this.touch[key] = true;this.touch.onChange?.();
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
        this.touch[key] = false;this.touch.onChange?.();
        el.classList.remove('pressed');
        aimTimer=setTimeout(() => { if (key === 'a') this.touch.aimJoy = null; }, 50);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture',up);
      resets.push(()=>{pid=null;clearTimeout(aimTimer);el.classList.remove('pressed')});
    };
    bind(this.btnA, 'a');
    bind(this.btnB, 'skill');
    bind(this.btnC, 'item');
    this.touch.reset=()=>resets.forEach(fn=>fn());
    this.root.append(joy, acts);
    this.joyEl = joy;
    this.actsEl = acts;
  }

  // Controls follow the device: touch → joystick + buttons; keyboard/mouse →
  // a key-hint bar and a compact ability bar. 'auto' starts from the pointer
  // type and then follows whatever you last used (tap vs. key press / click).
  initControlMode() {
    this.hasPlayer = false;
    this.controlMode = 'auto';
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.detected = coarse ? 'touch' : 'keys';
    this.onAnyPointer = (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') this.setDetected('touch'); else if (e.pointerType === 'mouse') this.setDetected('keys'); };
    this.onAnyKey = (e) => { if (!e.target.closest?.('input, textarea, select')) this.setDetected('keys'); };
    window.addEventListener('pointerdown', this.onAnyPointer, true);
    window.addEventListener('keydown', this.onAnyKey, true);
    this.applyControls();
  }

  setDetected(kind) {
    if (this.detected === kind) return;
    this.detected = kind;
    this.applyControls();
  }

  // mode: 'auto' | 'touch' | 'keys'
  setControlMode(mode = 'auto') {
    this.controlMode = mode;
    this.applyControls();
  }

  get activeControls() { return this.controlMode === 'auto' ? this.detected : this.controlMode; }

  applyControls() {
    const kind = this.activeControls;
    this.root.classList.toggle('ctl-touch', kind === 'touch');
    this.root.classList.toggle('ctl-keys', kind !== 'touch');
    this.root.classList.toggle('no-player', !this.hasPlayer);
    if (kind !== 'touch') { this.touch.joy = { x: 0, y: 0 }; this.touch.a = this.touch.skill = this.touch.item = false; }
  }

  setControlsVisible(v) {
    this.hasPlayer = v;
    this.applyControls();
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
      this.card.innerHTML = `<img class="portrait" src="${this.portrait(me.heroId, 48, me.model.userData.loadout)}"><div class="info"><div class="name"><span class="sq"></span>${hero.name}</div><div class="role">${hero.title.toLowerCase()} · ${hero.role.toLowerCase()}</div><div class="gb-pips"></div><div class="gb-bar"><b></b></div></div>`;
      this.card.style.display = '';
    } else this.card.style.display = 'none';
    this.setControlsVisible(!!me);
    this.alive.innerHTML = '';
    for (const p of match.players) {
      const m = h('img', 'mini' + (p.human ? ' me' : ''));
      m.src = this.portrait(p.heroId, 28, p.model.userData.loadout);
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
    match.on('pickup', ({ player, id }) => { if (player.human) {this.pop(player, ITEMS[id].name.toUpperCase(), ITEMS[id].color);this.showNotice(`${ITEMS[id].name} equipped · ${itemDetails(id,this.C).short}`,ITEMS[id].color)} });
    match.on('item',({player,id,affected})=>{if(player.human)this.showNotice(id==='whistle'?`Freeze Whistle · ${affected} rival${affected===1?'':'s'} frozen`:id==='overclock'?'Overclock · dash & skills READY':`${ITEMS[id].name} ACTIVE`,ITEMS[id].color)});
    match.on('deflect',({player,shieldConsumed})=>{if(player.human)this.showNotice(shieldConsumed?'BLOCKED · shield consumed':'BLOCKED · crown guard','#5aa8ff')});
    match.on('trap', ({ player }) => this.pop(player, 'PERFECT TRAP', this.C('hero.echo.fx')));
    match.on('deflect', ({ player }) => this.pop(player, 'BLOCKED', '#8fd0ff'));
  }

  showNotice(text,color){this.notice.textContent=text;this.notice.style.borderColor=color;this.notice.hidden=false;clearTimeout(this.noticeT);this.noticeT=setTimeout(()=>this.notice.hidden=true,2200);}

  showBanner(main, sub, cls = '', ms = 1200) {
    this.banner.innerHTML = `<div class="main ${cls}">${main}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => (this.banner.innerHTML = ''), ms);
  }

  addFeed(p, text) {
    const row = h('div', 'row', `<img src="${iconURL('skull', '#dc4343', 2)}"><img src="${this.portrait(p.heroId, 28, p.model.userData.loadout)}">${text}`);
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

    // Touch history and elimination responsibility deliberately use different fields.
    const ballRows=m.balls.filter(b=>b.state!=='dead').map((b,i)=>{
      const touch=b.lastTouch || (b.state==='held'?b.owner:b.lastPasser),risk=m.culpritOf(b);
      return {index:m.balls.length>1?i+1:null,touch,risk,held:b.state==='held'};
    });
    const trackingKey=ballRows.map(r=>`${r.index}:${r.touch?.id}:${r.risk?.id}:${r.held}`).join('|');
    if(trackingKey!==this._trackingKey){this._trackingKey=trackingKey;
      this.ballTrack.innerHTML=ballRows.map(r=>`<div class="ball-record ${r.risk?.human?'mine':''}"><img src="${iconURL('ball','#f5eddc',2)}" alt=""><div><span>${r.index?'BALL '+r.index+' · ':''}LAST TOUCH <b>${r.touch?(r.touch.human?'YOU':r.touch.name):'—'}</b></span><strong>${r.risk?(r.risk.human?'YOU':r.risk.name):'NOBODY'} <small>OUT IF BUZZER</small></strong></div></div>`).join('');
    }
    this.ballTrack.hidden=!m.human||m.phase==='over';
    const lastTouched=new Set(ballRows.map(r=>r.touch).filter(Boolean));
    const atRisk=new Set(ballRows.map(r=>r.risk).filter(Boolean));
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
        if (this._pipsN !== n) {
          this._pipsN = n;
          pips.innerHTML = m.players.map((p) => `<i class="${p.alive ? 'on' : ''}"></i>`).slice(0, 14).join('');
        }
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
        this.btnC.querySelector('.l').textContent = me.item ? ({cleats:'boost',shield:'shield',magnet:'magnet',cloak:'cloak',whistle:'freeze',overclock:'reset'}[me.item]) : 'item';
        this.btnC.classList.toggle('disabled', !me.item);
      }
    }

    if(me){
      const detail=itemDetails(me.item,C),key=`${me.item}|${this.activeControls}|${detail.effect}|${detail.duration}`;
      this.itemHelp.hidden=!me.item||!me.alive;
      if(key!==this._helpKey){this._helpKey=key;this.itemHelp.innerHTML=me.item?`<span class="equip-label">EQUIPPED · ${this.activeControls==='touch'?'TAP ITEM TO USE':'L / E TO USE'}</span><b>${ITEMS[me.item].name}</b><span>${detail.effect}${detail.duration?` · ${detail.duration} s`:''}</span><small>${detail.condition}</small>`:'';}
      const active=me.alive?activeItemStates(me,C):[];
      const statesKey=active.map(r=>`${r.id}:${r.left?.toFixed(1)}:${r.label}`).join('|');
      if(statesKey!==this._statesKey){this._statesKey=statesKey;this.statuses.innerHTML=active.map(r=>`<div class="status-effect" data-effect="${r.id}" style="--effect:${r.color}"><div><b>${r.name}</b><strong>${r.ready?'READY':r.left.toFixed(1)+'s'}</strong></div><small>${r.label}</small>${r.ready?'':`<i><em style="width:${Math.min(100,100*r.left/r.total)}%"></em></i>`}</div>`).join('');}
      this.statuses.hidden=!active.length;
    }

    // Roster minis
    for (const p of m.players) {
      const el = p._mini;
      if (!el) continue;
      el.classList.toggle('out', !p.alive);
      el.classList.toggle('it', !!m.holding(p));
      el.classList.toggle('last-touch',lastTouched.has(p));
      el.classList.toggle('at-risk',atRisk.has(p));
      el.title=`${p.human?'YOU':p.name}${lastTouched.has(p)?' · last touch':''}${atRisk.has(p)?' · out if buzzer':''}`;
    }

    // Compact views reserve labels for the player, holders and nearby rivals.
    // Stable priorities and a wider exit radius avoid labels flickering at the cutoff.
    const v = new THREE.Vector3();
    const pt = {};
    const W = this.root.clientWidth, H = this.root.clientHeight;
    const compact = W <= 720 || (W <= 980 && H <= 500);
    const focus = me?.alive ? me : this.stage.target;
    const candidates = [];
    for (const p of m.players) {
      let el = this.tagEls.get(p);
      if (!el) {
        el = h('div', 'hud-tag');
        el.dataset.player = p.id;
        this.tags.appendChild(el);
        this.tagEls.set(p, el);
      }
      const wasShown = !!el._shown;
      el._shown = false;
      if (!p.alive || !p.model.visible) { el.style.display = 'none'; continue; }
      const it = !!m.holding(p),last=lastTouched.has(p),risk=atRisk.has(p), priority = p.human ? 0 : it||last||risk ? 1 : 2;
      const distance = Math.hypot(p.x - focus.x, p.z - focus.z);
      if (compact && priority === 2 && distance > (wasShown ? 8.5 : 7)) {
        el.style.display = 'none'; continue;
      }
      el.style.display = '';
      const sig = (it ? 1 : 0) + (p.human ? 2 : 0)+(last?4:0)+(risk?8:0);
      if (el._sig !== sig) {
        el._sig = sig;
        el.className = 'hud-tag' + (p.human ? ' me' : '') + (it ? ' it' : '')+(last?' last-touch':'')+(risk?' at-risk':'');
        el.textContent = `${p.human?'YOU':p.name}${it?' · BALL':last?' · LAST':''}${risk?' !':''}`;
        el._width = 0;
      }
      v.set(p.x, 2.55 * HERO_BY_ID[p.heroId].look.build + p.y, p.z);
      this.stage.toScreen(v, pt);
      if (compact && (pt.x < 0 || pt.x > W || pt.y < 0 || pt.y > H)) {
        el.style.display = 'none'; continue;
      }
      if (!el._width) { el._width = el.offsetWidth; el._height = el.offsetHeight; }
      candidates.push({ p, el, x: pt.x, y: pt.y, priority, distance, wasShown });
    }
    if (compact) candidates.sort((a, b) => a.priority - b.priority ||
      (a.priority < 2 ? a.p.id - b.p.id :
        (a.distance - (a.wasShown ? 1 : 0)) - (b.distance - (b.wasShown ? 1 : 0)) || a.p.id - b.p.id));
    const placed = [];
    let nearby = 0;
    for (const c of candidates) {
      const { el } = c;
      if (compact && c.priority < 2) c.x = Math.max(el._width / 2 + 4, Math.min(W - el._width / 2 - 4, c.x));
      let y = compact ? Math.max(el._height + 4, Math.min(H - 4, c.y)) : c.y, visible = !compact || c.priority < 2 || nearby < 3;
      const box = top => ({ left: c.x - el._width / 2, right: c.x + el._width / 2,
        top: top - el._height, bottom: top });
      const overlaps = r => placed.some(o => r.left < o.right + 4 && r.right > o.left - 4 &&
        r.top < o.bottom + 3 && r.bottom > o.top - 3);
      if (compact && visible) {
        if (c.priority < 2) {
          // Never suppress YOU or an onscreen holder: stack their labels above a crowded head.
          const step = el._height + 4;
          for (const offset of [0, -step, step, -step * 2, step * 2]) {
            const r = box(y + offset);
            if (r.top >= 0 && r.bottom <= H && !overlaps(r)) { y += offset; break; }
          }
        } else if (overlaps(box(y))) visible = false;
      }
      el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      el._shown = true;
      el.style.left = `${Math.round(c.x)}px`;
      el.style.top = `${Math.round(y)}px`;
      placed.push(box(y));
      if (c.priority === 2) nearby++;
    }

    // Each real ball gets its own edge pointer. Numbers only appear in multi-ball modes.
    const pointers = [];
    for (let i = 0; i < m.balls.length; i++) {
      let arrow = this.offballs[i];
      if (!arrow) {
        arrow = h('div', 'hud-offball', '<i></i><b></b>');
        this.offballs.push(arrow);
        this.root.insertBefore(arrow, this.top);
      }
      const ball = m.balls[i];
      arrow.style.display = 'none';
      if (ball.state === 'dead' || m.phase === 'over') continue;
      v.set(ball.x, ball.y, ball.z);
      this.stage.toScreen(v, pt);
      if (pt.x >= 0 && pt.y >= 0 && pt.x <= W && pt.y <= H) continue;
      const pad = 34, cx = W / 2, cy = H / 2, dx = pt.x - cx, dy = pt.y - cy;
      const k = Math.min((cx - pad) / Math.abs(dx || 1e-3), (cy - pad) / Math.abs(dy || 1e-3));
      let x = cx + dx * k, y = cy + dy * k;
      if (pointers.some(p => Math.hypot(x - p.x, y - p.y) < 42)) {
        if (Math.abs(x - pad) < 1 || Math.abs(x - (W - pad)) < 1) y += y + 42 <= H - pad ? 42 : -42;
        else x += x + 42 <= W - pad ? 42 : -42;
      }
      pointers.push({ x, y });
      arrow.style.display = '';
      arrow.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      arrow.firstChild.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      arrow.lastChild.textContent = m.balls.length > 1 ? String(i + 1) : '';
      arrow.classList.toggle('hot', ball.state === 'held' && !!ball.owner);
    }
    for (let i = m.balls.length; i < this.offballs.length; i++) this.offballs[i].style.display = 'none';

    for (const el of this.pops.children) {
      const p = el._p;
      v.set(p.x, 3.1 + p.y, p.z);
      this.stage.toScreen(v, pt);
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
    }
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onAnyPointer, true);
    window.removeEventListener('keydown', this.onAnyKey, true);
    clearTimeout(this.bannerT);clearTimeout(this.noticeT);
    this.root.remove();
  }
}
