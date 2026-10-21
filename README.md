# tradies

Your [beads](https://github.com/gastownhall/beads) or [OpenSpec](https://github.com/Fission-AI/OpenSpec) work and GitHub pull requests as a construction site. We're building a house.

![the demo site](https://raw.githubusercontent.com/dialect-david/tradies/main/docs/demo.png)

## Try it

```sh
npx @stottula/tradies --demo
```

A made-up cafe app with every feature lit. Nothing is saved: claim a job, close it, watch the tinnie fly.

## Run

```sh
npx @stottula/tradies              # this repo
npx @stottula/tradies /path/to/repo
```

Opens http://localhost:5173, refreshes when the tracker changes.

- Global: `npm i -g @stottula/tradies`, then `tradies`.
- From a clone: `yarn`, then `yarn start` in the repo you want to see.

## Requirements

- Node 24
- A tracker in the repo, one of:
  - beads: `.beads/` and `bd` on PATH
  - OpenSpec: `openspec/`. Fewer features, see [OpenSpec mode](#openspec-mode)
  - Both: beads wins unless `.tradies.json` says `"source": "openspec"`
- `gh` logged in, for pull requests. Optional.

## Legend

| On site                                    | Real                                                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| street of houses, one per epic             | stage = children closed / total (site, slab, frame, roof, lockup, fitout, done); the shed holds beads with no epic; click for open chits                                                              |
| tradie working a house, hat colour = type  | in_progress bead, at its epic's house                                                                                                                                                                 |
| tradie asleep against the wall, Zs         | in_progress bead untouched 7+ days; 💤 on the board                                                                                                                                                   |
| ON THE TOOLS board                         | in_progress beads; click a row for the card                                                                                                                                                           |
| boom gate down, tradies queued behind it   | waiting on the foreman: `needs-*` label, or blocked and assigned to you; click the gate for the list; arm lifts when nobody is waiting                                                                |
| tradies sitting on the esky, empties       | stale beads, 7 to 30 days untouched                                                                                                                                                                   |
| jobs sign                                  | ready beads; "new" under by hand to create one                                                                                                                                                        |
| pallets, tradies arms crossed              | blocked, waiting on materials                                                                                                                                                                         |
| rolled plans on the shed wall              | click for the dependency map (mermaid, click a node for its card, copy the text for your docs); deferred beads behind a button there                                                                  |
| Kelpie on a root blocker                   | HUD says "closing X frees N": the bead whose closure unblocks the most others                                                                                                                         |
| beer wall                                  | closed beads, 24 to a slab; closing one flies a tinnie; click for the last 200 with their close reasons                                                                                               |
| ute                                        | gone home: untouched 30+ days                                                                                                                                                                         |
| inspector's car on the road                | open PR: L plates = draft, signed off = approved, red = CI failed; merge drives it off                                                                                                                |
| rain                                       | a PR with red CI                                                                                                                                                                                      |
| Kelpie                                     | parks next to the worst thing on site                                                                                                                                                                 |
| supervisor with a clipboard                | click for the briefing; knock-off is the same at dusk                                                                                                                                                 |
| smoko                                      | everyone sits down for ten minutes                                                                                                                                                                    |
| health & safety officer, by the supervisor | `reviewAfter` commits since `refs/reviewed`; click to copy a report-only review prompt; the report lands as a git note (`--ref=reviewed`) on the marker and shows in the card; SITE STOPPED at double |
| cones at a house                           | open review findings (`hs` label) parented to that epic; unparented ones at the shed; click for the list                                                                                              |
| new day, toolbox at the gate               | beads labelled `today`: the few picked for you to start on (the backlog stays at the gate); the toolbox or the `today` button reopens it                                                              |

## Using with agents

tradies is read-only. Agents use `bd` and `gh` as normal.

`npx @stottula/tradies prime` prints the conventions tradies draws (labels, houses, close reasons). Give it to your agent:

- Copied prompts already say to run it. Nothing to do.
- Or hook it into every session, `.claude/settings.json`:

  ```json
  {
    "hooks": {
      "SessionStart": [{ "hooks": [{ "type": "command", "command": "npx @stottula/tradies prime" }] }]
    }
  }
  ```

- Or `npx @stottula/tradies init` writes it as a `/tradies` skill.

## OpenSpec mode

No `bd` needed. `openspec` on PATH only for close and new.

| On site           | OpenSpec                                                               |
| ----------------- | ---------------------------------------------------------------------- |
| house             | `openspec/changes/<name>/`, titled from the `# heading` of proposal.md |
| chit              | a `- [ ]` line in tasks.md, id `<name>#<n>`                            |
| stage             | ticked / total boxes; a tick puts the change in progress               |
| closed, beer wall | `openspec/changes/archive/YYYY-MM-DD-<name>/`, closed on that date     |
| who, when         | last commit touching the change folder                                 |
| close             | ticks the box; on the house, `openspec archive <name> -y`              |
| note              | appends to design.md                                                   |
| new               | `openspec new change <kebab-title>`                                    |

Optional frontmatter at the top of proposal.md fills in what OpenSpec has no word for:

```yaml
---
priority: 1
labels: [needs-signoff, today]
blocks: [other-change]
owner: sam
---
```

Without it the boom gate, toolbox, cones and Kelpie stay quiet, and there is no claim.

## Config

`~/.config/tradies.json` for all your repos, `.tradies.json` in a repo to override. Defaults:

```json
{
  "foremanLabels": ["needs-"],
  "todayLabels": ["today"],
  "houseTypes": ["epic", "feature"],
  "staleDays": 7,
  "goneDays": 30,
  "reviewAfter": 15,
  "reviewSkill": "/code-review {from}..{to}",
  "hazardLabels": ["hs"],
  "foreman": "<BEADS_ACTOR, else git user.name>"
}
```

## Inspections

The health & safety officer counts commits since `refs/reviewed`. Start the count:

```sh
git update-ref refs/reviewed HEAD
```

No marker: she counts the last `reviewAfter` commits.

## Credits

Art: Kenney Tiny Town and Pixel Platformer (CC0); tradies and the Kelpie are pixel strings in `game/sprites.ts`.
