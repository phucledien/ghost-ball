// Procedural pose animation for voxel heroes.
// A pose is a bag of joint angles (radians) + body offsets. Actions are a list
// of phases; each phase eases from the previous phase's pose into its own.

export const POSE_KEYS = ['y', 'squash', 'lean', 'twist', 'head', 'hipL', 'hipR', 'kneeL', 'kneeR', 'shL', 'shR', 'shLz', 'shRz', 'elL', 'elR'];

const P = (o) => Object.fromEntries(POSE_KEYS.map((k) => [k, o[k] ?? (k === 'squash' ? 1 : 0)]));

// Conventions: hip/shoulder +x = swing forward; knee/elbow + = bend;
// shLz/shRz + = arm raised out to the side; lean + = forward; twist + = turn left.
export const POSES = {
  idle: P({ shLz: 0.12, shRz: 0.12, elL: 0.2, elR: 0.2 }),
  coil: P({ y: -0.08, squash: 0.92, lean: -0.18, twist: -0.45, head: 0.15, hipL: 0.2, kneeL: 0.35, hipR: -0.95, kneeR: 1.3, shL: 0.9, shLz: 0.7, shR: -0.7, shRz: 0.3, elL: 0.4, elR: 0.6 }),
  kick: P({ y: 0.02, squash: 1.03, lean: 0.28, twist: 0.35, head: 0.1, hipL: -0.1, kneeL: 0.2, hipR: 1.35, kneeR: 0.1, shL: -0.7, shLz: 0.8, shR: 0.8, shRz: 0.5, elL: 0.3, elR: 0.3 }),
  follow: P({ y: 0.08, squash: 1.04, lean: 0.35, twist: 0.55, head: 0.05, hipL: -0.2, kneeL: 0.25, hipR: 1.9, kneeR: 0.05, shL: -0.4, shLz: 1.1, shR: 0.5, shRz: 1.0, elL: 0.2, elR: 0.2 }),
  crouch: P({ y: -0.18, squash: 0.82, lean: 0.4, head: -0.25, hipL: 0.6, kneeL: 1.0, hipR: 0.6, kneeR: 1.0, shL: -0.8, shR: -0.8, shLz: 0.25, shRz: 0.25, elL: 0.5, elR: 0.5 }),
  sprint: P({ y: 0.02, squash: 1.04, lean: 0.62, head: -0.35, hipL: 1.1, kneeL: 0.5, hipR: -0.9, kneeR: 1.3, shL: -1.1, shR: 1.2, shLz: 0.15, shRz: 0.15, elL: 1.2, elR: 1.2 }),
  skid: P({ y: -0.1, squash: 0.9, lean: -0.38, twist: 0.3, hipL: 0.95, kneeL: 0.15, hipR: -0.4, kneeR: 0.7, shL: 0.6, shR: 0.4, shLz: 1.2, shRz: 1.2, elL: 0.3, elR: 0.3 }),
  leap: P({ y: 0.05, squash: 1.12, lean: 0.3, head: -0.2, hipL: 1.2, kneeL: 1.5, hipR: -0.6, kneeR: 0.9, shL: 2.5, shR: 2.3, shLz: 0.4, shRz: 0.4, elL: 0.2, elR: 0.2 }),
  land: P({ y: -0.2, squash: 0.78, lean: 0.35, head: -0.2, hipL: 0.7, kneeL: 1.2, hipR: 0.5, kneeR: 1.2, shL: 0.3, shR: 0.3, shLz: 1.0, shRz: 1.0, elL: 0.4, elR: 0.4 }),
  flex: P({ y: 0.06, squash: 1.08, lean: -0.15, head: -0.3, shLz: 1.45, shRz: 1.45, elL: 1.5, elR: 1.5, shL: 0.2, shR: 0.2 }),
  twirl: P({ y: 0.04, twist: 2.9, lean: 0.15, hipR: 0.7, kneeR: 0.9, shLz: 1.35, shRz: 1.35, elL: 0.1, elR: 0.1 }),
  stompUp: P({ y: 0.06, squash: 1.05, lean: -0.12, hipR: 1.6, kneeR: 1.7, hipL: 0, kneeL: 0.1, shL: 1.3, shR: 1.3, shLz: 0.6, shRz: 0.6, elL: 0.9, elR: 0.9 }),
  stomp: P({ y: -0.16, squash: 0.82, lean: 0.32, head: -0.2, hipR: 0.2, kneeR: 0.3, hipL: -0.15, kneeL: 0.6, shL: -0.3, shR: -0.3, shLz: 0.8, shRz: 0.8, elL: 0.3, elR: 0.3 }),
  trap: P({ y: -0.1, squash: 0.9, lean: -0.22, head: 0.15, hipL: 0.45, kneeL: 0.7, hipR: 0.35, kneeR: 0.7, shL: 0.5, shR: 0.5, shLz: 1.05, shRz: 1.05, elL: 0.3, elR: 0.3 }),
  guard: P({ y: -0.05, squash: 0.95, lean: 0.12, head: 0.2, hipL: 0.25, kneeL: 0.5, hipR: -0.15, kneeR: 0.4, shL: 2.0, shR: 2.0, shLz: -0.35, shRz: -0.35, elL: 1.6, elR: 1.6 }),
  absorb: P({ y: -0.1, squash: 0.88, lean: -0.18, head: 0.2, hipL: 0.1, kneeL: 0.4, hipR: 0.65, kneeR: 0.9, shLz: 0.75, shRz: 0.75, shL: 0.3, shR: 0.3, elL: 0.4, elR: 0.4 }),
  shock: P({ y: 0.16, squash: 1.14, lean: -0.25, head: -0.4, shL: 2.8, shR: 2.8, shLz: 0.5, shRz: 0.5, hipL: 0.3, hipR: -0.3, kneeL: 0.4, kneeR: 0.4 }),
  blown: P({ y: 0.3, squash: 1.2, lean: -0.6, head: -0.5, shL: 3.0, shR: 3.0, shLz: 0.9, shRz: 0.9, hipL: 0.8, hipR: -0.6 }),
  stun: P({ y: -0.06, squash: 0.94, lean: -0.3, head: 0.35, shLz: 0.5, shRz: 0.5, elL: 0.8, elR: 0.8, kneeL: 0.3, kneeR: 0.3 }),
};

const ease = {
  hold: (u) => 1 - Math.pow(1 - u, 3),
  fast: (u) => 1 - Math.pow(1 - u, 2),
  move: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
};

export function lerpPose(a, b, u, out = {}) {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * u;
  return out;
}

export function scalePose(p, amp, out = {}) {
  const idle = POSES.idle;
  for (const k of POSE_KEYS) out[k] = idle[k] + (p[k] - idle[k]) * amp;
  return out;
}

export function totalDuration(phases) {
  return phases.reduce((s, p) => s + p.dur, 0);
}

// Locate the phase at time t. Returns { index, phase, u (0..1), start }.
export function phaseAt(phases, t) {
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const d = phases[i].dur;
    if (t < acc + d || i === phases.length - 1) {
      return { index: i, phase: phases[i], u: d > 0 ? Math.min(1, Math.max(0, (t - acc) / d)) : 1, start: acc };
    }
    acc += d;
  }
  return { index: 0, phase: phases[0], u: 0, start: 0 };
}

// Pose for an action at time t, blending from `from` (usually locomotion pose).
export function actionPose(phases, t, amp = 1, from = POSES.idle, out = {}) {
  const { index, phase, u } = phaseAt(phases, t);
  const prev = index === 0 ? from : scalePose(POSES[phases[index - 1].pose] || POSES.idle, amp);
  const target = scalePose(POSES[phase.pose] || POSES.idle, amp);
  return lerpPose(prev, target, (ease[phase.type] || ease.move)(u), out);
}

// Running / idle cycle. phase advances with distance travelled.
export function locomotionPose(speedNorm, cyc, stride = 1, bob = 1, out = {}) {
  const s = Math.min(1, speedNorm);
  const sw = Math.sin(cyc) * 0.95 * stride * s;
  const breathe = Math.sin(cyc * 0.35) * 0.02 * (1 - s);
  out.y = (Math.abs(Math.sin(cyc)) * 0.09 * bob - 0.03) * s + breathe;
  out.squash = 1 + Math.abs(Math.cos(cyc)) * 0.04 * bob * s;
  out.lean = 0.22 * s;
  out.twist = Math.sin(cyc) * 0.12 * s;
  out.head = -0.08 * s;
  out.hipL = sw;
  out.hipR = -sw;
  out.kneeL = Math.max(0, -Math.cos(cyc)) * 1.1 * s * stride + 0.05;
  out.kneeR = Math.max(0, Math.cos(cyc)) * 1.1 * s * stride + 0.05;
  out.shL = -sw * 0.9;
  out.shR = sw * 0.9;
  out.shLz = 0.12 + 0.1 * s;
  out.shRz = 0.12 + 0.1 * s;
  out.elL = 0.2 + 0.9 * s;
  out.elR = 0.2 + 0.9 * s;
  return out;
}

// Angular "pose speed" between two poses — drives the editor's speed curve.
export function poseDelta(a, b) {
  let s = 0;
  for (const k of POSE_KEYS) {
    const w = k === 'y' ? 6 : k === 'squash' ? 4 : 1;
    s += Math.abs((a[k] - b[k]) * w);
  }
  return s;
}
