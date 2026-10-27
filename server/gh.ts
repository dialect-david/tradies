import { json, sh } from "./shell.ts";
import { fromPr, type Item, type Pr } from "./model.ts";
import type { PrFilter } from "./defaults.ts";
import { glance, linkedRow, prune, type Check, type Detail } from "./detail.ts";

const FIELDS = "number,title,state,isDraft,reviewDecision,statusCheckRollup,author,updatedAt,url";
export const PR_LIMIT = 50;

export function prArgs(f: PrFilter = {}): string[] {
  const out = ["pr", "list", "--json", FIELDS, "--limit", String(f.limit ?? PR_LIMIT)];
  for (const k of ["author", "base", "label"] as const) if (f[k]) out.push(`--${k}`, f[k]!);
  return out;
}

export async function listPrs(filter?: PrFilter): Promise<Item[]> {
  try {
    const prs = await json<Pr[]>("gh", prArgs(filter));
    return prs.map(fromPr);
  } catch {
    return [];
  }
}

export const merge = (n: string) =>
  sh("gh", ["pr", "merge", n.replace("#", ""), "--squash", "--delete-branch"]);
const VIEW_FIELDS = "title,body,headRefName,statusCheckRollup";
export type PrView = {
  title: string;
  body?: string;
  headRefName?: string;
  statusCheckRollup?: { name?: string; context?: string; conclusion?: string; state?: string; status?: string }[];
};

export const check = (c: NonNullable<PrView["statusCheckRollup"]>[number]): Check => ({
  name: c.name ?? c.context ?? "check",
  state: (c.conclusion || c.state || c.status || "pending").toLowerCase(),
});

export function fromPrView(p: PrView, items: Item[] = []): Detail {
  return prune({
    ...glance(p.body),
    branch: p.headRefName,
    checks: (p.statusCheckRollup ?? []).map(check),
    linked: linkedRow(`${p.title} ${p.headRefName ?? ""}`, items),
  });
}

export const view = async (n: string, items: Item[] = []) =>
  fromPrView(await json<PrView>("gh", ["pr", "view", n.replace("#", ""), "--json", VIEW_FIELDS]), items);
