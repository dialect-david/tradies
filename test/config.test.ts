import { describe, expect, it } from "vitest";
import { DEFAULTS, loadConfig, parseConfig } from "../server/config.js";

describe("config", () => {
  it("missing or empty file gives defaults", () => {
    expect(loadConfig("/nonexistent/tradies.json")).toEqual({ ...DEFAULTS, foreman: undefined });
    expect(loadConfig("/nonexistent/tradies.json", "Sam").foreman).toBe("Sam");
    expect(parseConfig('{"foreman":"Dave"}').foreman).toBe("Dave");
    expect(parseConfig(undefined)).toEqual(DEFAULTS);
  });
  it("partial file fills gaps and drops junk", () => {
    expect(parseConfig('{"foremanLabels":["blocked-on-","needs-"],"staleDays":"soon"}')).toEqual({
      foremanLabels: ["blocked-on-", "needs-"],
      foreman: undefined,
      houseTypes: ["epic", "feature"],
      staleDays: 7,
      goneDays: 30,
    });
    expect(parseConfig('{"foremanLabels":[]}').foremanLabels).toEqual([]);
  });
});
