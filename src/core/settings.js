// Player settings (the in-game Settings screen). Stored on their own in
// localStorage — never in the tuning draft — so changing graphics or bot
// difficulty doesn't show up as an unlocked editor change. "Default" means
// "use whatever the editor / locked config says".
const KEY = 'ghostball.settings.v1';

export const SETTINGS = [
  { id: 'controls', group: 'Controls', label: 'Control scheme', hint: 'Auto follows your device: joystick on touch screens, keys on desktop.',
    options: [['auto', 'Auto'], ['touch', 'Touch'], ['keys', 'Keyboard']] },
  { id: 'music', group: 'Sound', label: 'Music',
    options: [['off', 'Off'], ['low', 'Low'], ['auto', 'Normal'], ['high', 'Loud']] },
  { id: 'sfx', group: 'Sound', label: 'Sound effects',
    options: [['off', 'Off'], ['low', 'Low'], ['auto', 'Normal'], ['high', 'Loud']] },
  { id: 'pixel', group: 'Graphics', label: 'Pixel size', hint: 'Bigger pixels = chunkier look and faster on older phones.',
    options: [['auto', 'Default'], ['2', 'Fine'], ['3', 'Classic'], ['4', 'Chunky']], keys: (v) => ({ 'render.pixelScale': +v }) },
  { id: 'shadows', group: 'Graphics', label: 'Shadows',
    options: [['auto', 'Default'], ['on', 'On'], ['off', 'Off']], keys: (v) => ({ 'render.shadows': v === 'on' }) },
  { id: 'effects', group: 'Graphics', label: 'Effects',
    options: [['auto', 'Default'], ['low', 'Low'], ['high', 'High']], keys: (v) => ({ 'fx.particles': v === 'low' ? 0.45 : 1.5 }) },
  { id: 'shake', group: 'Graphics', label: 'Screen shake',
    options: [['auto', 'Default'], ['low', 'Low'], ['off', 'Off']], keys: (v) => ({ 'fx.shake': v === 'low' ? 0.45 : 0, 'fx.flash': v === 'low' ? 0.2 : 0 }) },
  { id: 'hud', group: 'Interface', label: 'HUD size',
    options: [['auto', 'Default'], ['s', 'Small'], ['l', 'Large']], keys: (v) => ({ 'ui.scale': v === 's' ? 0.85 : 1.2 }) },
  { id: 'bots', group: 'Match', label: 'Bot difficulty',
    options: [['easy', 'Easy'], ['auto', 'Normal'], ['hard', 'Hard'], ['ego', 'Egoist']], keys: (v) => ({ 'rules.botSkill': { easy: 0.3, hard: 0.8, ego: 1 }[v] }) },
  { id: 'round', group: 'Match', label: 'Round length',
    options: [['short', '10s'], ['auto', 'Default'], ['long', '20s']], keys: (v) => ({ 'rules.roundTime': v === 'short' ? 10 : 20 }) },
];

export class Prefs {
  constructor() {
    this.values = {};
    try { this.values = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { this.values = {}; }
    this.listeners = new Set();
    this.recompute();
  }

  get(id) { return this.values[id] ?? 'auto'; }

  set(id, v) {
    if (v === 'auto') delete this.values[id]; else this.values[id] = v;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* private mode */ }
    this.recompute();
    for (const fn of this.listeners) fn(id);
  }

  reset() {
    for (const id of Object.keys(this.values)) delete this.values[id];
    this.set('controls', 'auto');
  }

  recompute() {
    this.overrides = {};
    for (const s of SETTINGS) {
      const v = this.get(s.id);
      if (v !== 'auto' && s.keys) Object.assign(this.overrides, s.keys(v));
    }
  }

  // Wrap a config getter so settings win over tuned values.
  wrap(get) { return (k) => (k in this.overrides ? this.overrides[k] : get(k)); }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

// Last menu picks (mode / striker / arena / cosmetics), so "Play" remembers.
const PICKS = 'ghostball.picks.v1';
export function loadPicks() {
  try { return JSON.parse(localStorage.getItem(PICKS) || '{}') || {}; } catch { return {}; }
}
export function savePicks(p) {
  try { localStorage.setItem(PICKS, JSON.stringify(p)); } catch { /* ignore */ }
}
