// Game-mode variants. Each mode tweaks the core rule: whoever is stuck with
// the ball when it "goes off" is eliminated.
export const MODES = {
  classic: {
    name: 'Ghost Ball', tag: 'CLASSIC',
    desc: 'One ball, a round clock. When the buzzer hits, whoever holds the ball — or kicked it last if it\'s loose — is out.',
    balls: 1, timer: 'round', shrink: false, icon: 'ball',
    rules: ['Every round has a visible clock', 'Holding the ball at the buzzer: out', 'Loose ball at the buzzer: its last kicker is out', 'Last striker standing wins'],
  },
  fuse: {
    name: 'Hot Fuse', tag: 'VARIANT A',
    desc: 'The fuse burns fast while someone holds the ball and smoulders while it\'s loose. A loose ball drifts back to its kicker.',
    balls: 1, timer: 'fuse', shrink: false, icon: 'overclock',
    rules: ['No round clock: the ball carries its own fuse', 'Burns fast in your hands, slowly when loose', 'A loose ball drifts back to whoever kicked it', 'Whoever it blows up on is out'],
  },
  twin: {
    name: 'Twin Ego', tag: 'VARIANT B',
    desc: 'Two balls, more players, bigger pitch. Two people can drop out each round.',
    balls: 2, timer: 'round', shrink: false, playersBonus: 2, sizeMul: 1.2, icon: 'split',
    rules: ['Two balls live at once', 'Two more strikers, 20% bigger pitch', 'Up to two players drop each round', 'Watch both: the arrow points at the nearest'],
  },
  shrink: {
    name: 'Last Field', tag: 'VARIANT C',
    desc: 'The pitch shrinks after every elimination. Fewer places to run.',
    balls: 1, timer: 'round', shrink: true, icon: 'wall',
    rules: ['The red fence closes in after every round', 'Cover outside the fence stops mattering', 'Late rounds are knife fights', 'Same buzzer rule as Classic'],
  },
  sudden: {
    name: 'Sudden Death', tag: 'VARIANT D',
    desc: 'Hidden clock. The ball can go off anywhere between half and one-and-a-half rounds.',
    balls: 1, timer: 'hidden', shrink: false, icon: 'skull',
    rules: ['The clock is hidden: ??', 'It goes off between ½× and 1½× a normal round', 'Never hold it longer than you have to', 'The ball glows faintly the whole time'],
  },
};
