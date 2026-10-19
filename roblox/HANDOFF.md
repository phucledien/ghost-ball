# Implementation handoff · issue #3

Scope authority: [accepted plan](https://github.com/phucledien/ghost-ball/issues/2#issuecomment-6259806304), [coordinator decision](https://github.com/phucledien/ghost-ball/issues/3#issuecomment-6259806573). Baseline browser revision: `7dd5400beca5421259308bafc8ca0c3d8320faf1`. Work is isolated to `roblox/` on `feat/roblox-native-mvp`; the generated manifest and #3 handoff comment identify the final implementation revision. No merge, Roblox upload/publish or issue closure was performed.

## Delivered source

| Files | Responsibility |
| --- | --- |
| `default.project.json`, `test.project.json`, `rokit.toml` | Production/test service mappings and pinned Rojo version |
| `src/shared/Rules.luau`, `Math.luau`, `Movement.luau` | Versioned tuning, finite/normalization/sweep helpers, shared movement |
| `src/shared/Sim.luau`, `Clock.luau`, `Bots.luau`, `Protocol.luau` | Deterministic rules/lifecycle/bots and flat schemas/token buckets |
| `src/server/Main.server.luau`, `InputGateway.luau` | Server clock, fixed-step budget, player identity/lifecycle, remotes and validation |
| `src/client/Main.client.luau`, `InputController.luau`, `Prediction.luau` | Boot, epoch/snapshot/event handling, desktop/touch input and movement reconciliation |
| `src/shared/CameraFit.luau`, `src/client/HUD.luau`, `CameraController.luau`, `ActorView.luau`, `Effects.luau`, `Audio.luau` | Native presentation, safe-area GUI, seven pose states, bounded pulses, missing-audio diagnostics |
| `src/assets/Primitives.luau`, `AssetManifest.luau` | Training Pitch/native Parts helpers and intentionally unassigned audio ownership/IDs |
| `tests/Run.luau`, `RunInput.luau`, `Suite.luau`, `Regressions.luau`, `InputHandlers.luau`, `CameraAdapter.luau`, `Studio.server.luau` | CLI/Studio entries, pure fixtures, seven-defect regression assertions and adapter stand-ins |
| `tools/manage.py`, `verify_artifacts.py`, `recipes.mjs`, `README.md`, this file | Verified local tooling/build/test/audio commands and setup/QA handoff |

## Available evidence

Host: Apple Silicon macOS; source resolves to `/Users/thohong/Projects/ghost-ball`; output resolves to `/Users/thohong/Library/Developer/CodexBuilds/ghost-ball/roblox`. Tool versions: Rojo 7.7.1, Luau 0.743. Rules/protocol versions: 1/1. Place/universe: local only. Exact command output is retained beneath that root; see `build/manifest.json` for source/file hashes and final place hashes and `qa/<revision>-<UTC>/checks.log` for the final run.

| Check | Result and evidence limit |
| --- | --- |
| `python3 roblox/tools/manage.py setup` | Pinned archive checksums verified; local-only tools. No Studio install or account setup |
| `python3 roblox/tools/manage.py check` | Pure strict type check, syntax compilation of every Luau file, 17 original + 17 GBQA groups, five input-handler groups and a six-case camera adapter check pass; no Roblox engine API/type/runtime validation |
| Buzzer/ownership fixtures | 100 held + 100 flight + 100 loose cases; last touch deliberately differs from responsible actor; repeated resolution produces one elimination |
| Timing/contact fixtures | Pre/at/post catch lock, immunity and deadline; quick/full/capped charge; scheduled strike; self regrab; earliest/max-speed swept catch; stable tie and height rejection |
| Movement/lifecycle fixtures | Diagonal normalization, dash duration/cooldown, stale movement, 1,000 bounded commands; phase freeze; join by phase; duplicate reset; reconnect; holder/kicker departure; last-human abort; one/zero survivor paths |
| Abuse fixtures | 100 each for malformed type, NaN/infinity, unknown/nested/recursive fields, out-of-range axes, supplied identity, bad/future/stale epoch, bad sequence/enum and spectator attempts; separate replay/action legality tests |
| Rate isolation fixture | 1,000 Move requests at 100/s for ten seconds: 204 accepted by the 20/s + burst-5 gate; simultaneous valid peer's 200 requests all accepted |
| Seeded simulation | Eight seeds each at 1 human + 7 bots and 2 humans + 6 bots, 20 matches per roster/seed: **320 matches**, exactly one winner each, no deadlock or simulation faults. Humans are connected stationary actors in this offline fixture; there are no real network clients. Fix-pass total: 16,872 passes; the changed count reflects corrected simulation timing and catches |
| Determinism/faults | Identical seeded replay matches; snapshot mutation cannot alter server actors; stalled tick resolves expired deadline before movement; non-finite/escaped ball repair preserves culprit/deadline |
| `python3 roblox/tools/manage.py build` | Both `.rbxlx` places generate with correct server/client/shared service placement; XML structure inspected offline. Opening/running them is pending |
| `python3 roblox/tools/manage.py audio` | Six PCM16 mono/48 kHz exports; source/recipe/export hashes, cue mapping, durations, normalized peak; no IDs, moderation, grants or audible runtime test |
| `GHOST_BUILD_DIR=…/roblox/build/web GHOST_VITE_CACHE=…/roblox/cache/vite npm run build` | Baseline implementation/independent QA evidence: six-entry Vite production build passes using existing dependencies and local Developer output/cache; pre-existing large-chunk warning remains. No browser runtime smoke needed for unchanged browser source/config |
| Browser preservation / diff hygiene | No browser source, assets, package/lock/build config changed by this implementation; all implementation paths under `roblox/`. Unrelated shared-checkout changes are excluded from the implementation commit |

## GBQA fix pass (2026-10-19)

Baseline: `d6640defb517ee6df43881b20d7b6bfd1672b53f`. Authority: [independent failures](https://github.com/phucledien/ghost-ball/issues/4#issuecomment-6260102604) and [fix work order](https://github.com/phucledien/ghost-ball/issues/3#issuecomment-6260137498). Exact fix commit and rebuilt place hashes are recorded in the new #3 handoff comment and local build manifest; this avoids a self-referential commit hash in source.

Evidence root: `/Users/thohong/Library/Developer/CodexBuilds/ghost-ball/roblox/qa/fix-d6640def-20261019`. Original `qa/independent-d6640def-20261019T045756Z` is immutable; its recursive hash inventory is checked after this pass. No workers were started or prompted. Herdr's stale inherited caller returned `pane_not_found`; explicit supplied IDs verified `roblox-fix` in `wD:p4` and project pane `wD:p2`.

| ID | Change and offline evidence |
| --- | --- |
| GBQA-01 | Simulation splits at strike, launches from the holder's strike position and integrates only later flight. Clock flushes use distinct bounded endpoints plus a partial tail; wall deadline wins before catch-up, bots and accepted commands. Tests cover midpoint/endpoint/initial strikes, moving holder, multiple catch-up steps, dropped backlog, exact birth-overlap contact without travel (including immune/height boundaries), catches on either side of buzzer and the exact wrong-loser reproduction. |
| GBQA-02 | Swept circle entry **and exit** intersect immunity expiry and ballistic height eligibility. Catch event/lock use actual contact time. Tests cover the glancing miss, crossing/initial overlap, moving actors, both immunity roles, expiry while still overlapping, exit equality and ascending/descending height boundaries. |
| GBQA-03 | Cancel at pointer termination/state-change clears charge and sends Cancel, never Release. Duplicate signals are inert; fresh gestures and normal independent touch/mouse/keyboard release are covered by original-handler stand-ins. |
| GBQA-04 | Textbox/window/menu plus help/orientation eligibility keeps IAS context and movement neutral. Held state clears once across overlapping gates; neutral/fresh movement resumes cleanly after release. Stand-in tests exercise blocked state changes, held Primary, new pointers and repeated frame updates. |
| GBQA-05 | `GetMouseLocation()` is screen-relative; subtract actual `GetGuiInset()` before Core UI-relative `ScreenPointToRay()`. Tests assert zero, top-only and horizontal/top inset coordinates at the real adapter boundary. Actual cursor behavior is **PENDING**. |
| GBQA-06 | Perspective half-space fit includes arena/lines, legal actor positions with rotated Parts envelope, and held/flying ball extents, plus HUD, billboard and Core UI/device-safe margins. Vertical FOV is explicit; fullscreen and safe rectangles share one inset origin. Short landscape HUD is compact. Independent projection assertions at 844×390, 1280×720, 1920×1080 cover zero and nonzero safe margins; camera adapter is exercised with stand-ins. **No screenshots/runtime fit claimed.** |
| GBQA-07 | History stores the sent sequence, original input/send time and motion interval. Snapshot time prunes represented prefixes regardless of ack; later motion survives even for acked inputs. Send-time splits prevent backdating a new direction. Tests cover same-time, partial/delayed/out-of-order acknowledgments, stopping, direction changes and timeout/source immutability. |
| Clock/gateway adjacency | Coordinator-requested guard: flush is behind rate/schema/epoch/live-actor/replay gates. 1,000 malformed requests and 994 excess requests after the burst cause no flushes, while a legitimate peer progresses and deadline resolution still wins. |

`old-check.log` passes the original 17 groups; `old-adversarial.log` retains four original failures and `old-input.log` both original handler failures. `negative-{rules,input,camera}.log` runs the new tests against baseline source copies: all seven IDs have failing controls. Only adapter environment bindings are injected into baseline client copies; original handler decisions remain intact. Some additional new-helper/API cases cannot execute against the old API and are not counted as semantic negative evidence. `birth-overlap-new.log` passes the coordinator’s exact strike-time overlap reproduction; its original failing source/log remain unchanged under `qa/coordinator-birth-overlap-20261019T052120Z`. `new-check.log` records the new positive suite, pure/prediction/gateway strict analysis and syntax compilation of every Luau file. The isolated Studio test place includes these same regressions and stand-ins but has **not been run in Studio**.

Current official contracts were retrieved on 2026-10-19 and retained with hashes in this evidence root: [mouse location](https://create.roblox.com/docs/reference/engine/classes/UserInputService#GetMouseLocation), [screen ray](https://create.roblox.com/docs/reference/engine/classes/Camera#ScreenPointToRay), [viewport/FOV](https://create.roblox.com/docs/reference/engine/classes/Camera), [GUI inset regions](https://create.roblox.com/docs/reference/engine/classes/GuiService#GetInsetArea). Run `python3 roblox/tools/verify_artifacts.py` after the final scoped commit/build/audio export to compare every source hash with HEAD/current files, every embedded place Source blob, both place hashes and all six WAV hashes/format. A dirty whole checkout is expected from unrelated documentation; this verifier requires every manifest `roblox/` file to equal its committed blob.

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
| Q16 / defects | Seven source fixes have offline positive/negative controls; coordinator review and independent `roblox-qa` retest remain **PENDING** |
| Q17 / release | **BLOCKED / separately authorized:** owner/group/place/grants/device/compliance review after QA; do not publish from this task |

Studio/Player were not found in the inspected application/tool paths. Owner confirms no Roblox creator account/group/private experience yet. There is no verified uploader, universe/place ID, collaborator grant, Windows session, physical phone/tablet access or reference Android model. The owner supplies those prerequisites; QA executes and records the pending checks. No credentials were inspected or requested.

## Known practical limits to inspect first

Input/AudioPlayer engine integration and presentation are syntax-checked source only. Start QA with startup Output, native Input Action System bindings, reset interception, viewport framing, touch cancellation, help fit and server/client agreement. The optional 200 ms buffered action mechanism is intentionally absent; illegal early input is rejected. The 15 Hz snapshot rate, 100 ms interpolation and simple pending-movement reconciliation require actual latency testing and tuning. The faceted Parts rig is an appearance approximation rather than a Blender/R15 import. Six WAVs exist but audible quality/permission/loading are pending, so the local game is currently a silent visual checkpoint.

Keep captures/profiling results in a new local `qa/<revision>-<UTC>/` directory. Record revision, UTC, Rules/protocol version, local/private place, Studio/client build, actual device/OS, input, graphics/resolution, human/bot counts, seed, real simulator settings, expected/actual and pass/fail/blocked. Preserve the original browser sources and avoid attaching secrets or inventing runtime evidence.
