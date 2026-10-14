# Ghost Ball art production — 14 October 2026

All six heroes now have editable Blender masters, character-specific movement, ten actions in eight directions, layered Aseprite sources and runtime exports. Temple, Ego Lab and Frost received coordinated scenery treatments. The game has four core contact cues, twelve skill motifs and twenty-one authored 16×16 icons.

Open `/art.html` for the original / live master / finished sprite comparison. Use `/?autoplay=1&hero=echo&map=frost&art=master` to play; `art=legacy` selects the original geometry. `/device.html` runs a repeatable three-arena measurement.

## Renderer decision and limits

The game uses live Blender-authored geometry. This preserves arbitrary facing, depth behind cover, editor orbit views and supported recolours. Baked sprites are available in the comparison lab, not substituted for match rendering. All 42 catalog options now attach to the master rig across all six heroes. Saved outfits retain the new style; the legacy renderer is available only as an explicit comparison setting.

The sprite output has fixed pixels, binary alpha, a limited palette and nearest filtering. It is render-derived art with an authored finishing process, not 2,880 individually hand-painted drawings. The finishing layer adds a one-pixel outer ink contour and merges isolated shadow pixels under conservative neighbourhood rules. Per-frame corrections can be supplied as `art/specs/{hero}-pixel-patches.json`; none were needed for detached pixels or clipping in this pass. Small eye/brow changes during motion remain a normal target-resolution rasterization limitation. The live 3D view can still shimmer during subpixel motion; no claim of universally pixel-perfect rendering is made.

A physical iPhone 16e run was attempted, but Apple device tooling rejected it because Developer Mode is disabled. No physical-phone performance result is claimed. Browser viewport QA is separate. The Site's Device Check can run directly in Safari without developer tooling; it records frame intervals and interruptions and offers a local JSON download. Physical touch/readability and thermal performance remain unverified.

## Sources and coverage

For each of `nova`, `bolt`, `titan`, `jinx`, `echo`, `kaiz`:

- `art/source/{hero}/{hero}-master.blend`: rigid-joint geometry, named pivots, keyed poses, camera and palette setup.
- `art/source/{hero}/{hero}-cleanup.aseprite`: 480 frames, 80 action/facing tags, timing, foot-anchor slice and two populated layers: Blender palette base and pixel finish.
- `art/specs/{hero}-clips.json`: base and character-specific poses, durations and events. `roster-clips.json` supplies the comparison lab.
- `art/specs/{hero}-camera-palette.json`: palette and camera contract.
- `src/engine/assets/{hero}-master.json`: geometry and rig used by Three.js.
- `public/assets/heroes/{hero}/{hero}-preview.glb`: unanimated geometry interchange reference.
- `public/assets/heroes/{hero}/{hero}-atlas.json` and two PNG pages: runtime sprites, metadata and checksums. Base-only pages support the lab's finishing toggle.

Generated boards under `art/source/nova/` and `art/source/roster/` are design references. Exact generation prompts accompany the roster boards. Blender geometry resolves inconsistent generated details; board role labels do not change gameplay classes.

| Action | Frames per facing | Timing |
| --- | ---: | --- |
| Idle | 4 | 150 ms each, looping |
| Run | 8 | 75 ms each, looping |
| Pass | 6 | Strike begins at 90 ms; contact held for 50 ms |
| Catch | 4 | Catch marker on first frame |
| Dash | 6 | Burst marker on third frame |
| Hit | 4 | Hit marker on first frame |
| Out | 8 | Burst marker on fourth frame |
| Win | 6 | 140 ms each, looping |
| Attack | 8 | Existing hero skill phases and durations |
| Defense | 6 | Existing hero skill phases and durations |

60 frames × 8 directions × 6 heroes = 2,880 frames. Nova has balanced movement; Bolt leans forward with compact arms; Titan uses broader, heavier movement; Jinx is asymmetric; Echo has relaxed shoulders and scarf motion; Kaiz stays upright. Grounded locomotion uses two-bone leg IK and articulated ankles; the gait phase follows distance actually travelled. Collision dimensions and skill mechanics remain independent of these visual proportions.

## Pixel and runtime contract

Y up, +Z forward, metres; orthographic camera pitch 36°, yaw 45°. Cells are 96×96 at 24 pixels/world unit, anchor (48,70). Eight facing rotations advance in 45° steps. Use 24 px/unit for native scale or 48 for exact 2× inspection.

Each hero has a 2048×2048 page and a 1024×1024 page: **20 MiB of RGBA pixels**. The lab loads only the selected hero's two pages and disposes replaced textures. This excludes geometry, buffers and other renderer resources. Files have hard alpha, a fixed per-hero palette, two transparent padding pixels, nearest filters and no mipmaps. PNG compression size is not GPU storage.

`heroPose` supplies character movement to both live rigs and sampled clips. `authoredFor` prevents applying adjustments twice. `buildHero`, `applyPose`, `footWorld`, afterimages and elimination fragments remain compatible. Attack/defense preview poses are sampled from existing skill phases; gameplay events retain their original simulation timing.

## Arenas, effects and icons

Temple uses broad sand/slate masses, capped walls, perimeter pavers and grouped grass. Ego Lab uses cool floor panels, steel crates, octagonal terminals and static floodlights. Frost uses tiered pines, blue-grey rocks, capped ice and sparse broad snow shapes. Terrain rules and collision definitions are preserved.

The football has a bright surface, dark outline and existing heat pulse. Core cues are kick slash, catch brackets, dash chevrons and elimination star. Each of the twelve skills has a distinct motif emitted at its designated action phase. Effects use stepped shape animation and clean up owned geometry/materials. The icon family contains six items, twelve skills and ball/crown/skull, drawn on explicit 16×16 grids with integer display sizes.

## Reproduction and safe storage

All generated renders, build output, caches, QA and temporary exports live in real local `~/Library/Developer` paths, outside iCloud. Vite defaults to `~/Library/Developer/CodexBuilds/ghost-ball/{dist,vite-cache}`. Verify resolved destinations when overriding `GHOST_BUILD_DIR` or `GHOST_VITE_CACHE`.

Installed authoring tools: Blender 4.5.14 under `~/Library/Developer/Tools/Blender-4.5.14.app`; Aseprite 1.3.18.6 in Applications; Pillow environment `~/Library/Developer/Tools/ghost-ball-art-python`; Playwright in `~/Library/Developer/Tools/ghost-ball-qa`.

```sh
node tools/art/sample-roster.mjs
~/Library/Developer/Tools/Blender-4.5.14.app/Contents/MacOS/Blender --background --python tools/art/build-hero.py -- --hero bolt --force --bake
~/Library/Developer/Tools/ghost-ball-art-python/bin/python tools/art/pack-hero.py --hero bolt
/Applications/Aseprite.app/Contents/MacOS/aseprite --batch \
  --script-param source="$HOME/Library/Developer/CodexBuilds/ghost-ball-art/renders/bolt-import.png" \
  --script-param finish="$HOME/Library/Developer/CodexBuilds/ghost-ball-art/renders/bolt-corrections.png" \
  --script-param tags="$HOME/Library/Developer/CodexBuilds/ghost-ball-art/renders/bolt-tags.json" \
  --script-param dest=/absolute/new/bolt-cleanup.aseprite \
  --script tools/art/make-hero-source.lua
npm run build
```

Choose any hero ID above. `--force` deliberately replaces the master; omit it to protect an existing file. Preserve independently edited Blender sources before rebuilding from the construction script. Aseprite creation also refuses overwriting unless `force=true` is supplied. Once manual pixels are edited, export and repack the edited source rather than replacing it with generated layers. `sample-nova.mjs` is a legacy first-slice script; use `sample-roster.mjs` for the current ten-action contract.

## Verification and evidence

The production Vite build passes; its shared Three.js/art chunk remains over the advisory 500 KB threshold. All 2,880 boot sockets agree with live authored poses within 0.000001 world units. Contact boundaries, all six alternate kits and legacy fallbacks, refresh state, afterimages, fragments and core effect cleanup pass. All 2,880 Aseprite composites exactly match runtime pixels; tags, durations, pivots and both atlas page sets pass verification. Atlas review found no tiny detached alpha components or clipped silhouettes. The lab passes desktop and 390×844 browser layout/control checks. All 21 icon grids and their 16/32/64 pixel browser outputs pass checks. All twelve actual skills fire the expected phase motif once, then expire and dispose their resources. Three arenas run fourteen players, all six masters and two balls. Phone-width menus, selection-to-match flow and the editor drawer pass without page errors. A 390×844 desktop Chromium measurement recorded 16.7 ms median and 33.3 ms p95 frame delivery in each arena; this is not physical-phone performance.

```sh
~/Library/Developer/Tools/ghost-ball-art-python/bin/python tools/art/verify-assets.py
node tools/art/verify-icons.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Developer/Tools/playwright-browsers" node tools/art/verify-browser.mjs
```

QA evidence is stored under `~/Library/Developer/CodexBuilds/ghost-ball-art/qa/`; selected non-sensitive results and editable sources are available on the art Site. Device labels are user-supplied. A narrow desktop viewport is never recorded as a verified phone.

## Phone clarity revision 5

A physical iPhone screenshot revealed that the default 3× CSS pixel enlargement left faces and limbs undersampled, even though the user reported that frame rate felt good. The game now defaults to one render pixel per CSS pixel on narrow screens and short coarse-pointer landscape screens. A 390×800 game viewport therefore renders 390×800 instead of 130×266. Field of view, model sizes and gameplay are unchanged. This is nine times the render-pixel area, not nine times the total GPU workload; actual device performance must be checked again.

Explicit Fine/Classic/Chunky choices are respected, and Settings now exposes Sharp (1×) on every device. Desktop defaults and exact-scale Art Lab controls are unchanged. A gold silhouette reveals only the local player's occluded parts: scenery draws first, the depth-tested silhouette second, and visible player surfaces last. Pixel comparison verifies no colour change for an unobstructed hero. The overlay borrows geometry and restores original draw order when removed.

`tools/art/verify-phone-clarity.mjs` checks portrait/landscape defaults, explicit settings, desktop defaults, visibility disposal/order restoration, zero uncovered-pixel changes and positive coverage behind a test wall. QA captures and performance results remain in the local Developer directory. Device Check identifies this build as `phone-clarity-5` and records actual render size/pixel scale. Millisecond intervals are rounded to 0.001 ms before threshold comparisons to avoid floating-point false failures at exactly 33.4 ms. Browser verification does not certify physical Safari appearance or performance.


## Arena and motion revision 6

Temple now has stepped paving, recessed teal columns, sandstone entry architecture and banners. Ego Lab has a dark modular floor and technical gantry; Frost has packed-snow margins, ice seams and faceted alpine peaks. Interlocking cliff columns replace scattered foundation cubes. Floor textures and geometry are deterministic. The three static arena batches and animated torch counts remain unchanged. Collision layouts and terrain rules are preserved; obstacle art fits its existing collider and height within floating-point tolerance (<0.000001 units).

Six version-3 Blender masters add ankle pivots. At steady full-speed forward travel, support feet remain stationary in world space; short flight intervals separate contacts. Starts, braking and turning still blend through the gait. Dust follows footfall crossings. Generic passes and Kaiz's strike show the contact pose before launching from the boot socket. Catches enter the absorb pose before hitstop. Event timings remain simulation-driven: a nominal 90 ms pass contact occurs at the next simulation tick (100 ms at 60 Hz).

On compact screens, labels prioritize YOU, ballholders and up to three nearby rivals. Distance hysteresis reduces flicker; screen collision checks suppress overlapping optional names. All fourteen portrait entries remain available. Twin balls have separate numbered off-screen arrows. Desktop names remain visible.

Rebuilt all 2,880 frames and all six editable Blender/Aseprite sources. Pixel, socket, fallback, visibility and action tests pass. `tools/art/verify-motion.mjs` checks planted-sole travel, launch contact and catch hitstop. Map/HUD evidence and the production performance report are downloadable on the Site. Device Check reports `arena-motion-6`. The user confirmed that revision 5 looks better on iPhone; revision 6 still requires on-device feedback. Desktop Chromium measurements do not establish physical iPhone performance.


## Readability and controls revision 7

Every catalog hairstyle, eyewear, headwear, accessory, boot and kit now uses the new master. `master-cosmetics.js` provides explicit angular geometry and normalized transfers of the six signature hair silhouettes. Per-pivot merging preserves at most 14 character meshes in tested options. The baked signature sheets and Blender masters remain editable references; interchangeable custom parts are source-controlled runtime geometry. Portraits, roster thumbnails and match models all receive the same saved outfit.

Mode selection uses a centered 1,220px maximum-width layout with a rule illustration and short mode summaries. Arena selection uses actual clean in-game renders, with a collapsible tactical layout; dimensions still derive from the selected mode. Portrait and short landscape layouts keep the start/next control reachable.

Each real ball records last touch independently from elimination responsibility. Catches, kicks and shield deflections update the touch record; the existing buzzer rule still uses the holder or last kicker. HUD cards label both, while player tags and roster portraits mark the relevant players. Twin balls retain separate numbered cards and edge arrows.

Equipped items show their name, action, configured duration and consumption condition. Active effects have countdown bars and distinct geometry: shield arcs, speed chevrons, cloak brackets, magnet and freeze symbols. Magnet stays ready until a targeted pass consumes it. Freeze Whistle reports the number of affected rivals; Overclock confirms cooldown reset. Persistent effect geometry disposes on expiry, consumption, death, removed players and match cleanup.

Input is latched from browser events so taps between render frames survive. The match queues presses for 200ms across zero-step frames, impact pauses and short action recovery. Actions are consumed once, movement stays independent, and expired presses do not fire after long cooldowns/stuns. Blur, hidden documents and menu transitions clear input. Key releases always clear held keys; touch pointers retain separate ownership and reset on lost capture.

Verification: 252 individual cosmetic options, 384 mixed outfits, 1,152 animated-fragment cases; 60/144Hz simultaneous input, fast taps, hitstop, recovery, expiry and multi-touch; all six item behaviors, last-touch versus buzzer responsibility, customized menu-to-match flow; desktop 1920px and phone portrait/landscape screenshots. Browser evidence is under `qa/revision7`; physical keyboard rollover and actual iPhone sustained performance are not inferred from emulation. Device Check identifies `readability-controls-7`.

## Animated VFX and interactive showcase revision 8

The Site now opens on an interactive showcase instead of the chronological planning document. Five sections expose the live assets: character actions/facing/cosmetics, 22 sound effects and two music loops, six item effects, all twelve skill casts, and all four arena layouts. Playback includes pause, replay, 0.25–2× speed, frame scrubbing, backdrop selection and phone framing. The complete original plan remains at `plan.html`; the sprite comparison lab, device check and playable match remain available.

The VFX direction was generated with the built-in image generation tool. Its unmodified reference is `art/reference/vfx-direction-v8.png`; the exact prompt is `art/reference/vfx-direction-v8-prompt.txt`. This is an original visual-development board, not shipped sprite frames or a claim to Dota/LoL production parity. The runtime recreates its core language using authored Three.js geometry: assembling shield facets, tapered wind ribbons, a sharp colored impact with a bright seam, and outward ice waves with staggered crystals. The concept and prompt are inspectable in the showcase.

`spell-art.js` supplies two-batch transient effects: a vertex-colored ribbon batch and instanced shards. Each of twelve skill motifs has its own directional or radial arrangement, with evolving silhouette, contact core and fading secondary motion. Windup tracks the real cast phase and player position, disappears when interrupted, and respects cloak visibility. Impact still fires at the existing simulation hook. Ball wakes follow actual trajectory history, including redirected travel, and clear when the ball is held or stops. Four core kick/catch/dash/elimination effects use the same layered geometry language.

`item-art.js` uses four draws per sustained effect with reused geometry buffers. Shield petals assemble around a faint faceted shell while ribbons orbit; cleat streams flow behind the ankles; ice rises in staggered clusters around frozen players; Magnet energy moves into its floating U; cloak wisps drift upward. Duration segments and end fades use actual simulation values. Shield removal triggers a short breakup; consumed/expired item effects dissipate, and death/removal/match cleanup release their owned resources.

The showcase is a visual inspector, not a second physics implementation: skills share cast phases and VFX but targeting/collisions are tried through its match links. The Magnet preview consumes its ready state after three seconds; gameplay keeps it until a targeted pass. Image-generation keyframes are labelled as concepts, distinct from the live implementation. Pixel rendering retains nearest-neighbor display and no bloom; camera resolution remains user-selectable.

Revision-8 QA evidence lives in `~/Library/Developer/CodexBuilds/ghost-ball-art/qa/revision8`. Tests cover every cast reaching its real phase hook, changing/finite geometry, timed expiry, geometry/material disposal, canceled anticipation, ball-history cleanup, cloak visibility, item expiry/death, all showcase sections and phone overflow. Production performance is measured separately in a 14-player/two-ball match on each of three maps. Desktop Chromium at phone size is explicitly not a physical-iPhone result.

Final production measurement: 16.7–16.8 ms median, 33.4 ms p95 on all three maps; 14 players / 2 balls at 390×800 render pixels. The first run reached 33.5 ms p95 in Frost. Stone-wall visuals were then batched into a single instanced draw (plus shadow pass), preserving staggered rise/sink and collider behavior; the final run met the provisional 30 fps target. Both records remain in local QA. Reproduce functional checks with `tools/art/verify-vfx.mjs` and `tools/art/verify-showcase.mjs`.
