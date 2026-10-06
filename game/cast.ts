import { ageDays, byUrgency, isStale, type Item } from "../server/model.js";
import { DEFAULTS, type Config } from "../server/config.js";

export const needsSomeone = (i: Item, cfg: Config = DEFAULTS) =>
  i.labels.some((l) => cfg.foremanLabels.some((p) => l.startsWith(p)));

export type Role = "working" | "smoko" | "waiting" | "inspector" | "board";

export type Cast = {
  working: Item[];
  asleep: Item[];
  needsYou: Item[];
  deferred: Item[];
  smoko: Item[];
  gone: Item[];
  waiting: Item[];
  inspectors: Item[];
  rain: boolean;
  worst?: Item;
  ready: Item[];
  cfg: Config;
};

export function cast(items: Item[], now = new Date(), cfg: Config = DEFAULTS): Cast {
  const stale = (i: Item) => isStale(i, now, cfg.staleDays);
  const all = items.filter((i) => i.kind === "bead");
  const deferred = all.filter((i) => i.status === "deferred");
  const beads = all.filter((i) => i.status !== "deferred");
  const prs = items.filter((i) => i.kind === "pr");
  const byScore = (a: Item, b: Item) => score(b, now, cfg) - score(a, now, cfg);
  const working = beads.filter((i) => i.status === "in_progress");
  const asleep = working.filter(stale);
  const needsYou = beads.filter((i) => needsSomeone(i, cfg) && i.status !== "in_progress").sort(byScore);
  const waiting = beads
    .filter((i) => i.blocked && i.status !== "in_progress" && !needsYou.includes(i))
    .sort(byScore);
  const idle = beads.filter(
    (i) => stale(i) && !working.includes(i) && !waiting.includes(i) && !needsYou.includes(i),
  );
  const gone = idle.filter((i) => ageDays(i, now) >= cfg.goneDays).sort(byScore);
  const smoko = idle.filter((i) => !gone.includes(i)).sort(byScore);
  const rain = prs.some((i) => i.blocked);
  const ready = beads
    .filter((i) => !i.blocked && i.status === "open" && !needsYou.includes(i))
    .sort(byUrgency);
  const worst = [...items].sort(byScore)[0];
  return {
    working,
    asleep,
    needsYou,
    deferred,
    smoko,
    gone,
    waiting,
    inspectors: prs,
    rain,
    worst: worst && score(worst, now, cfg) > 0 ? worst : undefined,
    ready,
    cfg,
  };
}

export function score(i: Item, now: Date, cfg: Config = DEFAULTS): number {
  let s = 0;
  if (i.kind === "pr" && i.blocked) s += 100;
  if (i.priority === 0) s += 50;
  if (i.priority === 1) s += 10;
  const age = ageDays(i, now);
  const stale = isStale(i, now, cfg.staleDays);
  if (stale) s += age >= cfg.goneDays ? 2 : Math.min(40, age);
  if (i.status === "in_progress" && stale) s += 30;
  if (needsSomeone(i, cfg)) s += 25;
  if (i.status === "deferred") s = 0;
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
