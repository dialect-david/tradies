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
      for (const c of t.critters) {
        expect(c.frames.length).toBe(2);
        const [w, h] = [c.frames[0]![0]!.length, c.frames[0]!.length];
        for (const f of c.frames) {
          expect(f.length).toBe(h);
          for (const row of f) {
            expect(row.length).toBe(w);
            for (const ch of row) if (ch !== ".") expect(c.palette[ch]).toBeDefined();
          }
        }
      }
    }
  });
});
