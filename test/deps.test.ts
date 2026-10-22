import { describe, expect, it } from "vitest";
import { frees, mermaid, rootBlocker } from "../server/deps.ts";
import type { Item } from "../server/model.ts";

const item = (id: string, waitsOn: string[] = [], over: Partial<Item> = {}): Item => ({
  kind: "bead",
  id,
  title: `t ${id}`,
  status: "open",
  priority: 2,
  trade: "task",
  updatedAt: new Date("2026-10-09"),
  blocked: waitsOn.length > 0,
  labels: [],
  waitsOn,
  ...over,
});

describe("deps", () => {
  const items = [item("a"), item("b", ["a"]), item("c", ["b"]), item("d", ["a", "gone"]), item("e")];

  it("counts transitive open dependents, ignoring closed blockers", () => {
    const f = frees(items);
    expect([...f.get("a")!].sort()).toEqual(["b", "c", "d"]);
    expect([...f.get("b")!]).toEqual(["c"]);
    expect(f.has("gone")).toBe(false);
  });

  it("names the bead whose closure frees the most", () => {
    expect(rootBlocker(items)).toEqual({ item: items[0], frees: 3 });
    expect(rootBlocker([item("x")])).toBeUndefined();
  });

  it("draws blocks edges grouped by house", () => {
    const m = mermaid(items, (i) => (i.id === "e" || i.id === "a" ? undefined : "epic-1"));
    expect(m).toContain("graph LR");
    expect(m).toContain('subgraph epic_1["epic-1"]');
    expect(m).toContain("a --> b");
    expect(m).toContain("a --> d");
    expect(m).not.toContain("gone");
    expect(m).not.toContain("e[");
  });
});
