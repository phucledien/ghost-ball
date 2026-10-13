// Game-mode variants. Each mode tweaks the core rule: whoever is stuck with
// the ball when it "goes off" is eliminated.
export const MODES = {
  classic: {
    name: 'Ghost Ball', tag: 'CLASSIC',
    desc: 'One ball, a round clock. When the buzzer hits, whoever holds the ball — or kicked it last if it\'s loose — is out.',
    balls: 1, timer: 'round', shrink: false,
  },
  fuse: {
    name: 'Hot Fuse', tag: 'VARIANT A',
    desc: 'The fuse burns fast while someone holds the ball and smoulders while it\'s loose. A loose ball drifts back to its kicker.',
    balls: 1, timer: 'fuse', shrink: false,
  },
  twin: {
    name: 'Twin Ego', tag: 'VARIANT B',
    desc: 'Two balls, more players, bigger pitch. Two people can drop out each round.',
    balls: 2, timer: 'round', shrink: false, playersBonus: 2, sizeMul: 1.2,
  },
  shrink: {
    name: 'Last Field', tag: 'VARIANT C',
    desc: 'The pitch shrinks after every elimination. Fewer places to run.',
    balls: 1, timer: 'round', shrink: true,
  },
  sudden: {
    name: 'Sudden Death', tag: 'VARIANT D',
    desc: 'Hidden clock. The ball can go off anywhere between half and one-and-a-half rounds.',
    balls: 1, timer: 'hidden', shrink: false,
  },
};
