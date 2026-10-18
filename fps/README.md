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
| Right mouse | Aim (over-the-shoulder zoom; with the sniper: look through the scope, wheel zooms) |
| Left mouse | Shoot (pistol: one shot per click; rifle: hold for full auto). Hip-fire works too but is less accurate |
| Q / E (hold) | Lean left / right while aiming |
| R | Reload (from your reserve ammo; guns never reload on their own — an empty magazine shows red); with a frag in hand: pull the pin (cook) |
| F | Pick up the gun or grenade you're standing next to |
| G | Throwables quick inventory: take out a grenade / cycle types |
| Left mouse (grenade) | Hold to ready (shows the arc and landing spot), release to throw; hold right mouse too for a short underhand toss |
| Esc (grenade) | Cancel a readied or cooked throw (you keep the grenade; also releases the mouse) |
| H | Bandage: 5 s to apply, then +20 hp (one health segment) over 5 s; H / Esc cancels |
| 1 – 4 | Switch to your 1st / 2nd / 3rd / 4th gun (rifle, SMG, sniper, pistol order; shown above the ammo). Also puts a grenade away |
| Tab (hold) | Inventory: your guns with magazine / reserve ammo (the one in hand highlighted), grenades and bandages |
| Space / F (in the plane) | Jump out (only while over the map) |
| Space (free fall) | Open the parachute early (it opens by itself at 35 m) |
| F (eliminated) | Free spectator camera: fly with WASD / Space / C (Shift = fast); F or click goes back to following players |
| Alt (hold) | Free look: orbit the camera while the soldier keeps his heading |
| M | Full map (regions, A–E / 1–5 grid) and the controls list |

Click the page to lock the mouse; Esc releases it.

## Weapons

Everyone starts with a **pistol**. **Rifles**, **SMGs** and **sniper rifles** lie around the map — walk up
to one (it floats over a faint ring) and press **F**; **1–4** pick your 1st, 2nd… gun (in rifle, SMG, sniper,
pistol order — with only the pistol, it's 1).

| Gun | Damage body / head | Kills in | Magazine | Reserve | Fire |
| --- | --- | --- | --- | --- | --- |
| Pistol | 20 / 50 | 5 body / 2 head | 12 | ∞ | semi-auto, ~5/s |
| Rifle | 15 / 35 | 7 body / 3 head | 20 | 60 | full auto, 10/s |
| SMG | 12 / 28 | 9 body / 4 head | 30 | 90 | full auto, ~11/s; ~40% of the rifle's recoil, tighter hip-fire |
| Sniper | 60 / 120 | 2 body / 1 head | 5 | 15 | bolt action, 1 shot / 1.4 s |

With the sniper, holding right mouse looks **through the scope**: first-person, zoom adjustable
with the **mouse wheel** from ~7.3× (9° field of view, the max) down to half that (~3.6×, 18°), reticle with range marks, lower mouse sensitivity and less haze. It's
pinpoint accurate scoped but wild from the hip, and kicks hard. Other guns spread more when
hip-firing and while holding the trigger (bloom), and every shot kicks the view up (recoil).

In multiplayer the host scatters 12 rifles, 12 SMGs and 5 snipers across the map at match start (plus a few
of each around Ranger Camp in the lobby), decides who gets each one, and applies each gun's damage.
Everyone starts each round with just the pistol. The animation library has no rifle animations, so
the two-handed hold is posed procedurally (two-bone arm IK on top of the pistol aim clips). Tune
the guns in `src/weapons.js`.

## Bandages

Press **H** to wrap a bandage (you need one and missing health). Applying takes **5 s** — a
progress bar shows under the crosshair, you can walk but not sprint, aim, shoot or throw, and
**H** again, **Esc** or switching weapons cancels it (you keep the bandage). Then it heals **one
health segment (20 hp) over the next 5 s**, which keeps going even if you fight; the health bar
glows green meanwhile. Bandages come in pairs; carry up to 10 (shown as *H Bandage × N* next to
the health bar). 18 pairs lie around the map per match (a few at Ranger Camp). In multiplayer the
host applies the healing.

## Grenades

Press **G** to open the throwables quick inventory (one slot per type with its count) and take
out a grenade; press **G** again to cycle types. Hold **left mouse** to ready it — a dashed arc and
ring show where it will land — and release to throw (about 30 m overhand). Hold **right mouse** as
you release for a short underhand toss (~8 m). When you run out you switch back to your gun. Press **Esc** to cancel a
throw you've readied or cooked — you keep the grenade and a cooked frag gets its pin back.

**Frag**: PUBG-style 5 s fuse. Normally the fuse starts when you throw; press **R** first to
pull the pin and **cook** it (a red countdown appears under the crosshair) so it blows up sooner
after landing — hold it too long and it goes off in your hand. Blast: 130 damage within 2 m,
falling off to nothing at 9 m (~78 at 4 m); rocks, trees and terrain between you and the blast
block it completely. It can hurt the thrower too. Flash, fireball, debris, a boom and camera shake.

**Smoke**: pops 1.8 s after the throw, builds up over ~2.5 s into a ~6 m cloud, stays thick for
~24 s and thins out over the last 8 s. It blocks sight — including name tags — but not bullets.

**Blue zone grenade** (PUBG had one as a limited item): pops 1.5 s after the throw into a blue
dome that grows over ~3 s to 5.5 m, lasts 12 s and shrinks away. Anyone inside takes 20 hp/s
(10 every half second), so a full-health player dies after 5 s; your screen tints blue while
you're in one. It hurts the thrower too, and cover doesn't help — get out.

Carry up to 4 frags, 4 smokes and 3 blue zone grenades; per match 12 frags, 12 smoke cans and
8 blue zone grenades lie around the map (a few of each at Ranger Camp).

Like PUBG, grenades are client-side visuals: only the throw (release point, velocity, fuse left)
goes over the network, and every client runs the same fixed-step grenade physics (bounces off
ground, trunks and rocks), so it lands in the same place for everyone. Frag and blue zone damage is
decided by the host: it predicts where the grenade will be when it goes off and applies the
damage on its network ticker (which keeps running in a background tab). Add new types in `src/throwables.js`.

## Map and regions

The world is 250 × 250 m, split into nine named regions (Ranger Camp in the middle, Highpine Ridge,
Wolf Hollow, Stone Fields, Mossgrove, Deadfall, Fern Gully, Old Timber, Crow's Nest). The minimap
(top right, north up) shows the area around you and your heading, with the current region and grid
square under it, e.g. `Wolf Hollow · D2`; crossing into a new region shows an "Entering …" banner.
Press **M** for the full map, with the controls listed on its left. While spectating, the map follows the player you're watching.

## Multiplayer (battle royale)

Pick your name and **uniform color** (saved in this browser, so you usually keep it), then
**Host a game** in the start menu and share the 5-letter room code (click it in the top-left
to copy). Friends open the game, type the code and press **Join**; a link like
`http://<host>/?room=ABCDE` pre-fills it. **Play solo** skips networking.

Round flow:

1. **Lobby** — everyone gathers around the central clearing; shots do no damage. With 2+ players
   the host presses **Enter** (or clicks **Start match**; press Esc first to free the mouse).
2. **Match** — everyone starts in a **drop plane** that crosses the map in a straight line, at a
   different random angle every match (the dashed line on the minimap / M map). Press **Space** or
   **F** to jump wherever you like while it's over the map; anyone still aboard at the far side
   is dropped. Free-fall (WASD steers, **W** dives steeper and further), the parachute opens by
   itself 35 m above the ground (or press **Space** earlier), then steer down and land. 5 body shots or 2 headshots eliminate; **there is no respawn**.
   Eliminated players spectate the survivors (click to switch) or press **F** to fly a free camera
   (WASD along the view, Space / C up / down, Shift faster; it passes through everything). The HUD shows players alive.
   The **blue zone** closes in waves (see below); being outside it drains health.
3. **Winner** — the last one standing wins; after 8 s everyone returns to the lobby for the next round.
   The winner gets **"Winner winner chicken dinner!"**, everyone else their placement, and all
   players see the match results: place, kills, damage dealt and time survived for each player
   (12 s before the lobby).

People who join mid-match spectate until the next round.

### Blue zone

Modeled on PUBG, scaled to the 250 m map (~6.5 min instead of ~30). The match starts with the
whole map safe; after 40 s the first **white circle** (next safe zone) appears on the minimap and
full map. Each phase: a countdown while the white circle is shown, then the **blue wall** closes
in on it. Later phases wait less, move at different speeds and hurt more:

| Phase | Safe radius | Wait | Shrink | Damage outside |
| --- | --- | --- | --- | --- |
| 1 | 80 m | 50 s | 55 s | 1 hp/s |
| 2 | 52 m | 40 s | 40 s | 2 hp/s |
| 3 | 32 m | 32 s | 35 s | 3.5 hp/s |
| 4 | 18 m | 25 s | 22 s | 6 hp/s |
| 5 | 8 m | 20 s | 18 s | 9 hp/s |
| 6 | 0 m | 15 s | 22 s | 14 hp/s |

Damage applies once a second and ramps up the longer you stay out (+15% per second, up to 1.5×).
Outside the wall the fog turns blue and thickens and the screen tints blue, more so in later phases.
The HUD shows the countdown and the distance to safety; the maps draw the blue edge, the white
circle and a dashed run line. Like PUBG, the first circle is roughly central but random (its center
anywhere within ~60 m of the middle), and each next circle is placed at random fully inside the
previous one, biased toward bigger jumps, so the final circle can end up anywhere on the playable
ground, near the edges included. The host picks the
circles and applies the damage; tune the table in `src/zone.js`. Host with `?zone=fast` to run the
whole schedule about 6× faster for testing.

How it works:

- **Peer-to-peer, host-authoritative.** Browsers connect directly over WebRTC (via [PeerJS](https://peerjs.com));
  every client connects to the host, whose browser acts as the game server. Each client simulates
  its own movement and sends its state 20×/s; the host rebroadcasts snapshots of everyone.
- **The host decides hits.** Clients draw their own shots instantly, but the host traces every shot
  (player hitboxes scaled to stance, trees/rocks/terrain block), applies damage (100 hp: 20 per body shot, 50 per headshot,
  so 5 body shots or 2 headshots eliminate), and runs the round: spawns, eliminations, the winner, and the return to the lobby.
- **Matchmaking** uses the free public PeerJS broker (`0.peerjs.com`) only to introduce browsers;
  game traffic doesn't go through it.

Uniform colors are chosen to be fair: eight hues on the blue → violet → red arc, all with the same
brightness, none close to the forest's greens, browns or beiges. The host makes sure nobody shares
a color — if yours is taken you get the nearest free one for that game (only a 9th player repeats).

**Dropped connections:** switching windows or backgrounding a tab no longer kicks anyone. Short
WebRTC blips (common in background tabs) get 12 s to recover; a peer counts as gone only after
20 s of silence. If a client's link really drops, the host keeps their player — soldier, health,
place in the match — for 30 s while the client reconnects by itself ("reconnecting…" banner); then
it carries on where it was. The matchmaking link is re-registered automatically too, so the room
code keeps working.

Limits (fine for a proof of concept):

- Best for ~2–8 players. If the host's tab closes, the game ends for everyone (clients give it 30 s to come back).
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
- `src/weapons.js` – gun stats (damage, fire mode, scope) and loot counts; `src/pickups.js` – guns on the ground (visuals, F prompt, random scatter)
- `src/throwables.js` – grenade types, shared bounce physics, smoke clouds, throw-arc preview
- `src/plane.js` – drop plane: random flight line per match, plane position from the match clock, plane model
- `src/zone.js` – blue zone plan (phases, circles) and its state at any time; `src/zone-view.js` draws the wall, fog/tint and timer
- `src/colors.js` – fair uniform palette, saved pick, host-side unique assignment
- `src/regions.js` – region names/centers (nearest-center borders) and grid references
- `src/minimap.js` – bakes a shaded map image once (terrain, trees, rocks, region borders); draws the minimap, full map and region banner
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
