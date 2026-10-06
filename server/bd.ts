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

export async function allBeads(): Promise<Bead[]> {
  return json<Bead[]>("bd", [
    "list",
    "--json",
    "--limit",
    "0",
    "--status",
    "open,in_progress,blocked,deferred,closed",
  ]);
}

export async function actor(): Promise<string | undefined> {
  if (process.env.BEADS_ACTOR) return process.env.BEADS_ACTOR;
  try {
    return (await sh("git", ["config", "user.name"])).trim() || process.env.USER;
  } catch {
    return process.env.USER;
  }
}
