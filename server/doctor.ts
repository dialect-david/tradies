import { DEFAULTS, type Config, type SourceName } from "./defaults.ts";
import { isStale, type Item } from "./model.ts";
import { PR_LIMIT } from "./gh.ts";
import type { HouseStat } from "./houses.ts";

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

const KNOWN = new Set<string>([...Object.keys(DEFAULTS), "source", "foreman", "prs"]);
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
  const [major, minor] = (/(\d+)\.(\d+)/.exec(env.nodeVersion) ?? []).slice(1).map(Number);
  const nodeOk = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23;
  out.push({
    id: "node",
    ok: nodeOk,
    says: `node ${env.nodeVersion}`,
    fix: nodeOk ? undefined : "needs node 20.19, 22.12 or newer: https://nodejs.org",
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

export type Data = {
  items: Item[];
  houses: HouseStat[];
  closed: Item[];
  /** Open PRs as fetched; omitted = no PR check. */
  prs?: Item[];
  cfg: Pick<Config, "foremanLabels" | "todayLabels" | "hazardLabels" | "staleDays" | "prs">;
  source: SourceName;
  now?: Date;
};

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

export function dataChecks({ items, houses, closed, prs, cfg, source, now = new Date() }: Data): Check[] {
  const beads = items.filter((i) => i.kind === "bead" && i.status !== "closed");
  const bd = source !== "openspec";
  const out: Check[] = [];
  const parented = beads.filter((i) => i.parent).length;
  const houseCmd = bd
    ? 'bd create "<area>" -t epic; bd update <id> --parent <epic>'
    : "openspec new change <name>; its tasks.md boxes are the chits";

  out.push({
    id: "houses",
    ok: houses.length > 0,
    says: houses.length
      ? `${houses.length} houses`
      : "no houses: everything is at the shed, no street to walk",
    fix: houses.length ? undefined : houseCmd,
  });
  out.push({
    id: "parented",
    ok: beads.length > 0 && pct(parented, beads.length) >= 50,
    says: beads.length
      ? `${pct(parented, beads.length)}% of open work has a house${
          pct(parented, beads.length) < 50 ? ": houses look empty, the shed overflows" : ""
        }`
      : "no open work: nobody on site",
    fix:
      beads.length && pct(parented, beads.length) >= 50
        ? undefined
        : beads.length
          ? houseCmd
          : bd
            ? 'bd q "<title>"'
            : "openspec new change <name>",
  });
  const blocks = beads.filter((i) => i.waitsOn.length).length;
  out.push({
    id: "blocks",
    ok: blocks > 0,
    says: blocks
      ? `${blocks} waiting on something`
      : "no blocks deps: no pallets, no Kelpie, no 'closing X frees N'",
    fix: blocks
      ? undefined
      : bd
        ? "bd dep add <bead> <blocker> --type blocks"
        : "'depends on: <change>' in proposal.md",
  });
  if (bd) {
    const reasoned = closed.filter((i) => i.closeReason?.trim()).length;
    out.push({
      id: "reasons",
      ok: closed.length > 0 && pct(reasoned, closed.length) >= 50,
      says: closed.length
        ? `${pct(reasoned, closed.length)}% of closed work says why`
        : "nothing closed yet: the beer wall is bare",
      fix:
        closed.length && pct(reasoned, closed.length) >= 50
          ? undefined
          : 'bd close <id> --reason "<one human line>"; it goes on the beer wall',
    });
    const wanted = (l: string) =>
      cfg.foremanLabels.some((p) => l.startsWith(p)) ||
      cfg.todayLabels.includes(l) ||
      cfg.hazardLabels.includes(l);
    const labelled = beads.some((i) => i.labels.some(wanted));
    out.push({
      id: "labels",
      ok: labelled,
      says: labelled
        ? "site labels in use"
        : `none of ${[...cfg.foremanLabels.map((p) => `${p}*`), ...cfg.todayLabels, ...cfg.hazardLabels].join(", ")} in use: gate, toolbox and cones stay quiet`,
      fix: labelled ? undefined : `bd label add <id> ${cfg.todayLabels[0] ?? "today"}`,
    });
  }
  const stale = beads.filter((i) => isStale(i, now, cfg.staleDays)).length;
  out.push({
    id: "stale",
    ok: beads.length === 0 || pct(stale, beads.length) <= 30,
    says: `${pct(stale, beads.length)}% untouched ${cfg.staleDays}+ days`,
    fix:
      beads.length && pct(stale, beads.length) > 30
        ? bd
          ? "the esky is full: bd update <id> --claim, or bd close / bd defer what is not happening"
          : "the esky is full: tick a box, or archive what is not happening"
        : undefined,
  });
  const working = beads.filter((i) => i.status === "in_progress").length;
  out.push({
    id: "working",
    ok: working > 0,
    says: working ? `${working} on the tools` : "nobody on the tools",
    fix: working ? undefined : bd ? "bd update <id> --claim" : "tick a box in tasks.md",
  });
  if (prs) {
    const limit = cfg.prs?.limit ?? PR_LIMIT;
    const filtered = !!(cfg.prs?.author || cfg.prs?.base || cfg.prs?.label);
    const full = prs.length >= limit && !filtered;
    out.push({
      id: "prs",
      ok: !full,
      optional: true,
      says: full
        ? `${prs.length} PRs, the road is full: filter with prs.author in .tradies.json`
        : `${prs.length} open PR${prs.length === 1 ? "" : "s"}`,
      fix: full ? '"prs": { "author": "@me" }' : undefined,
    });
  }
  return out;
}

export const readiness = (checks: Check[]) => {
  const counted = checks.filter((c) => !c.optional);
  return `site readiness ${counted.filter((c) => c.ok).length}/${counted.length}`;
};

export type Group = { name: string; why: string; ids: string[] };

const PREFIX = /^(?:\[([^\]]+)\]|([A-Za-z][\w-]*):)\s+/;

/** Unparented open beads, grouped by label, title prefix, then blocks component. First rule wins. */
export function proposeEpics(items: Item[]): Group[] {
  const loose = items.filter((i) => i.kind === "bead" && i.status !== "closed" && !i.parent);
  const taken = new Set<string>();
  const out: Group[] = [];
  const claim = (name: string, why: string, ids: string[]) => {
    const fresh = ids.filter((id) => !taken.has(id));
    if (fresh.length < 2) return;
    for (const id of fresh) taken.add(id);
    out.push({ name, why, ids: fresh });
  };

  const byLabel = new Map<string, string[]>();
  for (const i of loose) for (const l of i.labels) byLabel.set(l, [...(byLabel.get(l) ?? []), i.id]);
  for (const [label, ids] of [...byLabel].sort((a, b) => b[1].length - a[1].length))
    if (ids.length >= 3) claim(label, `label ${label}`, ids);

  const byPrefix = new Map<string, string[]>();
  for (const i of loose) {
    const m = PREFIX.exec(i.title);
    const p = (m?.[1] ?? m?.[2])?.toLowerCase();
    if (p) byPrefix.set(p, [...(byPrefix.get(p) ?? []), i.id]);
  }
  for (const [prefix, ids] of [...byPrefix].sort((a, b) => b[1].length - a[1].length))
    if (ids.length >= 3) claim(prefix, `title prefix ${prefix}`, ids);

  const ids = new Set(loose.map((i) => i.id));
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    adj.set(a, (adj.get(a) ?? new Set()).add(b));
    adj.set(b, (adj.get(b) ?? new Set()).add(a));
  };
  for (const i of loose) for (const w of i.waitsOn) if (ids.has(w)) link(i.id, w);
  const seen = new Set<string>();
  for (const i of loose) {
    if (seen.has(i.id) || !adj.has(i.id)) continue;
    const comp: string[] = [];
    const stack = [i.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      comp.push(id);
      for (const n of adj.get(id) ?? []) stack.push(n);
    }
    const root =
      comp.find((id) => !loose.find((x) => x.id === id)!.waitsOn.some((w) => ids.has(w))) ?? comp[0];
    claim(loose.find((x) => x.id === root)!.title, `blocks chain from ${root}`, comp);
  }
  return out;
}

export function renderGroups(groups: Group[], source: SourceName): string {
  if (!groups.length) return "";
  const bd = source !== "openspec";
  const lines = groups.flatMap((g) =>
    bd
      ? [
          `bd create "${g.name}" -t epic   # ${g.why}`,
          ...g.ids.map((id) => `bd update ${id} --parent <epic>`),
        ]
      : [`openspec new change ${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}   # ${g.why}`],
  );
  return lines.length ? `houses to build:\n${lines.join("\n")}` : "";
}

export function agentPrompt(checks: Check[], groups: Group[], source: SourceName): string {
  const bad = checks.filter((c) => !c.ok);
  if (!bad.length && !groups.length) return "";
  const bd = source !== "openspec";
  const lines = ["Run `npx @stottula/tradies prime` first, then tidy the site:"];
  for (const c of bad) lines.push(`- ${c.says}${c.fix ? `. Fix: ${c.fix}` : ""}`);
  for (const g of groups)
    lines.push(
      bd
        ? `- Create an epic "${g.name}" (${g.why}) and parent ${g.ids.join(", ")} to it.`
        : `- Create a change "${g.name}" (${g.why}) and move ${g.ids.join(", ")} into its tasks.md.`,
    );
  lines.push("Close nothing, defer nothing, ask before guessing a parent.");
  return lines.join("\n");
}
