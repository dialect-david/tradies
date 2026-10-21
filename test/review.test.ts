import { describe, expect, it } from "vitest";
import { parseShortstat, reviewPrompt, type Review } from "../server/review.js";

describe("review", () => {
  it("sums insertions and deletions", () => {
    expect(parseShortstat(" 3 files changed, 40 insertions(+), 12 deletions(-)\n")).toBe(52);
    expect(parseShortstat(" 1 file changed, 1 insertion(+)\n")).toBe(1);
    expect(parseShortstat("")).toBe(0);
  });

  it("prompt reviews the range, reports only, then moves the marker", () => {
    const r: Review = {
      head: "abcdef0123456789",
      from: "0123456789abcdef",
      marked: true,
      commits: 16,
      lines: 400,
    };
    const p = reviewPrompt(
      r,
      "sheila",
      "/open-code-review:delegate-review --from {from} --to {to}",
      "hs",
      "File it: -l {hazard}.",
    );
    expect(p).toContain(
      "Run /open-code-review:delegate-review --from 0123456789abcdef --to abcdef0123456789.",
    );
    expect(p).toContain("16 commits, 400 lines, 0123456..abcdef0");
    expect(p).toMatch(/do not commit/);
    expect(p).toContain("-l hs");
    expect(p).toContain("git notes --ref=reviewed add -f -F <report.md> abcdef0123456789");
    expect(p).toContain("git update-ref refs/reviewed abcdef0123456789");
  });
});
