import type { Item } from "../server/model.js";

export type Site = { site: string; closed: number; items: Item[] };

export async function items(): Promise<Site> {
  const r = await fetch("/api/items");
  if (!r.ok) throw new Error((await r.json()).error);
  const s = (await r.json()) as Site;
  for (const i of s.items) i.updatedAt = new Date(i.updatedAt);
  return s;
}

export async function show(id: string): Promise<string> {
  return (await fetch(`/api/show?id=${encodeURIComponent(id)}`)).text();
}

export async function act(type: string, id: string, text = ""): Promise<string> {
  const r = await fetch("/api/act", { method: "POST", body: JSON.stringify({ type, id, text }) });
  const j = (await r.json()) as { msg?: string; error?: string };
  if (!r.ok) throw new Error(j.error);
  return j.msg ?? "";
}

export function onRefresh(fn: () => void) {
  new EventSource("/api/events").onmessage = (e) => e.data === "refresh" && fn();
}
