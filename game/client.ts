import type { Item } from "../server/model.js";

import type { Epic } from "./street.js";

export type Site = { site: string; closed: number; epics: Epic[]; items: Item[] };

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

export async function act(
  type: string,
  id: string,
  text = "",
  extra: Record<string, string> = {},
): Promise<string> {
  const r = await fetch("/api/act", { method: "POST", body: JSON.stringify({ type, id, text, ...extra }) });
  const j = (await r.json()) as { msg?: string; error?: string };
  if (!r.ok) throw new Error(j.error);
  return j.msg ?? "";
}

export function onRefresh(fn: () => void) {
  new EventSource("/api/events").onmessage = (e) => e.data === "refresh" && fn();
}

export async function knockoff(): Promise<{ since: Date; today: Item[] }> {
  const r = await fetch("/api/knockoff");
  if (!r.ok) throw new Error((await r.json()).error);
  const k = (await r.json()) as { since: string; today: Item[] };
  for (const i of k.today) ((i.updatedAt = new Date(i.updatedAt)), (i.closedAt = new Date(i.closedAt!)));
  return { since: new Date(k.since), today: k.today };
}
