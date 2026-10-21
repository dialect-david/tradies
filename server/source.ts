import type { Item } from "./model.js";
import type { HouseStat } from "./houses.js";
import type { Config } from "./defaults.js";

/** run does the work and returns the id to name in the toast. */
export type Action = { run: (id: string, a: Record<string, string>) => Promise<string>; done: string };

export type Source = {
  items(): Promise<Item[]>;
  houses(cfg: Pick<Config, "houseTypes">): Promise<HouseStat[]>;
  closedCount(): Promise<number>;
  closedSince(since: Date): Promise<Item[]>;
  closedRecent(limit?: number): Promise<Item[]>;
  show(id: string): Promise<string>;
  actor(): Promise<string | undefined>;
  actions: Record<string, Action>;
  /** Directory whose changes mean the site should refresh. */
  watchPath?: string;
};
