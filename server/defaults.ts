export type Config = { foremanLabels: string[]; foreman?: string; staleDays: number; goneDays: number };

export const DEFAULTS: Config = { foremanLabels: ["needs-"], staleDays: 7, goneDays: 30 };
