import path from "node:path";
import { json, sh, site } from "./shell.ts";
import { fromBead, type Bead, type Item } from "./model.ts";
import { houses } from "./houses.ts";
import { userName } from "./git.ts";
import type { Source } from "./source.ts";
import { glance, prune, type Detail, type Row } from "./detail.ts";

export type Shown = Bead & {
  description?: string;
  acceptance_criteria?: string;
  design?: string;
  notes?: string;
  comments?: { author: string; created_at: string; text: string }[];
  dependents?: (Omit<Row, "updatedAt"> & {
    issue_type: string;
    updated_at: string;
    dependency_type: string;
  })[];
};

export const kidsOf = (b: Shown) => (b.dependents ?? []).filter((d) => d.dependency_type === "parent-child");

/** subs: sub-epics' own `bd show` results, keyed by id, so their children nest. */
export function fromShown(b: Shown, subs: Record<string, Shown> = {}): Detail {
  const rowsOf = (x: Shown): Row[] =>
    kidsOf(x).map((d) => {
      const sub = subs[d.id];
      const kids = sub ? rowsOf(sub) : [];
      return {
        id: d.id,
        title: d.title,
        status: d.status,
        priority: d.priority,
        updatedAt: d.updated_at,
        trade: d.issue_type,
        ...(kids.length ? { children: kids } : {}),
      };
    });
  return prune({
    ...glance(b.description),
    acceptance: b.acceptance_criteria,
    design: b.design,
    notes: [
      ...(b.notes ? [{ text: b.notes }] : []),
      ...(b.comments ?? []).map((c) => ({ who: c.author, when: c.created_at, text: c.text })),
    ],
    closeReason: b.close_reason,
    children: rowsOf(b),
  });
}

const list = (status: string, extra: string[] = []) =>
  json<Bead[]>("bd", ["list", "--json", "--limit", "0", "--status", status, ...extra]);

const byClosed = (items: Item[]) =>
  items.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));

export async function actor(): Promise<string | undefined> {
  return process.env.BEADS_ACTOR || userName();
}

export const beads: Source = {
  items: async () => (await list("open,in_progress,blocked,deferred")).map(fromBead),
  houses: async (cfg) => houses((await list("open,in_progress,blocked,deferred,closed")).map(fromBead), cfg),
  closedCount: async () => Number(/\d+/.exec(await sh("bd", ["count", "--status", "closed"]))?.[0] ?? 0),
  closedSince: async (since) =>
    byClosed((await list("closed", ["--closed-after", since.toISOString()])).map(fromBead)),
  closedRecent: async (limit = 200) =>
    byClosed(
      (
        await json<Bead[]>("bd", [
          "list",
          "--json",
          "--limit",
          String(limit),
          "--status",
          "closed",
          "--sort",
          "closed",
        ])
      ).map(fromBead),
    ),
  show: async (id): Promise<Detail> => {
    const [b] = await json<Shown[]>("bd", [
      "show",
      id,
      "--json",
      "--include-comments",
      "--include-dependents",
    ]);
    if (!b) throw new Error(`no bead ${id}`);
    const subs: Record<string, Shown> = {};
    const fetch = async (x: Shown) => {
      const epics = kidsOf(x).filter((d) => d.issue_type === "epic");
      const shown = await Promise.all(
        epics.map((d) => json<Shown[]>("bd", ["show", d.id, "--json", "--include-dependents"])),
      );
      for (const [sub] of shown) if (sub) (subs[sub.id] = sub), await fetch(sub);
    };
    await fetch(b);
    return fromShown(b, subs);
  },
  actor,
  actions: {
    claim: { run: (id) => sh("bd", ["update", id, "--claim"]).then(() => id), done: "on the tools" },
    close: {
      run: (id, a) => sh("bd", ["close", id, "--reason", a.text]).then(() => id),
      done: "knocked off",
    },
    note: { run: (id, a) => sh("bd", ["note", id, a.text]).then(() => id), done: "noted" },
    create: {
      run: async (_, a) =>
        (await sh("bd", ["q", a.text ?? "", "-p", a.priority || "2", "-t", a.kind || "task"])).trim(),
      done: "pinned to the board",
    },
  },
  prompts: {
    work: "Work on {id}: {title}. Read `bd show {id}` first, claim it with `bd update {id} --claim`, add dated notes as you go (`bd note {id} '<date>: ...'`), and close it with a one-line reason when done.",
    plan: "Give me a plan for {id} ({title}). Read `bd show {id}` and its notes first, then propose the approach; don't change anything yet.",
    review:
      'File each High or Medium finding as a bead: `bd create "<file>: <one line>" -t bug -p 1 -l {hazard} -d "<one-sentence finding, blank line, the fix>"`, with `--parent <epic>` when it clearly belongs to one.',
  },
  watchPath: path.join(site, ".beads"),
};
