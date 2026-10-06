import type { Bead } from "./model.js";
import type { Config } from "./defaults.js";

export type HouseStat = { id: string; title: string; status: string; closed: number; total: number };

export function houses(all: Bead[], cfg: Pick<Config, "houseTypes">): HouseStat[] {
  const byId = new Map(all.map((b) => [b.id, b]));
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const b of all)
    for (const d of b.dependencies ?? [])
      if (d.type === "parent-child" && byId.has(d.depends_on_id)) {
        parent.set(b.id, d.depends_on_id);
        children.set(d.depends_on_id, [...(children.get(d.depends_on_id) ?? []), b.id]);
      }
  const wants = (b: Bead) =>
    cfg.houseTypes.includes(b.issue_type) && (b.issue_type === "epic" || children.has(b.id));
  const candidates = new Set(all.filter(wants).map((b) => b.id));
  const nested = (id: string) => {
    for (let p = parent.get(id); p; p = parent.get(p)) if (candidates.has(p)) return true;
    return false;
  };
  const tops = new Set(all.filter((b) => candidates.has(b.id) && !nested(b.id)).map((b) => b.id));
  return all
    .filter((b) => tops.has(b.id))
    .map((b) => {
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
      walk(b.id);
      return { id: b.id, title: b.title, status: b.status, closed, total };
    });
}
