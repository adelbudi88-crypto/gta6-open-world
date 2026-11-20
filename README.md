# PORTO AZUL II — 8 story missions, police chases, heists, radio and saves
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game set in **Porto Azul**, a dusk-soaked neon city on the coast. You are **Daz**, a driver with nothing but a fast car and faster friends. Benny, Tono and Mara have eight jobs for you — from a quiet plaza pickup to the last casino vault heist on the Mirage Strip.

## What is in the game

- **8 story missions** with chapter banners, timers and payouts: Welcome to Porto Azul ($9,500), Tono's Debt ($14,000), Heat Wave ($19,000), The Vault Job ($26,000), Casino Vault Run ($28,500), Harbor Lights ($32,000), Air One Down ($41,000) and the finale The Last Score ($60,000).
- **Wanted system, 0–5 stars**: foot cops, pursuit cars, police roadblocks at 3+ stars, PIT maneuvers that spin your car, and Air One — one helicopter at 3 stars, a second at 5, both sweeping a visible searchlight cone over the streets.
- **Weapon wheel** (hold Q, or press 1/2/3): Pistol (infinite), HORNET SMG (24/120), Riot Shotgun (18/24), with HUD ammo.
- **Carjacking**: press E near any parked or traffic car to steal it. The driver flees on foot — and if a cop or pedestrian sees it, the heat goes up a star.
- **A living city**: 32 traffic cars, 60 pedestrians, four districts (Torre Plaza, The Mirage Strip, Palmline Beach, Harbor East), neon casino signs, palms, streetlights, a harbor dock with a boat and smuggle crates, and burning wrecks after high-speed crashes.
- **Economy + garage**: mission payouts, cash, respect levels, and Benny's Garage upgrades (engine, armour, tires).
- **Full HUD**: district + flavor text, mission + timer, day + clock, cash, wanted stars, health + armour bars, respect level, minimap with a route to the target, speedometer + gear + car name, radio station, weapon + ammo.
- **Radio**: four WebAudio synth stations (SOL FM 95.4 Synthwave, Azul 101.1, Neon 88.7, Harbour Talk 720) — press C to switch.
- **Saves**: progress, cash, respect, missions and upgrades persist in localStorage.

## Controls

WASD / arrows — drive & move · Shift — run · E — enter / steal / exit car · Q (hold) — weapon wheel · 1/2/3 — weapons · Click / F — fire · C — radio · G — garage (near Benny's) · M — start mission

## Play it

Serve the game locally with `node serve.ts`, then open http://localhost:8080. No build step, no network requests — the game runs fully offline (three.js is vendored under `game/vendor/`).

## Screenshots

The dossier screenshots are staged mid-action with `node tools/shots.mjs`, which serves the game headlessly, captures all four shots at dusk and verifies them (0 console errors, each ≤ 256 KiB).
