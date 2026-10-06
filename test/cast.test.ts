import { describe, expect, it } from "vitest";
import { cast, score } from "../game/cast.js";
import type { Item } from "../server/model.js";

const now = new Date("2026-10-10T00:00:00Z");
const item = (over: Partial<Item>): Item => ({
  kind: "bead",
  id: "b",
  title: "t",
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: new Date("2026-10-09"),
  blocked: false,
  labels: [],
  ...over,
});

describe("cast", () => {
  it("puts each bead in one place", () => {
    const c = cast(
      [
        item({ id: "w", status: "in_progress" }),
        item({ id: "stale-w", status: "in_progress", updatedAt: new Date("2026-09-01") }),
        item({ id: "wait", blocked: true }),
        item({ id: "old", updatedAt: new Date("2026-09-20") }),
        item({ id: "gone", updatedAt: new Date("2026-08-01") }),
        item({ id: "fresh" }),
        item({ id: "#1", kind: "pr", blocked: true }),
      ],
      now,
    );
    expect(c.working.map((i) => i.id)).toEqual(["w", "stale-w"]);
    expect(c.waiting.map((i) => i.id)).toEqual(["wait"]);
    expect(c.smoko.map((i) => i.id)).toEqual(["old"]);
    expect(c.gone.map((i) => i.id)).toEqual(["gone"]);
    expect(c.inspectors.map((i) => i.id)).toEqual(["#1"]);
    expect(c.rain).toBe(true);
    expect(c.ready.map((i) => i.id)).toEqual(["fresh", "old", "gone"]);
  });
  it("kelpie goes to rain first, then P0, then the oldest smoko, and ignores the gone", () => {
    const rain = item({ id: "#1", kind: "pr", blocked: true });
    const p0 = item({ id: "p0", priority: 0 });
    const old = item({ id: "old", updatedAt: new Date("2026-09-20") });
    const gone = item({ id: "gone", updatedAt: new Date("2026-06-01") });
    expect(cast([gone, old], now).worst?.id).toBe("old");
    expect(score(gone, now)).toBe(2);
    expect(cast([old, p0, rain], now).worst?.id).toBe("#1");
    expect(cast([old, p0], now).worst?.id).toBe("p0");
    expect(cast([old, item({ id: "fresh" })], now).worst?.id).toBe("old");
    expect(cast([item({ id: "fresh" })], now).worst).toBeUndefined();
    expect(score(old, now)).toBe(20);
  });
});
