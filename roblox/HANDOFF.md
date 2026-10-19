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
| `tests/Run.luau`, `RunInput.luau`, `Suite.luau`, `Regressions.luau`, `InputHandlers.luau`, `HUDLayout.luau`, `CameraAdapter.luau`, `Studio.server.luau` | CLI/Studio entries, pure fixtures, GBQA regression assertions and actual input/HUD/camera factory stand-ins |
| `tools/manage.py`, `verify_artifacts.py`, `recipes.mjs`, `README.md`, this file | Verified local tooling/build/test/audio commands and setup/QA handoff |

## Available evidence

Host: Apple Silicon macOS; source resolves to `/Users/thohong/Projects/ghost-ball`; output resolves to `/Users/thohong/Library/Developer/CodexBuilds/ghost-ball/roblox`. Tool versions: Rojo 7.7.1, Luau 0.743. Rules/protocol versions: 1/1. Place/universe: local only. Exact command output is retained beneath that root; see `build/manifest.json` for source/file hashes and final place hashes and `qa/<revision>-<UTC>/checks.log` for the final run.

| Check | Result and evidence limit |
| --- | --- |
| `python3 roblox/tools/manage.py setup` | Pinned archive checksums verified; local-only tools. No Studio install or account setup |
| `python3 roblox/tools/manage.py check` | Pure strict type check, syntax compilation of every Luau file, 17 original + 20 GBQA groups, seven input-handler groups, a 40-layout HUD factory contract and a six-case camera adapter check pass; no Roblox engine API/type/runtime validation |
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

## Focused Q16 follow-up (2026-10-19)

Baseline: `89915b0b2dab2111b93546c96a99ce44406a9c32`. Authority: [complete independent Q16 report](https://github.com/phucledien/ghost-ball/issues/4#issuecomment-6260452676) and [four-correction work order](https://github.com/phucledien/ghost-ball/issues/3#issuecomment-6260481785). The original strike/contact/prediction/inset/framing and birth-overlap reproductions passed Q16. This pass changes only the gateway, input controller, HUD, their tests/mapping/tool checks, and these Roblox docs. Simulation, clock, camera fit/controller, movement and prediction source are byte-identical to this baseline.

Fresh evidence root: `/Users/thohong/Library/Developer/CodexBuilds/ghost-ball/roblox/qa/followup-89915b0b-20261019`. Every prior independent/Q16/fix/coordinator evidence file is protected by a recursive hash inventory. The original Q16 harnesses remain read-only; copies and new source copies live under this fresh root. Unrelated README.md/AGENTS.md/docs/HERDR.md byte hashes are also checked. No workers or existing-agent prompts; Herdr verified `roblox-fix`/`wD:p4` using explicit IDs after the stale caller lookup failed.

| ID / paths | Correction and regression evidence |
| --- | --- |
| GBQA-08 / `src/server/InputGateway.luau`, `tests/Regressions.luau` | Keep cheap rate/schema/epoch/live/replay prevalidation. After clock advancement and deadline resolution, recheck epoch and look up the sender afresh; no pre-flush actor/slot survives into command dispatch or acknowledgment. 90 combinations cover before/at/after result deadline, unchanged/reordered next rosters, late join/leave and every command kind, plus fresh new-epoch peer progress. Additional cases replace an actor or remove the sender without an epoch change. Counters distinguish no-flush pre-gate rejection from initially valid traffic that flushes then becomes stale; counters drain once. |
| GBQA-03 / `src/client/InputController.luau`, `tests/InputHandlers.luau` | Track the active raw Primary input, including IAS-before-raw presses. Cancel through InputEnded/InputChanged clears down and latches suppression of ordinary IAS Released. When Cancel state is already visible on the tracked object at IAS Released, cancel before releasing. Space/J, both terminal orders with known Cancel state, duplicate/stale signals, unmatched key cancellation, fresh gestures and ordinary touch/mouse/keyboard releases are covered. Actual native cancellation dispatch/order is still pending. |
| GBQA-04 / same input paths | Fresh raw movement keys determine direction independently of relative raw/IAS callback order. Stale held keys are excluded, including neutral/repeated IAS states while a known raw key remains held through a gate. Fresh diagonal/alias keys normalize; raw release and cancellation remove held state. Both event orders, gate overlap, held/fresh combinations and repeated states pass. No new engine API is used to read IAS state; current official InputAction/InputContext/InputObject contracts were checked and retained with hashes. |
| GBQA-09 / `src/client/HUD.luau`, `tests/HUDLayout.luau` | Compact Mute/Motion become side-by-side 48×48 targets, Forfeit stays 112×48, and diagnostic clearance is retained. Full-size layout restores when resized. The actual HUD factory accepts injected stand-ins; 40 layouts assert every TextButton is at least 48×48, fits safe bounds, keeps required targets separated and stays inside the unchanged camera HUD margins. No 48px exception or runtime hit-test claim. |
| Test/build plumbing | `test.project.json` and Studio runner include the HUD factory/contract only in server-side tests. `RunInput.luau` runs it offline; `tools/manage.py` strictly analyzes the new pure contract and syntax-compiles all 28 Luau files. `tools/verify_artifacts.py` checks the two additional test-place Source blobs. No production test remotes or browser changes. |

Evidence/results in that fresh root:

- `old-{gateway-transition,handler-neighbors,hud-targets}.log`: reproduce the four failures at baseline. `negative-{gateway,input,hud}.log`: new committed assertions fail against old production behavior; the baseline HUD copy only receives stand-in globals, with its original factory body intact.
- `check.log`: complete suite passes (17 original + 20 GBQA groups; 320 seeded matches / 16,872 passes; seven handler groups; six camera adapter cases; 40 actual HUD layouts). Pure/prediction/gateway/contracts strict analysis and all 28 syntax compilations pass. The Studio test place includes the same assertions but has not been run in Studio.
- `{gateway-transition,handler-neighbors,hud-targets}.log`: all three independent harness copies pass against new source; handler neighbors are 8/8. The copied HUD harness refreshes only its embedded factory body from current source; its expected 48px assertions are unchanged.
- `original-adversarial-api-adapted.log` (11/11), `coordinator-birth-overlap.log`, and `neighbors.log` (9/9): all passing earlier reproductions remain passing with new copied source. Explicit snapshot-time API adaptation from Q16 is retained.
- `camera-frames.log`, `project-extents.log`, `perspective-results.json`: the independent projection script passes all nine frames at 844×390, 1280×720, 1920×1080 with zero/symmetric/asymmetric safe margins. Each frame checks 112,468 points plus 1,728 billboard rectangles. These are numerical checks, not screenshots or runtime layout evidence.
- Final build/verification logs and manifests identify the exact follow-up commit and both place hashes in the new #3 comment. Every manifest source must equal HEAD/current files; dirty whole-checkout status reflects unrelated documentation. Earlier evidence directories remain immutable.

Native Classic MVP scope and all runtime/account/audio/device gaps below are unchanged. Coordinator review and a bounded independent exact-revision retest remain pending; every issue stays open.

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
| Q16 / defects | Original Q16 reproductions passed; GBQA-03/04 follow-ups and GBQA-08/09 now have offline positive/negative controls. Bounded independent exact-revision retest remains **PENDING** |
| Q17 / release | **BLOCKED / separately authorized:** owner/group/place/grants/device/compliance review after QA; do not publish from this task |

Studio/Player were not found in the inspected application/tool paths. Owner confirms no Roblox creator account/group/private experience yet. There is no verified uploader, universe/place ID, collaborator grant, Windows session, physical phone/tablet access or reference Android model. The owner supplies those prerequisites; QA executes and records the pending checks. No credentials were inspected or requested.

## Known practical limits to inspect first

Input/AudioPlayer engine integration and presentation are syntax-checked source only. Start QA with startup Output, native Input Action System bindings, reset interception, viewport framing, touch cancellation, help fit and server/client agreement. The optional 200 ms buffered action mechanism is intentionally absent; illegal early input is rejected. The 15 Hz snapshot rate, 100 ms interpolation and simple pending-movement reconciliation require actual latency testing and tuning. The faceted Parts rig is an appearance approximation rather than a Blender/R15 import. Six WAVs exist but audible quality/permission/loading are pending, so the local game is currently a silent visual checkpoint.

Keep captures/profiling results in a new local `qa/<revision>-<UTC>/` directory. Record revision, UTC, Rules/protocol version, local/private place, Studio/client build, actual device/OS, input, graphics/resolution, human/bot counts, seed, real simulator settings, expected/actual and pass/fail/blocked. Preserve the original browser sources and avoid attaching secrets or inventing runtime evidence.
