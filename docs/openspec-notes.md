# OpenSpec 1.14 as seen by tradies

Smoked 2026-10-21 against `openspec` 1.14.3 in a scratch repo. Every tradies action worked unchanged: items, houses, show, close (tick), close (archive), note, create.

## On disk

```
openspec/
  config.yaml                       schema: spec-driven (+ optional context/rules)
  specs/<capability>/spec.md        merged on archive
  changes/
    <name>/
      .openspec.yaml                schema, created: YYYY-MM-DD
      README.md                     "# <name>\n\n<description>"   written by `new change`
      proposal.md  design.md        hand/agent written
      specs/<capability>/spec.md    delta: "## ADDED Requirements" / "### Requirement:" / "#### Scenario:"
      tasks.md                      "## 1. Section" then "- [ ] 1.1 text"
    archive/YYYY-MM-DD-<name>/      whole folder moved, .openspec.yaml included
```

Differences from what tradies assumed:

- `openspec new change` makes `.openspec.yaml` + `README.md` only. No proposal.md, so title fell back to the kebab name. Fixed: title reads README.md heading when proposal.md has none.
- `openspec archive <name> -y` needs the tasks ticked? No: it archived with boxes ticked, did not check; `--skip-specs` not needed. It merges `specs/` into `openspec/specs/` and leaves git dirty (tradies does not commit).
- `.openspec.yaml` `created:` is a usable creation date; `lastModified` in `list --json` is file mtime.

## `openspec list --json`

```json
{
  "changes": [
    {
      "name": "add-login",
      "completedTasks": 0,
      "totalTasks": 4,
      "lastModified": "2026-10-21T10:59:47.364Z",
      "status": "in-progress"
    }
  ],
  "root": { "path": "/abs", "source": "nearest" }
}
```

`status` was `in-progress` with 0 of 4 ticked; it is not a planning-phase signal. Archived changes are not listed.

## `openspec status --change <name> --json`

```json
{
  "changeName": "add-login",
  "schemaName": "spec-driven",
  "changeRoot": "/abs/openspec/changes/add-login",
  "artifactPaths": { "<id>": { "outputPath": "proposal.md", "existingOutputPaths": ["/abs/..."] } },
  "isPlanningComplete": true,
  "isComplete": true,
  "applyRequires": ["tasks"],
  "nextSteps": ["..."],
  "artifacts": [
    { "id": "proposal", "outputPath": "proposal.md", "status": "done", "requires": [] },
    { "id": "specs", "outputPath": "specs/**/*.md", "status": "done", "requires": ["proposal"] },
    { "id": "design", "outputPath": "design.md", "status": "done", "requires": ["proposal"] },
    { "id": "tasks", "outputPath": "tasks.md", "status": "done", "requires": ["specs", "design"] }
  ],
  "root": { "path": "/abs", "source": "nearest" }
}
```

- `artifacts[].status`: `done` | `ready` | `blocked`. `done` = file exists, nothing about content or ticks.
- `isComplete` is true as soon as all four files exist, before any box is ticked. Do not read it as "work done".
- Artifact order and `requires` come from the schema; `spec-driven` is proposal → specs + design → tasks. Stage mapping for bead .3: proposal = slab, design or specs = frame, both = roof, ticks = lockup → fitout, archive = done. Without the CLI the same can be had from file presence via `artifactPaths`-style globs.

## `openspec show <name> --json --deltas-only`

```json
{
  "id": "add-login",
  "title": "Add login",
  "deltaCount": 1,
  "deltas": [
    {
      "spec": "auth",
      "operation": "ADDED",
      "description": "Add requirement: Users SHALL log in with email and password.",
      "requirement": {
        "name": "Email login",
        "text": "Users SHALL log in with email and password.",
        "scenarios": [{ "name": "valid credentials", "rawText": "- **WHEN** ...\n- **THEN** ..." }]
      },
      "requirements": ["...same shape, one per requirement in the delta"]
    }
  ],
  "root": { "path": "/abs", "source": "nearest" }
}
```

`operation` is `ADDED` | `MODIFIED` | `REMOVED` | `RENAMED` from the `## <OP> Requirements` headings. For bead .9 the card can render `spec · operation · requirement.name` then the scenario `rawText` lines; `description` is a one-line summary per delta.

## `openspec validate <name> --json`

`{ items: [{ id, type: "change", valid, issues: [], durationMs }], summary: { totals: { items, passed, failed } }, version: "1.0" }`. Not used by tradies.

## For bead .2 (prime doc)

An agent on an openspec repo: `openspec new change <name>`, write proposal.md with a `# Title` and optional frontmatter, design.md, `specs/<cap>/spec.md` deltas, tasks.md as `- [ ] N.N text` under `## N. Section` headings. Tick boxes as work lands. `openspec archive <name> -y` when all ticked, then commit the move and the merged `openspec/specs/`. No bd, no claim; owner is the last commit author unless `owner:` is in frontmatter.

## Card mapping (`show`)

| On disk | Card region |
|---|---|
| proposal `## Why` (else body minus headings) | summary + more, via `glance` |
| proposal `## What Changes` | more, after Why's detail |
| design.md (title stripped) + proposal `## Impact` | design |
| tasks.md, `- [x]`/`- [ ]` as ✓/○ | done when |
| `openspec show --deltas-only`, else `specs/*/spec.md` | spec delta |
| `git log -- <change dir>` | notes |
