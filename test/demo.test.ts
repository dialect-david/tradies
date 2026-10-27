import { describe, expect, it } from "vitest";
import { cast } from "../game/cast.ts";
import { demoDetail } from "../server/demo.ts";
import { DEFAULTS } from "../server/defaults.ts";
import { houses } from "../server/houses.ts";
import { fixture } from "../server/demo/fixture.ts";
import { glance } from "../server/detail.ts";
import { hasGlance } from "../server/doctor.ts";

const now = new Date("2026-10-21T12:00:00Z");
const { items, prs, foreman } = fixture(now);
const cfg = { ...DEFAULTS, foreman };
const open = items.filter((i) => i.status !== "closed");
const stats = houses(items, cfg);
const c = cast([...open, ...prs], now, cfg, new Set(stats.map((h) => h.id)));

describe("demo fixture", () => {
  it("has unique ids and resolvable parents and waits", () => {
    const ids = new Set(items.map((i) => i.id));
    expect(ids.size).toBe(items.length);
    for (const i of items) {
      if (i.parent) expect(ids.has(i.parent)).toBe(true);
      for (const w of i.waitsOn) expect(ids.has(w)).toBe(true);
    }
  });

  it("builds a street with houses at every stage, one sold, one nested", () => {
    const by = Object.fromEntries(stats.map((h) => [h.id, h]));
    expect(stats.map((h) => h.id)).toEqual(["demo-1", "demo-2", "demo-3", "demo-4", "demo-5"]);
    expect(by["demo-4"].status).toBe("closed");
    expect(by["demo-3"].closed / by["demo-3"].total).toBeGreaterThan(0.7);
    expect(by["demo-2"].closed / by["demo-2"].total).toBeLessThan(0.2);
    expect(by["demo-5"].total).toBeGreaterThan(by["demo-5"].closed);
    expect(items.some((i) => i.parent === "demo-5" && i.trade === "epic")).toBe(true);
    expect(open.some((i) => !i.parent)).toBe(true);
  });

  it("lights every yard feature", () => {
    expect(c.working.length).toBeGreaterThanOrEqual(2);
    expect(c.asleep.length).toBeGreaterThanOrEqual(1);
    expect(c.smoko.length).toBeGreaterThanOrEqual(2);
    expect(c.gone.length).toBeGreaterThanOrEqual(2);
    expect(c.needsYou.length).toBeGreaterThanOrEqual(2);
    expect(c.needsYou.some((i) => i.labels.includes("needs-review"))).toBe(true);
    expect(c.needsYou.some((i) => i.blocked && i.assignee === foreman)).toBe(true);
    expect(c.waiting.length).toBeGreaterThanOrEqual(3);
    expect(c.deferred.length).toBe(2);
    expect(c.today.length).toBe(3);
    expect(c.hazards.length).toBe(2);
    expect(c.hazards.some((i) => i.parent)).toBe(true);
    expect(c.hazards.some((i) => !i.parent)).toBe(true);
    expect(c.blocker?.item.id).toBe("demo-21");
    expect(c.blocker?.frees).toBeGreaterThanOrEqual(3);
    expect(c.worst).toBeDefined();
  });

  it("has inspectors on the road, no rain", () => {
    expect(c.inspectors.map((i) => i.status).sort()).toEqual(["approved", "draft", "review", "review"]);
    expect(c.rain).toBe(false);
    expect(prs.every((p) => p.url && p.id.startsWith("#"))).toBe(true);
  });

  it("has a playable backlog spread across the houses", () => {
    expect(c.ready.length).toBeGreaterThanOrEqual(12);
    const housesWithWork = new Set(c.ready.map((i) => i.parent).filter(Boolean));
    expect(housesWithWork.size).toBeGreaterThanOrEqual(4);
  });

  it("every open bead has a one-sentence glance line, bar the Payments wall of text", () => {
    for (const i of open) {
      if (i.id === "demo-2") continue;
      expect(hasGlance(i.description), i.id).toBe(true);
      const { summary } = glance(i.description);
      expect(summary.length, i.id).toBeLessThanOrEqual(140);
      expect(summary, i.id).toMatch(/^(?!.*[.!?]\s).*[.!?]$/);
    }
    expect(hasGlance(open.find((i) => i.id === "demo-2")!.description)).toBe(false);
    expect(open.filter((i) => i.acceptance).length).toBeGreaterThanOrEqual(6);
  });

  it("fills the beer wall and today's knockoff", () => {
    const done = items.filter((i) => i.status === "closed" && i.closeReason);
    expect(done.length).toBeGreaterThanOrEqual(30);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    expect(done.filter((i) => i.closedAt! >= start).length).toBeGreaterThanOrEqual(3);
    expect(done.some((i) => i.closedAt! < new Date(now.getTime() - 14 * 86_400_000))).toBe(true);
  });
});

describe("demo show", () => {
  it("maps items into regions, empty fields missing", () => {
    const epic = items.find((i) => i.id === "demo-1")!;
    const kids = items.filter((i) => i.parent === epic.id);
    const d = demoDetail(epic, kids, []);
    expect(d.summary).toBeTruthy();
    expect(d.children?.length).toBe(kids.length);
    expect(d).not.toHaveProperty("notes");
    expect(d).not.toHaveProperty("text");
    const bare = demoDetail(
      { ...epic, description: undefined, acceptance: undefined, closeReason: undefined },
      [],
      [],
    );
    expect(bare).toEqual({ summary: "" });
  });
});

describe("demo source", () => {
  it("claim shows in_progress, close lands in closedSince", async () => {
    const { demoSource } = await import("../server/demo.ts");
    const s = demoSource();
    const ready = (await s.items()).find((i) => i.status === "open" && i.parent && !i.blocked)!;
    await s.actions.claim.run(ready.id, {});
    expect((await s.items()).find((i) => i.id === ready.id)?.status).toBe("in_progress");
    await s.actions.close.run(ready.id, { text: "shipped" });
    const since = new Date(Date.now() - 3_600_000);
    expect((await s.closedSince(since)).map((i) => i.id)).toContain(ready.id);
    const d = await s.show(ready.id);
    expect(d.closeReason).toBe("shipped");
    expect(d).not.toHaveProperty("notes");
    await s.actions.note.run(ready.id, { text: "a note" });
    expect((await s.show(ready.id)).notes).toEqual([{ text: "a note", who: foreman }]);
    const id = await s.actions.create.run("", { text: "new job" });
    expect((await s.items()).some((i) => i.id === id)).toBe(true);
  });
});
