# PORTO AZUL II — open-world crime in a dusk-lit neon city

An original open-world crime game (three.js, vendored under `game/vendor/`):
explore the city of Porto Azul on foot and by car, steal and drive cars, run
from the police, and play through a 5-chapter story with Benny, Tono and Mara.

## What is in the game

- **A living city at dusk** — Torre Plaza, The Mirage Strip, Palmline Beach,
  Old Town and Harbor East; traffic, pedestrians, lit windows, neon signs,
  palms, a sunset sky and wet-looking roads.
- **5 story missions** — delivery, debt collection, a heat-wave escape, a
  vault job and the Casino Vault Run, each with a chapter banner, a timer
  and a cash payout.
- **Wanted system** — 0–5 stars, police cars, foot cops and a helicopter
  with a searchlight; reach MOST WANTED at 5 stars.
- **Economy and progression** — cash, mission payouts, Benny's Garage
  upgrades (engine, armour, tyres), respect levels, health and armour,
  a HORNET SMG with ammo.
- **Full HUD** — minimap with route, mission + timer, cash, wanted stars,
  health/armour, weapon, radio station, day + clock, district + flavour
  line, speedometer + gear + car name.
- **Radio** — 4 procedural WebAudio stations (C to change), engine hum
  and police sirens.
- **Save** — progress autosaves to localStorage; continue from the title
  screen.

## Controls

WASD drive / walk · Shift boost · Space handbrake · E enter / exit car ·
F shoot · R reload · C radio · B garage (near Benny's Garage) · P pause ·
mouse drag orbits the camera · Enter start.

## Play it

`node serve.ts` then open http://localhost:8080. No build step, no
network requests — everything loads from `game/`.

## Screenshots

The 4 dossier screenshots are staged mid-action by `tools/shots.mjs`
(`node tools/shots.mjs`): a high-speed chase, a foot firefight on the
Strip, a MOST WANTED chase and the final vault run.
