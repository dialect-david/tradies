import type { Item } from "./model.ts";
import { houses } from "./houses.ts";
import type { Source } from "./source.ts";
import { glance, linkedRow, prune, row, type Detail, type Note } from "./detail.ts";
import { fixture, type Fixture } from "./demo/fixture.ts";

const byClosed = (items: Item[]) =>
  items.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));

/** A Source over a mutable copy of the fixture; nothing persists. */
export function demoDetail(i: Item, kids: Item[], notes: Note[]): Detail {
  return prune({
    ...glance(i.description),
    acceptance: i.acceptance,
    notes,
    closeReason: i.closeReason,
    children: kids.map(row),
  });
}

const CI: Record<string, string> = { pass: "success", fail: "failure", pending: "pending" };

export function demoView(p: Item, items: Item[]): Detail {
  const ci = p.labels.find((l) => l.startsWith("ci:"))?.slice(3);
  return prune({
    ...glance(p.description),
    branch: `${p.owner}/${p.id.slice(1)}`,
    checks: ci ? [{ name: "build", state: CI[ci] ?? ci }, { name: "test", state: CI[ci] ?? ci }] : [],
    linked: linkedRow(p.title, items),
  });
}

export function demoSource(f: Fixture = fixture()): Source {
  const items = f.items.map((i) => ({ ...i }));
  const prs = f.prs.map((i) => ({ ...i }));
  const notes = new Map<string, string[]>();
  let next = items.length + 1;
  const find = (id: string) => {
    const i = items.find((x) => x.id === id);
    if (!i) throw new Error(`no bead ${id}`);
    return i;
  };
  const closed = () => items.filter((i) => i.status === "closed");
  return {
    items: async () => items.filter((i) => i.status !== "closed"),
    houses: async (cfg) => houses(items, cfg),
    closedCount: async () => closed().length,
    closedSince: async (since) => byClosed(closed().filter((i) => i.closedAt && i.closedAt >= since)),
    closedRecent: async (limit = 200) => byClosed(closed()).slice(0, limit),
    show: async (id): Promise<Detail> =>
      demoDetail(
        find(id),
        items.filter((x) => x.parent === id),
        (notes.get(id) ?? []).map((text) => ({ text, who: f.foreman })),
      ),
    actor: async () => f.foreman,
    prs: async () => prs,
    view: async (id) => {
      const p = prs.find((x) => x.id === id);
      if (!p) throw new Error(`no PR ${id}`);
      return demoView(p, items);
    },
    actions: {
      claim: {
        run: async (id) => {
          Object.assign(find(id), {
            status: "in_progress",
            assignee: f.foreman,
            owner: f.foreman,
            updatedAt: new Date(),
          });
          return id;
        },
        done: "on the tools",
      },
      close: {
        run: async (id, a) => {
          const now = new Date();
          Object.assign(find(id), {
            status: "closed",
            closedAt: now,
            updatedAt: now,
            closeReason: a.text || "done",
          });
          return id;
        },
        done: "knocked off",
      },
      note: {
        run: async (id, a) => {
          notes.set(id, [...(notes.get(id) ?? []), a.text ?? ""]);
          find(id).updatedAt = new Date();
          return id;
        },
        done: "noted",
      },
      create: {
        run: async (_, a) => {
          const id = `demo-${next++}`;
          items.push({
            kind: "bead",
            id,
            title: a.text ?? "",
            status: "open",
            priority: Number(a.priority || 2),
            trade: a.kind || "task",
            updatedAt: new Date(),
            blocked: false,
            waitsOn: [],
            labels: [],
          });
          return id;
        },
        done: "pinned to the board",
      },
      merge: {
        run: async (id) => {
          const i = prs.findIndex((x) => x.id === id);
          if (i < 0) throw new Error(`no PR ${id}`);
          prs.splice(i, 1);
          return id;
        },
        done: "certified",
      },
    },
    prompts: {
      work: "Work on {id}: {title}. This is the tradies demo; nothing here is saved.",
      plan: "Give me a plan for {id} ({title}). This is the tradies demo; nothing here is saved.",
      review:
        'File each High or Medium finding as a bead: `bd create "<file>: <one line>" -t bug -p 1 -l {hazard}`.',
    },
  };
}

export const demo = demoSource();
