import { ageDays, byUrgency, isStale, type Item } from "../server/model.ts";
import { DEFAULTS, type Config } from "../server/defaults.ts";
import { rootBlocker } from "../server/deps.ts";

export const needsSomeone = (i: Item, cfg: Config = DEFAULTS) =>
  i.labels.some((l) => cfg.foremanLabels.some((p) => l.startsWith(p))) ||
  (i.blocked && !!i.assignee && !!cfg.foreman && i.assignee.toLowerCase() === cfg.foreman.toLowerCase());

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
  /** Picked for the new-day board: open beads carrying a today label, wherever they live. */
  today: Item[];
  /** Open review findings; cones at the house they belong to. */
  hazards: Item[];
  /** Closing this bead frees the most others. */
  blocker?: { item: Item; frees: number };
  items: Item[];
  cfg: Config;
};

export function cast(
  items: Item[],
  now = new Date(),
  cfg: Config = DEFAULTS,
  houses: ReadonlySet<string> = new Set(),
): Cast {
  const stale = (i: Item) => isStale(i, now, cfg.staleDays);
  const house = (i: Item) => houses.has(i.id);
  const all = items.filter((i) => i.kind === "bead" && (!house(i) || needsSomeone(i, cfg)));
  const deferred = all.filter((i) => i.status === "deferred");
  const beads = all.filter((i) => i.status !== "deferred");
  const prs = items.filter((i) => i.kind === "pr").sort(byInspection);
  const byScore = (a: Item, b: Item) => score(b, now, cfg) - score(a, now, cfg);
  const working = beads.filter((i) => i.status === "in_progress" && !house(i));
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
  const blocker = rootBlocker(items.filter((i) => i.kind === "bead" && i.status !== "closed"));
  const bonus = (i: Item) => (blocker && blocker.item.id === i.id ? Math.min(30, blocker.frees * 6) : 0);
  const worst = [...prs, ...all].sort(
    (a, b) => score(b, now, cfg) + bonus(b) - score(a, now, cfg) - bonus(a),
  )[0];
  const today = items
    .filter(
      (i) => i.kind === "bead" && i.status !== "closed" && i.labels.some((l) => cfg.todayLabels.includes(l)),
    )
    .sort(byUrgency);
  const hazards = items
    .filter(
      (i) => i.kind === "bead" && i.status !== "closed" && i.labels.some((l) => cfg.hazardLabels.includes(l)),
    )
    .sort(byUrgency);
  return {
    items,
    blocker,
    hazards,
    working,
    asleep,
    needsYou,
    deferred,
    smoko,
    gone,
    waiting,
    inspectors: prs,
    rain,
    worst: worst && score(worst, now, cfg) + bonus(worst) > 0 ? worst : undefined,
    ready,
    today,
    cfg,
  };
}

const INSPECTION = ["review", "draft", "approved"];
/** Failing CI first, then approved, review, draft; newest first within a group. */
export function byInspection(a: Item, b: Item): number {
  const rank = (i: Item) => (i.blocked ? 0 : 1 + Math.max(0, INSPECTION.indexOf(i.status)));
  return rank(a) - rank(b) || b.updatedAt.getTime() - a.updatedAt.getTime();
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

export type WhyState =
  | "working"
  | "asleep"
  | "needs"
  | "waiting"
  | "smoko"
  | "gone"
  | "deferred"
  | "closed"
  | "failing"
  | "approved"
  | "ready";

export type Why = { state: WhyState; text: string };

const weekday = (d: Date) => d.toLocaleDateString("en-AU", { weekday: "short" });

/** The one line the author can't write: why this bead is on screen today, in site words. */
export function why(i: Item, items: Item[], now = new Date(), cfg: Config = DEFAULTS): Why {
  const age = ageDays(i, now);
  const frees = items.filter((x) => x.waitsOn.includes(i.id)).length;
  const freesWord = frees ? `, frees ${frees}` : "";
  const who = i.assignee ?? "someone";
  if (i.kind === "pr")
    return i.blocked
      ? { state: "failing", text: "red CI, site stopped till it's green" }
      : i.status === "approved"
        ? { state: "approved", text: "signed off, ready to merge" }
        : { state: "ready", text: "" };
  if (i.status === "closed")
    return { state: "closed", text: i.closeReason ? `knocked off: ${i.closeReason}` : "knocked off" };
  if (i.status === "deferred") return { state: "deferred", text: "on the plans, out of the way" };
  if (i.blocked && !needsSomeone(i, cfg)) {
    const on = items.filter((x) => i.waitsOn.includes(x.id));
    const what = on.length ? on.map((x) => `${x.id} ${x.title}`).join("; ") : "materials";
    return { state: "waiting", text: `waiting on ${what}${freesWord}` };
  }
  if (needsSomeone(i, cfg)) {
    const asks = i.labels
      .filter((l) => cfg.foremanLabels.some((p) => l.startsWith(p)))
      .map((l) => l.slice(cfg.foremanLabels.find((p) => l.startsWith(p))!.length) || l);
    const what = asks.length ? asks.join(", ") : "blocked and yours";
    return { state: "needs", text: `needs you: ${what}${freesWord}` };
  }
  if (i.status === "in_progress")
    return isStale(i, now, cfg.staleDays)
      ? { state: "asleep", text: `${who} asleep since ${weekday(i.updatedAt)}, ${age} days` }
      : { state: "working", text: `${who} on the tools` };
  if (age >= cfg.goneDays) return { state: "gone", text: `gone home ${age} days${freesWord}` };
  if (isStale(i, now, cfg.staleDays)) return { state: "smoko", text: `on smoko ${age} days${freesWord}` };
  return { state: "ready", text: frees ? `ready${freesWord}` : "" };
}

export const whyLine = (i: Item, items: Item[], now = new Date(), cfg: Config = DEFAULTS) =>
  why(i, items, now, cfg).text;
