import type { Item } from "./model.ts";

/** Blocker id → ids it holds up, directly or through other open beads. */
export function frees(items: Item[]): Map<string, Set<string>> {
  const open = new Set(items.map((i) => i.id));
  const dependents = new Map<string, string[]>();
  for (const i of items)
    for (const b of i.waitsOn) if (open.has(b)) dependents.set(b, [...(dependents.get(b) ?? []), i.id]);
  const out = new Map<string, Set<string>>();
  for (const id of dependents.keys()) {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) {
      for (const d of dependents.get(stack.pop()!) ?? [])
        if (!seen.has(d)) {
          seen.add(d);
          stack.push(d);
        }
    }
    out.set(id, seen);
  }
  return out;
}

export function rootBlocker(items: Item[]): { item: Item; frees: number } | undefined {
  let best: { item: Item; frees: number } | undefined;
  for (const [id, set] of frees(items)) {
    const item = items.find((i) => i.id === id);
    if (item && (!best || set.size > best.frees)) best = { item, frees: set.size };
  }
  return best;
}

const node = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");
const label = (i: Item) => `${i.id}<br/>${i.title.slice(0, 40).replace(/["<>|]/g, " ")}`;

/** Blocks edges only; beads grouped by house. Blocker points at what it holds up. */
export function mermaid(items: Item[], houseOf: (i: Item) => string | undefined): string {
  const open = new Map(items.map((i) => [i.id, i]));
  const edges = items.flatMap((i) => i.waitsOn.filter((b) => open.has(b)).map((b) => [b, i.id] as const));
  const inGraph = new Set(edges.flat());
  const groups = new Map<string, Item[]>();
  for (const i of items)
    if (inGraph.has(i.id)) {
      const h = houseOf(i) ?? "";
      groups.set(h, [...(groups.get(h) ?? []), i]);
    }
  const lines = ["graph LR"];
  for (const [h, members] of groups) {
    if (h) lines.push(`  subgraph ${node(h)}["${h}"]`);
    for (const i of members) lines.push(`  ${h ? "  " : ""}${node(i.id)}["${label(i)}"]`);
    if (h) lines.push("  end");
  }
  for (const [a, b] of edges) lines.push(`  ${node(a)} --> ${node(b)}`);
  for (const i of items)
    if (inGraph.has(i.id) && i.status === "in_progress")
      lines.push(`  style ${node(i.id)} stroke:#f1c40f,stroke-width:3px`);
  return lines.join("\n");
}
