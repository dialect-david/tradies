export type Config = {
  foremanLabels: string[];
  todayLabels: string[];
  foreman?: string;
  houseTypes: string[];
  staleDays: number;
  goneDays: number;
  reviewAfter: number;
};

export const DEFAULTS: Config = {
  foremanLabels: ["needs-"],
  todayLabels: ["today"],
  houseTypes: ["epic", "feature"],
  staleDays: 7,
  goneDays: 30,
  reviewAfter: 15,
};
