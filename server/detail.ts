import type { Item } from "./model.ts";

export type Row = { id: string; title: string; status: string; priority: number; updatedAt: string };
export type Note = { who?: string; when?: string; text: string };
export type Check = { name: string; state: string };

/** What a card shows. Only `summary` is required; a missing field is a missing region. */
export type Detail = {
  summary: string;
  more?: string;
  acceptance?: string;
  design?: string;
  notes?: Note[];
  closeReason?: string;
  children?: Row[];
  /** Spec delta lines, one fold after design. */
  deltas?: string;
  /** CI checks of a PR; state is lower-case (`success`, `failure`, `pending`...). */
  checks?: Check[];
  /** Branch of a PR, shown as a chip. */
  branch?: string;
  /** The bead a PR is for, named in its title or branch. */
  linked?: Row;
};

const ID = /\b[a-z][a-z0-9]*-[a-z0-9]+(?:\.\d+)*\b/gi;

/** First bead id in the text that names an item. */
export function linkedRow(text: string, items: Item[]): Row | undefined {
  const by = new Map(items.map((i) => [i.id, i]));
  for (const m of text.match(ID) ?? []) {
    const i = by.get(m);
    if (i) return row(i);
  }
  return undefined;
}

export const passing = (c: Check) => /^(success|pass|passed|neutral|skipped)$/.test(c.state);

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

/** Drop empty fields so a missing region is a missing key. */
export function prune(d: Detail): Detail {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d))
    if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  return { summary: d.summary, ...out } as Detail;
}

export const row = (i: Item): Row => ({
  id: i.id,
  title: i.title,
  status: i.status,
  priority: i.priority,
  updatedAt: i.updatedAt.toISOString(),
});
