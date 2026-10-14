# Ghost Ball — brag video plan

**What it is:** a pixel-isometric football survival game: hot-potato football where whoever holds the ball at the buzzer is out.
**For:** people who like quick, chaotic party/arena games (iPhone & iPad target, web prototype today).
**Sets it apart:** football as elimination; 6 heroes with MOBA-style skills; every frame is real three.js voxel/pixel art; even the music is synthesised in code.
**Hook:** our own striker (TITAN) holding the ball as the clock hits 0.0, then BUZZER and ELIMINATED.
**Tone:** default (punchy, playful, clean), cut on the beat of the game's own 140 BPM match loop.
**Share caption:** "Pass it on. Don't be holding it at the buzzer."

## Visual identity (from src/ui/style.css)
- Panel `#0e1524`, ink `#f3e9d2`, accent `#e8a93a`, red `#dc4343`, tan `#8c7b58`
- Silkscreen (display) + Pixelify Sans (body), hard 0 6px 0 pixel shadows, `.gb-tag` kickers
- All footage is the real game, captured frame by frame (fake clock) with `?demo=1` bots

## Audio
The game's own procedural `audio.js`: the `match` loop (E minor, 140 BPM) plus the real SFX, placed at the real
match events logged during capture. Rendered offline with a shared reverb and a bus compressor; music up front, SFX underneath.
Hook: a filtered loop plus G6 ticks; at the buzzer the music cuts and the buzzer, boom and elim land in the gap.

## Storyboard (bar = 1.714 s @ 140 BPM; 12 bars + 0.8 s tail ≈ 21.4 s)
| # | Time | Shot | Text |
|---|---|---|---|
| 1 Hook | 0–3.43 | Temple, round 2, push-in on TITAN; buzzer on bar 1 → flash, shake, ELIMINATED | "PASS IT ON." / "DON'T BE HOLDING IT AT THE BUZZER." |
| 2 Reveal | 3.43–6.86 | Real title screen over a live bot match, slow push | (the game's own logo + tagline) |
| 3 Rules | 6.86–10.29 | Ego Lab, round 1 → "ODE OUT" | kicker HOW IT PLAYS · "8 STRIKERS. 1 BALL." · "It sticks to whoever touches it." |
| 4 Heroes | 10.29–13.71 | Striker select turntable: TITAN → BOLT → KAIZ → ECHO, cut every 2 beats | kicker 6 STRIKERS · "12 SKILLS." |
| 5 Arenas | 13.71–17.14 | Sun Temple Ruins → Ego Lab Complex → Frost Peak (buzzer, VEX OUT) | kicker 3 ARENAS · 5 MODES + arena name |
| 6 Outro | 17.14–21.4 | Dip to panel; logo over dimmed match | GHOST·BALL · "Pass it on." · Built for iPhone & iPad · web prototype |
