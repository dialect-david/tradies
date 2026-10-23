import { json, sh } from "./shell.ts";
import { fromPr, type Item, type Pr } from "./model.ts";
import type { PrFilter } from "./defaults.ts";

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
export const view = (n: string) => sh("gh", ["pr", "view", n.replace("#", "")]);
