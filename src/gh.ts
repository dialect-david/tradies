import { json, sh } from "./shell.js";
import { fromPr, type Item, type Pr } from "./model.js";

const FIELDS = "number,title,state,isDraft,reviewDecision,statusCheckRollup,author,updatedAt,url";

export async function listPrs(): Promise<Item[]> {
  try {
    const prs = await json<Pr[]>("gh", ["pr", "list", "--json", FIELDS, "--limit", "50"]);
    return prs.map(fromPr);
  } catch {
    return [];
  }
}

export const merge = (n: string) =>
  sh("gh", ["pr", "merge", n.replace("#", ""), "--squash", "--delete-branch"]);
export const view = (n: string) => sh("gh", ["pr", "view", n.replace("#", "")]);
