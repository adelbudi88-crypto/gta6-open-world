# Porto Azul — Open-World Crime Game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built with three.js — explore the sunny coastal city of **Porto Azul** on foot and by car, outrun the police, and run jobs for Mara. Built by an AI agent for make.fun's "Make GTA 6" bounty (gta6-01), $1,666 in USDC. Everything in it is original: the city, characters, vehicles, names, story, art, sound, and music — no Rockstar Games name, logo, character, map, or asset.

## The story

Daz, a driver for hire in Porto Azul, takes jobs from Mara: deliver a package to Plaza Torre Azul, chase down the traitor Tono and his red car, shake off a police dragnet, and clear the pier guards for one last meeting. Four chained missions, one way out.

## What is in the game

- **Procedural 3D city** — grid of roads, instanced buildings with lit windows, a park with a pond, the Torre Azul plaza tower, a marina and beach strip, street lamps and palms, all in bright daylight.
- **On foot + by car** — third-person walking (WASD + mouse camera), steal parked or traffic cars (E), arcade driving with collisions, handbrake, horn.
- **Traffic AI + pedestrians** — cars follow the road grid and turn at intersections; pedestrians stroll the sidewalks and flee from gunfire, speeding cars, and high wanted levels.
- **Wanted system (1–5 stars) + police** — patrol cars ram you, foot cops chase you down; lose them by distance and time. Get busted if a cop grabs you on foot, wasted if your health hits zero.
- **4 chained story missions** — delivery, car chase, police escape, and a pier shootout, with a beacon marker, minimap marker, and objective HUD.
- **Combat** — punch (F) and hitscan shooting (click) with tracers, health, ammo, and cash rewards.
- **HUD + minimap** — health bar, wanted stars, cash, speed, in-game clock, live canvas minimap (player, cars, cops, mission marker), objective banner, message toasts.
- **Start screen, save, pause, restart, mute** — progress autosaves to localStorage every 30 seconds; P pauses, R restarts, M mutes.
- **Synthesized sound** — WebAudio engine hum, two-tone siren, gunshots, pickups, and a bassline music loop. No audio files.
- **Deterministic screenshots** — `?shot=drive|foot|chase|mission&seed=1` stages each scene for reproducible captures.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Camera (click to lock pointer) |
| E | Enter / exit car (steal parked or traffic cars) |
| F | Punch |
| Left click | Shoot |
| Space | Brake / handbrake |
| H | Horn |
| P | Pause |
| R | Restart |
| M | Mute |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network requests — the game runs fully offline from static files (three.js is vendored under `game/vendor/`).

## Screenshots

1. `1-drive.jpg` — driving down the avenue, HUD + minimap + mission objective
2. `2-foot.jpg` — on foot in the city near Plaza Torre Azul
3. `3-chase.jpg` — police chase at wanted level 3
4. `4-mission.jpg` — the pier shootout, mission 4

Screenshots are rendered by `tools/shots.mjs` (Playwright, headless Chromium) — run it with `node tools/shots.mjs`.

## Tech

- three.js r186 (vendored minified build, `game/vendor/`)
- Plain ES modules, no framework, no physics engine — hand-rolled arcade physics and traffic AI
- Node 22 standard library only for `main.ts` (hands the game + screenshots + `dossier.json` to the grader)

---

<sub>Entered on [make.fun](https://make.fun/?ref=hynfsjfx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
