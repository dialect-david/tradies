# tradies

A construction site over beads (`bd`) and GitHub PRs (`gh`), in the browser. We're building a house.

- `yarn --cwd ~/Projects/tradies start` from any beads workspace: opens http://localhost:5173
- state lives in bd and gh only; every action is a shell-out from the Vite dev server (`server/api.ts`)
- the site refreshes when anything under `.beads/` changes (a terminal `bd close` flies the tinnie within a second; `bd q` has no file signal and waits for the 30s tick)
- `node scripts/shot.mjs <url> <out.png> [ms]` screenshots the running game with headless Chrome, console included

| On site                                          | Real                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a street of houses, one per epic                 | each house's stage is its children closed over total: site, slab, frame, roof, lockup, fitout; a closed epic gets fence and garden; the shed holds beads with no epic. Click a house for its open chits |
| tradie working a house, hat colour = type        | in_progress bead, at its epic's house                                                                                                                                                                   |
| tradie asleep against the wall, Zs               | in_progress bead untouched 7+ days: claimed and forgotten; the Kelpie's first worry, 💤 on the board                                                                                                    |
| ON THE TOOLS board (click a row → card)          | in_progress beads, rotates when > 10                                                                                                                                                                    |
| pallets by the gate, 3 tradies arms crossed      | blocked beads, waiting on materials (click the pallets for the list)                                                                                                                                    |
| tradies at the gate holding clipboards           | beads labelled `needs-<name>`: waiting on a person, not on work; high Kelpie score, first section of knock-off                                                                                          |
| rolled plans on the shed wall                    | deferred beads (click for the list); the Kelpie ignores them                                                                                                                                            |
| empties on the esky, 3 tradies sitting           | stale beads, 7 to 30 days untouched (click the esky)                                                                                                                                                    |
| ute                                              | gone home: untouched over 30 days, the Kelpie stops caring (click the ute)                                                                                                                              |
| inspector's car on the road, inspector beside it | an open PR: inspecting, L plates for draft, signed off when approved; red tint on failed CI; merge drives it off                                                                                        |
| rain                                             | a PR with red CI                                                                                                                                                                                        |
| Kelpie                                           | parks next to the worst thing on site; pat her                                                                                                                                                          |
| supervisor with a clipboard, by the first house  | click for the briefing: the knock-off card without the sun going down                                                                                                                                   |
| smoko button                                     | everyone sits for ten minutes                                                                                                                                                                           |

Card: claim / note / close for beads, merge for PRs. Every id is a copy chip. 'copy prompt' and 'copy plan prompt' put a ready-to-paste Claude Code prompt for that bead on the clipboard; the briefing and knock-off cards have 'copy as markdown'.
Job board (click the site sign or the HUD button): ready beads as chits by priority, claim on each, "pin it" creates one via `bd q`.

Art: houses from Kenney's Tiny Town, ground and props from Kenney's Pixel Platformer (both CC0, `game/public/kenney`); tradies and the Kelpie are pixel strings in `game/sprites.ts`. Roof colour and wall material vary per epic.
Every closed bead is a beer; 24 make a slab, stacked beside the house. Closing one flies a tinnie onto the pile.
The street is wider than the screen: drag, scroll wheel, or arrow keys to pan. The yard sits past the last house, ordered by how much you need to act: waiting on the foreman, smoko, jobs, materials, plans, beers, ute (clear WIP before picking up new work).

Config in `config.json` at the repo root; missing file means these defaults:

```json
{ "foremanLabels": ["needs-"], "houseTypes": ["epic", "feature"], "staleDays": 7, "goneDays": 30 }
```

A bead is "waiting on the foreman" when it is blocked and assigned to the foreman (`bd assign <id> <you>`), or carries a label starting with one of `foremanLabels`. `foreman` defaults to `BEADS_ACTOR`, else git `user.name`; set it in config to override. With neither in a workspace the gate is simply empty. House signs strip any leading `word:` from an epic title.

PR testing: private repo `dialect-david/tradies-scratch`, open a PR there and run the game from its clone.

Working tradies walk the house front, hammer with dust, and once there is a door they go inside for a bit.

Next: per-epic rooms, Kelpie speech bubbles.
