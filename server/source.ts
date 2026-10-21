import type { Item } from "./model.js";
import type { HouseStat } from "./houses.js";
import type { Config, SourceName } from "./defaults.js";

/** run does the work and returns the id to name in the toast. */
export type Action = { run: (id: string, a: Record<string, string>) => Promise<string>; done: string };

/** Templates for the copied Claude prompts; {id} and {title} are filled by the card. */
export type Prompts = { work: string; plan: string };

/** {change} is the id before any `#` task suffix. */
export function fillPrompt(template: string, item: { id: string; title: string }): string {
  const change = item.id.split("#")[0];
  return template.replace(
    /\{(id|title|change)\}/g,
    (_, k) => ({ id: item.id, title: item.title, change })[k as "id"],
  );
}

export type Source = {
  items(): Promise<Item[]>;
  houses(cfg: Pick<Config, "houseTypes">): Promise<HouseStat[]>;
  closedCount(): Promise<number>;
  closedSince(since: Date): Promise<Item[]>;
  closedRecent(limit?: number): Promise<Item[]>;
  show(id: string): Promise<string>;
  actor(): Promise<string | undefined>;
  actions: Record<string, Action>;
  prompts: Prompts;
  /** Pull requests; absent means gh. */
  prs?(): Promise<Item[]>;
  /** Text for a `#n` PR id; absent means gh. */
  view?(id: string): Promise<string>;
  /** Directory whose changes mean the site should refresh. */
  watchPath?: string;
};

/** demo when asked; else .beads/ wins over openspec/ unless config says otherwise. */
export function pickSource(
  has: { beads: boolean; openspec: boolean; demo?: boolean },
  prefer?: SourceName,
): SourceName {
  if (has.demo) return "demo";
  if (prefer && prefer !== "demo" && has[prefer]) return prefer;
  return has.openspec && !has.beads ? "openspec" : "beads";
}
