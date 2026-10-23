import { describe, expect, it } from "vitest";
import {
  epicOf,
  HOUSE_PITCH,
  layoutStreet,
  carPark,
  roadFits,
  BAY_PITCH,
  CARPARK_GAP,
  SHED,
  STREET_START,
  CLOSE_GAP,
  TERRACE_PITCH,
  TILE_PX,
  YARD_GAP,
  YARD_W,
  type Epic,
} from "../game/street.ts";
import type { Item } from "../server/model.ts";

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
  waitsOn: [],
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
  it("live epics front, closest to done first, shed last; done epics are terraces past the yard", () => {
    const { houses, shed, yard, width } = layoutStreet(
      [
        epic({ id: "half", closed: 2 }),
        epic({ id: "done", status: "closed" }),
        epic({ id: "most", closed: 3 }),
        epic({ id: "all", closed: 4 }),
      ],
      [],
    );
    expect(houses.map((h) => h.id)).toEqual(["done", "all", "most", "half"]);
    expect(houses.map((h) => h.stage)).toEqual(["done", "done", "lockup", "roof"]);
    expect(houses.map((h) => h.sold)).toEqual([true, true, false, false]);
    expect(houses.map((h) => h.no)).toEqual([1, 2, undefined, undefined]);
    expect(shed.x).toBe(STREET_START + 2 * HOUSE_PITCH);
    const phased = layoutStreet([epic({ id: "p", closed: 0, phase: "roof" })], []);
    expect(phased.houses[0].stage).toBe("roof");
    expect(yard).toBe(shed.x + 2 * TILE_PX + 40 + YARD_GAP);
    const close = yard + YARD_W + CLOSE_GAP;
    expect(houses.slice(0, 2).map((h) => h.x)).toEqual([close, close + TERRACE_PITCH]);
    expect(houses.slice(2).map((h) => h.x)).toEqual([STREET_START, STREET_START + HOUSE_PITCH]);
    expect(width).toBe(close + 2 * TERRACE_PITCH + 40);
  });
  it("no done epics: world ends at the yard", () => {
    const { yard, width } = layoutStreet([epic({ id: "half", closed: 2 })], []);
    expect(width).toBe(yard + YARD_W);
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

import { shortTitle } from "../game/street.ts";

describe("car park", () => {
  it("seven cars fit a 1400 road; the rest take bays in rows of six past the street", () => {
    expect(roadFits(1400)).toBe(7);
    const lot = carPark(3000, 8);
    expect(lot.x).toBe(3000 + CARPARK_GAP);
    expect(lot.bays).toHaveLength(8);
    expect(lot.bays.slice(0, 6).map((b) => b.row)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(lot.bays.slice(6).map((b) => b.row)).toEqual([1, 1]);
    expect(lot.bays[1].x - lot.bays[0].x).toBe(BAY_PITCH);
    expect(lot.x + lot.width).toBeGreaterThan(lot.x + lot.bays[5].x);
  });
});

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
