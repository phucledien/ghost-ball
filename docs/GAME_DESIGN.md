# Ghost Ball — Game Design Document

*Web prototype · target platforms: iOS / iPadOS · pixel-isometric voxel style*

> Every number in this doc is a **default** and lives in the config schema (`src/core/schema.js`, `src/game/heroes.js`, `src/game/items.js`). You can retune any of them live in the editor, and the key is given next to each value.

---

## 1. Pitch

Ghost Ball is a hot-potato survival game played with a football. Up to 12 strikers share a small arena with one ball and one round clock. The ball sticks to whoever it touches. When the buzzer goes, whoever is still holding it is eliminated. If the ball is loose or still in the air, the player who kicked it last is eliminated. Each hero brings a MOBA-style kit: a passive, an **attack skill** for when you hold the ball and a **defense skill** for when you're running from it. Rounds repeat until one striker is left: the Egoist.

### Pillars
1. **Every second is a decision.** Hold the ball to set up a pass, or get rid of it now? Dodge the pass, or block it?
2. **Readable chaos.** A chunky pixel-iso view, one clear "IT" marker and loud phase-based animations, so you can always tell who has the ball and what's about to happen.
3. **Ego over team.** No allies. Your kit is a personal weapon, and every elimination is a spotlight moment (slow-mo, voxel explosion, crowd roar).
4. **Tunable feel.** Every timing, force and effect can be edited live, then locked and shipped.

### Inspiration
The tension comes from "ego striker" survival anime, where everyone is a rival and your own tricks are all you have. All names, characters and kits are **original** and contain no IP from that genre. The art direction follows the reference clips the user shared: voxel models rendered at low resolution, nearest-neighbour upscaling, an orthographic isometric camera, a navy/gold UI and a pixel font.

---

## 2. Core rules (as built)

### Round flow
| Phase | What happens | Default |
|---|---|---|
| `intro` | Ball(s) handed to random players (gold pillar FX). Shows "READY" / "ROUND n". Contact checks run but nobody can act | 1.6 s first round, 1.1 s after |
| `play` | The clock runs. Everyone can act | `rules.roundTime` = **15 s** |
| `boom` | Buzzer: the ball explodes and the culprit is eliminated (slow-mo) | 1.6 s (0.6 s if nobody is out) |
| `inter` | Survivors regroup | `rules.intermission` × 0.5 = **1.3 s** |
| `over` | 1 player left → "EGOIST CROWNED" + victory flourish | — |

### Who gets eliminated
- **Ball held** at the buzzer → the **holder** is out.
- **Ball loose or in flight** → the **last passer** is out (if they're still alive).
- **Never everyone at once:** if the culprits would include every remaining player, one of them is spared.
- At most `min(mode balls, alive − 1)` balls are in play each round.

### Ball rules
| Rule | Meaning | Key / default |
|---|---|---|
| Auto-catch | A ball in flight or loose sticks to the **first player it touches**: horizontal distance < pickup radius and ball height < 1.8 + jump height | `ball.pickup` 0.75 |
| Catch lock | After receiving, you can't pass for a short time | `rules.catchLock` 0.4 s |
| Passer immunity | Your own pass can't stick to you straight away | `rules.passerImmune` 0.3 s |
| No pass-back | The player who passed to you is immune to your return pass | `rules.passBackImmune` 0.9 s |
| Flight → loose | The first hard ground bounce turns a pass into a loose ball that rolls with friction | `ball.friction` 3.4 |
| Walls | The ball bounces off the field edge (and off Titan's Rampart) | `ball.bounce` 0.62 |
| Re-grab | After your immunity ends you can pick up your own loose ball and pass it again. Bots do this when < 4 s remain | — |
| Danger glow | The ball and the ring under it pulse red as the clock runs down | `ball.danger` 4 s |

### Passing
- **Tap A** for a quick pass. **Hold A** to charge it: speed rises up to `ball.chargeMul` **1.6×** over `ball.chargeTime` **0.55 s**. You move at 55% speed while charging.
- Base speed is `ball.passSpeed` **16**, with an arc height of `ball.lobApex` **0.9**.
- **Aim assist** snaps to the best target inside a **24°** cone (`ball.aimAssist`) within **13 m** (`ball.aimRange`). It leads moving targets (60% velocity prediction). Cloaked and pass-back-immune players are ignored.
- Passes play the **Pass** action: windup 0.09 → strike 0.05 → follow 0.14 → recover 0.12 s. The ball leaves on **strike**.

### Movement
| | Key | Default |
|---|---|---|
| Run speed | `move.speed` | 6.2 |
| Accel / stop friction | `move.accel` / `move.friction` | 42 / 16 |
| Ball holder speed | `move.holderMul` | ×1.06 (the chaser is slightly faster) |
| Dash | `move.dashSpeed` / `dashTime` / `dashCd` | 22 / 0.14 s / 1.6 s cooldown |
| Body radius (soft collision) | `move.radius` | 0.45 |

### Items
Crates spawn every `rules.itemEvery` **6 s** (max `rules.maxItems` **3** on the field), away from players. Walk over one to pick it up. You carry **one** item at a time.

---

## 3. Roles & buttons

The same three buttons change meaning depending on whether you have the ball.

| Button | **Attacker** (holding the ball) | **Defender** (no ball) |
|---|---|---|
| **A** (gold) | Pass. Hold to charge, drag off the button to aim (touch) | Dash |
| **B** (ring: red when attacking, green when defending) | Hero **attack** skill | Hero **defense** skill |
| **C** (cream) | Use item | Use item |

The HUD shows a cooldown sweep on each button. While you're catch-locked, A reads "wait". While you hold the ball, a red vignette tightens around the screen.

## 4. Controls

| Action | Touch | Keyboard / mouse |
|---|---|---|
| Move | Left virtual joystick | WASD / arrows |
| Pass / dash | A (hold = charge, drag = aim) | J / Space / left click (aims at cursor) |
| Skill | B | K / Q / right click |
| Item | C | L / E |
| Menu | — | Esc |

Movement is camera-relative (it follows `camera.yaw`). Aim priority: mouse cursor (if moved in the last 2.5 s), then the touch aim drag, then the move direction, then facing.

---

## 5. Heroes

Each hero has a passive, an attack skill and a defense skill. Each skill is an animation built from **phases**. Phase types colour the editor timeline:
**HOLD** = anticipation (blue) · **FAST** = the snap (red) · **MOVE** = follow-through (tan).

| Hero | Title / role | Speed × | Passive | Attack (with ball) · cd | Defense (no ball) · cd |
|---|---|---|---|---|---|
| **NOVA** | The Architect · Playmaker | 1.00 | Metavision | Direct Volley · 9 s | Field Read · 11 s |
| **BOLT** | The Panther · Speedster | 1.00 (×1.10 passive) | Afterburn | Blitz Carry · 8 s | Panther Leap · 8 s |
| **TITAN** | The King · Bruiser | 0.94 | Royal Body | Predator Cannon · 11 s | Rampart · 12 s |
| **JINX** | The Monster · Trickster | 1.02 | Inner Monster | Phantom Pair · 9 s | Feint Step · 7 s |
| **ECHO** | The Trapper · Genius | 0.97 | Lazy Genius | Curve Ghost · 8 s | Perfect Trap · 10 s |
| **KAIZ** | The Emperor · Assassin | 1.00 | Magnus Field | Emperor Impact · 12 s | Crown Guard · 11 s |

Keys: `hero.<id>.speed`, `hero.<id>.atk.cd`, `hero.<id>.def.cd`, `hero.<id>.<slot>.<phase>`, `hero.<id>.<slot>.<param>`, plus `amp` (pose amplitude) and `fxScale` on every skill. Each round starts with skill cooldowns capped at 1.5 s.

### NOVA — The Architect
- **Passive · Metavision:** +18° aim-assist cone (`passive.aimBonus`) and +3 m assist range.
- **Attack · Direct Volley:** `read` HOLD 0.20 → `volley` FAST 0.05 → `follow` MOVE 0.18 → `recover` MOVE 0.14. A flat, near-instant pass at ×2.1 speed (`speedMul`) with full lead prediction (`lead` 1.0). The lane is telegraphed with a thin beam during *read*, and the strike adds a beam, a short hitstop and a zoom punch.
- **Defense · Field Read:** `focus` HOLD 0.12 → `pulse` FAST 0.06 → `recover` MOVE 0.10. Every other player **and the ball** run at ×0.4 time (`slow`) for 1.4 s (`dur`). The screen gets a hue-shift filter.
- **Counterplay:** Field Read doesn't stop a pass that's already about to hit. Bait the read, then pass after it ends.

### BOLT — The Panther
- **Passive · Afterburn:** permanent ×1.10 speed (`passive.speed`).
- **Attack · Blitz Carry:** `crouch` HOLD 0.10 → `blitz` FAST 0.34 → `skid` MOVE 0.16. Dash at speed 24 with the ball glued to your foot. The **first player you touch is IT**: they get knockback 5 and a 0.25 s stun. Shields reverse the blitz.
- **Defense · Panther Leap:** `crouch` 0.06 → `leap` FAST 0.32 → `land` 0.12. Leaps 6 m at height 1.6. You're **untouchable mid-air**, so passes sail underneath.
- **Counterplay:** sidestep the blitz line. A leap's landing spot is predictable.

### TITAN — The King
- **Passive · Royal Body:** immune to stun and knockback.
- **Attack · Predator Cannon:** `charge` HOLD 0.34 → `cannon` FAST 0.06 → `follow` 0.20 → `recover` 0.20. A flat ×2.4 cannon. The receiver is **stunned 0.9 s** (and catch-locked at least that long) and knocked back 7. Big shake, flash and hitstop. Titan barely moves while charging.
- **Defense · Rampart:** `stomp` HOLD 0.14 → `rise` FAST 0.08 → `settle` 0.18. Raises a stone wall 3.4 m long, 1.5 m ahead, for 3 s. Balls under 1.6 m high bounce off, and players can't walk through it.
- **Counterplay:** the 0.34 s charge is the tell, so dash during it. Walls also block Titan's own lanes.

### JINX — The Monster
- **Passive · Inner Monster:** catch lock ×0.45 (`passive.lockMul`). Jinx re-passes almost instantly.
- **Attack · Phantom Pair:** `twirl` HOLD 0.16 → `split` FAST 0.05 → `follow` 0.16. The real ball goes on the aimed line, plus **2 decoys** fanned out at 26° steps. Decoys look identical and pop on contact, on landing or after 1.6 s.
- **Defense · Feint Step:** `fade` 0.05 → `blink` FAST 0.03 → `reappear` 0.14. Teleports 4.2 m in your move direction with 0.15 s invulnerability, leaving an afterimage behind.
- **Counterplay:** decoys never stick. Watch for the ball that's still flying after the others pop.

### ECHO — The Trapper
- **Passive · Lazy Genius:** cooldowns recover ×2.2 while you stand still.
- **Attack · Curve Ghost:** `lean` HOLD 0.16 → `whip` FAST 0.05 → `follow` 0.20. Kicked about 40° off-line, then **homes** in (strength 7) at ×1.25 speed. It's a low lob that skims until it arrives. Uses a wide 40° extra assist cone.
- **Defense · Perfect Trap:** `stance` 0.05 → `window` HOLD 0.45 → `recover` 0.15. During the window, a ball that touches Echo is **fired straight back out** at the nearest other player (×1.8, light homing) and Echo becomes the last passer. A short hitstop and flash play.
- **Counterplay:** the window is short. Delay your pass, or use it on a target the trap can't redirect into you.

### KAIZ — The Emperor
- **Passive · Magnus Field:** while Kaiz holds the ball, rivals within 3.5 m move at ×0.8.
- **Attack · Emperor Impact:** `vanish` HOLD 0.12 → `strike` FAST 0.05 → `crown` MOVE 0.32. Teleports behind the nearest valid rival within 7 m and **forces a catch** (0.35 s stun, knockback 4). If no one is in range, the skill doesn't fire and goes on no cooldown.
- **Defense · Crown Guard:** `raise` FAST 0.08 → `guard` HOLD 0.20 → `release` 0.12. A shield bubble for 1.5 s that bounces balls away.
- **Counterplay:** keep more than 7 m away when Kaiz has the ball. Cloak and leap make you untargetable.

---

## 6. Items

| Item | Effect | Params (key `item.<id>.*`) |
|---|---|---|
| **Spring Cleats** | Speed boost | `dur` 3.5 s, `speed` ×1.45 |
| **Ego Shield** | The next ball that touches you bounces off | `dur` 6 s max |
| **Magnet Lace** | Your next assisted pass homes in | `homing` 9 |
| **Cloak Flare** | Aim assist, Kaiz's Impact and bots ignore you; your model flickers for others | `dur` 3 s |
| **Freeze Whistle** | Freezes everyone nearby | `radius` 4, `dur` 1 s |
| **Overclock** | Resets skill + dash cooldowns | — |

Each item can be switched off with `item.<id>.on`.

---

## 7. Variants

### Game modes (`rules.mode`)
| Mode | Tag | What changes | Design intent | Risk |
|---|---|---|---|---|
| **Ghost Ball** | CLASSIC | 1 ball, 15 s round clock | The core read of the game | Can get passive in big lobbies |
| **Hot Fuse** | VARIANT A | No round clock. Each ball has a fuse (`rules.fuseTime` **10 s**) that **burns at full speed while held** and smoulders at `rules.fuseLooseBurn` **0.4×** while loose or in flight. When it hits 0 the holder (or the last passer, if it's loose) is out on the spot. A loose ball drifts back to its kicker after 1 s | Rewards fast, constant passing, and punishes anyone who sits on the ball | Ping-pong stalling (limited by the pass-back window) |
| **Twin Ego** | VARIANT B | 2 balls, +2 players, a 1.2× bigger pitch. Up to 2 eliminations per round | Chaos and crossfire. Shorter matches for big lobbies | Hard to read. Needs a stronger IT marker |
| **Last Field** | VARIANT C | The pitch shrinks by `rules.shrinkPerRound` **12%** each round (down to 40%), with a red fence | A battle-royale endgame squeeze | Late rounds can feel cramped |
| **Sudden Death** | VARIANT D | Hidden clock (timer shows `??`), a random length of 0.5–1.5× the round time. The ball pulses all round | Paranoia: you can never "safely" hold the ball | Can feel random. Consider audio tells |

### Arena themes (`arena.theme`)
| Theme | Look |
|---|---|
| **Sun Temple** (`temple`) | Sand pitch on a cliff-top temple, blue/red halves, torches, lantern strings, a roaring crowd, lavender cliffs. Matches the reference |
| **Ego Lab** (`egolab`) | A night training facility: mown turf, cyan lines, navy stands, blue-white "flames" (floodlights) |
| **Frost Peak** (`frost`) | A packed-snow pitch above the clouds, slate curbs, cold palette |

Size and dressing: `arena.width` 26, `arena.depth` 16, `arena.crowd` 1.0, `arena.lights` on.

---

## 8. Feel / juice spec

| Effect | Behaviour | Key / default |
|---|---|---|
| Pixel look | Renders at `screen / pixelScale` and is upscaled with `image-rendering: pixelated`. The camera snaps to the texel grid to stop shimmer | `render.pixelScale` 3 |
| Camera | Orthographic iso at pitch 36°, yaw 45°, half-height 9.5. Follows you, biased 30% toward the ball | `camera.*` |
| Hitstop | Sim freezes on a catch, scaled by ball speed (×≤1.6). Skills add their own (0.05–0.09 s) | `fx.hitstop` 0.05 s |
| Screen shake | Trauma model: offset ∝ trauma², decays 1.8/s. Pass 0.12–0.27, cannon 0.7, elimination 0.75 | `fx.shake` ×1 |
| Flash | Full-screen screen-blend flash | `fx.flash` 0.35 |
| Elimination slow-mo | Game speed ×0.3 for 0.7 s. Shock (HOLD) → burst (FAST, voxel shatter + pillar + rings) → scatter | `fx.slowmo`, `fx.slowmoTime`, `anim.elim.*` |
| Zoom punch | Brief zoom-in on big hits | — |
| Stepped animation | Poses update at N fps ("on twos" = 30, "on threes" = 20) | `render.animFps` 60 |
| Smears & afterimages | Flat-colour ghost clones during dashes, blitz, leap and blink. Beam smears | `fx.smears` on |
| Particles | Instanced voxel particles (solid + additive glow), 2600 per pool | `fx.particles` ×1, `fx.trail` ×1 |
| Crowd | The crowd bobs, and jumps hard on eliminations | — |
| Colour grade | CSS saturate / contrast on the canvas | `render.saturate` 1.12, `render.contrast` 1.04 |

**Phase grammar:** every action is HOLD (anticipation, ease-out cubic) → FAST (the snap, ease-out quad) → MOVE (follow-through, ease-in-out sine). Pose amplitude (`amp`) scales every pose relative to idle.

---

## 9. Tuning workflow

1. Open **`/editor.html`**. Every schema key has a control, and the viewport runs the real engine.
2. Edits go into a **draft**, which is saved in `localStorage` and broadcast over `BroadcastChannel('ghostball-config')`. **Any open game tab updates live** and shows a "DRAFT · n UNLOCKED CHANGES" badge.
3. Press **Lock**. The dev server (`POST /api/config`) writes:
   - `config/locked.json`: the full value set, which becomes the new baseline for everyone.
   - `config/history/<timestamp>.json`: values + the list of changes + a note.
4. **Hand off to Claude:** say *"apply my locked config"*. Claude reads `config/locked.json` and the latest history diff, then bakes the values into the defaults in `src/core/schema.js` / `src/game/heroes.js` / `src/game/items.js`, so they ship in the build.

Layering: schema defaults < `locked.json` < draft.

---

## 10. iOS / iPadOS path

**Recommendation: wrap the web build with Capacitor first.**
- It's the fastest path to TestFlight: the same Vite build, no rewrite, and three.js runs in WKWebView with WebGL2.
- Use the `@capacitor/haptics` plugin. Haptic hook points already exist as match events: `catch` (medium), `pass` (light), `elim`/`elimBurst` (heavy), `deflect`, `trap`, `skill`.
- Later alternatives: a native **SpriteKit/SceneKit** (or RealityKit) port for battery life, or a **Unity** port if online multiplayer needs a mature netcode stack. Decide after the vertical slice.

**Performance budget (target 60 fps on A14+):**
- The pixel scale is the main lever: pixelScale 3 renders about 1/9 of the screen pixels.
- One 2048² shadow map (BasicShadowMap). Drop it to 1024 or turn off `render.shadows` on low-end devices.
- Particles and crowd are instanced (2 draw calls per pool). Hero meshes share cached geometry and materials.
- Portraits use **one** shared offscreen WebGL context, which keeps the context count low on iOS.

**Platform details:**
- `viewport-fit=cover` + `env(safe-area-inset-*)` are already used on HUD edges.
- **Bundle the fonts locally** (Silkscreen, Pixelify Sans, both under the OFL licence). The prototype loads them from Google Fonts.
- **Landscape first** for phones (the joystick and buttons are thumb-reachable). iPad works in both orientations. Portrait phone needs a tighter camera zoom; the editor's Phone frame previews this.
- Pause on `visibilitychange`, and lock orientation in Capacitor config.

---

## 11. Decisions made (open to revisit)

- **Passing is the main transfer.** The only other ways are Bolt's Blitz Carry (touch tag) and Kaiz's Emperor Impact (forced catch). Walking into someone does nothing.
- **Contact auto-catch.** You can't refuse a ball; you can only dodge, block (shield, crown, wall), leap or trap it.
- **Loose-ball blame stays with the kicker**, so a missed pass is risky. That's why the kicker can re-grab it.
- **Bots only.** There's no online or local multiplayer yet.
- **One item slot**, auto-pickup.
- **Holder is faster (×1.06)**, so the chaser can close distance.
- **Skill cooldowns persist between rounds** but are capped to 1.5 s at round start.
- Hero names and looks are original placeholders, ready for an art pass.

## 12. Future / not built yet
- Online multiplayer (authoritative server with fixed 60 Hz sim, which the sim already uses) and private lobbies.
- Ranked "Ego Rating", hero unlocks and cosmetics (boots, hair dyes, celebration emotes).
- Ultimate skills charged by successful passes / dodges.
- Audio: buzzer, crowd swells, per-skill stingers, and a ticking audio tell for Sudden Death.
- Portrait-phone camera mode, an accessibility colour-blind IT marker, and a tutorial.
- More arenas (rooftop, rain night) and hazards (sprinklers, moving walls).

## 13. Roadmap
| Stage | Goal | Exit criteria |
|---|---|---|
| **Prototype** (now) | Web: core loop, 6 heroes, 6 items, 5 modes, 3 arenas, live editor, design sheet | The core read ("pass or hold?") is fun with bots |
| **Vertical slice** | Capacitor iOS build, final art pass on 2 heroes + 1 arena, audio, haptics, onboarding | 10-minute sessions on device at 60 fps, positive playtest |
| **Multiplayer** | Server-authoritative netcode, matchmaking, lobbies | 8-player matches at < 120 ms with rollback-free pass feel |
| **Soft launch** | Progression, cosmetics, analytics | D1/D7 retention targets |
