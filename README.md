# tradies

A construction site over beads (`bd`) and GitHub PRs (`gh`), in the browser. We're building a house.

- `yarn --cwd ~/Projects/tradies start` from any beads workspace: opens http://localhost:5173
- state lives in bd and gh only; every action is a shell-out from the Vite dev server (`server/api.ts`)
- the site refreshes when anything under `.beads/` changes (a terminal `bd close` flies the tinnie within a second; `bd q` has no file signal and waits for the 30s tick)
- `node scripts/shot.mjs <url> <out.png> [ms]` screenshots the running game with headless Chrome, console included

| On site                                          | Real                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| tradie by the house, hat colour = type           | in_progress bead                                                                                                 |
| ON THE TOOLS board (click a row → card)          | in_progress beads, rotates when > 10                                                                             |
| pallets by the gate, 3 tradies arms crossed      | blocked beads, waiting on materials (click the pallets for the list)                                             |
| empties on the esky, 3 tradies sitting           | stale beads, 7 to 30 days untouched (click the esky)                                                             |
| ute                                              | gone home: untouched over 30 days, the Kelpie stops caring (click the ute)                                       |
| inspector's car on the road, inspector beside it | an open PR: inspecting, L plates for draft, signed off when approved; red tint on failed CI; merge drives it off |
| rain                                             | a PR with red CI                                                                                                 |
| Kelpie                                           | parks next to the worst thing on site; pat her                                                                   |
| smoko button                                     | everyone sits for ten minutes                                                                                    |

Card: claim / note / close for beads, merge for PRs.
Job board (click the site sign or the HUD button): ready beads as chits by priority, claim on each, "pin it" creates one via `bd q`.

Art: tiles from Kenney's Pixel Platformer (CC0, `game/public/kenney`); tradies and the Kelpie are pixel strings in `game/sprites.ts`.
Every closed bead is a beer; 24 make a slab, stacked beside the house. Closing one flies a tinnie onto the pile.
House stage = closed beads over all beads: site → slab → frame → roof → lockup → fitout → done (only at zero open).

PR testing: private repo `dialect-david/tradies-scratch`, open a PR there and run the game from its clone.

Working tradies walk the house front, hammer with dust, and once there is a door they go inside for a bit.

Next: per-epic rooms, Kelpie speech bubbles.
