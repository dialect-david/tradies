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
