import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULTS, type Config } from "./defaults.js";
import { site } from "./shell.js";

export { DEFAULTS, type Config };

/** Lowest to highest precedence: tool install, workspace, user. */
export const CONFIG_PATHS = [
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "config.json"),
  path.join(site, ".tradies.json"),
  path.join(os.homedir(), ".config", "tradies.json"),
];

export function parseConfig(text: string | undefined): Partial<Config> {
  if (!text) return {};
  const raw = JSON.parse(text) as Partial<Record<keyof Config, unknown>>;
  const out: Partial<Config> = {};
  for (const k of ["foremanLabels", "todayLabels", "houseTypes", "hazardLabels"] as const)
    if (Array.isArray(raw[k]))
      out[k] = (raw[k] as unknown[]).filter((l): l is string => typeof l === "string" && l.length > 0);
  for (const k of ["staleDays", "goneDays", "reviewAfter"] as const) {
    const v = raw[k];
    if (typeof v === "number" && v > 0) out[k] = v;
  }
  for (const k of ["foreman", "reviewSkill"] as const)
    if (typeof raw[k] === "string" && (raw[k] as string).trim()) out[k] = (raw[k] as string).trim();
  return out;
}

export function loadConfig(files = CONFIG_PATHS, actor?: string): Config {
  const cfg = { ...DEFAULTS };
  for (const file of files) {
    try {
      Object.assign(cfg, parseConfig(readFileSync(file, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn(`tradies: ignoring ${file}: ${(e as Error).message}`);
    }
  }
  return { ...cfg, foreman: cfg.foreman ?? actor };
}
