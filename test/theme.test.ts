import { describe, expect, it } from "vitest";
import { THEMES } from "../game/theme.ts";
import { CONE_FRAMES } from "../game/sprites.ts";

describe("themes", () => {
  it("every theme has the same keys and a hazard sprite the size of a cone", () => {
    const keys = Object.keys(THEMES.default!).sort();
    for (const t of Object.values(THEMES)) {
      expect(Object.keys(t).sort()).toEqual(keys);
      expect(t.hazard.frames[0]!.length).toBe(CONE_FRAMES[0]!.length);
      expect(t.hazard.frames[0]![0]!.length).toBe(CONE_FRAMES[0]![0]!.length);
      for (const row of t.hazard.frames[0]!) for (const ch of row) if (ch !== ".") expect(t.hazard.palette[ch]).toBeDefined();
    }
  });
});
