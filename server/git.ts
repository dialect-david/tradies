import { sh } from "./shell.ts";
import { NOTES_REF, parseShortstat, REVIEW_REF, type Review } from "./review.ts";

const rev = async (ref: string) => (await sh("git", ["rev-parse", "--verify", "-q", ref])).trim();

export async function review(fallbackCommits: number): Promise<Review | undefined> {
  try {
    const head = await rev("HEAD");
    const marker = await rev(REVIEW_REF).catch(() => undefined);
    const total = Number(await sh("git", ["rev-list", "--count", "HEAD"]));
    const from = marker ?? (await rev(`HEAD~${Math.min(fallbackCommits, total - 1)}`));
    const [commits, stat, markedAt, report] = await Promise.all([
      sh("git", ["rev-list", "--count", `${from}..HEAD`]),
      sh("git", ["diff", "--shortstat", from, head]),
      marker ? sh("git", ["log", "-1", "--format=%cI", marker]) : undefined,
      marker ? sh("git", ["notes", `--ref=${NOTES_REF}`, "show", marker]).catch(() => undefined) : undefined,
    ]);
    return {
      head,
      from,
      marked: !!marker,
      markedAt: markedAt?.trim(),
      commits: Number(commits),
      lines: parseShortstat(stat),
      report: report?.trim() || undefined,
    };
  } catch {
    return undefined;
  }
}

export async function userName(): Promise<string | undefined> {
  try {
    return (await sh("git", ["config", "user.name"])).trim() || process.env.USER;
  } catch {
    return process.env.USER;
  }
}
