import { describe, expect, it } from "vitest";
import { CONVENTIONS, fillPrompt, pickSource } from "../server/source.ts";

describe("pickSource", () => {
  it("beads by default, openspec only when it is the one present", () => {
    expect(pickSource({ beads: true, openspec: false })).toBe("beads");
    expect(pickSource({ beads: false, openspec: true })).toBe("openspec");
    expect(pickSource({ beads: false, openspec: false })).toBe("beads");
    expect(pickSource({ beads: true, openspec: true })).toBe("beads");
  });
  it("config breaks a tie but cannot pick what is not there", () => {
    expect(pickSource({ beads: true, openspec: true }, "openspec")).toBe("openspec");
    expect(pickSource({ beads: true, openspec: false }, "openspec")).toBe("beads");
  });
  it("demo wins when asked", () => {
    expect(pickSource({ beads: true, openspec: true, demo: true }, "openspec")).toBe("demo");
    expect(pickSource({ beads: false, openspec: false }, "demo")).toBe("beads");
  });
});

describe("prompts", () => {
  const item = { id: "add-login#2", title: "wire the form" };
  it("fills id, title and change", () => {
    expect(fillPrompt("{id} / {title} / {change}", item)).toBe(
      `add-login#2 / wire the form / add-login ${CONVENTIONS}`,
    );
  });
  it("every source names the item and points at prime", async () => {
    const { beads } = await import("../server/beads.ts");
    const { openspec } = await import("../server/openspec.ts");
    const { demoSource } = await import("../server/demo.ts");
    for (const s of [beads, openspec, demoSource()])
      for (const t of [s.prompts.work, s.prompts.plan]) {
        expect(s.prompts.review).toContain("{hazard}");
        expect(fillPrompt(t, item)).toContain("add-login#2");
        expect(fillPrompt(t, item)).toContain("tradies prime");
      }
  });
});
