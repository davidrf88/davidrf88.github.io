# Forest Walk (POC)

A tiny open-world forest in the browser built with [three.js](https://threejs.org) — no build step.

## Run

```
npm start          # or: python -m http.server 5180
```

Open http://localhost:5180. (A local server is required; opening `index.html` directly won't load the models.)

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (character strafes, facing the camera) |
| Shift | Sprint (forward only; also stands you up from a crouch) |
| Space | Jump; next to a low log/stump: vault over it; next to a rock or boulder whose lip is below head height: vault up on top; stand up from crouch/prone |
| C | Toggle crouch |
| Z | Toggle prone (crawl) |
| Right mouse | Aim (over-the-shoulder zoom) |
| Left mouse | Shoot (hip-fire works too) |
| Q / E (hold) | Lean left / right while aiming |
| R | Reload (12-round magazine) |
| Alt (hold) | Free look: orbit the camera while the soldier keeps his heading |
| Wheel | Camera distance |

Click the page to lock the mouse; Esc releases it.

## Multiplayer (battle royale)

Pick **Host a game** in the start menu and share the 5-letter room code (click it in the top-left
to copy). Friends open the game, type the code and press **Join**; a link like
`http://<host>/?room=ABCDE` pre-fills it. **Play solo** skips networking.

Round flow:

1. **Lobby** — everyone gathers around the central clearing; shots do no damage. With 2+ players
   the host presses **Enter** (or clicks **Start match**; press Esc first to free the mouse).
2. **Match** — players are dropped as far apart as possible across the map (farthest-point
   sampling, ~450 m apart with two players). 3 hits eliminate; **there is no respawn**.
   Eliminated players spectate the survivors (click to switch). The HUD shows players alive.
3. **Winner** — the last one standing wins; after 8 s everyone returns to the lobby for the next round.

People who join mid-match spectate until the next round.

How it works:

- **Peer-to-peer, host-authoritative.** Browsers connect directly over WebRTC (via [PeerJS](https://peerjs.com));
  every client connects to the host, whose browser acts as the game server. Each client simulates
  its own movement and sends its state 20×/s; the host rebroadcasts snapshots of everyone.
- **The host decides hits.** Clients draw their own shots instantly, but the host traces every shot
  (player hitboxes scaled to stance, trees/rocks/terrain block), applies damage (34 per hit, 3 to
  eliminate), and runs the round: spawns, eliminations, the winner, and the return to the lobby.
- **Matchmaking** uses the free public PeerJS broker (`0.peerjs.com`) only to introduce browsers;
  game traffic doesn't go through it.

Limits (fine for a proof of concept):

- Best for ~2–8 players. If the host leaves, the game ends for everyone.
- Some strict networks (corporate, some mobile carriers) block direct WebRTC and would need a TURN relay.
- Clients are trusted for their own movement, so cheating is possible.
- To play with others they must reach the page too: serve it on your LAN (`npm start` and share
  `http://<your-ip>:5180`) or publish the folder on any static host (e.g. GitHub Pages).

### Moving to our own server later

Game code only talks to the `Transport` interface (`src/net/transport.js`). A Node WebSocket
server would add a `ws-transport.js` that speaks the same messages (`src/net/protocol.js`);
`Session` (`src/net/session.js`) holds the host logic that could move onto the server, and the
world is seed-generated, so a server can rebuild it for hit checks.

## Structure

- `src/terrain.js` – procedural heightmap terrain (Perlin fBm), `heightAt()` for exact ground height
- `src/forest.js` – loads the nature models and scatters thousands of instances (InstancedMesh) + trunk colliders
- `src/soldier.js` – soldier visuals shared by local and remote players: recolored model, gear on bones, animation layers (aim/shoot/reload), lean
- `src/player.js` – local controller: stances, directional locomotion, vaulting, shooting, health, network state
- `src/remote-player.js` – other players: interpolated soldier + name tag
- `src/multiplayer.js` – glue between the network session and the game (remotes, shots, damage, HUD)
- `src/net/` – `transport.js` (interface + background-safe ticker), `peer-transport.js` (PeerJS), `protocol.js` (messages), `session.js` (host authority, hit tracing)
- `src/ui.js` – start menu and HUD (room code, health, kill feed, overlays)
- `src/combat.js` – shot effects (tracer, muzzle flash, impact puffs, synthesized gunshot)
- `src/main.js` – renderer, lights, fog/sky, input, third-person camera, world ray tracing, start menu

## Assets (all CC0)

- Trees, rocks, plants: [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) — see `assets/nature/LICENSE-Kenney-NatureKit.txt`
- Character + animations: [Quaternius Universal Animation Library 1 & 2](https://quaternius.com/packs/universalanimationlibrary.html) (mannequin recolored and equipped with procedural helmet/vest/pistol) — see `assets/character/LICENSE-Quaternius-UAL.txt`
