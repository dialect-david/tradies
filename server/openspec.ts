import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { sh, site } from "./shell.js";
import { userName } from "./git.js";
import type { Item } from "./model.js";
import { houses } from "./houses.js";
import type { Source } from "./source.js";

export type Task = { text: string; done: boolean; line: number };
export type Meta = { updatedAt: Date; owner?: string };
export type Change = Meta & { name: string; title: string; dir: string; closedAt?: Date; tasks: Task[] };

export const ROOT = path.join(site, "openspec");
const TASK = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const ARCHIVE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

export function parseTasks(text: string): Task[] {
  return text.split("\n").flatMap((l, line) => {
    const m = TASK.exec(l);
    return m ? [{ text: m[2].trim(), done: m[1] !== " ", line }] : [];
  });
}

async function dirs(p: string): Promise<string[]> {
  try {
    const entries = await readdir(p, { withFileTypes: true });
    return entries
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

const text = (p: string) => readFile(p, "utf8").catch(() => "");

async function gitMeta(dir: string): Promise<Meta> {
  try {
    const [iso, an] = (await sh("git", ["log", "-1", "--format=%aI%n%an", "--", dir])).trim().split("\n");
    if (iso) return { updatedAt: new Date(iso), owner: an || undefined };
  } catch {
    /* not a git repo */
  }
  const s = await stat(dir).catch(() => undefined);
  return { updatedAt: s?.mtime ?? new Date(0) };
}

export async function readChanges(root = ROOT, meta = gitMeta): Promise<Change[]> {
  const changes = path.join(root, "changes");
  const load = async (name: string, dir: string, closedAt?: Date): Promise<Change> => {
    const proposal = await text(path.join(dir, "proposal.md"));
    return {
      name,
      title: /^#\s+(.+)$/m.exec(proposal)?.[1].trim() ?? name,
      dir,
      closedAt,
      tasks: parseTasks(await text(path.join(dir, "tasks.md"))),
      ...(await meta(dir)),
    };
  };
  const active = (await dirs(changes))
    .filter((n) => n !== "archive")
    .map((n) => load(n, path.join(changes, n)));
  const archived = (await dirs(path.join(changes, "archive"))).flatMap((n) => {
    const m = ARCHIVE.exec(n);
    return m ? [load(m[2], path.join(changes, "archive", n), new Date(m[1]))] : [];
  });
  return Promise.all([...active, ...archived]);
}

export function toItems(c: Change): Item[] {
  const base = {
    kind: "bead" as const,
    priority: 2,
    owner: c.owner,
    updatedAt: c.updatedAt,
    blocked: false,
    waitsOn: [],
    labels: [],
  };
  const ticked = c.tasks.filter((t) => t.done).length;
  const status = c.closedAt ? "closed" : ticked ? "in_progress" : "open";
  const epic: Item = { ...base, id: c.name, title: c.title, trade: "epic", status, closedAt: c.closedAt };
  const kids = c.tasks.map((t, i): Item => ({
    ...base,
    id: `${c.name}#${i + 1}`,
    title: t.text,
    trade: "task",
    parent: c.name,
    status: c.closedAt || t.done ? "closed" : "open",
    closedAt: c.closedAt ?? (t.done ? c.updatedAt : undefined),
  }));
  return [epic, ...kids];
}

const all = async () => (await readChanges()).flatMap(toItems);
const isOpen = (i: Item) => i.status !== "closed";
const byClosed = (items: Item[]) =>
  items.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));

export const openspec: Source = {
  items: async () => (await all()).filter(isOpen),
  houses: async (cfg) => houses(await all(), cfg),
  closedCount: async () => (await all()).filter((i) => !isOpen(i)).length,
  closedSince: async (since) => byClosed((await all()).filter((i) => i.closedAt && i.closedAt >= since)),
  closedRecent: async (limit = 200) => byClosed((await all()).filter((i) => !isOpen(i))).slice(0, limit),
  show: async (id) => {
    const name = id.split("#")[0];
    const c = (await readChanges()).find((x) => x.name === name);
    if (!c) throw new Error(`no change ${name}`);
    return [await text(path.join(c.dir, "proposal.md")), await text(path.join(c.dir, "tasks.md"))].join("\n");
  },
  actor: userName,
  actions: {},
  watchPath: ROOT,
};
