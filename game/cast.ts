import { ageDays, byUrgency, isStale, type Item } from "../server/model.js";

export const GONE_DAYS = 30;

export type Role = "working" | "smoko" | "waiting" | "inspector" | "board";

export type Cast = {
  working: Item[];
  asleep: Item[];
  smoko: Item[];
  gone: Item[];
  waiting: Item[];
  inspectors: Item[];
  rain: boolean;
  worst?: Item;
  ready: Item[];
};

export function cast(items: Item[], now = new Date()): Cast {
  const beads = items.filter((i) => i.kind === "bead");
  const prs = items.filter((i) => i.kind === "pr");
  const byScore = (a: Item, b: Item) => score(b, now) - score(a, now);
  const working = beads.filter((i) => i.status === "in_progress");
  const asleep = working.filter((i) => isStale(i, now));
  const waiting = beads.filter((i) => i.blocked && i.status !== "in_progress").sort(byScore);
  const idle = beads.filter((i) => isStale(i, now) && !working.includes(i) && !waiting.includes(i));
  const gone = idle.filter((i) => ageDays(i, now) >= GONE_DAYS).sort(byScore);
  const smoko = idle.filter((i) => !gone.includes(i)).sort(byScore);
  const rain = prs.some((i) => i.blocked);
  const ready = beads.filter((i) => !i.blocked && i.status === "open").sort(byUrgency);
  const worst = [...items].sort(byScore)[0];
  return {
    working,
    asleep,
    smoko,
    gone,
    waiting,
    inspectors: prs,
    rain,
    worst: worst && score(worst, now) > 0 ? worst : undefined,
    ready,
  };
}

export function score(i: Item, now: Date): number {
  let s = 0;
  if (i.kind === "pr" && i.blocked) s += 100;
  if (i.priority === 0) s += 50;
  if (i.priority === 1) s += 10;
  const age = ageDays(i, now);
  if (isStale(i, now)) s += age >= GONE_DAYS ? 2 : Math.min(40, age);
  if (i.status === "in_progress" && isStale(i, now)) s += 30;
  if (i.blocked) s += 5;
  return s;
}

export const TRADE_COLOUR: Record<string, number> = {
  bug: 0xe74c3c,
  feature: 0x3498db,
  task: 0xf1c40f,
  chore: 0x95a5a6,
  epic: 0x9b59b6,
  decision: 0x1abc9c,
  spike: 0xe67e22,
  story: 0x2ecc71,
  milestone: 0xecf0f1,
};
