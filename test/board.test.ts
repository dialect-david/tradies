import { describe, expect, it } from "vitest";
import { current, initial, reduce, visible, type State } from "../src/board.js";
import type { Item } from "../src/model.js";

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

const loaded = (): State =>
  reduce(initial, {
    type: "loaded",
    items: [
      item({ id: "low", priority: 3 }),
      item({ id: "hi", priority: 0 }),
      item({ id: "#1", kind: "pr", priority: 1 }),
    ],
  })[0];

describe("board", () => {
  it("shows by urgency and cycles the cursor", () => {
    let s = loaded();
    expect(visible(s).map((i) => i.id)).toEqual(["hi", "#1", "low"]);
    s = reduce(s, { type: "key", key: "k" })[0];
    expect(current(s)?.id).toBe("low");
    s = reduce(s, { type: "key", key: "j" })[0];
    expect(current(s)?.id).toBe("hi");
  });
  it("tab filters beads / prs / all", () => {
    let s = reduce(loaded(), { type: "key", key: "tab" })[0];
    expect(visible(s).every((i) => i.kind === "bead")).toBe(true);
    s = reduce(s, { type: "key", key: "tab" })[0];
    expect(visible(s).map((i) => i.id)).toEqual(["#1"]);
  });
  it("claim emits claim then refresh; only for beads", () => {
    const s = loaded();
    expect(reduce(s, { type: "key", key: "c" })[1].map((e) => e.type)).toEqual(["claim", "refresh"]);
    const onPr = reduce(s, { type: "key", key: "j" })[0];
    expect(reduce(onPr, { type: "key", key: "c" })[1]).toEqual([]);
    expect(reduce(onPr, { type: "key", key: "m" })[1][0]).toEqual({ type: "merge", id: "#1" });
  });
  it("close prompts for a reason, then closes on submit", () => {
    let s = reduce(loaded(), { type: "key", key: "x" })[0];
    expect(s.mode).toBe("close");
    s = reduce(s, { type: "input", value: "done" })[0];
    const [after, fx] = reduce(s, { type: "submit" });
    expect(after.mode).toBe("list");
    expect(fx).toEqual([{ type: "close", id: "hi", reason: "done" }, { type: "refresh" }]);
  });
  it("empty submit cancels; escape cancels", () => {
    let s = reduce(loaded(), { type: "key", key: "n" })[0];
    expect(reduce(s, { type: "submit" })[1]).toEqual([]);
    s = reduce(s, { type: "key", key: "escape" })[0];
    expect(s.mode).toBe("list");
  });
  it("detail shows on enter and any key returns", () => {
    const [, fx] = reduce(loaded(), { type: "key", key: "return" });
    expect(fx[0]?.type).toBe("show");
    let s = reduce(loaded(), { type: "detail", text: "body" })[0];
    expect(s.mode).toBe("detail");
    s = reduce(s, { type: "key", key: "q" })[0];
    expect(s.mode).toBe("list");
  });
  it("reload clamps the cursor", () => {
    const s = reduce(loaded(), { type: "key", key: "G" })[0];
    expect(reduce(s, { type: "loaded", items: [item({})] })[0].cursor).toBe(0);
  });
});
