import path from "node:path";
import { site } from "./shell.js";
import type { Source } from "./source.js";

const notYet = () => Promise.reject(new Error("openspec source: not yet"));

export const openspec: Source = {
  items: notYet,
  houses: notYet,
  closedCount: notYet,
  closedSince: notYet,
  closedRecent: notYet,
  show: notYet,
  actor: () => Promise.resolve(process.env.USER),
  actions: {},
  watchPath: path.join(site, "openspec"),
};
