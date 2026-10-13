# Ghost Ball

In this football hot-potato survival game, the ball sticks to whoever it touches. Whoever holds it when the buzzer goes (or kicked it last, if it's loose) is out. Heroes have MOBA-style passives and attack/defense skills. It's built as a web prototype (Vite + three.js) in a pixel-isometric voxel style, aimed at iOS/iPadOS.

See **[docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)** for the full design.

## Run

```sh
bun install      # or: npm install
bun run dev      # or: npm run dev  → http://localhost:5173
```

| URL | What |
|---|---|
| `/` | Game: menu, mode + hero select, matches against bots (`?autoplay=1&hero=titan&mode=fuse` skips the menu) |
| `/editor.html` | Live tuning editor: every value, the skill animation timeline, compare draft vs locked, Lock |
| `/sheet.html` | Design sheet: colours, fonts, components, hero sprites, icons, VFX |

## Controls

| | Touch | Keyboard / mouse |
|---|---|---|
| Move | Joystick | WASD / arrows |
| A: pass (with ball) / dash (without) | A, hold to charge, drag to aim | J / Space / left click |
| B: skill (attack with ball, defense without) | B | K / Q / right click |
| C: item | C | L / E |

## Tuning → Lock → hand off

1. Tweak values in `/editor.html`. Changes are a **draft** (saved in localStorage) and sync live to any open game tab.
2. Press **Lock**. This writes `config/locked.json` (the new baseline) and `config/history/<timestamp>.json` (what changed).
3. Tell Claude *"apply my locked config"* to bake the values into the code defaults.

The Lock endpoint only exists on the dev server (`bun run dev`).

## Structure

```
index.html / editor.html / sheet.html   page entries
vite.config.js        multi-page build + /api/config lock endpoint (dev)
config/locked.json    locked tuning values (created by Lock)
config/history/       one snapshot per Lock
docs/GAME_DESIGN.md   design doc
src/core/schema.js    every tunable: default, range, label
src/core/config.js    defaults < locked < draft; live sync; lock()
src/engine/stage.js   renderer, iso ortho camera, pixel scale, shake, flash
src/engine/arena.js   procedural pitch, stands, crowd, torches
src/engine/themes.js  arena palettes (Sun Temple, Ego Lab, Frost Peak)
src/engine/hero-model.js  voxel hero rig, pose application, ghosts
src/engine/anim.js    poses, phase easing, locomotion cycle
src/engine/vfx.js     instanced particles, rings, beams, walls, shields
src/engine/props.js   ball, item crates, markers
src/game/heroes.js    hero roster, skills, phases (+ their tunables)
src/game/skills.js    skill gameplay hooked to animation phases
src/game/sim.js       match: rules, rounds, ball physics, items (60 Hz)
src/game/ai.js        bot holder / runner behaviour
src/game/input.js     keyboard, mouse, touch → intent
src/game/items.js     items (+ tunables)
src/game/modes.js     game-mode variants
src/ui/style.css      design system (tokens, components, HUD)
src/ui/tokens.js      ui.* config → CSS variables
src/ui/hud.js         in-match HUD + touch controls
src/ui/icons.js       12×12 pixel icons
src/ui/portrait.js    hero portraits / sprite frames (shared offscreen GL)
src/pages/game.js     game page
src/pages/editor.js   editor page
src/editor/lab.js     Skill Lab: loops an action on a lab-mode Match (draft vs locked lanes)
src/editor/editor.css editor chrome
src/pages/sheet.js    design sheet page
src/pages/sheet.css   design sheet layout
```
