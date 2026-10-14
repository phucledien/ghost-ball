# Ghost Ball — brag video plan (v2: gameplay pace + striker skills)

**What it is:** a pixel-isometric football survival game: hot-potato football where whoever holds the ball at the buzzer is out.
**For:** people who like quick, chaotic arena games (iPhone & iPad target, web prototype today).
**Angle (v2):** play it at game speed. Every shot runs at 1×, takes are long, and the middle of the video gives each striker its own section showing its attack and defense skill in a real match.
**Share caption:** "Pass it on. Don't be holding it at the buzzer."

## Visual identity (from src/ui/style.css)
- Panel `#0e1524`, ink `#f3e9d2`, accent `#e8a93a`, red `#dc4343`; hero FX colours from the config
- Silkscreen (display) + Pixelify Sans (body), hard pixel shadows, `.gb-tag` kickers
- All footage is the real game, captured frame by frame (fake clock) with `?demo=1` bots.
  Striker clips use the game's own camera at `stage.zoomMul = 0.55` and make the bot cast its skills as soon as they're ready.

## Audio
The game's own procedural `audio.js`: the `match` loop (E minor, 140 BPM) plus the real SFX at the logged match events.
Hook: filtered loop plus countdown ticks, cut dead by the buzzer. Lead sits lower under the striker section so the skill SFX come through.

## Storyboard (bar = 1.714 s @ 140 BPM; 35 bars + 0.8 s tail ≈ 60.8 s)
| # | Bars | Time | Shot | Text |
|---|---|---|---|---|
| 1 Hook | 0–3 | 0–5.1 | Temple, TITAN holding the ball as the clock runs out; buzzer on bar 2, ELIMINATED | "PASS IT ON." / "DON'T BE HOLDING IT AT THE BUZZER." |
| 2 Title | 3–5 | 5.1–8.6 | Real title screen over a live bot match | (the game's own logo + tagline) |
| 3 Gameplay | 5–9 | 8.6–15.4 | One long Ego Lab take through a full round to the buzzer | "1 BALL. 1 CLOCK." → "LAST STRIKER STANDING." |
| 4 Strikers | 9–33 | 15.4–56.6 | 6 × 4 bars: NOVA, BOLT, TITAN, JINX, ECHO, KAIZ. Attack shot (2 bars), then defense shot (2 bars); camera follows the hero | Striker n/6 · role, name + title, skill slot, skill name, one-line description (README hero table) |
| 5 Outro | 33–35 + tail | 56.6–60.8 | Dip; logo over a dimmed match | GHOST·BALL · tagline · 6 STRIKERS · 3 ARENAS · 5 MODES · Built for iPhone & iPad |
