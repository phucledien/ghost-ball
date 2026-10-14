// Layered config: schema defaults < locked (config/locked.json) < draft.
// The draft lives in localStorage and syncs across open tabs over a
// BroadcastChannel, so tweaking in the editor updates a running game tab live.
import { SCHEMA } from './schema.js';
import '../game/heroes.js'; // registers hero/skill tunables into SCHEMA
import '../game/items.js';

const DRAFT_KEY = 'ghostball.draft.v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ghostball-config') : null;

function store(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

async function loadLocked() {
  if (import.meta.env.DEV) {
    try {
      const r = await fetch('/api/config');
      if (r.ok) return await r.json();
    } catch { /* fall through */ }
  }
  const mods = import.meta.glob('../../config/locked.json', { import: 'default' });
  const loader = Object.values(mods)[0];
  return loader ? await loader() : {};
}

class Config {
  constructor(locked, draft) {
    this.defaults = Object.fromEntries(SCHEMA.map((s) => [s.key, s.v]));
    this.lockedValues = { ...this.defaults, ...pick(locked, this.defaults) };
    this.draft = { ...pick(draft, this.defaults) };
    this.listeners = new Set();
    this.get = (k) => (k in this.draft ? this.draft[k] : this.lockedValues[k]);
    this.getLocked = (k) => this.lockedValues[k];
    channel?.addEventListener('message', (e) => {
      if (e.data?.type === 'draft') {
        this.draft = { ...e.data.draft };
        this.emit(e.data.key ?? null, true);
      } else if (e.data?.type === 'locked') {
        this.lockedValues = { ...this.defaults, ...e.data.values };
        this.draft = {};
        this.emit(null, true);
      }
    });
  }

  schema(key) { return SCHEMA.find((s) => s.key === key); }
  get keys() { return SCHEMA.map((s) => s.key); }

  set(key, value) {
    if (value === this.lockedValues[key]) delete this.draft[key];
    else this.draft[key] = value;
    this.persist(key);
    this.emit(key);
  }

  setMany(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (!(k in this.defaults)) continue;
      if (v === this.lockedValues[k]) delete this.draft[k];
      else this.draft[k] = v;
    }
    this.persist(null);
    this.emit(null);
  }

  revert(key) {
    if (key) delete this.draft[key];
    else this.draft = {};
    this.persist(key ?? null);
    this.emit(key ?? null);
  }

  resetToDefault(key) { this.set(key, this.defaults[key]); }

  diff() {
    return Object.keys(this.draft).map((k) => ({ key: k, from: this.lockedValues[k], to: this.draft[k] }));
  }

  values() {
    const out = {};
    for (const k of this.keys) out[k] = this.get(k);
    return out;
  }

  async lock(note = '') {
    const values = this.values();
    const changes = this.diff();
    let result = { ok: false };
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only values that differ from the code defaults are written, so later
        // default changes in code still reach anything you never touched.
        body: JSON.stringify({ values: this.sparse(values), changes, note, at: new Date().toISOString() }),
      });
      result = await r.json();
    } catch (e) {
      result = { ok: false, error: String(e) };
    }
    if (result.ok) {
      this.lockedValues = values;
      this.draft = {};
      this.persist(null);
      channel?.postMessage({ type: 'locked', values });
      this.emit(null);
    }
    return result;
  }

  sparse(values) {
    const out = {};
    for (const [k, v] of Object.entries(values)) if (v !== this.defaults[k]) out[k] = v;
    return out;
  }

  persist(key) {
    store(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(this.draft)));
    channel?.postMessage({ type: 'draft', draft: this.draft, key });
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(key, remote = false) { for (const fn of this.listeners) fn(key, remote); }
}

function pick(obj, allowed) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) if (k in allowed) out[k] = v;
  return out;
}

let instance;
export async function loadConfig() {
  if (instance) return instance;
  const locked = await loadLocked();
  const draft = store(() => JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'), {});
  instance = new Config(locked, draft);
  return instance;
}
