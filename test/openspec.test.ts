import { describe, expect, it } from "vitest";
import path from "node:path";
import { parseTasks, readChanges, toItems } from "../server/openspec.js";

const root = path.join(import.meta.dirname, "fixtures", "openspec");
const meta = async () => ({ updatedAt: new Date("2026-10-01T00:00:00Z"), owner: "dave" });

describe("openspec", () => {
  it("parses checkbox lines only", () => {
    expect(parseTasks("# h\n- [x] a\n* [ ] b\n- c\n  - [X] d")).toEqual([
      { text: "a", done: true, line: 1 },
      { text: "b", done: false, line: 2 },
      { text: "d", done: true, line: 4 },
    ]);
  });
  it("reads active and archived changes", async () => {
    const c = await readChanges(root, meta);
    expect(c.map((x) => [x.name, x.title, x.tasks.length, x.closedAt?.toISOString().slice(0, 10)])).toEqual([
      ["add-login", "Add login", 3, undefined],
      ["remove-legacy", "remove-legacy", 1, undefined],
      ["old-thing", "Old thing", 1, "2026-09-01"],
    ]);
    expect(c[0].owner).toBe("dave");
  });
  it("a change is a house, a checkbox a chit", async () => {
    const [login, , old] = await readChanges(root, meta);
    const items = toItems(login);
    expect(items.map((i) => [i.id, i.trade, i.status, i.parent])).toEqual([
      ["add-login", "epic", "in_progress", undefined],
      ["add-login#1", "task", "closed", "add-login"],
      ["add-login#2", "task", "open", "add-login"],
      ["add-login#3", "task", "open", "add-login"],
    ]);
    expect(items[1].closedAt).toEqual(login.updatedAt);
    const archived = toItems(old);
    expect(archived.every((i) => i.status === "closed" && i.closedAt === old.closedAt)).toBe(true);
  });
});
