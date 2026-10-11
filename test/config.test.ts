import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULTS, loadConfig, parseConfig } from "../server/config.js";

const file = (name: string, body: string) => {
  const p = path.join(mkdtempSync(path.join(os.tmpdir(), "tradies-")), name);
  writeFileSync(p, body);
  return p;
};

describe("config", () => {
  it("missing or empty file gives defaults", () => {
    expect(loadConfig(["/nonexistent/tradies.json"])).toEqual({ ...DEFAULTS, foreman: undefined });
    expect(loadConfig(["/nonexistent/tradies.json"], "Sam").foreman).toBe("Sam");
    expect(parseConfig('{"foreman":"Dave"}').foreman).toBe("Dave");
    expect(parseConfig(undefined)).toEqual({});
  });
  it("partial file keeps valid keys and drops junk", () => {
    expect(parseConfig('{"foremanLabels":["blocked-on-","needs-"],"staleDays":"soon"}')).toEqual({
      foremanLabels: ["blocked-on-", "needs-"],
    });
    expect(parseConfig('{"foremanLabels":[]}').foremanLabels).toEqual([]);
    expect(parseConfig('{"todayLabels":["next"]}').todayLabels).toEqual(["next"]);
  });
  it("later files override earlier ones key by key", () => {
    const project = file(".tradies.json", '{"houseTypes":["epic"],"staleDays":3}');
    const user = file("tradies.json", '{"staleDays":10,"foreman":"Dave"}');
    expect(loadConfig([project, user], "Sam")).toEqual({
      ...DEFAULTS,
      houseTypes: ["epic"],
      staleDays: 10,
      foreman: "Dave",
    });
  });
});
