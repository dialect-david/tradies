import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { DEFAULTS, type Config } from "./defaults.js";

export { DEFAULTS, type Config };

export const CONFIG_PATH = path.join(homedir(), ".config", "tradies", "config.json");

export function parseConfig(text: string | undefined): Config {
  if (!text) return DEFAULTS;
  const raw = JSON.parse(text) as Partial<Record<keyof Config, unknown>>;
  const list = Array.isArray(raw.foremanLabels)
    ? raw.foremanLabels.filter((l): l is string => typeof l === "string" && l.length > 0)
    : DEFAULTS.foremanLabels;
  const days = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  return {
    foremanLabels: list,
    staleDays: days(raw.staleDays, DEFAULTS.staleDays),
    goneDays: days(raw.goneDays, DEFAULTS.goneDays),
  };
}

export function loadConfig(file = CONFIG_PATH): Config {
  try {
    return parseConfig(readFileSync(file, "utf8"));
  } catch {
    return DEFAULTS;
  }
}
