# Working with tradies

tradies draws the beads (`bd`) issues and GitHub pull requests of this workspace as a construction site. It only reads; you work through `bd` and `gh` as usual. What you write shows up on site like this.

## Houses

- An `epic` or `feature` with children is a house. Parent new work to one (`bd create ... --parent <epic>`); unparented beads sit at the shed.
- House stage = closed children / total. Closing children builds it; close the epic itself when it is done.

## Labels tradies reads

| Label                | On site                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `needs-*`            | waiting on the foreman at the boom gate. Use when a human must decide, review or sign off. Remove it when answered. |
| `today`              | in the toolbox: the few picked to start on today                 |
| `hs`                 | a hazard cone at its epic: an open review finding. `-t bug -p 1 -l hs --parent <epic>` |

Blocked and assigned to the foreman also queues at the gate.

## Dependencies

- `bd dep add <bead> <blocker> --type blocks`. Blocked beads wait on pallets; the root blocker that frees the most others gets the Kelpie. Prefer to close blockers first.
- `--parent` is the house, not a block.

## Time

- Untouched 7 days: stale, sits on the esky (in progress: asleep). 30 days: gone home in the ute.
- Touch what you are on (`bd update <id> --claim`, `bd note <id> "..."`) so it stays on the tools; close or defer what you are not.

## Closing

- `bd close <id> --reason "<one human line>"`. The reason shows on the beer wall and in the knock-off briefing, so make it the one line you would tell the crew.
- Status words matter: `in_progress` is a tradie at the house, `blocked` pallets, `deferred` behind the plans, `closed` a tinnie.

## Pull requests

- Open PRs are inspectors on the road: draft = L plates, approved = signed off, failing CI = rain over the site. Keep CI green.

## Inspections

- The health & safety officer counts commits since `refs/reviewed`. A review prompt is copied from the site; it files findings as `hs` beads, saves the report as a git note (`--ref=reviewed`) on the reviewed commit and moves `refs/reviewed` there.

## Sources

- `.beads/` present: everything above. `openspec/` only: a change folder is a house, a `- [ ]` in tasks.md a chit, archive = closed; frontmatter in proposal.md carries priority, labels, blocks, owner.
- `--demo`: in memory, nothing saved.
