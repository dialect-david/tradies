export type Config = {
  foremanLabels: string[];
  foreman?: string;
  houseTypes: string[];
  staleDays: number;
  goneDays: number;
};

export const DEFAULTS: Config = {
  foremanLabels: ["needs-"],
  houseTypes: ["epic", "feature"],
  staleDays: 7,
  goneDays: 30,
};
