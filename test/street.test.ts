import { describe, expect, it } from "vitest";
import { epicOf, HOUSE_PITCH, layoutStreet, SHED, STREET_START, type Epic } from "../game/street.js";
import type { Item } from "../server/model.js";

const item = (over: Partial<Item>): Item => ({
  kind: "bead",
  id: "b",
  title: "t",
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: new Date("2026-10-01"),
  blocked: false,
  labels: [],
  ...over,
});
const epic = (over: Partial<Epic>): Epic => ({
  id: "e",
  title: "e",
  status: "open",
  closed: 0,
  total: 4,
  ...over,
});

describe("street", () => {
  it("done houses first, then closest to done; shed last", () => {
    const { houses, shed } = layoutStreet(
      [
        epic({ id: "half", closed: 2 }),
        epic({ id: "done", status: "closed" }),
        epic({ id: "most", closed: 3 }),
      ],
      [],
    );
    expect(houses.map((h) => h.id)).toEqual(["done", "most", "half"]);
    expect(houses.map((h) => h.stage)).toEqual(["done", "lockup", "roof"]);
    expect(houses[1]!.x).toBe(STREET_START + HOUSE_PITCH);
    expect(shed.x).toBe(STREET_START + 3 * HOUSE_PITCH);
  });
  it("beads live at their epic, through a parent chain; orphans in the shed", () => {
    const items = [
      item({ id: "e", trade: "epic" }),
      item({ id: "e.1", parent: "e" }),
      item({ id: "e.1.a", parent: "e.1" }),
      item({ id: "lone" }),
    ];
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(epicOf(items[2]!, byId, new Set(["e"]))).toBe("e");
    expect(epicOf(items[3]!, byId, new Set(["e"]))).toBe(SHED);
    const { houses, shed } = layoutStreet([epic({ id: "e" })], items);
    expect(houses[0]!.items.map((i) => i.id)).toEqual(["e.1", "e.1.a"]);
    expect(shed.items.map((i) => i.id)).toEqual(["lone"]);
  });
});

import { shortTitle } from "../game/street.js";

describe("shortTitle", () => {
  it("drops the kind prefix and everything after a dash or colon, then caps at a word", () => {
    expect(shortTitle("epic: personalise your Sal — voice, style")).toBe("personalise your Sal");
    expect(shortTitle("arch: classify-retrieve-compose — Clef owns")).toBe("classify-retrieve-compose");
    expect(shortTitle("epic: tradie lifecycle — signup to leaving")).toBe("tradie lifecycle");
    expect(shortTitle("Scenarios at ~100% by close reading: harness")).toBe("Scenarios at ~100% by…");
    expect(shortTitle("epic: business")).toBe("business");
    expect(shortTitle("chore: tidy the ute")).toBe("tidy the ute");
    expect(shortTitle("http://x")).toBe("http://x");
  });
});
