import { describe, expect, it } from "vitest";
import { houses } from "../server/houses.js";
import type { Bead } from "../server/model.js";

const bead = (id: string, over: Partial<Bead> = {}, parent?: string): Bead => ({
  id,
  title: id,
  status: "open",
  priority: 2,
  issue_type: "task",
  updated_at: "2026-10-01T00:00:00Z",
  dependencies: parent ? [{ depends_on_id: parent, type: "parent-child" }] : [],
  ...over,
});

describe("houses", () => {
  const all = [
    bead("epic", { issue_type: "epic" }),
    bead("epic.1", {}, "epic"),
    bead("epic.2", { status: "closed" }, "epic"),
    bead("epic.feat", { issue_type: "feature" }, "epic"),
    bead("epic.feat.a", { status: "closed" }, "epic.feat"),
    bead("feat", { issue_type: "feature" }),
    bead("feat.1", {}, "feat"),
    bead("feat.2", { status: "closed" }, "feat"),
    bead("leaf-feature", { issue_type: "feature" }),
    bead("empty-epic", { issue_type: "epic", status: "closed" }),
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
