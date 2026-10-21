import { appendFile, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sh, site } from "./shell.js";
import { userName } from "./git.js";
import type { Item } from "./model.js";
import { houses } from "./houses.js";
import type { Source } from "./source.js";

export type Task = { text: string; done: boolean; line: number };
export type Meta = { updatedAt: Date; owner?: string };
export type Front = { priority?: number; labels?: string[]; blocks?: string[]; owner?: string };
export type Change = Meta & {
  name: string;
  title: string;
  dir: string;
  closedAt?: Date;
  tasks: Task[];
  front: Front;
};

export const ROOT = path.join(site, "openspec");
const TASK = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const ARCHIVE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

const LIST_KEYS = ["labels", "blocks"] as const;

/** Leading `---` block of proposal.md: `key: value`, `key: [a, b]`, or `key:` then `- a` lines. */
export function parseFront(text: string): Front {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out: Front = {};
  let list: string[] | undefined;
  for (const raw of m[1].split("\n")) {
    const item = /^\s+-\s+(.+)$/.exec(raw);
    if (item && list) {
      list.push(item[1].trim());
      continue;
    }
    list = undefined;
    const kv = /^([a-z]+):\s*(.*)$/.exec(raw);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "priority" && /^\d+$/.test(value)) out.priority = Number(value);
    else if (key === "owner" && value) out.owner = value.trim();
    else if ((LIST_KEYS as readonly string[]).includes(key)) {
      const k = key as (typeof LIST_KEYS)[number];
      const inline = /^\[(.*)\]$/.exec(value);
      out[k] = inline
        ? inline[1]
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
      if (!inline && !value) list = out[k];
    }
  }
  return out;
}

export function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
    const front = parseFront(proposal);
    const m = await meta(dir);
    return {
      name,
      title: /^#\s+(.+)$/m.exec(proposal)?.[1].trim() ?? name,
      dir,
      closedAt,
      tasks: parseTasks(await text(path.join(dir, "tasks.md"))),
      front,
      ...m,
      owner: front.owner ?? m.owner,
    };
  };
  const active = (await dirs(changes))
    .filter((n) => n !== "archive")
    .map((n) => load(n, path.join(changes, n)));
  const archived = (await dirs(path.join(changes, "archive"))).flatMap((n) => {
    const m = ARCHIVE.exec(n);
    return m ? [load(m[2], path.join(changes, "archive", n), localDate(m[1]))] : [];
  });
  return Promise.all([...active, ...archived]);
}

/** active = names of changes not yet archived; a change waiting on one of them is blocked. */
export function toItems(c: Change, active = new Set<string>()): Item[] {
  const base = {
    kind: "bead" as const,
    priority: c.front.priority ?? 2,
    owner: c.owner,
    updatedAt: c.updatedAt,
    blocked: false,
    waitsOn: [],
    labels: [],
  };
  const ticked = c.tasks.filter((t) => t.done).length;
  const status = c.closedAt ? "closed" : ticked ? "in_progress" : "open";
  const waitsOn = c.front.blocks ?? [];
  const epic: Item = {
    ...base,
    id: c.name,
    title: c.title,
    trade: "epic",
    status,
    closedAt: c.closedAt,
    waitsOn,
    blocked: !c.closedAt && waitsOn.some((n) => active.has(n)),
    labels: c.front.labels ?? [],
  };
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

async function all(): Promise<Item[]> {
  const changes = await readChanges();
  const active = new Set(changes.filter((c) => !c.closedAt).map((c) => c.name));
  return changes.flatMap((c) => toItems(c, active));
}
const isOpen = (i: Item) => i.status !== "closed";
const byClosed = (items: Item[]) =>
  items.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));

export const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Ticks the nth checkbox (1-based) of a tasks.md; returns the new text. */
export function tick(text: string, n: number): string {
  const task = parseTasks(text)[n - 1];
  if (!task) throw new Error(`no task ${n}`);
  const lines = text.split("\n");
  lines[task.line] = lines[task.line].replace("[ ]", "[x]");
  return lines.join("\n");
}

async function change(id: string): Promise<Change> {
  const name = id.split("#")[0];
  const c = (await readChanges()).find((x) => x.name === name);
  if (!c) throw new Error(`no change ${name}`);
  return c;
}

async function close(id: string): Promise<string> {
  const c = await change(id);
  const n = Number(id.split("#")[1]);
  if (n) {
    const file = path.join(c.dir, "tasks.md");
    await writeFile(file, tick(await text(file), n));
  } else await sh("openspec", ["archive", c.name, "-y"]);
  return id;
}

export const openspec: Source = {
  items: async () => (await all()).filter(isOpen),
  houses: async (cfg) => houses(await all(), cfg),
  closedCount: async () => (await all()).filter((i) => !isOpen(i)).length,
  closedSince: async (since) => byClosed((await all()).filter((i) => i.closedAt && i.closedAt >= since)),
  closedRecent: async (limit = 200) => byClosed((await all()).filter((i) => !isOpen(i))).slice(0, limit),
  show: async (id) => {
    const c = await change(id);
    return [await text(path.join(c.dir, "proposal.md")), await text(path.join(c.dir, "tasks.md"))].join("\n");
  },
  actor: userName,
  actions: {
    close: { run: close, done: "knocked off" },
    note: {
      run: async (id, a) => {
        await appendFile(path.join((await change(id)).dir, "design.md"), `\n${a.text}\n`);
        return id;
      },
      done: "noted",
    },
    create: {
      run: async (_, a) => {
        const name = kebab(a.text ?? "");
        await sh("openspec", ["new", "change", name]);
        return name;
      },
      done: "proposed",
    },
  },
  watchPath: ROOT,
};
