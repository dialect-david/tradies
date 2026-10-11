export type Review = {
  head: string;
  from: string;
  /** false when refs/reviewed is missing and `from` is a fallback. */
  marked: boolean;
  markedAt?: string;
  commits: number;
  lines: number;
  /** Last report, from the git note on the marker. */
  report?: string;
};

export const REVIEW_REF = "refs/reviewed";
export const NOTES_REF = "reviewed";

export function parseShortstat(text: string): number {
  let n = 0;
  for (const m of text.matchAll(/(\d+) (?:insertion|deletion)/g)) n += Number(m[1]);
  return n;
}

export const short = (sha: string) => sha.slice(0, 7);

export function reviewPrompt(r: Review, site: string, skill: string, hazardLabel: string): string {
  return [
    `Code review ${site}: ${r.commits} commits, ${r.lines} lines, ${short(r.from)}..${short(r.head)}.`,
    `Run ${skill.replaceAll("{from}", r.from).replaceAll("{to}", r.head)}.`,
    `Report only: do not edit files, do not commit — skip the skill's fix step.`,
    `Write the findings as a report: severity, file:line, what's wrong, proposed fix.`,
    `File each High or Medium finding as a bead: \`bd create "<file>: <one line>" -t bug -p 1 -l ${hazardLabel} -d "<finding and fix>"\`, with \`--parent <epic>\` when it clearly belongs to one.`,
    `When done, save the report as a git note and move the inspection marker:`,
    `\`git notes --ref=${NOTES_REF} add -f -F <report.md> ${r.head} && git update-ref ${REVIEW_REF} ${r.head}\`.`,
  ].join(" ");
}
