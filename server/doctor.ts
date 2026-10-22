import { DEFAULTS, type Config } from "./defaults.ts";

export type Check = { id: string; ok: boolean; says: string; fix?: string; optional?: boolean };

export type Env = {
  nodeVersion: string;
  /** Paths relative to the site. */
  exists(p: string): boolean;
  which(cmd: string): boolean;
  ghAuthed(): boolean;
  configFiles: { path: string; text?: string }[];
  hasRef(ref: string): boolean;
};

const KNOWN = new Set<string>([...Object.keys(DEFAULTS), "source", "foreman"]);
const LISTS = ["foremanLabels", "todayLabels", "houseTypes", "hazardLabels"];
const DAYS = ["staleDays", "goneDays", "reviewAfter"];

export function configProblems(text: string): string[] {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    return [`not JSON: ${(e as Error).message}`];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["not an object"];
  const out: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN.has(k)) out.push(`unknown key ${k}`);
    else if (LISTS.includes(k) && !(Array.isArray(v) && v.every((x) => typeof x === "string" && x)))
      out.push(`${k} must be a list of strings`);
    else if (DAYS.includes(k) && !(typeof v === "number" && v > 0)) out.push(`${k} must be a number > 0`);
    else if (k === "source" && !["beads", "openspec"].includes(String(v)))
      out.push(`source must be beads or openspec`);
    else if ((k === "foreman" || k === "reviewSkill") && !(typeof v === "string" && v.trim()))
      out.push(`${k} must be text`);
  }
  return out;
}

export function setupChecks(env: Env): Check[] {
  const out: Check[] = [];
  const major = Number(/\d+/.exec(env.nodeVersion)?.[0] ?? 0);
  out.push({
    id: "node",
    ok: major >= 24,
    says: `node ${env.nodeVersion}`,
    fix: major >= 24 ? undefined : "needs node 24: https://nodejs.org",
  });

  const beads = env.exists(".beads");
  const openspec = env.exists("openspec");
  out.push({
    id: "tracker",
    ok: beads || openspec,
    says: beads ? ".beads/ here" : openspec ? "openspec/ here" : "no .beads/ or openspec/ here",
    fix:
      beads || openspec
        ? undefined
        : "bd init, or openspec init; to look around first: npx @stottula/tradies --demo",
  });
  if (beads)
    out.push({
      id: "cli",
      ok: env.which("bd"),
      says: env.which("bd") ? "bd on PATH" : "bd not on PATH",
      fix: env.which("bd") ? undefined : "install beads: https://github.com/gastownhall/beads",
    });
  else if (openspec)
    out.push({
      id: "cli",
      ok: env.which("openspec"),
      says: env.which("openspec") ? "openspec on PATH" : "openspec not on PATH; close and new will fail",
      fix: env.which("openspec") ? undefined : "npm i -g @fission-ai/openspec",
    });

  const gh = env.ghAuthed();
  out.push({
    id: "gh",
    ok: gh,
    optional: true,
    says: gh ? "gh logged in" : "gh not logged in; the road stays empty",
    fix: gh ? undefined : "gh auth login",
  });

  const present = env.configFiles.filter((f) => f.text !== undefined);
  if (!present.length) out.push({ id: "config", ok: true, says: "no config files, defaults apply" });
  for (const f of present) {
    const problems = configProblems(f.text!);
    out.push({
      id: "config",
      ok: !problems.length,
      says: problems.length ? `${f.path}: ${problems.join("; ")}` : `${f.path} ok`,
      fix: problems.length ? `keys: ${[...KNOWN].join(", ")}` : undefined,
    });
  }

  const marked = env.hasRef("refs/reviewed");
  out.push({
    id: "reviewed",
    ok: marked,
    optional: true,
    says: marked ? "refs/reviewed set" : "no refs/reviewed; the officer counts the last commits",
    fix: marked ? undefined : "git update-ref refs/reviewed HEAD",
  });
  return out;
}

export const failed = (checks: Check[]) => checks.filter((c) => !c.ok && !c.optional);

export function render(checks: Check[]): string {
  return checks
    .map((c) => `${c.ok ? "✓" : c.optional ? "·" : "✗"} ${c.says}${c.fix ? `\n    ${c.fix}` : ""}`)
    .join("\n");
}

export type { Config };
