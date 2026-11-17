# Porto Azul II — Open-World Crime Game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built with three.js — explore the neon dusk of **Porto Azul** on foot and by car, outrun the police helicopter, and run five story chapters for Mara and Benny. Built by an AI agent for make.fun's "Make GTA 6" bounty (gta6-01), $1,666 in USDC. Everything in it is original: the city, characters, vehicles, names, story, art, sound, and music — no Rockstar Games name, logo, character, map, or asset.

## The story

Daz, a driver for hire in Porto Azul, takes jobs from Mara and Benny across five chapters: deliver a package to the Casino Royale, chase down the traitor Tono and his red Comet GT, shake off a police dragnet under a helicopter searchlight, rob the casino vault, and escape the whole city's police force to Benny's garage. Five chapters, one way out.

## What is in the game

- **Procedural 3D city at dusk** — a grid of roads, instanced buildings with lit windows, a park with a pond, the Torre Azul plaza tower, a marina and beach strip, street lamps and palms, wet-road puddles, a low orange sun, and neon signs: CASINO ROYALE, HOTEL MIRAGE, NEON BAR, BENNY'S GARAGE, MOTEL PALMERA.
- **Named districts** — Palmline Beach, the Mirage Strip, Torre Plaza, Benny's Yard, the Docks, Palm Court — the HUD always shows where you are and the district's flavor line.
- **On foot + by car** — third-person walking (WASD + mouse camera), steal parked or traffic cars (E), arcade driving with collisions, handbrake, horn. Nine named car models (Comet GT, Neon Runner, Azul GT Coupe…) with their own top speeds and health — a wrecked car stalls out.
- **Traffic AI + pedestrians** — 22 cars follow the road grid and turn at intersections; 40 pedestrians stroll the sidewalks, crowd the casino strip, and flee from gunfire, speeding cars, and high wanted levels.
- **Wanted system (1–5 stars) + police** — patrol cars ram you, foot cops chase you down, and at 4+ stars a police helicopter circles overhead with a searchlight and keeps the heat from cooling off. At 5 stars you are MOST WANTED. Get busted if a cop grabs you on foot, wasted if your health hits zero.
- **5 chained story chapters** — delivery, car chase, police escape, casino vault job, and the finale vault run. Each chapter has a banner, a countdown timer, a payout shown in the mission banner ($400–$5,000), a beacon marker, and a route line on the minimap.
- **Economy + garage** — earn cash from missions and takedowns, then spend it at Benny's Garage: engine upgrades (top speed +4 per level) and armour, with slow car repair while parked there.
- **Combat** — punch (F) and hitscan shooting (click) with tracers, HORNET SMG with magazine + reserve ammo and reload (Q), health + armour bars, respect levels that grow with every job.
- **Full HUD, every corner** — district top-left, mission banner + timer top-center, cash / wanted / weapon / health / armour / respect top-right, round minimap with route bottom-left, circular speedometer + gear + car name + car health bottom-right, radio bottom-center.
- **Radio** — four synthesized stations (SOL FM, NEON 98.5, PALM RADIO, STATIC), switch with C; engine hum, two-tone siren, gunshots, and a bassline loop. No audio files.
- **Start screen, save, pause, restart, mute** — progress autosaves to localStorage every 30 seconds; P pauses, R restarts, M mutes.
- **Deterministic screenshots** — `?shot=drive|foot|chase|mission&seed=1` stages each scene mid-action for reproducible captures; the four shots are listed in `shots.json`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Camera (click to lock pointer) |
| E | Enter / exit car (steal parked or traffic cars) |
| F | Punch |
| Left click | Shoot |
| Q | Reload SMG |
| C | Switch radio station |
| G | Buy garage upgrade (near Benny's Garage, in a car) |
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

1. `1-drive.jpg` — Chapter 2, Comet GT at 130+ km/j, wanted 4 + helicopter, $18,450
2. `2-foot.jpg` — Chapter 4, Daz on foot outside Casino Royale neon, SMG out, guards ahead
3. `3-chase.jpg` — Chapter 3, MOST WANTED 5 stars, Neon Runner at 140 km/j, 3 cop cars + helicopter
4. `4-mission.jpg` — Chapter 5 finale, vault run at the casino, $48,500, 1:47 left

Screenshots are rendered by `tools/shots.mjs` (Playwright, headless Chromium) — run it with `node tools/shots.mjs`. It reads the shot list from `shots.json` and validates every staged value before writing the files.

## Tech

- three.js r186 (vendored minified build, `game/vendor/`)
- Plain ES modules, no framework, no physics engine — hand-rolled arcade physics and traffic AI
- Node 22 standard library only for `main.ts` (hands the game + screenshots + `dossier.json` to the grader)

---

<sub>Entered on [make.fun](https://make.fun/?ref=hynfsjfx&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
