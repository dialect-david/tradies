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
  back: boolean;
};

export const HOUSE_W = 3;
export const TILE_PX = 48;
export const HOUSE_PITCH = HOUSE_W * TILE_PX + 44;
export const STREET_START = 130;
export const TERRACE_W = 2;
export const BACK_SCALE = 0.6;
export const BACK_LIFT = 72;
export const TERRACE_PITCH = TERRACE_W * TILE_PX * BACK_SCALE + 8;
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
  let front = 0;
  let back = 0;
  const houses = sorted.map((e) => {
    const st: Stage = e.status === "closed" ? "done" : stage(e.closed, Math.max(0, e.total - e.closed));
    const isBack = st === "done";
    return {
      id: e.id,
      title: e.title,
      x: isBack ? STREET_START + back++ * TERRACE_PITCH : STREET_START + front++ * HOUSE_PITCH,
      stage: st,
      closed: e.closed,
      total: e.total,
      items: homes.get(e.id) ?? [],
      back: isBack,
    };
  });
  const shed: House = {
    id: SHED,
    title: "the shed",
    x: STREET_START + front * HOUSE_PITCH,
    stage: "lockup",
    closed: 0,
    total: 0,
    items: homes.get(SHED) ?? [],
    back: false,
  };
  const width = Math.max(shed.x + 2 * TILE_PX + 40, STREET_START + back * TERRACE_PITCH + 40);
  return { houses, shed, width };
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
