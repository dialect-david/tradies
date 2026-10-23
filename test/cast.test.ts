import { describe, expect, it } from "vitest";
import { byInspection, cast, score } from "../game/cast.ts";
import { DEFAULTS } from "../server/config.ts";
import type { Item } from "../server/model.ts";

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
  waitsOn: [],
  ...over,
});

describe("cast", () => {
  it("keeps houses off the yard unless the foreman is asked", () => {
    const houses = new Set(["h1", "h2", "h3"]);
    const c = cast(
      [
        item({ id: "h1" }),
        item({ id: "h2", status: "in_progress", updatedAt: new Date("2026-09-01") }),
        item({ id: "h3", labels: ["needs-dave"] }),
        item({ id: "job" }),
      ],
      now,
      DEFAULTS,
      houses,
    );
    expect(c.ready.map((i) => i.id)).toEqual(["job"]);
    expect(c.working).toEqual([]);
    expect(c.asleep).toEqual([]);
    expect(c.needsYou.map((i) => i.id)).toEqual(["h3"]);
    expect(c.worst?.id).toBe("h3");
  });

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
        item({ id: "ask", blocked: true, labels: ["needs-dave"] }),
        item({ id: "parked", status: "deferred", updatedAt: new Date("2026-01-01") }),
      ],
      now,
    );
    expect(c.needsYou.map((i) => i.id)).toEqual(["ask"]);
    expect(c.deferred.map((i) => i.id)).toEqual(["parked"]);
    expect(c.working.map((i) => i.id)).toEqual(["w", "stale-w"]);
    expect(c.asleep.map((i) => i.id)).toEqual(["stale-w"]);
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
    const napping = item({ id: "nap", status: "in_progress", updatedAt: new Date("2026-09-25") });
    expect(cast([old, napping], now).worst?.id).toBe("nap");
    const ask = item({ id: "ask", blocked: true, labels: ["needs-dave"] });
    expect(cast([old, ask], now).worst?.id).toBe("ask");
    expect(cast([ask, napping], now).worst?.id).toBe("nap");
    expect(score(item({ status: "deferred", priority: 0 }), now)).toBe(0);
    expect(score(gone, now)).toBe(2);
    expect(cast([old, p0, rain], now).worst?.id).toBe("#1");
    expect(cast([old, p0], now).worst?.id).toBe("p0");
    expect(cast([old, item({ id: "fresh" })], now).worst?.id).toBe("old");
    expect(cast([item({ id: "fresh" })], now).worst).toBeUndefined();
    expect(score(old, now)).toBe(20);
  });
});

describe("config", () => {
  it("foreman label prefixes and day thresholds come from config; defaults match the needs- convention", () => {
    const ask = item({ id: "ask", blocked: true, labels: ["waiting-on:sam"] });
    expect(cast([ask], now).needsYou).toEqual([]);
    expect(
      cast([ask], now, { ...DEFAULTS, foremanLabels: ["waiting-on:"] }).needsYou.map((i) => i.id),
    ).toEqual(["ask"]);
    const mine = item({ id: "mine", blocked: true, assignee: "david" });
    expect(cast([mine], now).needsYou).toEqual([]);
    expect(cast([mine], now, { ...DEFAULTS, foreman: "David" }).needsYou.map((i) => i.id)).toEqual(["mine"]);
    expect(
      cast([item({ id: "open-mine", assignee: "david" })], now, { ...DEFAULTS, foreman: "David" }).needsYou,
    ).toEqual([]);
    const twoDays = item({ id: "2d", updatedAt: new Date("2026-10-08") });
    expect(cast([twoDays], now).smoko).toEqual([]);
    expect(cast([twoDays], now, { ...DEFAULTS, staleDays: 1, goneDays: 3 }).smoko.map((i) => i.id)).toEqual([
      "2d",
    ]);
    expect(cast([twoDays], now, { ...DEFAULTS, staleDays: 1, goneDays: 2 }).gone.map((i) => i.id)).toEqual([
      "2d",
    ]);
  });
});

describe("new day", () => {
  it("lists open beads labelled today, in a house or not, and nothing closed", () => {
    const houses = new Set(["in-house"]);
    const c = cast(
      [
        item({ id: "in-house", labels: ["today"] }),
        item({ id: "yard", labels: ["today"], priority: 1 }),
        item({ id: "done", labels: ["today"], status: "closed" }),
        item({ id: "other", labels: ["needs-dave"] }),
      ],
      now,
      DEFAULTS,
      houses,
    );
    expect(c.today.map((i) => i.id).sort()).toEqual(["in-house", "yard"]);
  });
});

describe("hazards", () => {
  it("picks open beads with a hazard label", () => {
    const c = cast(
      [
        item({ id: "h", labels: ["hs"] }),
        item({ id: "c", labels: ["hs"], status: "closed" }),
        item({ id: "j" }),
      ],
      now,
      DEFAULTS,
    );
    expect(c.hazards.map((i) => i.id)).toEqual(["h"]);
  });
});

describe("root blocker", () => {
  it("is named and pulls the kelpie", () => {
    const c = cast(
      [
        item({ id: "root" }),
        item({ id: "x", waitsOn: ["root"], blocked: true }),
        item({ id: "y", waitsOn: ["root"], blocked: true }),
        item({ id: "z", waitsOn: ["x"], blocked: true }),
      ],
      now,
      DEFAULTS,
    );
    expect(c.blocker).toEqual({ item: expect.objectContaining({ id: "root" }), frees: 3 });
    expect(c.worst?.id).toBe("root");
  });
});

describe("inspectors", () => {
  const pr = (over: Partial<Item>): Item => item({ kind: "pr", trade: "inspector", ...over });
  it("line up failed, approved, review, draft; newest first within a group", () => {
    const cars = [
      pr({ id: "#1", status: "draft", updatedAt: new Date("2026-10-09") }),
      pr({ id: "#2", status: "review", updatedAt: new Date("2026-10-08") }),
      pr({ id: "#3", status: "approved", updatedAt: new Date("2026-10-01") }),
      pr({
        id: "#4",
        status: "review",
        blocked: true,
        labels: ["ci:fail"],
        updatedAt: new Date("2026-10-02"),
      }),
      pr({ id: "#5", status: "review", updatedAt: new Date("2026-10-09") }),
    ];
    expect([...cars].sort(byInspection).map((i) => i.id)).toEqual(["#4", "#3", "#5", "#2", "#1"]);
    expect(cast(cars, now, DEFAULTS, new Set()).inspectors.map((i) => i.id)).toEqual([
      "#4",
      "#3",
      "#5",
      "#2",
      "#1",
    ]);
  });
});
