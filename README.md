# PORTO AZUL II — 5 story missions, police chases, heists, radio and saves

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game set in Porto Azul, a dusk-lit neon city. Daz works five story
missions with Benny, Tono and Mara — stealing the Comet GT, settling Tono's debt, outrunning
a police helicopter at MOST WANTED, casing the Casino Royale vault and running it for
$48,500. Built with three.js (vendored), no external requests, no build step.

## How to play

```sh
node serve.ts
# open http://localhost:8080
```

- **WASD** drive / walk, **SHIFT** run, **E** enter / exit car, **SPACE** shoot,
  **C** change radio station, **M** mute, **ENTER** start.
- Steal cars, lose the cops, finish missions before the timer runs out.
- Cash, respect, health, armour and mission progress save to localStorage.

## Features

- **5 story missions** with chapter banners (1/5–5/5), timers and payouts up to $25,000
- **Wanted system 0–5 stars** — pursuit cars, foot cops and a searchlight helicopter; MOST WANTED at 5 stars
- **Economy** — cash, payouts, respect levels, Benny's Garage
- **Full HUD** — district + flavor text, mission + timer, clock, cash, wanted stars,
  HP/armour bars, weapon + ammo, minimap with route, speedometer + gear + car name, radio
- **Living city** — 22 traffic cars, 40 pedestrians, lit-window towers, neon signs,
  palms, streetlights, dusk sunset over 5 districts
- **4 procedural radio stations** (WebAudio, no audio files), engine hum and sirens
- **Saves** — progress persists in localStorage

## Dossier screenshots

`node tools/shots.mjs` renders the four staged mid-action screenshots into
`screenshots/` (police chase at 137–144 km/h, the vault job on foot, MOST WANTED).

## Credits

Entry for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01) — a GTA 6-style
open-world game. Three.js is vendored under `game/vendor/`.
