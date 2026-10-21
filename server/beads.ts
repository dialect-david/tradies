import path from "node:path";
import { json, sh, site } from "./shell.js";
import { fromBead, type Bead, type Item } from "./model.js";
import { houses } from "./houses.js";
import { userName } from "./git.js";
import type { Source } from "./source.js";

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
  show: (id) => sh("bd", ["show", id]),
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
  watchPath: path.join(site, ".beads"),
};
