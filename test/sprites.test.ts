import { describe, expect, it } from "vitest";
import {
  frameSize,
  KELPIE_FRAMES,
  LETTERBOX_FRAMES,
  SOLD_FRAMES,
  stage,
  TRADIE_FRAMES,
} from "../game/sprites.ts";

describe("sprites", () => {
  it("frames are rectangular", () => {
    expect(frameSize(TRADIE_FRAMES)).toEqual({ w: 12, h: 19 });
    expect(TRADIE_FRAMES).toHaveLength(8);
    expect(frameSize(KELPIE_FRAMES)).toEqual({ w: 16, h: 8 });
    expect(frameSize(SOLD_FRAMES)).toEqual({ w: 19, h: 16 });
    expect(frameSize(LETTERBOX_FRAMES)).toEqual({ w: 7, h: 11 });
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

import { CAN_FRAMES, SLAB_FRAMES, slabs, UTE_FRAMES } from "../game/sprites.ts";

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

import { ROOF_FRAMES, TRUSS_FRAMES } from "../game/sprites.ts";

describe("roof", () => {
  it("roof and truss are the same size, three house tiles wide plus eaves", () => {
    expect(frameSize(ROOF_FRAMES)).toEqual({ w: 56, h: 18 });
    expect(frameSize(TRUSS_FRAMES)).toEqual({ w: 56, h: 18 });
  });
});
