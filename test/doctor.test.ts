import { describe, expect, it } from "vitest";
import {
  configProblems,
  agentPrompt,
  proposeEpics,
  renderGroups,
  dataChecks,
  failed,
  hasGlance,
  readiness,
  render,
  setupChecks,
  type Env,
} from "../server/doctor.ts";
import { fixture } from "../server/demo/fixture.ts";
import { houses } from "../server/houses.ts";
import { DEFAULTS } from "../server/defaults.ts";
import type { Item } from "../server/model.ts";

const env = (over: Partial<Env> = {}): Env => ({
  nodeVersion: "v24.1.0",
  exists: (p) => p === ".beads",
  which: () => true,
  ghAuthed: () => true,
  configFiles: [],
  hasRef: () => true,
  ...over,
});

describe("doctor setup", () => {
  it("all green on a wired-up beads repo", () => {
    const c = setupChecks(env());
    expect(c.every((x) => x.ok)).toBe(true);
    expect(c.map((x) => x.id)).toEqual(["node", "tracker", "cli", "gh", "config", "reviewed"]);
    expect(failed(c)).toEqual([]);
  });
  it("no tracker fails hard with the three ways in", () => {
    const c = setupChecks(env({ exists: () => false }));
    expect(failed(c).map((x) => x.id)).toEqual(["tracker"]);
    expect(c.find((x) => x.id === "tracker")!.fix).toMatch(/bd init.*openspec init.*--demo/);
    expect(c.some((x) => x.id === "cli")).toBe(false);
  });
  it("openspec only wants openspec on PATH", () => {
    const c = setupChecks(env({ exists: (p) => p === "openspec", which: (cmd) => cmd !== "openspec" }));
    expect(failed(c).map((x) => x.id)).toEqual(["cli"]);
  });
  it("gh and refs/reviewed are optional", () => {
    const c = setupChecks(env({ ghAuthed: () => false, hasRef: () => false }));
    expect(failed(c)).toEqual([]);
    expect(render(c)).toContain("· gh not logged in");
    expect(render(c)).toContain("    git update-ref refs/reviewed HEAD");
  });
  it("old node fails", () => {
    expect(failed(setupChecks(env({ nodeVersion: "v22.3.0" }))).map((x) => x.id)).toEqual(["node"]);
  });
  it("config files are named with their problems", () => {
    const c = setupChecks(
      env({
        configFiles: [
          { path: "~/.config/tradies.json" },
          { path: ".tradies.json", text: '{"staleDays": "7", "fooLabels": [], "source": "beads"}' },
        ],
      }),
    );
    const cfg = c.filter((x) => x.id === "config");
    expect(cfg).toHaveLength(1);
    expect(cfg[0].ok).toBe(false);
    expect(cfg[0].says).toBe(".tradies.json: staleDays must be a number > 0; unknown key fooLabels");
  });
  it("configProblems", () => {
    expect(configProblems("{")).toEqual([expect.stringMatching(/^not JSON/)]);
    expect(configProblems("[]")).toEqual(["not an object"]);
    expect(configProblems('{"foremanLabels":["needs-"],"foreman":"Sam"}')).toEqual([]);
    expect(configProblems('{"source":"demo"}')).toEqual(["source must be beads or openspec"]);
  });
});

const now = new Date("2026-10-22T09:00:00");
const bead = (id: string, over: Partial<Item> = {}): Item => ({
  kind: "bead",
  id,
  title: id,
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: now,
  blocked: false,
  waitsOn: [],
  labels: [],
  ...over,
});

describe("doctor data", () => {
  it("demo fixture passes everything", () => {
    const { items } = fixture(now);
    const open = items.filter((i) => i.status !== "closed");
    const closed = items.filter((i) => i.status === "closed");
    const c = dataChecks({
      items: open,
      houses: houses(items, DEFAULTS),
      closed,
      cfg: DEFAULTS,
      source: "beads",
      now,
    });
    expect(c.filter((x) => !x.ok)).toEqual([]);
    expect(readiness(c)).toBe("site readiness 7/7");
    const g = c.find((x) => x.id === "glance")!;
    expect(g.optional).toBe(true);
    expect(g.says).toMatch(/^\d+ of \d+ open beads have a glance line$/);
  });
  it("glance share is informational: optional, never counted, quiet under five beads", () => {
    const wall = "First sentence. Second sentence on the same line.";
    const few = dataChecks({
      items: [bead("a", { description: wall }), bead("b")],
      houses: [],
      closed: [],
      cfg: DEFAULTS,
      source: "beads",
      now,
    });
    expect(few.find((x) => x.id === "glance")).toMatchObject({
      ok: true,
      optional: true,
      says: "0 of 2 open beads have a glance line",
    });
    const items = Array.from({ length: 10 }, (_, i) =>
      bead(`b${i}`, { description: i < 3 ? "One line that stands alone." : i < 6 ? wall : undefined }),
    );
    const c = dataChecks({ items, houses: [], closed: [], cfg: DEFAULTS, source: "beads", now });
    const g = c.find((x) => x.id === "glance")!;
    expect(g.ok).toBe(false);
    expect(g.says).toBe("3 of 10 open beads have a glance line");
    expect(g.fix).toContain("tradies prime");
    expect(failed(c).map((x) => x.id)).not.toContain("glance");
    expect(readiness(c)).toMatch(/\/7$/);
    expect(render(c)).toContain("· 3 of 10 open beads have a glance line");
  });
  it("hasGlance", () => {
    expect(hasGlance()).toBe(false);
    expect(hasGlance("  ")).toBe(false);
    expect(hasGlance("One sentence that stands alone.")).toBe(true);
    expect(hasGlance("One sentence.\n\nThen the detail, as long as you like.")).toBe(true);
    expect(hasGlance("One sentence.\nDetail with no blank line.")).toBe(false);
    expect(hasGlance("Two sentences. On one line.")).toBe(false);
    expect(hasGlance(`${"x".repeat(141)}\n\nmore`)).toBe(false);
  });
  it("a flat backlog of fresh unlabelled beads fails five of seven", () => {
    const items = [bead("a"), bead("b"), bead("c")];
    const c = dataChecks({ items, houses: [], closed: [], cfg: DEFAULTS, source: "beads", now });
    expect(c.filter((x) => !x.ok).map((x) => x.id)).toEqual([
      "houses",
      "parented",
      "blocks",
      "reasons",
      "labels",
      "working",
    ]);
    expect(c.find((x) => x.id === "houses")!.fix).toContain("-t epic");
    expect(readiness(c)).toBe("site readiness 1/7");
  });
  it("stale ratio and close reasons use thresholds", () => {
    const old = new Date(now.getTime() - 10 * 86_400_000);
    const items = [bead("a", { updatedAt: old }), bead("b", { updatedAt: old }), bead("c")];
    const closed = [bead("x", { status: "closed", closeReason: "done" }), bead("y", { status: "closed" })];
    const c = dataChecks({ items, houses: [], closed, cfg: DEFAULTS, source: "beads", now });
    expect(c.find((x) => x.id === "stale")!.ok).toBe(false);
    expect(c.find((x) => x.id === "reasons")!.ok).toBe(true);
  });
  it("a full road with no filter is flagged, optional, not counted", () => {
    const pr = (n: number): Item => ({ ...bead(`#${n}`), kind: "pr", trade: "inspector" });
    const prs = Array.from({ length: 50 }, (_, i) => pr(i));
    const full = dataChecks({ items: [], houses: [], closed: [], prs, cfg: DEFAULTS, source: "beads", now });
    const check = full.find((x) => x.id === "prs")!;
    expect(check.ok).toBe(false);
    expect(check.optional).toBe(true);
    expect(check.says).toContain("road is full");
    expect(readiness(full)).toMatch(/\/7$/);
    const filtered = dataChecks({
      items: [],
      houses: [],
      closed: [],
      prs,
      cfg: { ...DEFAULTS, prs: { author: "@me" } },
      source: "beads",
      now,
    });
    expect(filtered.find((x) => x.id === "prs")!.ok).toBe(true);
  });
  it("openspec skips labels and reasons", () => {
    const c = dataChecks({ items: [], houses: [], closed: [], cfg: DEFAULTS, source: "openspec", now });
    expect(c.map((x) => x.id)).toEqual(["houses", "parented", "blocks", "stale", "working"]);
    expect(readiness(c)).toMatch(/\/5$/);
  });
});

const loose = (id: string, title: string, over: Partial<Item> = {}): Item => ({
  kind: "bead",
  id,
  title,
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: new Date(),
  blocked: false,
  waitsOn: [],
  labels: [],
  ...over,
});

describe("doctor proposes epics", () => {
  const thirty: Item[] = [
    ...[1, 2, 3, 4].map((n) => loose(`a-${n}`, `Auth thing ${n}`, { labels: ["auth"] })),
    ...[1, 2, 3].map((n) => loose(`b-${n}`, `billing: invoice ${n}`)),
    ...[1, 2, 3].map((n) => loose(`c-${n}`, `[ui] button ${n}`)),
    loose("d-1", "Decide schema"),
    loose("d-2", "Write migration", { waitsOn: ["d-1"] }),
    loose("d-3", "Backfill rows", { waitsOn: ["d-2"] }),
    loose("e-1", "Pick a logger", { labels: ["ops"] }),
    loose("e-2", "Rotate logs", { labels: ["ops"] }),
    ...[1, 2, 3, 4, 5].map((n) => loose(`f-${n}`, `odd job ${n}`)),
    ...[1, 2, 3, 4, 5].map((n) => loose(`g-${n}`, `closed ${n}`, { status: "closed" })),
    ...[1, 2, 3].map((n) => loose(`h-${n}`, `housed ${n}`, { parent: "epic-1", labels: ["auth"] })),
    loose("i-1", "auth: leftover with label", { labels: ["auth"] }),
  ];
  const groups = proposeEpics(thirty);
  const by = Object.fromEntries(groups.map((g) => [g.name, g]));

  it("labels first, then prefixes, then blocks chains", () => {
    expect(groups.map((g) => g.why)).toEqual([
      "label auth",
      "title prefix billing",
      "title prefix ui",
      "blocks chain from d-1",
    ]);
  });
  it("a bead lands in one group, first rule wins", () => {
    expect(by.auth.ids).toEqual(["a-1", "a-2", "a-3", "a-4", "i-1"]);
    expect(by.billing.ids).toEqual(["b-1", "b-2", "b-3"]);
    expect(by.ui.ids).toEqual(["c-1", "c-2", "c-3"]);
    expect(by["Decide schema"].ids.sort()).toEqual(["d-1", "d-2", "d-3"]);
  });
  it("skips small labels, housed, closed and leftovers", () => {
    const all = groups.flatMap((g) => g.ids);
    expect(all.some((id) => /^(e|f|g|h)-/.test(id))).toBe(false);
  });
  it("renders bd lines or openspec lines", () => {
    const bd = renderGroups(groups, "beads");
    expect(bd).toContain('bd create "auth" -t epic');
    expect(bd).toContain("bd update b-1 --parent <epic>");
    expect(renderGroups(groups, "openspec")).toContain("openspec new change decide-schema");
    expect(renderGroups([], "beads")).toBe("");
  });
});

describe("doctor agent prompt", () => {
  const checks = [
    { id: "houses", ok: false, says: "no houses", fix: 'bd create "<area>" -t epic' },
    { id: "stale", ok: true, says: "fine" },
  ];
  const groups = [{ name: "auth", why: "label auth", ids: ["a-1", "a-2"] }];
  it("prime first, failing signals, proposals, bd wording", () => {
    const p = agentPrompt(checks, groups, "beads");
    expect(p.startsWith("Run `npx @stottula/tradies prime` first")).toBe(true);
    expect(p).toContain("- no houses. Fix: bd create");
    expect(p).not.toContain("fine");
    expect(p).toContain('epic "auth" (label auth) and parent a-1, a-2');
  });
  it("openspec wording, empty when all green", () => {
    expect(agentPrompt(checks, groups, "openspec")).toContain("tasks.md");
    expect(agentPrompt([{ id: "x", ok: true, says: "ok" }], [], "beads")).toBe("");
  });
});
