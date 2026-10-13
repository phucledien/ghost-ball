// Arena themes = the three visual variants. Each is a palette the arena
// builder reads; the design sheet renders these as swatches.
export const THEMES = {
  temple: {
    name: 'Sun Temple', desc: 'Sand pitch on a cliff-top temple. Torches, lanterns, a roaring crowd.',
    sky: '#5d6291', fog: '#6a6fa0',
    ground: '#ecd49c', speck: ['#d4b578', '#c9a96a', '#f5e2b4', '#9aa0c8'],
    lineA: '#3b7be0', lineB: '#dc4343', lineMid: '#4a3a2a', circle: '#fbf3df', lane: '#2aa6a0',
    curb: '#1f5a46', curbTop: '#2c7a5c', plinth: '#4b4f7e', plinthTop: '#7378a8', rock: '#5b5f8e',
    stand: '#6b6fa0', standTop: '#8a8fc0',
    crowd: ['#e04a5a', '#3b7be0', '#e8a93a', '#f3e9d2', '#5cc46a', '#8c5a3c', '#2a2f4a'], skin: ['#e2a878', '#b9784e', '#f0caa6', '#8a5a3a'],
    flame: ['#ffd84a', '#ff9a2a', '#ff5a2a'], post: '#2a1f1a', lantern: '#ffe7a0',
    sun: '#fff1d8', sunDir: [-0.55, 1, 0.4], ambSky: '#c9cdf5', ambGround: '#6b5a4a',
  },
  egolab: {
    name: 'Ego Lab', desc: 'Night-time training facility. Turf, floodlights, monitors watching you.',
    sky: '#0b1020', fog: '#0f1630',
    ground: '#2b7a54', speck: ['#256b4a', '#33885e', '#1f5e40', '#3c9468'],
    lineA: '#5ad8ff', lineB: '#5ad8ff', lineMid: '#e8f6ff', circle: '#e8f6ff', lane: '#2f8f62',
    curb: '#121a30', curbTop: '#1d2a4c', plinth: '#141c34', plinthTop: '#25335a', rock: '#0f1528',
    stand: '#1b2442', standTop: '#26345e',
    crowd: ['#3b7be0', '#5ad8ff', '#1d2a4c', '#e8f6ff', '#6a46d8'], skin: ['#e2a878', '#b9784e', '#f0caa6'],
    flame: ['#e8fbff', '#5ad8ff', '#2a8cff'], post: '#0c1222', lantern: '#9ae8ff',
    sun: '#cfe4ff', sunDir: [0.3, 1, 0.5], ambSky: '#6a86c8', ambGround: '#14243a',
  },
  frost: {
    name: 'Frost Peak', desc: 'Packed-snow pitch above the clouds. Pines, banners, cold breath.',
    sky: '#9fb6d8', fog: '#b7c9e4',
    ground: '#e4ecf4', speck: ['#c8d6e6', '#b7c9dd', '#f6fafd', '#a6b8d0'],
    lineA: '#3b7be0', lineB: '#dc4343', lineMid: '#3a4f6e', circle: '#3a4f6e', lane: '#8fb0d6',
    curb: '#3a4f6e', curbTop: '#5a7298', plinth: '#6c84aa', plinthTop: '#eef4fa', rock: '#7a90b4',
    stand: '#8aa0c4', standTop: '#e8f0f8',
    crowd: ['#dc4343', '#3b7be0', '#f3e9d2', '#2a2f4a', '#e8a93a'], skin: ['#f0caa6', '#e2a878'],
    flame: ['#fff4c0', '#ffb84a', '#ff7a3a'], post: '#2a3448', lantern: '#fff1c0',
    sun: '#ffffff', sunDir: [-0.4, 1, 0.6], ambSky: '#dfe8ff', ambGround: '#7a8aa8',
  },
};
