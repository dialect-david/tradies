import { describe, expect, it } from "vitest";
import { frameSize, KELPIE_FRAMES, stage, TRADIE_FRAMES } from "../game/sprites.js";

describe("sprites", () => {
  it("frames are rectangular", () => {
    expect(frameSize(TRADIE_FRAMES)).toEqual({ w: 12, h: 19 });
    expect(TRADIE_FRAMES).toHaveLength(7);
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

import { CAN_FRAMES, SLAB_FRAMES, slabs, UTE_FRAMES } from "../game/sprites.js";

describe("beers", () => {
  it("a slab is 24 closed beads, the rest are loose tinnies", () => {
    expect(slabs(0)).toEqual({ slabs: 0, cans: 0 });
    expect(slabs(23)).toEqual({ slabs: 0, cans: 23 });
    expect(slabs(24)).toEqual({ slabs: 1, cans: 0 });
    expect(slabs(515)).toEqual({ slabs: 21, cans: 11 });
  });
  it("sprites are rectangular", () => {
    expect(frameSize(SLAB_FRAMES)).toEqual({ w: 22, h: 9 });
    expect(frameSize(CAN_FRAMES)).toEqual({ w: 4, h: 6 });
    expect(frameSize(UTE_FRAMES)).toEqual({ w: 32, h: 12 });
  });
});
