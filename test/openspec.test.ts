import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  changeLog,
  dependsOn,
  detailOf,
  sections,
  gitMeta,
  kebab,
  openQuestions,
  localDate,
  parseFront,
  parseTasks,
  phase,
  readChanges,
  renderDeltas,
  setOwner,
  specFiles,
  tick,
  tickKey,
  tickedSince,
  toItems,
} from "../server/openspec.ts";

const root = path.join(import.meta.dirname, "fixtures", "openspec");
const byName = async (name: string) => (await readChanges(root, meta)).find((c) => c.name === name)!;
const meta = async (dirs: string[]) =>
  new Map(dirs.map((d) => [d, { updatedAt: new Date("2026-10-01T00:00:00Z"), owner: "dave" }]));

describe("openspec", () => {
  it("parses checkbox lines only", () => {
    expect(parseTasks("# h\n- [x] a\n* [ ] b\n- c\n  - [X] d")).toEqual([
      { text: "a", done: true, line: 1 },
      { text: "b", done: false, line: 2 },
      { text: "d", done: true, line: 4 },
    ]);
  });
  it("reads active and archived changes", async () => {
    const c = await readChanges(root, meta);
    expect(c.map((x) => [x.name, x.title, x.tasks.length, x.closedAt])).toEqual([
      ["add-login", "Add login", 3, undefined],
      ["just-made", "Just made", 0, undefined],
      ["later", "Later", 1, undefined],
      ["remove-legacy", "Remove legacy", 1, undefined],
      ["old-thing", "Old thing", 1, new Date(2026, 8, 1)],
    ]);
    expect(c.find((x) => x.name === "add-login")!.owner).toBe("dave");
    expect(c.find((x) => x.name === "remove-legacy")!.owner).toBe("sam");
  });
  it("one git log gives every change its last commit; stat fallback for the rest", async () => {
    const changes = path.join(root, "changes");
    const login = path.join(changes, "add-login");
    const ghost = path.join(changes, "ghost");
    const m = await gitMeta([login, ghost], root);
    expect(m.get(login)!.owner).toBeTruthy();
    expect(m.get(login)!.updatedAt.getTime()).toBeGreaterThan(0);
    expect(m.get(ghost)).toEqual({ updatedAt: new Date(0) });
    const old = path.join(changes, "archive", "2026-09-01-old-thing");
    expect((await gitMeta([old], root)).get(old)!.added).toMatch(/^openspec source, read side/);
  });
  it("an archived change carries the move's commit subject as its close reason", async () => {
    const old = (
      await readChanges(
        root,
        async (d) => new Map(d.map((x) => [x, { updatedAt: new Date(0), added: "ship it" }])),
      )
    ).find((c) => c.name === "old-thing")!;
    expect(old.closeReason).toBe("ship it");
    expect(toItems(old).every((i) => i.closeReason === "ship it")).toBe(true);
    expect((await byName("add-login")).closeReason).toBeUndefined();
  });
  it("a change is a house, a checkbox a chit", async () => {
    const [login, old] = await Promise.all([byName("add-login"), byName("old-thing")]);
    const items = toItems(login);
    expect(items.map((i) => [i.id, i.trade, i.status, i.parent])).toEqual([
      ["add-login", "epic", "in_progress", undefined],
      ["add-login#1", "task", "closed", "add-login"],
      ["add-login#2", "task", "open", "add-login"],
      ["add-login#3", "task", "open", "add-login"],
    ]);
    expect(items[1].closedAt).toBeUndefined();
    const archived = toItems(old);
    expect(archived.every((i) => i.status === "closed" && i.closedAt === old.closedAt)).toBe(true);
  });
  it("a label: prefix on a task is a label", async () => {
    const c = await byName("add-login");
    c.tasks.push({ text: "hs: server/x.ts: leaks the key", done: false, line: 9 });
    const kid = toItems(c).at(-1)!;
    expect(kid.labels).toEqual(["hs"]);
    expect(toItems(c)[1].labels).toEqual([]);
  });
  it("phase follows the artifacts, then the ticks, then the archive", async () => {
    const by = Object.fromEntries((await readChanges(root, meta)).map((c) => [c.name, c]));
    expect(by["just-made"].has).toEqual({ proposal: false, design: false, specs: false });
    expect(phase(by["just-made"])).toBe("site");
    expect(phase({ ...by["just-made"], has: { proposal: true, design: false, specs: false } })).toBe("slab");
    expect(phase(by["remove-legacy"])).toBe("frame");
    expect(phase({ ...by["remove-legacy"], has: { proposal: true, design: true, specs: true } })).toBe(
      "roof",
    );
    expect(phase(by["add-login"])).toBe("lockup");
    expect(
      phase({ ...by["add-login"], tasks: by["add-login"].tasks.map((t) => ({ ...t, done: true })) }),
    ).toBe("fitout");
    expect(phase(by["old-thing"])).toBe("done");
  });
  it("proposal body: open questions queue at the gate, depends on blocks; frontmatter wins", async () => {
    expect(openQuestions("# T\n## Open Questions\n- [ ] a\n- [x] b\n- [ ] c\n## Next\n- [ ] d")).toBe(2);
    expect(openQuestions("# T\n- [ ] a")).toBe(0);
    expect(dependsOn("Depends on: a, `b` ,c\n")).toEqual(["a", "b", "c"]);
    expect(dependsOn("- depends on: x")).toEqual(["x"]);
    expect(dependsOn("nothing")).toEqual([]);
    const login = await byName("add-login");
    expect([login.questions, login.dependsOn]).toEqual([1, ["remove-legacy", "old-thing"]]);
    const [epic] = toItems(login, new Set(["remove-legacy"]), { needs: "needs-" });
    expect([epic.labels, epic.waitsOn, epic.blocked]).toEqual([
      ["needs-questions"],
      ["remove-legacy", "old-thing"],
      true,
    ]);
    expect(toItems(login)[0].labels).toEqual([]);
    const legacy = await byName("remove-legacy");
    expect(toItems(legacy, new Set(), { needs: "needs-" })[0].labels).toEqual(["needs-signoff"]);
  });
  it("claim: owner frontmatter or a branch named after the change puts it on the tools", async () => {
    expect(setOwner("# T\n", "sam")).toBe("---\nowner: sam\n---\n# T\n");
    expect(setOwner("---\npriority: 1\n---\n# T", "sam")).toBe("---\npriority: 1\nowner: sam\n---\n# T");
    expect(setOwner("---\nowner: old\npriority: 1\n---\n", "sam")).toBe(
      "---\nowner: sam\npriority: 1\n---\n",
    );
    const legacy = await byName("remove-legacy");
    expect(toItems(legacy)[0].status).toBe("in_progress");
    const fresh = await byName("just-made");
    expect(toItems(fresh)[0].status).toBe("open");
    const [onIt] = toItems(fresh, new Set(), { branch: "feat/just-made", actor: "kim" });
    expect([onIt.status, onIt.owner]).toEqual(["in_progress", "kim"]);
    expect(toItems(fresh, new Set(), { branch: "just-made-2" })[0].status).toBe("open");
  });
  it("a box ticked in a commit since the date is closed then; untouched ticks have no date", async () => {
    const login = await byName("add-login");
    const file = path.join(login.dir, "tasks.md");
    const when = new Date("2026-10-20T09:00:00Z");
    const ticks = new Map([[tickKey(file, "1.1 session table"), when]]);
    const [, done, open] = toItems(login, new Set(), { ticks });
    expect(done.closedAt).toEqual(when);
    expect(open.closedAt).toBeUndefined();
    expect(toItems(login)[1].closedAt).toBeUndefined();
    const real = await tickedSince(new Date("2026-10-01"), root);
    expect(real.get(tickKey(path.join(root, "changes", "later", "tasks.md"), "wire it"))).toBeInstanceOf(
      Date,
    );
    expect(real.has(tickKey(file, "1.1 session table"))).toBe(false);
  });
  it("spec delta: cli json as one line per requirement, else the delta files", async () => {
    expect(
      renderDeltas([
        {
          spec: "auth",
          operation: "ADDED",
          requirement: { name: "Email login", scenarios: [{ name: "valid credentials" }] },
        },
        { spec: "cart", operation: "MODIFIED", requirements: [{ name: "Totals" }, { name: "Rounding" }] },
        { spec: "x", operation: "REMOVED" },
      ]),
    ).toBe("ADDED auth: Email login\n  · valid credentials\nMODIFIED cart: Totals\nMODIFIED cart: Rounding");
    const login = await byName("add-login");
    expect(await specFiles(login.dir)).toMatch(/^## auth\n## ADDED Requirements/);
    expect(await specFiles((await byName("just-made")).dir)).toBe("");
  });
  it("archive dates are local midnight", () => {
    const d = localDate("2026-09-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 1, 0]);
  });
  it("ticks the nth checkbox in place", () => {
    expect(tick("- [x] a\n\n- [ ] b [ ] c\n", 2)).toBe("- [x] a\n\n- [x] b [ ] c\n");
    expect(() => tick("- [ ] a", 2)).toThrow("no task 2");
  });
  it("kebabs a title into a change name", () => {
    expect(kebab("  Add Login (v2)! ")).toBe("add-login-v2");
  });
  it("frontmatter: inline and block lists, numbers, owner; absent means defaults", () => {
    expect(
      parseFront(
        "---\npriority: 1\nlabels: [needs-review, today]\nblocks:\n  - a\n  - b\nowner: sam\n---\n# T",
      ),
    ).toEqual({
      priority: 1,
      labels: ["needs-review", "today"],
      blocks: ["a", "b"],
      owner: "sam",
    });
    expect(parseFront("# T\n---\npriority: 1\n---")).toEqual({});
    expect(parseFront("---\npriority: high\nlabels:\n---")).toEqual({ labels: [] });
    expect(parseFront("---\npriority: 99\n---")).toEqual({ priority: 4 });
  });
  it("frontmatter drives priority, labels, and blocked against active changes", async () => {
    const legacy = await byName("remove-legacy");
    const [epic, kid] = toItems(legacy, new Set(["add-login"]));
    expect([epic.priority, epic.labels, epic.waitsOn, epic.blocked, epic.owner]).toEqual([
      1,
      ["needs-signoff"],
      ["add-login", "old-thing"],
      true,
      "sam",
    ]);
    expect([kid.priority, kid.labels, kid.blocked]).toEqual([1, [], false]);
    expect(toItems(legacy, new Set())[0].blocked).toBe(false);
  });
  it("show: Why glances, What Changes and Impact fold, ticks stay, deltas and log are their own", async () => {
    const login = await byName("add-login");
    const notes = [{ who: "dave", when: "2026-10-01T00:00:00Z", text: "login: session table" }];
    const d = await detailOf(login, "ADDED auth: Email login", notes);
    expect(d.summary).toBe("Nobody can sign in yet, so nothing is personal.");
    expect(d.more).toBe(
      "Sessions were ripped out with the legacy auth and never replaced.\n\n## What Changes\n\n- a session table\n- a login route and form",
    );
    expect(d.design).toBe("## Impact\n\nTouches `auth` and the UI shell.");
    expect(d.acceptance).toContain("- [x] 1.1 session table");
    expect(d.deltas).toBe("ADDED auth: Email login");
    expect(d.notes).toEqual(notes);
    expect(d).not.toHaveProperty("text");
    expect(d).not.toHaveProperty("children");
  });
  it("show: no Why glances the body minus headings; design.md is the design", async () => {
    const d = await detailOf(await byName("remove-legacy"), "", []);
    expect(d.summary).toBe("The old auth module is dead weight.");
    expect(d.more).toBe("Nothing imports it since the rewrite.");
    expect(d.design).toBe("sessions in a table");
    expect(d).not.toHaveProperty("deltas");
    expect(d).not.toHaveProperty("notes");
    const bare = await detailOf(await byName("later"), "", []);
    expect(bare.summary).toBe("");
    expect(bare.acceptance).toBe("- [x] wire it");
  });
  it("sections and change log", async () => {
    expect([...sections("# T\n## Why\n\na\n\n## What Changes\nb\n").entries()]).toEqual([
      ["why", "a"],
      ["what changes", "b"],
    ]);
    const log = await changeLog((await byName("add-login")).dir);
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]).toMatchObject({ who: expect.any(String), when: expect.stringMatching(/^\d{4}-/) });
  });
});
