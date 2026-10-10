# tradies

Your [beads](https://github.com/gastownhall/beads) issues and GitHub pull requests as a construction site. We're building a house.

## Requirements

- Node 24 and Yarn
- `bd` (beads) on your PATH
- `gh` (GitHub CLI), logged in, for pull requests. Optional: without it the road is just empty.

## Install

```sh
git clone https://github.com/dialect-david/tradies.git
cd tradies
yarn
```

## Run

From the workspace whose beads you want to see:

```sh
yarn --cwd /path/to/tradies start
```

Opens http://localhost:5173. State lives in `bd` and `gh` only; the site refreshes when `.beads/` changes.

## Legend

| On site                                   | Real                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| street of houses, one per epic            | stage = children closed / total (site, slab, frame, roof, lockup, fitout, done); the shed holds beads with no epic; click for open chits |
| tradie working a house, hat colour = type | in_progress bead, at its epic's house                                                                                                    |
| tradie asleep against the wall, Zs        | in_progress bead untouched 7+ days; 💤 on the board                                                                                      |
| ON THE TOOLS board                        | in_progress beads; click a row for the card                                                                                              |
| tradies at the gate holding clipboards    | waiting on the foreman: `needs-*` label, or blocked and assigned to you                                                                  |
| tradies sitting on the esky, empties      | stale beads, 7 to 30 days untouched                                                                                                      |
| jobs sign                                 | ready beads; claim, or "pin it" to create one                                                                                            |
| pallets, tradies arms crossed             | blocked, waiting on materials                                                                                                            |
| rolled plans on the shed wall             | deferred; the Kelpie ignores them                                                                                                        |
| beer wall                                 | closed beads, 24 to a slab; closing one flies a tinnie                                                                                   |
| ute                                       | gone home: untouched 30+ days                                                                                                            |
| inspector's car on the road               | open PR: L plates = draft, signed off = approved, red = CI failed; merge drives it off                                                   |
| rain                                      | a PR with red CI                                                                                                                         |
| Kelpie                                    | parks next to the worst thing on site                                                                                                    |
| supervisor with a clipboard               | click for the briefing; knock-off is the same at dusk                                                                                    |
| smoko                                     | everyone sits down for ten minutes                                                                                                       |

## Controls

Card: claim / note / close / merge, copy id, copy a Claude Code prompt. Briefing: copy as markdown. Drag, wheel or arrow keys to pan.

## Config

`config.json` in the tradies repo (defaults shown):

```json
{ "foremanLabels": ["needs-"], "houseTypes": ["epic", "feature"], "staleDays": 7, "goneDays": 30 }
```

`foreman` defaults to `BEADS_ACTOR`, else git `user.name`.

## Credits

Art: Kenney Tiny Town and Pixel Platformer (CC0); tradies and the Kelpie are pixel strings in `game/sprites.ts`.
