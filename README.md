# tradies

Your [beads](https://github.com/gastownhall/beads) issues and GitHub pull requests as a construction site. We're building a house.

![the demo site](https://raw.githubusercontent.com/dialect-david/tradies/main/docs/demo.png)

## Try it

No beads, no gh, nothing saved: a made-up cafe app with every feature lit. Claim a job from the sign, watch the tradie walk to its house, close it and the tinnie flies.

```sh
npx @stottula/tradies --demo
```

## Run

From the repo you want to see:

```sh
npx @stottula/tradies              # this repo
npx @stottula/tradies /path/to/repo
```

Opens http://localhost:5173. The site refreshes when the tracker changes.

Tired of typing it: `npm i -g @stottula/tradies`, then `tradies`. Hacking on tradies itself: clone, `yarn`, `yarn start` from the repo you want to see.

## Requirements

- Node 24
- One tracker in the repo:
  - [beads](https://github.com/gastownhall/beads): `.beads/` present and `bd` on your PATH. Everything on the legend.
  - [OpenSpec](https://github.com/Fission-AI/OpenSpec): `openspec/` present. Changes are houses, tasks are chits; see [OpenSpec mode](#openspec-mode) for what stays quiet.
  - Both present: beads wins; `"source": "openspec"` in `.tradies.json` flips it.
- `gh` (GitHub CLI), logged in, for pull requests. Optional: without it the road is just empty.

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

## Controls

Card: copy a Claude Code prompt (work or plan), copy id, waits-on / blocks links; claim / note / close / merge fold under "by hand". Every board has a find box: id, title, labels, close reason. Briefing: copy as markdown. Drag, wheel or arrow keys to pan.

## For agents

Agents work through `bd` and `gh`; tradies only draws it. It ships one page of the conventions it reads (houses, `needs-*`, `today`, `hs`, close reasons, `refs/reviewed`). Get it in front of your agent one of three ways:

1. Nothing. Every prompt copied from a card ends with "run `tradies prime` first", so the agent fetches it when it starts a job.
2. Every session. Add it to `.claude/settings.json` next to `bd prime`:

   ```json
   {
     "hooks": {
       "SessionStart": [
         { "matcher": "", "hooks": [{ "type": "command", "command": "npx @stottula/tradies prime" }] }
       ]
     }
   }
   ```

3. As a skill. Once, in the repo:

   ```sh
   npx @stottula/tradies init    # writes .claude/skills/tradies/SKILL.md and .agents/skills/tradies/SKILL.md
   ```

   The agent then has `/tradies`. Rerun with `--force` after upgrading.

To read it yourself: `npx @stottula/tradies prime`.

## OpenSpec mode

A workspace with `openspec/` and no `.beads/` is read from [OpenSpec](https://github.com/Fission-AI/OpenSpec) instead (both present: `"source": "openspec"` in config). No `bd` needed; `openspec` on PATH for archive and create.

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

Layered, later wins, each file optional. Defaults:

```json
{
  "foremanLabels": ["needs-"],
  "todayLabels": ["today"],
  "houseTypes": ["epic", "feature"],
  "staleDays": 7,
  "goneDays": 30,
  "reviewAfter": 15,
  "reviewSkill": "/code-review {from}..{to}",
  "hazardLabels": ["hs"]
}
```

1. `config.json` in the tradies repo
2. `.tradies.json` in the workspace, shared vocabulary:
   ```json
   { "foremanLabels": ["needs-", "blocked-on-"], "houseTypes": ["epic"] }
   ```
3. `~/.config/tradies.json`, personal:
   ```json
   {
     "foreman": "Dave",
     "staleDays": 3,
     "reviewSkill": "/open-code-review:delegate-review --from {from} --to {to}"
   }
   ```

`foreman` defaults to `BEADS_ACTOR`, else git `user.name`.

The officer counts commits since `refs/reviewed`; with no marker she counts the last `reviewAfter`. Arm it with `git update-ref refs/reviewed HEAD`.

## Credits

Art: Kenney Tiny Town and Pixel Platformer (CC0); tradies and the Kelpie are pixel strings in `game/sprites.ts`.
