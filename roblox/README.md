# Ghost Ball · native Roblox MVP

This is an additive native Luau implementation of the [accepted #2 plan](https://github.com/phucledien/ghost-ball/issues/2#issuecomment-6259806304) and [#3 scope](https://github.com/phucledien/ghost-ball/issues/3#issuecomment-6259806573). The browser game and its assets remain the behavioral reference. This tree does not load a browser or execute JavaScript inside Roblox.

The original strike/contact/prediction/inset/framing reproductions passed [independent Q16 at 89915b0b](https://github.com/phucledien/ghost-ball/issues/4#issuecomment-6260452676). The focused follow-up corrects post-flush roster identity (GBQA-08), keyboard cancellation (GBQA-03), fresh movement ordering (GBQA-04) and compact hit targets (GBQA-09); these corrections have offline positive/negative controls and await independent retest. **Studio, Roblox clients, physical devices, networking and imported audio have not been tested. This is not release approval.** The owner has confirmed that a creator account/group/private test experience is not yet available. No account credentials, uploads, publishing, commerce or persistence are involved.

## Scope

Classic only; one 30×19 logical-unit Training Pitch (90×57 studs); eight frozen human/bot slots; one Nova-inspired native Parts rig with uniform stats; movement, pass/charge, dash, catch immunity, round elimination and winner loop. Late joiners and eliminated humans spectate. Disconnect/reset forfeits; the next living slot receives the ball if the departure removes responsibility. Results restart automatically while humans remain.

Native geometry, an angled camera, HUD, touch controls, seven pose states, fixed-pool event pulses and a six-cue AudioPlayer layer are included. Audio IDs are deliberately blank until owner-authorized imports and experience grants exist. Each missing cue is counted in the HUD diagnostic. Nova is appearance only: all hero kits/passives, items, other maps/modes, cosmetics, progression, music, commerce, gamepad/VR and portrait gameplay are deferred.

## Reproduce locally

Prerequisites: Apple Silicon macOS, Python 3, Node.js and network access to the official Rojo/Luau GitHub releases. Existing browser dependencies are required only for the browser build. The bootstrap pins Rojo **7.7.1** and Luau **0.743**, verifies the committed SHA-256 archive hashes and installs only into the local build root. These checksums pin the downloaded releases, not an independent publisher signature. The bootstrap intentionally fails on another host instead of fetching an unverified binary.

From the repository root:

```sh
python3 roblox/tools/manage.py setup
python3 roblox/tools/manage.py check
python3 roblox/tools/manage.py audio
python3 roblox/tools/manage.py build
# After committing the scoped source, verify the exact commit and embedded scripts:
python3 roblox/tools/verify_artifacts.py
```

All generated outputs resolve to `~/Library/Developer/CodexBuilds/ghost-ball/roblox/`. The wrapper checks for symlinks and forbidden synced locations before creating output directories. It does not write generated files into the checkout. If source is later moved to synced storage, stage a real local copy before using tools that cache beside source.

| Path below that local root | Contents |
| --- | --- |
| `tools/` | Pinned CLI binaries and download archives |
| `build/GhostBall.rbxlx` | Production-mapped local game place |
| `build/GhostBallTests.rbxlx` | Separate Studio-only pure-rule test place |
| `build/manifest.json` | Source revision/dirty flag, source hashes, tool versions, place sizes and SHA-256 hashes |
| `exports/audio/` | Six WAVs and source/export/rights/permission manifest |
| `qa/<revision>-<UTC>/checks.log` | Exact commands, assertion output and exit codes |
| `evidence/` | This implementation's issue snapshots and browser-build log |

A clean checkout on the implementation commit should yield `sourceDirty: false` unless unrelated local work exists. Consult per-file hashes in the manifest if the shared checkout contains other agents' work. Generated place files, WAVs and QA results are intentionally untracked.

Open `build/GhostBall.rbxlx` with Roblox Studio after installing/signing in through the [official setup](https://create.roblox.com/docs/studio/setup). Use **Test**, then **Server & Clients** with two and eight clients. Do not publish as part of setup. Opening a built `.rbxlx` needs no Rojo plugin. Optional live sync uses the matching Rojo 7 plugin and a loopback Rojo server; it is not needed for this handoff. Configure the future experience capacity to eight when an owner creates it; the code includes only eight humans in each match even if a local test connects extra spectators.

Open `GhostBallTests.rbxlx` and run **Test** to execute the same pure and stand-in handler suites in Studio. That place includes the test runners, suites and adapter copies in server-only services, with no test RemoteEvent. The production place excludes both. Running this suite does not substitute for client or device QA.

## Controls and rules

- WASD/arrows move relative to the camera. Mouse aims at the pitch. Space/J/left click presses and releases Primary.
- With the ball: press and hold to charge, release to schedule a pass. A quick tap is uncharged. Without the ball: press dashes.
- Landscape touch: separate left thumbstick and right A button; hold and drag A to aim, release to pass. Touch pointers are independent. Portrait opens a rotate overlay and neutralizes input.
- Sound, motion and help controls are local preferences. Escape keeps the Roblox system menu. Menu/focus/text-entry/orientation cancellation sends a neutral/cancel command, and stale movement times out server-side after 0.25 seconds.
- Holder at buzzer loses. If the ball is loose/in flight, its last kicker loses. The HUD shows both holder and responsibility. **The server resolves the deadline before commands or contacts; a scheduled strike after that deadline cannot rescue the holder.** There is no client timestamp grace or rollback.
- Catch locks passing for 0.4 s. Kicker immunity is 0.3 s; previous-holder return immunity is 0.9 s. Dash lasts 0.14 s with a 1.6 s cooldown. All numerical tuning is centralized in `src/shared/Rules.luau`.
- Forfeit or Roblox Reset ends your participation in the current match. It cannot respawn you into that match. Reconnect and late join spectate until the next match. Disconnecting the last human aborts bot simulation and returns to waiting.

## Architecture and authority

`src/shared/Sim.luau` is a pure deterministic numeric simulation with injected rules, movement and seeded RNG. It reads no Roblox objects or clock. Its tables use logical units; client presentation multiplies by three. Server actors are never physics-owned character parts. The canonical ball history carries holder, last kicker, last touch, previous holder and immunity separately. Snapshots include the match/round/ball revisions, clock/deadline, sequences, alive roster, action state and cooldown deadlines.

`src/server/Main.server.luau` disables avatar spawning, owns joins/leaves and uses `shared/Clock.luau` for wall-clock deadline checks before catch-up at distinct endpoints of at most 1/60 s, including a final partial interval. Each flush is limited to eight steps; excess oldest backlog is dropped, increments an overrun counter and never extends a play deadline. Accepted commands flush prior simulation time after cheap rate/schema/epoch/replay gates; rejected traffic cannot bypass those gates. A scheduled strike splits its simulation interval; flight and immunity start at the strike, with no pre-strike integration. Bots think at at most 5 Hz and use the same internal action gate. Motion is normalized, accelerated and bounded; ball catches use relative swept segments against moving actors, stable slot tie-breaking, intersection of entry/exit contact intervals with immunity expiry and ballistic catch height, floor/wall response and loose friction. Non-finite/escaped ball repair preserves responsibility and deadline and emits a fault diagnostic.

`InputGateway.luau` derives identity only from the sender. After its cheap rate/schema/epoch/live-sender/replay gate, time advancement may replace a match or roster; the gateway rechecks epoch and looks up the sender in the new live roster before dispatch or acknowledgment. A request that becomes stale during an authorized flush is rejected and counted; pre-gate invalid traffic still does not flush. Flat fixed schemas reject unknown fields/types, non-finite axes, nested/recursive values, invalid enum/epoch and replay. Sequences are independent for Move/Action. Per-client token buckets limit Move to 20/s (burst 5), Action to 10/s (burst 5) and Ready/Sync to 1/s (burst 2), before schema traversal. Aggregate rejection counts are logged every ten seconds without payloads or credentials. `Cancel` is an explicit neutralization enum in addition to Press/Release/Dash/Forfeit; it cancels transient local input but cannot transfer possession or grant a cooldown. The optional 200 ms action buffer in the plan is not enabled: early/illegal actions are rejected.

Snapshots replicate at 15 Hz and immediately after authoritative events. The client predicts only local movement and replays only prediction intervals later than snapshot server time. Move sequence identifies the input actually sent, while timestamps determine which motion is already represented; acknowledging an input does not discard its genuinely later movement. Input changes split prediction at their send time, and stale snapshots cannot rewind prediction; remote actors/flight render approximately 100 ms behind with interpolation. Ball ownership and results always come from the server. Events are de-duplicated by monotonic event ID and stale epochs are ignored. Models/ball are anchored non-colliding local presentation; fixed pools bound effect instances. Input uses the current native Input Action System for keyboard Move/Primary plus dedicated touch pointers. Cancelled touch/mouse/keyboard Primary termination sends Cancel without Release. The active raw input is tracked so known Cancel state suppresses a preceding IAS Released callback as well as a later one; native dispatch ordering remains pending. Textbox/menu/window/help/orientation gates clear held state and keep the context neutral until eligible again. Fresh raw movement keys provide their own direction regardless of IAS/raw callback order; keys held through a gate stay suppressed until released or freshly begun. Mouse screen coordinates subtract the current GUI inset before `ScreenPointToRay`. Camera fitting projects pitch, actor and ball extents into HUD/safe-area bounds at each viewport, with a compact HUD below 500 safe-area pixels in height. All required buttons remain at least 48×48 UI pixels; compact Mute/Motion use side-by-side 48×48 targets within the existing HUD margin. These are source/analytic checks, not runtime cursor/layout results.

Strict Luau mode is enabled for all modules. The offline checker type-checks the pure modules, prediction, gateway and test suites; it compiles every Luau module for syntax. It does **not** provide Roblox engine types or validate runtime APIs, UI behavior, replication, connection cleanup or performance. Some mutable adapter/simulation tables use `any`; passing the pure type check is not a claim of complete static typing.

## Audio and assets

`tools/recipes.mjs` extracts the original `kick`, `catch`, `dash`, `tick`, `elim` and `win` recipes from `src/engine/audio.js` without modifying it. The Python exporter renders seeded noise, oscillator envelopes and biquad filters, trims/peak-normalizes to −1 dBFS and writes 48 kHz mono PCM16 WAVs. This numerical re-render is reproducible and preserves the original cue recipes; it is not browser-bit-identical DSP. The manifest records recipe/exporter/source hashes, cue mapping and WAV hashes. Audible quality and Roblox playback remain pending.

After a separate owner authorization: confirm rights and creator/group, create a **private** test experience, import the six WAVs through the asset workflow, wait for moderation, grant that experience permission and enter the verified `rbxassetid://…` IDs in `src/assets/AssetManifest.luau`. Record creator/type/ID/version, moderation, universe grant and tested revision beside the export manifest. Never substitute random IDs or change privacy to Open Use to bypass a grant failure. Rebuild, test every cue audibly as a permitted collaborator, and verify mute plus missing-asset diagnostics. Native Parts geometry needs no mesh/image/font upload. Full Blender/R15 fidelity and imported animations are deferred.

## Validation and handoff

See [HANDOFF.md](HANDOFF.md) for exact available checks, acceptance gaps and the QA sequence. Current official references: [Input Action System](https://create.roblox.com/docs/input/input-action-system), [AudioPlayer](https://create.roblox.com/docs/reference/engine/classes/AudioPlayer), [Studio testing](https://create.roblox.com/docs/studio/testing-modes), [server boundary](https://create.roblox.com/docs/scripting/security/client-server-boundary), [Rojo 7.7.1](https://github.com/rojo-rbx/rojo/releases/tag/v7.7.1). No issue should be closed and no release should be approved based solely on the offline evidence.
