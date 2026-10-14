// Procedural chiptune audio: every sound is synthesised with WebAudio, so
// there are no asset files. SFX are short oscillator / noise envelopes; the
// music is a small step sequencer (bass + arp + drums) that switches between
// a menu groove and a faster match loop.
//
// Browsers only allow audio after a user gesture, so the context is created
// lazily and resumed on the first pointer / key press.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.5;
    this.track = null;
    this.wanted = null;
    this.unlock = () => this.start();
    window.addEventListener('pointerdown', this.unlock, true);
    window.addEventListener('keydown', this.unlock, true);
  }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.connect(c.destination);
      this.sfx = c.createGain();
      this.music = c.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.setVolumes(this.sfxVol, this.musicVol);
      // one second of white noise, reused by every noisy sound
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.wanted && !this.track) this.playMusic(this.wanted);
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(sfx * 0.55, t, 0.02);
    this.music.gain.setTargetAtTime(music * 0.32, t, 0.05);
  }

  // ── Building blocks ──────────────────────────────────────────────────
  tone({ type = 'square', f0 = 440, f1 = null, dur = 0.12, vol = 0.5, at = 0, attack = 0.004, out = this.sfx }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.4, at = 0, filter = 'bandpass', f0 = 1200, f1 = null, q = 1, out = this.sfx }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const bf = c.createBiquadFilter();
    bf.type = filter; bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t);
    if (f1) bf.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bf).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ── Sound effects ────────────────────────────────────────────────────
  play(name, k = 1) {
    if (!this.ready) return;
    const fn = SFX[name];
    if (!fn) return;
    // don't stack the same sound more than a few times per frame burst
    const now = this.ctx.currentTime;
    this.last = this.last || {};
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    fn(this, k);
  }

  // ── Music ────────────────────────────────────────────────────────────
  playMusic(name) {
    this.wanted = name;
    if (!this.ready) return;
    if (this.track?.name === name) return;
    this.stopMusic();
    const song = SONGS[name];
    if (!song) return;
    const tr = { name, step: 0, next: this.ctx.currentTime + 0.08, timer: 0 };
    const spb = 60 / song.bpm / 4; // 16th notes
    const tick = () => {
      // schedule ahead so timing stays tight even when the tab is busy
      while (tr.next < this.ctx.currentTime + 0.15) {
        song.step(this, tr.step, tr.next - this.ctx.currentTime, spb);
        tr.step++;
        tr.next += spb;
      }
    };
    tr.timer = setInterval(tick, 40);
    tick();
    this.track = tr;
  }

  stopMusic() {
    if (this.track) clearInterval(this.track.timer);
    this.track = null;
  }
}

const SFX = {
  ui: (a) => a.tone({ type: 'square', f0: 880, f1: 1320, dur: 0.05, vol: 0.18 }),
  uiMove: (a) => a.tone({ type: 'square', f0: 660, dur: 0.03, vol: 0.1 }),
  uiBack: (a) => a.tone({ type: 'square', f0: 660, f1: 330, dur: 0.07, vol: 0.16 }),
  uiStart: (a) => { [0, 4, 7, 12].forEach((n, i) => a.tone({ type: 'square', f0: NOTE(72 + n), dur: 0.12, vol: 0.2, at: i * 0.06 })); },
  kick: (a, k) => {
    a.tone({ type: 'triangle', f0: 180 + 60 * k, f1: 50, dur: 0.12, vol: 0.7 });
    a.noise({ dur: 0.06, vol: 0.35, filter: 'highpass', f0: 2500 });
  },
  catch: (a) => {
    a.tone({ type: 'triangle', f0: 120, f1: 70, dur: 0.1, vol: 0.6 });
    a.noise({ dur: 0.05, vol: 0.2, filter: 'lowpass', f0: 900 });
  },
  it: (a) => { a.tone({ type: 'square', f0: 988, dur: 0.07, vol: 0.18 }); a.tone({ type: 'square', f0: 740, dur: 0.1, vol: 0.18, at: 0.07 }); },
  dash: (a) => a.noise({ dur: 0.18, vol: 0.3, filter: 'bandpass', f0: 600, f1: 3000, q: 2 }),
  skill: (a) => {
    a.tone({ type: 'sawtooth', f0: 220, f1: 880, dur: 0.22, vol: 0.22 });
    a.noise({ dur: 0.25, vol: 0.18, filter: 'bandpass', f0: 1500, f1: 5000, q: 3 });
  },
  power: (a) => {
    a.tone({ type: 'square', f0: 90, f1: 40, dur: 0.35, vol: 0.5 });
    a.noise({ dur: 0.35, vol: 0.45, filter: 'lowpass', f0: 2400, f1: 200 });
  },
  wall: (a) => { a.noise({ dur: 0.4, vol: 0.5, filter: 'lowpass', f0: 600, f1: 120 }); a.tone({ type: 'triangle', f0: 70, f1: 40, dur: 0.3, vol: 0.5 }); },
  bounce: (a) => a.tone({ type: 'triangle', f0: 320, f1: 200, dur: 0.06, vol: 0.25 }),
  block: (a) => { a.tone({ type: 'square', f0: 1200, f1: 500, dur: 0.12, vol: 0.2 }); a.noise({ dur: 0.1, vol: 0.2, filter: 'highpass', f0: 3000 }); },
  item: (a) => { [0, 7, 12].forEach((n, i) => a.tone({ type: 'square', f0: NOTE(79 + n), dur: 0.08, vol: 0.16, at: i * 0.05 })); },
  useItem: (a) => a.tone({ type: 'square', f0: 440, f1: 1760, dur: 0.18, vol: 0.18 }),
  tick: (a) => a.tone({ type: 'square', f0: 1568, dur: 0.04, vol: 0.14 }),
  go: (a) => { a.tone({ type: 'square', f0: NOTE(76), dur: 0.12, vol: 0.22 }); a.tone({ type: 'square', f0: NOTE(83), dur: 0.25, vol: 0.22, at: 0.1 }); },
  buzzer: (a) => { a.tone({ type: 'sawtooth', f0: 196, dur: 0.6, vol: 0.32 }); a.tone({ type: 'sawtooth', f0: 202, dur: 0.6, vol: 0.32 }); },
  boom: (a) => {
    a.noise({ dur: 0.9, vol: 0.8, filter: 'lowpass', f0: 3000, f1: 80 });
    a.tone({ type: 'triangle', f0: 120, f1: 30, dur: 0.6, vol: 0.8 });
  },
  elim: (a) => {
    a.noise({ dur: 0.7, vol: 0.6, filter: 'bandpass', f0: 2000, f1: 200, q: 0.7 });
    [0, -3, -7, -12].forEach((n, i) => a.tone({ type: 'square', f0: NOTE(72 + n), dur: 0.12, vol: 0.18, at: 0.05 + i * 0.08 }));
  },
  cheer: (a) => a.noise({ dur: 1.6, vol: 0.22, filter: 'bandpass', f0: 900, f1: 1400, q: 0.5 }),
  win: (a) => { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => a.tone({ type: 'square', f0: NOTE(72 + n), dur: 0.16, vol: 0.2, at: i * 0.11 })); },
};

// Tiny sequencer songs. step(audio, i, when, secondsPerStep)
const drums = (a, i, at, kickPat, snarePat) => {
  const s = i % 16;
  if (kickPat[s] === 'x') a.tone({ type: 'triangle', f0: 150, f1: 45, dur: 0.12, vol: 0.9, at, out: a.music });
  if (snarePat[s] === 'x') a.noise({ dur: 0.12, vol: 0.5, filter: 'highpass', f0: 1800, at, out: a.music });
  if (s % 2 === 0) a.noise({ dur: 0.03, vol: 0.18, filter: 'highpass', f0: 7000, at, out: a.music });
};

const SONGS = {
  // relaxed menu groove: Am – F – C – G
  menu: {
    bpm: 104,
    step(a, i, at, spb) {
      const bar = Math.floor(i / 16) % 4, s = i % 16;
      const roots = [57, 53, 48, 55];
      const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
      const r = roots[bar];
      drums(a, i, at, 'x.......x.x.....', '....x.......x...');
      if (s % 4 === 0 || s === 14) a.tone({ type: 'triangle', f0: NOTE(r - 12), dur: spb * 2.2, vol: 0.7, at, out: a.music });
      if (s % 2 === 0) {
        const n = chords[bar][(s / 2) % 3] + r + 12 + (s >= 8 ? 12 : 0);
        a.tone({ type: 'square', f0: NOTE(n), dur: spb * 0.9, vol: 0.16, at, out: a.music });
      }
    },
  },
  // driving match loop: Em – C – D – B
  match: {
    bpm: 140,
    step(a, i, at, spb) {
      const bar = Math.floor(i / 16) % 4, s = i % 16;
      const roots = [52, 48, 50, 47];
      const r = roots[bar];
      drums(a, i, at, 'x...x...x...x.x.', '....x.......x...');
      if (s % 2 === 0) a.tone({ type: 'sawtooth', f0: NOTE(r - 12 + (s % 4 === 2 ? 12 : 0)), dur: spb * 1.1, vol: 0.32, at, out: a.music });
      const lead = [0, 7, 12, 7, 3, 7, 12, 15];
      if (s % 2 === 1) a.tone({ type: 'square', f0: NOTE(r + 12 + lead[(s >> 1) % 8]), dur: spb * 0.7, vol: 0.1, at, out: a.music });
    },
  },
};
