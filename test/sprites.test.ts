import { describe, expect, it } from "vitest";
import { frameSize, KELPIE_FRAMES, stage, TRADIE_FRAMES } from "../game/sprites.js";

describe("sprites", () => {
  it("frames are rectangular", () => {
    expect(frameSize(TRADIE_FRAMES)).toEqual({ w: 12, h: 19 });
    expect(frameSize(KELPIE_FRAMES)).toEqual({ w: 16, h: 8 });
  });
  it("house stage follows closed ratio and only finishes at zero open", () => {
    expect(stage(0, 0)).toBe("site");
    expect(stage(0, 10)).toBe("site");
    expect(stage(2, 8)).toBe("slab");
    expect(stage(5, 5)).toBe("roof");
    expect(stage(9, 1)).toBe("fitout");
    expect(stage(99, 1)).toBe("fitout");
    expect(stage(10, 0)).toBe("done");
  });
});
