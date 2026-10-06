import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULTS, type Config } from "./defaults.js";

export { DEFAULTS, type Config };

export const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "config.json");

export function parseConfig(text: string | undefined): Config {
  if (!text) return DEFAULTS;
  const raw = JSON.parse(text) as Partial<Record<keyof Config, unknown>>;
  const strings = (v: unknown, d: string[]) =>
    Array.isArray(v) ? v.filter((l): l is string => typeof l === "string" && l.length > 0) : d;
  const list = strings(raw.foremanLabels, DEFAULTS.foremanLabels);
  const houseTypes = strings(raw.houseTypes, DEFAULTS.houseTypes);
  const days = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  const foreman = typeof raw.foreman === "string" && raw.foreman.trim() ? raw.foreman.trim() : undefined;
  return {
    foremanLabels: list,
    foreman,
    houseTypes,
    staleDays: days(raw.staleDays, DEFAULTS.staleDays),
    goneDays: days(raw.goneDays, DEFAULTS.goneDays),
  };
}

export function loadConfig(file = CONFIG_PATH, actor?: string): Config {
  let cfg = DEFAULTS;
  try {
    cfg = parseConfig(readFileSync(file, "utf8"));
  } catch {
    /* no file: defaults */
  }
  return { ...cfg, foreman: cfg.foreman ?? actor };
}
