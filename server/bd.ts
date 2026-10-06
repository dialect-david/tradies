import { json, sh } from "./shell.js";
import { fromBead, type Bead, type Item } from "./model.js";

export async function listBeads(): Promise<Item[]> {
  const beads = await json<Bead[]>("bd", [
    "list",
    "--json",
    "--limit",
    "0",
    "--status",
    "open,in_progress,blocked,deferred",
  ]);
  return beads.map(fromBead);
}

export const claim = (id: string) => sh("bd", ["update", id, "--claim"]);
export const close = (id: string, reason: string) => sh("bd", ["close", id, "--reason", reason]);
export const note = (id: string, text: string) => sh("bd", ["note", id, text]);
export const show = (id: string) => sh("bd", ["show", id]);

export async function closedCount(): Promise<number> {
  const out = await sh("bd", ["count", "--status", "closed"]);
  return Number(/\d+/.exec(out)?.[0] ?? 0);
}

export async function quick(title: string, priority = "2", type = "task"): Promise<string> {
  return (await sh("bd", ["q", title, "-p", priority, "-t", type])).trim();
}

export async function closedSince(since: Date): Promise<Item[]> {
  const beads = await json<Bead[]>("bd", [
    "list",
    "--json",
    "--limit",
    "0",
    "--status",
    "closed",
    "--closed-after",
    since.toISOString(),
  ]);
  return beads.map(fromBead).sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
}

export type Epic = { id: string; title: string; status: string; closed: number; total: number };

export async function epics(): Promise<Epic[]> {
  type Row = {
    epic: { id: string; title: string; status: string };
    total_children: number;
    closed_children: number;
  };
  const [open, done] = await Promise.all([
    json<Row[]>("bd", ["epic", "status", "--json"]),
    json<Bead[]>("bd", ["list", "--json", "--limit", "0", "--status", "closed", "--type", "epic"]),
  ]);
  return [
    ...open.map((r) => ({
      id: r.epic.id,
      title: r.epic.title,
      status: r.epic.status,
      closed: r.closed_children,
      total: r.total_children,
    })),
    ...done.map((b) => ({ id: b.id, title: b.title, status: "closed", closed: 1, total: 1 })),
  ];
}
