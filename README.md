# Porto Azul II — 5 story missions, police chases, heists, radio and saves

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Porto Azul II** is a three.js open-world crime game set in a dusk-lit neon city. Play as Daz across five story chapters with Benny, Tono and Mara — deliveries, escapes, a heat wave, a vault job and a casino vault run — with chapter banners, mission timers and payouts up to $25,000.

## Features

- **5-chapter story campaign** — delivery, debt collection, police heat, vault heist and casino run, each with a timer, payout and chapter banner.
- **Wanted system 0–5 stars** — pursuit cars, foot cops and a searchlight helicopter; hit MOST WANTED and the whole city comes for you.
- **Economy + Benny's Garage** — earn cash from missions, buy engine, armour and handling upgrades at the garage.
- **Full HUD** — district name and flavour text, mission banner and timer, day and clock, cash, wanted stars, health and armour bars, weapon and ammo, radio station, minimap with route, speedometer with gear and car name.
- **Living city** — five districts (Torre Plaza, Mirage Strip, Palmline Beach, Old Town, Harbor East), 22 traffic cars, 40 pedestrians, lit-window towers, neon signs, palms and a sunset sky.
- **Radio** — four procedural WebAudio stations, switch with C; engine hum and police sirens.
- **Saves** — progress, cash and upgrades persist in localStorage.
- **Steal cars, shoot, get busted, respawn** — the full loop, playable from the title screen.

## Play

Serve it locally with `node serve.ts`, then open http://localhost:8080.

- **W A S D** — drive / walk, **Shift** — boost
- **E** — enter / exit car, **Space** — shoot, **C** — change radio
- **G** — Benny's Garage (near the garage), **M** — start next mission, **R** — respawn

## Tech

Three.js (vendored under `game/vendor/three.module.min.js`), plain ES modules, no network requests, no build step. Screenshots are staged mid-action with `node tools/shots.mjs`.
