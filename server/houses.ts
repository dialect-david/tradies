import type { Item } from "./model.ts";
import type { Config } from "./defaults.ts";

export const PHASES = ["site", "slab", "frame", "roof", "lockup", "fitout", "done"] as const;
export type Phase = (typeof PHASES)[number];

/** phase: the source's own idea of how built the house is; absent means closed/total decides. */
export type HouseStat = {
  id: string;
  title: string;
  status: string;
  closed: number;
  total: number;
  phase?: Phase;
};

export function houses(
  all: Item[],
  cfg: Pick<Config, "houseTypes">,
  phaseOf: (id: string) => Phase | undefined = () => undefined,
): HouseStat[] {
  const byId = new Map(all.map((i) => [i.id, i]));
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const i of all)
    if (i.parent && byId.has(i.parent)) {
      parent.set(i.id, i.parent);
      children.set(i.parent, [...(children.get(i.parent) ?? []), i.id]);
    }
  const wants = (i: Item) => cfg.houseTypes.includes(i.trade) && (i.trade === "epic" || children.has(i.id));
  const candidates = new Set(all.filter(wants).map((i) => i.id));
  const nested = (id: string) => {
    for (let p = parent.get(id); p; p = parent.get(p)) if (candidates.has(p)) return true;
    return false;
  };
  const tops = new Set(all.filter((i) => candidates.has(i.id) && !nested(i.id)).map((i) => i.id));
  return all
    .filter((i) => tops.has(i.id))
    .map((i) => {
      let closed = 0;
      let total = 0;
      const walk = (id: string) => {
        for (const c of children.get(id) ?? []) {
          if (tops.has(c)) continue;
          total++;
          if (byId.get(c)!.status === "closed") closed++;
          walk(c);
        }
      };
      walk(i.id);
      const phase = phaseOf(i.id);
      return { id: i.id, title: i.title, status: i.status, closed, total, ...(phase ? { phase } : {}) };
    });
}
