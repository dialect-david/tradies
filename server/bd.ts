import { json, sh } from "./shell.js";
import { fromBead, type Bead, type Item } from "./model.js";

export async function listBeads(): Promise<Item[]> {
  const beads = await json<Bead[]>("bd", [
    "list",
    "--json",
    "--limit",
    "0",
    "--status",
    "open,in_progress,blocked",
  ]);
  return beads.map(fromBead);
}

export const claim = (id: string) => sh("bd", ["update", id, "--claim"]);
export const close = (id: string, reason: string) => sh("bd", ["close", id, "--reason", reason]);
export const note = (id: string, text: string) => sh("bd", ["note", id, text]);
export const show = (id: string) => sh("bd", ["show", id]);
