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
  /** Child epics folded into this house, each with its own tally. */
  floors?: Floor[];
};
export type Floor = { id: string; title: string; status: string; closed: number; total: number };

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
      const floors: Floor[] = [];
      const floorsOf = (id: string) => {
        for (const c of children.get(id) ?? []) {
          if (tops.has(c)) continue;
          const kid = byId.get(c)!;
          if (kid.trade === "epic") {
            let fc = 0;
            let ft = 0;
            const count = (x: string) => {
              for (const g of children.get(x) ?? []) {
                if (tops.has(g)) continue;
                ft++;
                if (byId.get(g)!.status === "closed") fc++;
                count(g);
              }
            };
            count(c);
            floors.push({ id: c, title: kid.title, status: kid.status, closed: fc, total: ft });
          }
          floorsOf(c);
        }
      };
      floorsOf(i.id);
      return {
        id: i.id,
        title: i.title,
        status: i.status,
        closed,
        total,
        ...(phase ? { phase } : {}),
        ...(floors.length ? { floors } : {}),
      };
    });
}
