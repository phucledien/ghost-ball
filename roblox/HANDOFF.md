# Implementation handoff · issue #3

Scope authority: [accepted plan](https://github.com/phucledien/ghost-ball/issues/2#issuecomment-6259806304), [coordinator decision](https://github.com/phucledien/ghost-ball/issues/3#issuecomment-6259806573). Baseline browser revision: `7dd5400beca5421259308bafc8ca0c3d8320faf1`. Work is isolated to `roblox/` on `feat/roblox-native-mvp`; the generated manifest and #3 handoff comment identify the final implementation revision. No merge, Roblox upload/publish or issue closure was performed.

## Delivered source

| Files | Responsibility |
| --- | --- |
| `default.project.json`, `test.project.json`, `rokit.toml` | Production/test service mappings and pinned Rojo version |
| `src/shared/Rules.luau`, `Math.luau`, `Movement.luau` | Versioned tuning, finite/normalization/sweep helpers, shared movement |
| `src/shared/Sim.luau`, `Bots.luau`, `Protocol.luau` | Deterministic rules/lifecycle/bots and flat schemas/token buckets |
| `src/server/Main.server.luau`, `InputGateway.luau` | Server clock, fixed-step budget, player identity/lifecycle, remotes and validation |
| `src/client/Main.client.luau`, `InputController.luau`, `Prediction.luau` | Boot, epoch/snapshot/event handling, desktop/touch input and movement reconciliation |
| `src/client/HUD.luau`, `CameraController.luau`, `ActorView.luau`, `Effects.luau`, `Audio.luau` | Native presentation, safe-area GUI, seven pose states, bounded pulses, missing-audio diagnostics |
| `src/assets/Primitives.luau`, `AssetManifest.luau` | Training Pitch/native Parts helpers and intentionally unassigned audio ownership/IDs |
| `tests/Run.luau`, `Suite.luau`, `Studio.server.luau` | CLI entry, shared pure fixtures and isolated Studio-only entry |
| `tools/manage.py`, `recipes.mjs`, `README.md`, this file | Verified local tooling/build/test/audio commands and setup/QA handoff |

## Available evidence

Host: Apple Silicon macOS; source resolves to `/Users/thohong/Projects/ghost-ball`; output resolves to `/Users/thohong/Library/Developer/CodexBuilds/ghost-ball/roblox`. Tool versions: Rojo 7.7.1, Luau 0.743. Rules/protocol versions: 1/1. Place/universe: local only. Exact command output is retained beneath that root; see `build/manifest.json` for source/file hashes and final place hashes and `qa/<revision>-<UTC>/checks.log` for the final run.

| Check | Result and evidence limit |
| --- | --- |
| `python3 roblox/tools/manage.py setup` | Pinned archive checksums verified; local-only tools. No Studio install or account setup |
| `python3 roblox/tools/manage.py check` | Pure strict type check, syntax compilation of every Luau file, 17 assertion groups pass; no Roblox engine API/type/runtime validation |
| Buzzer/ownership fixtures | 100 held + 100 flight + 100 loose cases; last touch deliberately differs from responsible actor; repeated resolution produces one elimination |
| Timing/contact fixtures | Pre/at/post catch lock, immunity and deadline; quick/full/capped charge; scheduled strike; self regrab; earliest/max-speed swept catch; stable tie and height rejection |
| Movement/lifecycle fixtures | Diagonal normalization, dash duration/cooldown, stale movement, 1,000 bounded commands; phase freeze; join by phase; duplicate reset; reconnect; holder/kicker departure; last-human abort; one/zero survivor paths |
| Abuse fixtures | 100 each for malformed type, NaN/infinity, unknown/nested/recursive fields, out-of-range axes, supplied identity, bad/future/stale epoch, bad sequence/enum and spectator attempts; separate replay/action legality tests |
| Rate isolation fixture | 1,000 Move requests at 100/s for ten seconds: 204 accepted by the 20/s + burst-5 gate; simultaneous valid peer's 200 requests all accepted |
| Seeded simulation | Eight seeds each at 1 human + 7 bots and 2 humans + 6 bots, 20 matches per roster/seed: **320 matches**, exactly one winner each, no deadlock or simulation faults. Humans are connected stationary actors in this offline fixture; there are no real network clients. Final pass count is recorded in the log |
| Determinism/faults | Identical seeded replay matches; snapshot mutation cannot alter server actors; stalled tick resolves expired deadline before movement; non-finite/escaped ball repair preserves culprit/deadline |
| `python3 roblox/tools/manage.py build` | Both `.rbxlx` places generate with correct server/client/shared service placement; XML structure inspected offline. Opening/running them is pending |
| `python3 roblox/tools/manage.py audio` | Six PCM16 mono/48 kHz exports; source/recipe/export hashes, cue mapping, durations, normalized peak; no IDs, moderation, grants or audible runtime test |
| `GHOST_BUILD_DIR=…/roblox/build/web GHOST_VITE_CACHE=…/roblox/cache/vite npm run build` | Existing six-entry Vite production build passes using existing dependencies and local Developer output/cache; pre-existing large-chunk warning remains. No browser runtime smoke needed for unchanged browser source/config |
| Browser preservation / diff hygiene | No browser source, assets, package/lock/build config changed by this implementation; all implementation paths under `roblox/`. Unrelated shared-checkout changes are excluded from the implementation commit |

## Pending acceptance and owners

**Offline passes are partial evidence for AC1–8 and AC13. All runtime/device/audio acceptance remains pending.** The coordinator must review/accept this source handoff before #4 executes the independent QA matrix. Missing access is not waived by generating a place.

| Plan QA rows | Status / next action |
| --- | --- |
| Q01 / clean build + Studio open | Local generation passes; QA must open the exact place/manifest revision in Studio and record Explorer, Output and Studio version |
| Q02 / pure rules | CLI passes; QA reruns CLI and the test place in Studio. Studio runner is isolated from production |
| Q03–Q06 / full loop, two/eight clients, lifecycle | **PENDING:** QA needs Studio clients; validate synced outcomes, late join, forfeit/reset/reconnect and every phase transition |
| Q07–Q08 / network and hostile client | **PENDING:** actual Studio simulator 0/100/200 ms one-way delay and 2% loss for five minutes/profile; malformed engine Instance payloads, 100/s/client bursts and valid-peer control. Pure gateway tests do not measure RemoteEvent/network behavior |
| Q09 / bots | Offline seeded run passes; QA still needs visual legality/danger/recovery behavior and runtime event traces |
| Q10–Q12 / controls/layout/comprehension | **PENDING:** simulator at 844×390, 1280×720, 1920×1080; physical macOS/Windows/iOS/Android and a tablet; multitouch, safe areas, rotation/focus/menu/text-entry cancellation and three first-time rule explanations |
| Q13 / audio/assets | **BLOCKED:** owner must create creator/private test experience, authorize rights/imports and grants. QA must load/audibly verify all six cues as collaborator, plus mute/motion/missing-ID fallback |
| Q14 / performance/cleanup | **PENDING:** real desktop/phone frame/network/memory/instance measurements, 30-minute server soak and post-20-match cleanup. No performance or cleanup targets have been measured |
| Q15 / browser | Build/preservation pass locally; repeat after any shared-source integration |
| Q16 / defects | Independent QA records exact revision/reproduction; fixes return to implementation owner and are retested |
| Q17 / release | **BLOCKED / separately authorized:** owner/group/place/grants/device/compliance review after QA; do not publish from this task |

Studio/Player were not found in the inspected application/tool paths. Owner confirms no Roblox creator account/group/private experience yet. There is no verified uploader, universe/place ID, collaborator grant, Windows session, physical phone/tablet access or reference Android model. The owner supplies those prerequisites; QA executes and records the pending checks. No credentials were inspected or requested.

## Known practical limits to inspect first

Input/AudioPlayer engine integration and presentation are syntax-checked source only. Start QA with startup Output, native Input Action System bindings, reset interception, viewport framing, touch cancellation, help fit and server/client agreement. The optional 200 ms buffered action mechanism is intentionally absent; illegal early input is rejected. The 15 Hz snapshot rate, 100 ms interpolation and simple pending-movement reconciliation require actual latency testing and tuning. The faceted Parts rig is an appearance approximation rather than a Blender/R15 import. Six WAVs exist but audible quality/permission/loading are pending, so the local game is currently a silent visual checkpoint.

Keep captures/profiling results in a new local `qa/<revision>-<UTC>/` directory. Record revision, UTC, Rules/protocol version, local/private place, Studio/client build, actual device/OS, input, graphics/resolution, human/bot counts, seed, real simulator settings, expected/actual and pass/fail/blocked. Preserve the original browser sources and avoid attaching secrets or inventing runtime evidence.
