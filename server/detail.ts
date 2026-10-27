import type { Item } from "./model.ts";

export type Row = { id: string; title: string; status: string; priority: number; updatedAt: string };
export type Note = { who?: string; when?: string; text: string };

/** What a card shows. Only `summary` is required; a missing field is a missing region. */
export type Detail = {
  summary: string;
  more?: string;
  acceptance?: string;
  design?: string;
  notes?: Note[];
  closeReason?: string;
  children?: Row[];
  /** Raw text for sources that have no structure yet; shown as-is below the regions. */
  text?: string;
};

const MAX = 140;

/** Glance line first: blank-line paragraph, else first sentence, else a word-boundary cut. */
export function glance(description = ""): { summary: string; more?: string } {
  const d = description.trim();
  if (!d) return { summary: "" };
  const para = d.indexOf("\n\n");
  if (para > 0 && para <= MAX * 2) return rest(d.slice(0, para), d.slice(para + 2));
  const line = d.indexOf("\n");
  if (line > 0 && line <= MAX) return rest(d.slice(0, line), d.slice(line + 1));
  const sentence = /[.!?](\s|$)/.exec(d);
  if (sentence && sentence.index + 1 <= MAX)
    return rest(d.slice(0, sentence.index + 1), d.slice(sentence.index + 1));
  if (d.length <= MAX) return { summary: d };
  const cut = d.lastIndexOf(" ", MAX);
  return rest(`${d.slice(0, cut > 40 ? cut : MAX)}…`, d);
}

const rest = (summary: string, more: string) => {
  const m = more.trim();
  return m ? { summary: summary.trim(), more: m } : { summary: summary.trim() };
};

export const row = (i: Item): Row => ({
  id: i.id,
  title: i.title,
  status: i.status,
  priority: i.priority,
  updatedAt: i.updatedAt.toISOString(),
});
