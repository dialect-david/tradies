import { describe, expect, it } from "vitest";
import { cast } from "../game/cast.js";
import { DEFAULTS } from "../server/defaults.js";
import { houses } from "../server/houses.js";
import { fixture } from "../server/demo/fixture.js";

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

  it("has inspectors on the road and rain", () => {
    expect(c.inspectors.map((i) => i.status).sort()).toEqual(["approved", "draft", "review", "review"]);
    expect(c.rain).toBe(true);
    expect(prs.every((p) => p.url && p.id.startsWith("#"))).toBe(true);
  });

  it("has a playable backlog spread across the houses", () => {
    expect(c.ready.length).toBeGreaterThanOrEqual(12);
    const housesWithWork = new Set(c.ready.map((i) => i.parent).filter(Boolean));
    expect(housesWithWork.size).toBeGreaterThanOrEqual(4);
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
