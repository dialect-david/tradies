import { describe, expect, it } from "vitest";
import { houses } from "../server/houses.ts";
import type { Item } from "../server/model.ts";

const bead = (id: string, over: Partial<Item> = {}, parent?: string): Item => ({
  kind: "bead",
  id,
  title: id,
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  blocked: false,
  waitsOn: [],
  parent,
  labels: [],
  ...over,
});

describe("houses", () => {
  const all = [
    bead("epic", { trade: "epic" }),
    bead("epic.1", {}, "epic"),
    bead("epic.2", { status: "closed" }, "epic"),
    bead("epic.feat", { trade: "feature" }, "epic"),
    bead("epic.feat.a", { status: "closed" }, "epic.feat"),
    bead("feat", { trade: "feature" }),
    bead("feat.1", {}, "feat"),
    bead("feat.2", { status: "closed" }, "feat"),
    bead("leaf-feature", { trade: "feature" }),
    bead("empty-epic", { trade: "epic", status: "closed" }),
  ];
  it("epics always; other house types only with children; nested ones fold into the outer house", () => {
    const h = houses(all, { houseTypes: ["epic", "feature"] });
    expect(h.map((x) => [x.id, x.closed, x.total, x.status])).toEqual([
      ["epic", 2, 4, "open"],
      ["feat", 1, 2, "open"],
      ["empty-epic", 0, 0, "closed"],
    ]);
  });
  it("with only epics configured a feature with children is just a bead in the epic", () => {
    const h = houses(all, { houseTypes: ["epic"] });
    expect(h.map((x) => x.id)).toEqual(["epic", "empty-epic"]);
    expect(h[0]).toMatchObject({ closed: 2, total: 4 });
  });
});

describe("floors", () => {
  it("lists child epics with their own tally, nested ones included", () => {
    const b = (id: string, over: Partial<Item> = {}, parent?: string): Item => ({
      kind: "bead",
      id,
      title: id,
      status: "open",
      priority: 2,
      trade: "task",
      updatedAt: new Date("2026-10-01T00:00:00Z"),
      blocked: false,
      waitsOn: [],
      parent,
      labels: [],
      ...over,
    });
    const all = [
      b("top", { trade: "epic" }),
      b("top.1", {}, "top"),
      b("sub", { trade: "epic" }, "top"),
      b("sub.1", { status: "closed" }, "sub"),
      b("sub.2", {}, "sub"),
      b("deep", { trade: "epic" }, "sub"),
      b("deep.1", {}, "deep"),
      b("flat", { trade: "epic" }),
    ];
    const [top, flat] = houses(all, { houseTypes: ["epic"] });
    expect(top!.floors).toEqual([
      { id: "sub", title: "sub", status: "open", closed: 1, total: 4 },
      { id: "deep", title: "deep", status: "open", closed: 0, total: 1 },
    ]);
    expect(top!.total).toBe(6);
    expect(flat!.floors).toBeUndefined();
  });
});
