import { appendFile, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sh, site } from "./shell.js";
import { userName } from "./git.js";
import type { Item } from "./model.js";
import { houses, type Phase } from "./houses.js";
import type { Source } from "./source.js";
import { loadConfig } from "./config.js";

export type Task = { text: string; done: boolean; line: number };
/** added: subject of the oldest commit that put a file in the dir; the archive move, for archived changes. */
export type Meta = { updatedAt: Date; owner?: string; added?: string };
export type Front = { priority?: number; labels?: string[]; blocks?: string[]; owner?: string };
export type Artifacts = { proposal: boolean; design: boolean; specs: boolean };
export type Change = Meta & {
  name: string;
  title: string;
  dir: string;
  closedAt?: Date;
  closeReason?: string;
  tasks: Task[];
  front: Front;
  has: Artifacts;
  /** Unticked boxes under a `## Open questions` heading in proposal.md. */
  questions: number;
  /** Names from a `depends on: a, b` line in proposal.md. */
  dependsOn: string[];
};

export const ROOT = path.join(site, "openspec");
const TASK = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
/** `label: text` on a task is a label. */
const TAG = /^([a-z][\w-]*):\s/;
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
    if (key === "priority" && /^\d+$/.test(value)) out.priority = Math.min(4, Number(value));
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

export function openQuestions(proposal: string): number {
  const m = /^##\s+open questions\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im.exec(proposal);
  return m ? parseTasks(m[1]).filter((t) => !t.done).length : 0;
}

export function dependsOn(proposal: string): string[] {
  const m = /^\s*(?:[-*]\s+)?depends on:\s*(.+)$/im.exec(proposal);
  return m
    ? m[1]
        .split(",")
        .map((x) => x.trim().replace(/^`|`$/g, ""))
        .filter(Boolean)
    : [];
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

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

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

export type MetaOf = (dirs: string[]) => Promise<Map<string, Meta>>;

/** One `git log` over the changes root; newest commit touching each dir wins, oldest add names the move. */
export async function gitMeta(dirs: string[], root = ROOT): Promise<Map<string, Meta>> {
  const out = new Map<string, Meta>();
  try {
    const log = await sh("git", [
      "log",
      "--format=%aI%x1f%an%x1f%s",
      "--name-status",
      "--no-renames",
      "--relative",
      "--",
      root,
    ]);
    let meta: Meta | undefined;
    let subject = "";
    for (const line of log.split("\n")) {
      const head = /^(\d{4}-\d{2}-\d{2}T[^\x1f]*)\x1f([^\x1f]*)\x1f(.*)$/.exec(line);
      if (head) {
        meta = { updatedAt: new Date(head[1]), owner: head[2] || undefined };
        subject = head[3];
        continue;
      }
      const file = /^([A-Z])\d*\t(.+)$/.exec(line);
      if (!meta || !file) continue;
      const abs = path.resolve(site, file[2]);
      const dir = dirs.find((d) => abs.startsWith(d + path.sep));
      if (!dir) continue;
      const m = out.get(dir) ?? out.set(dir, meta).get(dir)!;
      if (file[1] === "A") m.added = subject;
    }
  } catch {
    /* not a git repo */
  }
  await Promise.all(
    dirs
      .filter((d) => !out.has(d))
      .map(async (d) =>
        out.set(d, { updatedAt: (await stat(d).catch(() => undefined))?.mtime ?? new Date(0) }),
      ),
  );
  return out;
}

export async function readChanges(root = ROOT, metaOf: MetaOf = (d) => gitMeta(d, root)): Promise<Change[]> {
  const changes = path.join(root, "changes");
  const names = (await dirs(changes)).filter((n) => n !== "archive");
  const old = (await dirs(path.join(changes, "archive"))).flatMap((n) => {
    const m = ARCHIVE.exec(n);
    return m ? [{ name: m[2], dir: path.join(changes, "archive", n), closedAt: localDate(m[1]) }] : [];
  });
  const live = names.map((n) => ({ name: n, dir: path.join(changes, n), closedAt: undefined }));
  const meta = await metaOf([...live, ...old].map((c) => c.dir));
  const load = async ({
    name,
    dir,
    closedAt,
  }: {
    name: string;
    dir: string;
    closedAt?: Date;
  }): Promise<Change> => {
    const proposal = await text(path.join(dir, "proposal.md"));
    const front = parseFront(proposal);
    const m = meta.get(dir) ?? { updatedAt: new Date(0) };
    const heading = (md: string) => /^#\s+(.+)$/m.exec(md)?.[1].trim();
    const specs = await dirs(path.join(dir, "specs"));
    const has: Artifacts = {
      proposal: !!proposal,
      design: await exists(path.join(dir, "design.md")),
      specs: (await Promise.all(specs.map((s) => exists(path.join(dir, "specs", s, "spec.md"))))).some(
        Boolean,
      ),
    };
    return {
      has,
      questions: openQuestions(proposal),
      dependsOn: dependsOn(proposal),
      name,
      title: heading(proposal) ?? heading(await text(path.join(dir, "README.md"))) ?? name,
      dir,
      closedAt,
      closeReason: closedAt ? m.added : undefined,
      tasks: parseTasks(await text(path.join(dir, "tasks.md"))),
      front,
      ...m,
      owner: front.owner ?? m.owner,
    };
  };
  return Promise.all([...live, ...old].map(load));
}

/** spec-driven: proposal, then design and specs, then tasks ticked, then archived. */
export function phase(c: Change): Phase {
  if (c.closedAt) return "done";
  const ticked = c.tasks.filter((t) => t.done).length;
  if (ticked) return ticked * 2 >= c.tasks.length ? "fitout" : "lockup";
  if (c.has.design && c.has.specs) return "roof";
  if (c.has.design || c.has.specs) return "frame";
  return c.has.proposal ? "slab" : "site";
}

export type Derive = {
  /** Label prefix that queues at the gate, e.g. `needs-`. */
  needs?: string;
  /** When each box was ticked, keyed by tasks.md path + newline + task text. */
  ticks?: Map<string, Date>;
  /** Checked-out git branch; one named after the change puts it in progress. */
  branch?: string;
  actor?: string;
};

export const tickKey = (file: string, text: string) => `${file}\n${text}`;

/** Boxes that went `[ ]` to `[x]` in commits since `since`; newest tick wins. */
export async function tickedSince(since: Date, root = ROOT): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  try {
    const log = await sh("git", [
      "log",
      "-p",
      `--since=${since.toISOString()}`,
      "--format=%aI%x1f",
      "--no-renames",
      "--",
      path.join(root, "changes", "*", "tasks.md"),
    ]);
    let when: Date | undefined;
    let file = "";
    let gone = new Set<string>();
    for (const line of log.split("\n")) {
      if (line.endsWith("\x1f")) when = new Date(line.slice(0, -1));
      else if (line.startsWith("+++ b/")) {
        file = path.resolve(site, line.slice(6));
        gone = new Set();
      } else if (line.startsWith("-")) {
        const m = TASK.exec(line.slice(1));
        if (m && m[1] === " ") gone.add(m[2].trim());
      } else if (line.startsWith("+")) {
        const m = TASK.exec(line.slice(1));
        const key = m && tickKey(file, m[2].trim());
        if (m && m[1] !== " " && gone.has(m[2].trim()) && when && !out.has(key!)) out.set(key!, when);
      }
    }
  } catch {
    /* not a git repo */
  }
  return out;
}

export const onBranch = (c: Change, branch?: string) =>
  !!branch && (branch === c.name || branch.endsWith(`/${c.name}`));

/** Sets `owner:` in the frontmatter of a proposal, adding the block when there is none. */
export function setOwner(text: string, owner: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return `---\nowner: ${owner}\n---\n${text}`;
  const body = /^owner:.*$/m.test(m[1])
    ? m[1].replace(/^owner:.*$/m, `owner: ${owner}`)
    : `${m[1]}\nowner: ${owner}`;
  return text.replace(m[0], `---\n${body}\n---`);
}

/** active = names of changes not yet archived; a change waiting on one of them is blocked. */
export function toItems(c: Change, active = new Set<string>(), opts: Derive = {}): Item[] {
  const claimed = !!c.front.owner || onBranch(c, opts.branch);
  const base = {
    kind: "bead" as const,
    priority: c.front.priority ?? 2,
    owner: c.front.owner ?? (onBranch(c, opts.branch) ? opts.actor : undefined) ?? c.owner,
    updatedAt: c.updatedAt,
    blocked: false,
    waitsOn: [],
    labels: [],
  };
  const ticked = c.tasks.filter((t) => t.done).length;
  const status = c.closedAt ? "closed" : ticked || claimed ? "in_progress" : "open";
  const waitsOn = c.front.blocks ?? c.dependsOn;
  const labels = c.front.labels ?? [];
  if (c.questions && opts.needs && !labels.some((l) => l.startsWith(opts.needs!)))
    labels.push(`${opts.needs}questions`);
  const epic: Item = {
    ...base,
    id: c.name,
    title: c.title,
    trade: "epic",
    status,
    closedAt: c.closedAt,
    closeReason: c.closeReason,
    waitsOn,
    blocked: !c.closedAt && waitsOn.some((n) => active.has(n)),
    labels,
  };
  const kids = c.tasks.map((t, i): Item => ({
    ...base,
    id: `${c.name}#${i + 1}`,
    title: t.text,
    trade: "task",
    parent: c.name,
    labels: TAG.exec(t.text)?.slice(1) ?? [],
    status: c.closedAt || t.done ? "closed" : "open",
    closedAt:
      c.closedAt ?? (t.done ? opts.ticks?.get(tickKey(path.join(c.dir, "tasks.md"), t.text)) : undefined),
    closeReason: c.closeReason,
  }));
  return [epic, ...kids];
}

async function all(changes?: Change[], extra: Derive = {}): Promise<Item[]> {
  changes ??= await readChanges();
  const active = new Set(changes.filter((c) => !c.closedAt).map((c) => c.name));
  const [branch, actor] = await Promise.all([
    sh("git", ["branch", "--show-current"]).then(
      (b) => b.trim() || undefined,
      () => undefined,
    ),
    userName(),
  ]);
  const opts: Derive = { needs: loadConfig().foremanLabels[0], branch, actor, ...extra };
  return changes.flatMap((c) => toItems(c, active, opts));
}
const isOpen = (i: Item) => i.status !== "closed";
const archived = (items: Item[]) => items.filter((i) => i.closedAt);
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
  houses: async (cfg) => {
    const changes = await readChanges();
    const phases = new Map(changes.map((c) => [c.name, phase(c)]));
    return houses(await all(changes), cfg, (id) => phases.get(id));
  },
  closedCount: async () => archived(await all()).length,
  closedSince: async (since) =>
    byClosed(
      archived(await all(undefined, { ticks: await tickedSince(since) })).filter((i) => i.closedAt! >= since),
    ),
  closedRecent: async (limit = 200) => byClosed(archived(await all())).slice(0, limit),
  show: async (id) => {
    const c = await change(id);
    return [await text(path.join(c.dir, "proposal.md")), await text(path.join(c.dir, "tasks.md"))].join("\n");
  },
  actor: userName,
  actions: {
    claim: {
      run: async (id) => {
        const c = await change(id);
        const file = path.join(c.dir, "proposal.md");
        await writeFile(file, setOwner(await text(file), (await userName()) ?? "me"));
        return c.name;
      },
      done: "on the tools",
    },
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
  prompts: {
    work: "Work on {id}: {title}. Read openspec/changes/{change}/proposal.md, design.md and tasks.md first, tick the boxes in tasks.md as you finish them, and run `openspec archive {change} -y` when all are ticked.",
    plan: "Give me a plan for {id} ({title}). Read openspec/changes/{change}/proposal.md, design.md and tasks.md first, then propose the approach; don't change anything yet.",
    review:
      "File each High or Medium finding as a task `- [ ] {hazard}: <file>: <one line>` under a `## Hazards` heading in tasks.md of the change it belongs to, or openspec/changes/hazards/tasks.md when none fits.",
  },
  watchPath: ROOT,
};
