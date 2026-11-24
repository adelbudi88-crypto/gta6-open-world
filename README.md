# Porto Azul II — 12 story missions, 6-district turf, crew nitro & EMP, street races, side jobs, 10 vehicles, day-cycle city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/adelbudi88-crypto/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Porto Azul II** is a 3D open-world crime game set in Porto Azul, a sun-soaked coastal
city that slides from golden dusk into neon night. Play as **Daz**, a driver fresh out of
the Marina Bay docks, and climb from street-level jobs to the biggest score the city has
ever seen — with Benny's garage behind you, Tono's nitro under the hood, and Mara's EMP
in your pocket.

## What is in the game

- **12 story missions** with chapter banners (1/12–12/12), timers and payouts, from
  "First Light" ($8,000) to the 3-stage finale **"The Last Score"** ($75,000): casino
  vault, five-star chase through roadblocks and spike strips, then a boat escape from
  the harbor. New chapters: "Street Kings" (3-lap street race, $35,000), "Dock Orders"
  (delivery chain, $28,000), "Turf War" (gang shootout, $44,000).
- **6-district turf standing** — Torre Plaza, The Mirage Strip, Harbor East, Palmline
  Beach, Old Town, Marina Bay. Finish missions and side jobs to raise standing 0–5 in
  each district; the pause dashboard shows the full turf atlas.
- **Crew abilities** — Benny runs garage upgrades (engine, armour, nitro refills);
  Tono gives you **NITRO** (hold Shift, 3 charges, flame + speed burst); Mara gives you
  **EMP** (press X, disables police in a radius for 8s, 60s cooldown, $500 a use).
- **Side jobs & street races** — repeatable taxi fares, dock deliveries and 6-car street
  races ($800–$2,500 a job) that pay cash and raise turf standing.
- **10 vehicles** — 9 named cars (Comet GT, Neon Runner, Azul GT Coupe, Falcon
  Interceptor, Brisa Van, Solara S, Viento LX, Coral Coupe, Duna Pickup) plus the
  drivable **Vela Speedboat** in the harbor. Steal any of them: press E near a car on
  foot to carjack it (drivers flee; witnesses raise your wanted level).
- **5 weapons on the wheel** (hold Q or press 1–5) — Pistol (infinite), HORNET SMG
  (120 reserve), Riot Shotgun (24 shells), Carbine Rifle (90 reserve), Molotov (6,
  area fire).
- **5-star police dispatch** — patrol cars, foot cops, PIT maneuvers, roadblocks at
  wanted 3+, **spike strips** at wanted 4+, and Air One helicopters (two at wanted 5)
  with visible searchlight cones. Rammed or shot cars **explode** and leave burning
  wrecks.
- **A living city** — 32 traffic cars, 60 pedestrians, lit windows, neon casino signs,
  palms on Palmline Beach, docks and boats at Harbor East, and a **day cycle**: dusk
  19:07 melts into night 21:40, neon brightens, streetlights switch on.
- **Full HUD** — district + flavor line + turf standing, mission banner + timer, clock,
  cash, wanted stars, health/armour bars, respect level, minimap with route, speedometer
  + gear + car name, radio, weapon + ammo, nitro/EMP status, spike warnings.
- **Title screen + pause dashboard + 3 save slots** — start screen with slot select,
  Esc/P opens stats, turf atlas, controls and garage.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive (W accelerate, S brake/reverse) |
| Mouse | Camera (drag) |
| E | Enter / exit car, carjack |
| Q (hold) / 1–5 | Weapon wheel / select weapon |
| Click | Fire weapon |
| Shift (hold) | Nitro (Tono, 3 charges) |
| X | EMP pulse (Mara, 60s cooldown, $500) |
| G | Benny's Garage (near the garage marker) |
| T / Y / U | Side jobs: taxi fare / dock delivery / street race |
| C | Change radio station |
| P / Esc | Pause dashboard |
| R | Restart mission |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are staged deterministically: `node tools/shots.mjs` serves the game, opens
`?shot=drive|foot|chase|mission&seed=1`, and writes the four dossier screenshots.

Built with three.js (vendored under `game/vendor/`, no network requests, fully offline).
MIT licensed.
