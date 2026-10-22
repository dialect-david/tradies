import { describe, expect, it } from "vitest";
import { configProblems, failed, render, setupChecks, type Env } from "../server/doctor.ts";

const env = (over: Partial<Env> = {}): Env => ({
  nodeVersion: "v24.1.0",
  exists: (p) => p === ".beads",
  which: () => true,
  ghAuthed: () => true,
  configFiles: [],
  hasRef: () => true,
  ...over,
});

describe("doctor setup", () => {
  it("all green on a wired-up beads repo", () => {
    const c = setupChecks(env());
    expect(c.every((x) => x.ok)).toBe(true);
    expect(c.map((x) => x.id)).toEqual(["node", "tracker", "cli", "gh", "config", "reviewed"]);
    expect(failed(c)).toEqual([]);
  });
  it("no tracker fails hard with the three ways in", () => {
    const c = setupChecks(env({ exists: () => false }));
    expect(failed(c).map((x) => x.id)).toEqual(["tracker"]);
    expect(c.find((x) => x.id === "tracker")!.fix).toMatch(/bd init.*openspec init.*--demo/);
    expect(c.some((x) => x.id === "cli")).toBe(false);
  });
  it("openspec only wants openspec on PATH", () => {
    const c = setupChecks(env({ exists: (p) => p === "openspec", which: (cmd) => cmd !== "openspec" }));
    expect(failed(c).map((x) => x.id)).toEqual(["cli"]);
  });
  it("gh and refs/reviewed are optional", () => {
    const c = setupChecks(env({ ghAuthed: () => false, hasRef: () => false }));
    expect(failed(c)).toEqual([]);
    expect(render(c)).toContain("· gh not logged in");
    expect(render(c)).toContain("    git update-ref refs/reviewed HEAD");
  });
  it("old node fails", () => {
    expect(failed(setupChecks(env({ nodeVersion: "v22.3.0" }))).map((x) => x.id)).toEqual(["node"]);
  });
  it("config files are named with their problems", () => {
    const c = setupChecks(
      env({
        configFiles: [
          { path: "~/.config/tradies.json" },
          { path: ".tradies.json", text: '{"staleDays": "7", "fooLabels": [], "source": "beads"}' },
        ],
      }),
    );
    const cfg = c.filter((x) => x.id === "config");
    expect(cfg).toHaveLength(1);
    expect(cfg[0].ok).toBe(false);
    expect(cfg[0].says).toBe(".tradies.json: staleDays must be a number > 0; unknown key fooLabels");
  });
  it("configProblems", () => {
    expect(configProblems("{")).toEqual([expect.stringMatching(/^not JSON/)]);
    expect(configProblems("[]")).toEqual(["not an object"]);
    expect(configProblems('{"foremanLabels":["needs-"],"foreman":"Sam"}')).toEqual([]);
    expect(configProblems('{"source":"demo"}')).toEqual(["source must be beads or openspec"]);
  });
});
