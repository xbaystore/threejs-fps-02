# EMBERLINE — a three.js tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/xbaystore/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/xbaystore/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical shooter in the style Counter-Strike made famous, built on
three.js 0.187.0 as plain static files — no build step, no network. Open `game/index.html`
in desktop Chrome and play single-player against bots.

## The game

Two teams fight over the Kestrel Foundry, a dusk-lit industrial yard. **Vanguard** (you and
two allies) attacks; **Cinder** (five bots) defends. First to 5 rounds takes the match.

- **Rounds** last 100 seconds. Win by eliminating the other team, by detonating the ember
  charge, or — as Cinder — by running the clock out or defusing the charge.
- **Objective:** carry the ember charge to Site A (the furnace) or Site B (the container
  depot), hold **E** inside the ring for 3.5 s to plant it, then defend it for 35 s while
  Cinder retakes and defuses.
- **Money:** $800 to start, +$300 per kill, +$300 per plant, +$3,250 for a round win,
  +$1,900 for a loss. Spend it in the buy menu (**B**) during the 12 s buy phase.
- **Arsenal:** P9 sidearm (free), VK-7 rifle ($2,700), Hornet-9 SMG ($1,500), Longbow DMR
  ($4,100), frag and smoke grenades ($300 each), Kevlar ($650). Headshots pay more;
  firing on the move spreads your shots; stopping to aim pays.
- **Bots** walk the map's waypoint lanes, hold site angles, react to what they see and
  hear, fire in bursts, retake a planted site and defuse the charge.
- **HUD:** health and armour, ammunition, money, round timer, round score, alive counts,
  kill feed, hitmarker, plant/defuse progress and a buy menu.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock; drag works too) |
| Click | Fire |
| R | Reload |
| 1 / 2 / 3 | Switch weapon |
| 4 / 5 | Throw frag / smoke grenade |
| E | Plant the charge (hold, inside a site ring) |
| B | Buy menu (buy phase) |
| Ctrl / C | Crouch |
| Space | Jump |

## Play it

Serve `game/` with any static server and open `index.html`:

```sh
cd game && python3 -m http.server 8080
```

Screenshots: `?shot=start|play|plant|end&seed=N` renders a deterministic frame and sets
`window.__shotReady` when it is ready to capture.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with `vendor/makefun-threejs.ts`.
- `game/index.html` — the page and the HUD.
- `game/src/` — one module per job: `palette`, `audio`, `input`, `world`, `mover`,
  `weapons`, `bots`, `bomb`, `state`, `hud`, `main` (boot, the fixed-step loop, the rules).
- `game/vendor/three/` — three.js 0.187.0, byte for byte from npm.
- `screenshots/` — real renders of this game's own code.

## License

MIT — see `LICENSE`.
