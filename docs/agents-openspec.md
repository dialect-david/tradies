# Working with tradies (OpenSpec)

tradies draws the OpenSpec changes and GitHub pull requests of this workspace as a construction site. It only reads; you work through `openspec` and git as usual. What you write shows up on site like this.

## Houses

- A change folder `openspec/changes/<name>/` is a house. Make one with `openspec new change <name>`, then write `proposal.md` with a `# Title`, `design.md`, and `specs/<capability>/spec.md` deltas.
- Every `- [ ] N.N text` in `tasks.md` (under `## N. Section` headings) is a chit at that house. House stage = ticked / total.

## Doing the work

- Tick boxes in `tasks.md` as each lands; the first tick puts a tradie at the house.
- All ticked: `openspec archive <name> -y`, then commit the move and the merged `openspec/specs/`. Archived = closed, a tinnie on the beer wall dated from the archive folder.
- You are the owner of what you last committed. No claim; commit to the change folder to stay on the tools.

## Frontmatter tradies reads

Optional, at the top of `proposal.md`. Without it the boom gate, toolbox, cones and Kelpie stay quiet.

```yaml
---
priority: 1
labels: [needs-signoff, today]
blocks: [other-change]
owner: sam
---
```

| Key / label     | On site                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `priority`      | 0 urgent to 4; default 2                                                                  |
| {foremanLabels} | waiting on the foreman at the boom gate: a human must decide, review or sign off          |
| {todayLabels}   | in the toolbox: the few picked to start on today                                          |
| {hazardLabels}  | a hazard cone: an open review finding                                                     |
| `blocks`        | this change waits on those; pallets until they are archived, root blocker gets the Kelpie |
| `owner`         | overrides the last commit author                                                          |

A task whose text starts with `<label>:` carries that label, so `- [ ] {hazardLabels}: server/x.ts: ...` is a cone at its house.

## Time

- Change folder untouched {staleDays} days: stale, on the esky (in progress: asleep). {goneDays} days: gone home in the ute.

## Writing so the card reads at a glance

The site shows a change as a card: title, first paragraph of `## Why`, tasks as "done when", design, close reason. Write for that.

- `# Title` ≤60ch, verb first.
- `## Why`: first paragraph one sentence that stands alone, blank line, then the detail.
- Tasks are the acceptance: one testable line each.
- `design.md`: free.
- Archive commit message: one sentence.

Old changes are fine as they are; this is for what you write next.

## Pull requests

- Open PRs are inspectors on the road: draft = L plates, approved = signed off, failing CI = rain over the site. Keep CI green.

## Inspections

- The health & safety officer counts commits since `refs/reviewed`. A review prompt is copied from the site; it files findings as `- [ ] {hazardLabels}: <file>: <one line>` under a `## Hazards` heading in the reviewed change's `tasks.md` (or `openspec/changes/hazards/tasks.md` when none fits), saves the report as a git note (`--ref=reviewed`) on the reviewed commit and moves `refs/reviewed` there.
