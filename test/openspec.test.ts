import { describe, expect, it } from "vitest";
import path from "node:path";
import { kebab, localDate, parseFront, parseTasks, readChanges, tick, toItems } from "../server/openspec.js";

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
    expect(c.map((x) => [x.name, x.title, x.tasks.length, x.closedAt])).toEqual([
      ["add-login", "Add login", 3, undefined],
      ["remove-legacy", "Remove legacy", 1, undefined],
      ["old-thing", "Old thing", 1, new Date(2026, 8, 1)],
    ]);
    expect(c[0].owner).toBe("dave");
    expect(c[1].owner).toBe("sam");
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
    expect(items[1].closedAt).toBeUndefined();
    const archived = toItems(old);
    expect(archived.every((i) => i.status === "closed" && i.closedAt === old.closedAt)).toBe(true);
  });
  it("archive dates are local midnight", () => {
    const d = localDate("2026-09-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 1, 0]);
  });
  it("ticks the nth checkbox in place", () => {
    expect(tick("- [x] a\n\n- [ ] b [ ] c\n", 2)).toBe("- [x] a\n\n- [x] b [ ] c\n");
    expect(() => tick("- [ ] a", 2)).toThrow("no task 2");
  });
  it("kebabs a title into a change name", () => {
    expect(kebab("  Add Login (v2)! ")).toBe("add-login-v2");
  });
  it("frontmatter: inline and block lists, numbers, owner; absent means defaults", () => {
    expect(
      parseFront(
        "---\npriority: 1\nlabels: [needs-review, today]\nblocks:\n  - a\n  - b\nowner: sam\n---\n# T",
      ),
    ).toEqual({
      priority: 1,
      labels: ["needs-review", "today"],
      blocks: ["a", "b"],
      owner: "sam",
    });
    expect(parseFront("# T\n---\npriority: 1\n---")).toEqual({});
    expect(parseFront("---\npriority: high\nlabels:\n---")).toEqual({ labels: [] });
  });
  it("frontmatter drives priority, labels, and blocked against active changes", async () => {
    const [, legacy] = await readChanges(root, meta);
    const [epic, kid] = toItems(legacy, new Set(["add-login"]));
    expect([epic.priority, epic.labels, epic.waitsOn, epic.blocked, epic.owner]).toEqual([
      1,
      ["needs-signoff"],
      ["add-login", "old-thing"],
      true,
      "sam",
    ]);
    expect([kid.priority, kid.labels, kid.blocked]).toEqual([1, [], false]);
    expect(toItems(legacy, new Set())[0].blocked).toBe(false);
  });
});
