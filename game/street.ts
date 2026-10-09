import type { Item } from "../server/model.js";
import { stage, type Stage } from "./sprites.js";

export type Epic = { id: string; title: string; status: string; closed: number; total: number };

export type House = {
  id: string;
  title: string;
  x: number;
  stage: Stage;
  closed: number;
  total: number;
  items: Item[];
};

export const HOUSE_W = 3;
export const TILE_PX = 48;
export const HOUSE_PITCH = HOUSE_W * TILE_PX + 44;
export const STREET_START = 130;
export const SHED = "shed";

export function epicOf(item: Item, byId: Map<string, Item>, epics: Set<string>): string {
  let cur: Item | undefined = item;
  for (let hops = 0; cur && hops < 8; hops++) {
    if (cur.parent && epics.has(cur.parent)) return cur.parent;
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return SHED;
}

export function layoutStreet(epics: Epic[], items: Item[]): { houses: House[]; shed: House; width: number } {
  const ids = new Set(epics.map((e) => e.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const beads = items.filter((i) => i.kind === "bead" && !ids.has(i.id));
  const homes = new Map<string, Item[]>();
  for (const b of beads) {
    const home = epicOf(b, byId, ids);
    homes.set(home, [...(homes.get(home) ?? []), b]);
  }
  const ratio = (e: Epic) => (e.total ? e.closed / e.total : 0);
  const sorted = [...epics].sort((a, b) => {
    const da = a.status === "closed" ? 1 : 0;
    const db = b.status === "closed" ? 1 : 0;
    return db - da || ratio(b) - ratio(a) || a.id.localeCompare(b.id);
  });
  const houses = sorted.map((e, n) => ({
    id: e.id,
    title: e.title,
    x: STREET_START + n * HOUSE_PITCH,
    stage: e.status === "closed" ? ("done" as Stage) : stage(e.closed, Math.max(0, e.total - e.closed)),
    closed: e.closed,
    total: e.total,
    items: homes.get(e.id) ?? [],
  }));
  const shed: House = {
    id: SHED,
    title: "the shed",
    x: STREET_START + houses.length * HOUSE_PITCH,
    stage: "lockup",
    closed: 0,
    total: 0,
    items: homes.get(SHED) ?? [],
  };
  return { houses, shed, width: shed.x + 2 * TILE_PX + 40 };
}

export function shortTitle(title: string, max = 26): string {
  const t = title
    .replace(/^[a-z][\w-]*:\s+/i, "")
    .split(/\s+[—–-]\s+|:\s/)[0]!
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1).lastIndexOf(" ");
  return (cut > 8 ? t.slice(0, cut) : t.slice(0, max)) + "…";
}
