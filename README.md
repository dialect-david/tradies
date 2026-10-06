# tradies

A construction site over beads (`bd`) and GitHub PRs (`gh`), in the browser. We're building a house.

- `yarn --cwd ~/Projects/tradies start` from any beads workspace: opens http://localhost:5173
- state lives in bd and gh only; every action is a shell-out from the Vite dev server (`server/api.ts`)
- `node scripts/shot.mjs <url> <out.png> [ms]` screenshots the running game with headless Chrome, console included

| On site                                 | Real                                           |
| --------------------------------------- | ---------------------------------------------- |
| tradie by the house, hat colour = type  | in_progress bead                               |
| ON THE TOOLS board (click a row → card) | in_progress beads, rotates when > 10           |
| crowd mid-site                          | blocked beads, waiting on materials            |
| pile on the esky                        | stale beads (≥7 days untouched)                |
| rain                                    | a PR with red CI                               |
| Kelpie                                  | parks next to the worst thing on site; pat her |
| smoko button                            | everyone sits for ten minutes                  |

Card: claim / note / close for beads, merge for PRs.

Next: sprites (Kenney CC0), house stages per epic, inspector car, materials truck, knock-off.
