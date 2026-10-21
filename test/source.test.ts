import { describe, expect, it } from "vitest";
import { pickSource } from "../server/source.js";

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
});
