import { describe, expect, it } from "vitest";
import { glance } from "../server/detail.ts";

describe("glance", () => {
  it("empty stays empty", () => expect(glance("")).toEqual({ summary: "" }));
  it("blank line splits paragraph from detail", () =>
    expect(glance("One line.\n\nMore here.\nAnd more.")).toEqual({ summary: "One line.", more: "More here.\nAnd more." }));
  it("single short paragraph is all summary", () =>
    expect(glance("Just the one sentence here")).toEqual({ summary: "Just the one sentence here" }));
  it("long paragraph without blank line falls back to first sentence", () => {
    const d = `First sentence is short. ${"x".repeat(200)} more words.`;
    const g = glance(d);
    expect(g.summary).toBe("First sentence is short.");
    expect(g.more?.startsWith("xxx")).toBe(true);
  });
  it("one long sentence cuts at a word boundary with an ellipsis and keeps the whole text", () => {
    const d = `${"word ".repeat(60)}end`;
    const g = glance(d);
    expect(g.summary.endsWith("…")).toBe(true);
    expect(g.summary.length).toBeLessThanOrEqual(141);
    expect(g.more).toBe(d);
  });
  it("newline without blank line splits too", () =>
    expect(glance("Head\nbody")).toEqual({ summary: "Head", more: "body" }));
});

describe("tree and tally", () => {
  it("nests under sub-epics and counts every row", async () => {
    const { tree, tally } = await import("../server/detail.ts");
    const { fixture } = await import("../server/demo/fixture.ts");
    const { items } = fixture(new Date("2026-10-21T12:00:00Z"));
    const kids = tree("demo-5", items);
    const reports = kids.find((r) => r.id === "demo-6")!;
    expect(reports.children?.length).toBe(4);
    expect(tally(reports.children!)).toEqual({ closed: 1, total: 4 });
    expect(tally(kids).total).toBe(items.filter((i) => i.parent === "demo-5" || i.parent === "demo-6").length);
  });
});
