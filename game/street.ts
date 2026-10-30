import type { Item } from "../server/model.ts";
import type { Floor, HouseStat } from "../server/houses.ts";
import { stage, type Stage } from "./sprites.ts";

export type Epic = HouseStat;

export const stageOf = (e: Epic): Stage =>
  e.status === "closed" ? "done" : (e.phase ?? stage(e.closed, Math.max(0, e.total - e.closed)));

export type House = {
  id: string;
  title: string;
  x: number;
  stage: Stage;
  closed: number;
  total: number;
  items: Item[];
  sold: boolean;
  no?: number;
  floors?: Floor[];
};

export const HOUSE_W = 3;
export const MAX_FLOORS = 12;

export type Storeys = {
  shown: Floor[];
  extra: number;
  kind: "house" | "lowrise" | "midrise" | "tower";
  crane: boolean;
};

/** Child epics as floors: 1-3 low rise, 4-7 mid rise (flat roof), 8+ tower with a crane while any floor is open. */
export function storeys(floors: Floor[] = []): Storeys {
  const shown = floors.slice(0, MAX_FLOORS);
  const n = floors.length;
  const kind = n === 0 ? "house" : n <= 3 ? "lowrise" : n <= 7 ? "midrise" : "tower";
  return {
    shown,
    extra: n - shown.length,
    kind,
    crane: kind === "tower" && floors.some((f) => f.status !== "closed"),
  };
}
export const TILE_PX = 48;
export const HOUSE_PITCH = HOUSE_W * TILE_PX + 44;
export const STREET_START = 130;
export const TERRACE_W = 2;
export const TERRACE_PITCH = TERRACE_W * TILE_PX + 8;
export const YARD_GAP = 120;
export const YARD_W = 1130;
export const CLOSE_GAP = 90;
export const SHED = "shed";
export const CAR_PITCH = 150;
export const ROAD_START = 160;
export const CARPARK_GAP = 160;
export const BAY_PITCH = 110;
export const BAYS_PER_LEVEL = 6;
export const LEVEL_H = 60;

export type CarPark = { x: number; width: number; levels: number; bays: { x: number; level: number }[] };

/** How many cars fit on the first screen of road, leaving room for the car park sign. */
export const roadFits = (screenW: number) =>
  Math.max(1, Math.floor((screenW - ROAD_START - 130) / CAR_PITCH));

/** Multi-storey past the street. Bay x is lot-relative; level 1 is the first floor, ground is the booth. */
export function carPark(streetWidth: number, n: number): CarPark {
  const x = streetWidth + CARPARK_GAP;
  const levels = Math.max(2, Math.ceil(n / BAYS_PER_LEVEL));
  const bays = Array.from({ length: n }, (_, i) => ({
    x: 60 + (i % BAYS_PER_LEVEL) * BAY_PITCH,
    level: 1 + Math.floor(i / BAYS_PER_LEVEL),
  }));
  return { x, width: 60 + BAYS_PER_LEVEL * BAY_PITCH, levels, bays };
}

export function epicOf(item: Item, byId: Map<string, Item>, epics: Set<string>): string {
  let cur: Item | undefined = item;
  for (let hops = 0; cur && hops < 8; hops++) {
    if (cur.parent && epics.has(cur.parent)) return cur.parent;
    cur = cur.parent ? byId.get(cur.parent) : undefined;
  }
  return SHED;
}

export type Street = { houses: House[]; shed: House; yard: number; width: number };

export function layoutStreet(epics: Epic[], items: Item[]): Street {
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
  const live = sorted.filter((e) => stageOf(e) !== "done");
  const shedX = STREET_START + live.length * HOUSE_PITCH;
  const yard = shedX + 2 * TILE_PX + 40 + YARD_GAP;
  const closeX = yard + YARD_W + CLOSE_GAP;
  let front = 0;
  let sold = 0;
  const houses = sorted.map((e) => {
    const st = stageOf(e);
    const isSold = st === "done";
    return {
      id: e.id,
      title: e.title,
      x: isSold ? closeX + sold++ * TERRACE_PITCH : STREET_START + front++ * HOUSE_PITCH,
      stage: st,
      closed: e.closed,
      total: e.total,
      items: homes.get(e.id) ?? [],
      sold: isSold,
      ...(isSold ? { no: sold } : {}),
      ...(e.floors ? { floors: e.floors } : {}),
    };
  });
  const shed: House = {
    id: SHED,
    title: "the shed",
    x: shedX,
    stage: "lockup",
    closed: 0,
    total: 0,
    items: homes.get(SHED) ?? [],
    sold: false,
  };
  const width = sold ? closeX + sold * TERRACE_PITCH + 40 : yard + YARD_W;
  return { houses, shed, yard, width };
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
