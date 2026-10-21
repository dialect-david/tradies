export type SourceName = "beads" | "openspec" | "demo";

export type Config = {
  /** Which tracker drives the site when both .beads/ and openspec/ exist. */
  source?: SourceName;
  foremanLabels: string[];
  todayLabels: string[];
  foreman?: string;
  houseTypes: string[];
  staleDays: number;
  goneDays: number;
  reviewAfter: number;
  /** Skill line for the review prompt; {from} and {to} are shas. */
  reviewSkill: string;
  hazardLabels: string[];
};

export const DEFAULTS: Config = {
  foremanLabels: ["needs-"],
  todayLabels: ["today"],
  houseTypes: ["epic", "feature"],
  staleDays: 7,
  goneDays: 30,
  reviewAfter: 15,
  reviewSkill: "/code-review {from}..{to}",
  hazardLabels: ["hs"],
};
