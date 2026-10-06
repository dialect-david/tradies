export type Trade =
  "task" | "bug" | "feature" | "chore" | "epic" | "decision" | "spike" | "story" | "milestone";

export type Item = {
  kind: "bead" | "pr";
  id: string;
  title: string;
  status: string;
  priority: number;
  trade: string;
  owner?: string;
  assignee?: string;
  updatedAt: Date;
  blocked: boolean;
  parent?: string;
  labels: string[];
  url?: string;
  closedAt?: Date;
  closeReason?: string;
};

export type Bead = {
  id: string;
  title: string;
  status: string;
  priority: number;
  issue_type: string;
  owner?: string;
  assignee?: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  labels?: string[];
  dependencies?: { depends_on_id: string; type: string }[];
  dependency_count?: number;
};

export type Pr = {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  reviewDecision: string;
  updatedAt: string;
  url: string;
  author: { login: string };
  statusCheckRollup?: { conclusion?: string; status?: string }[];
};

export function fromBead(b: Bead): Item {
  const deps = b.dependencies ?? [];
  const parent = deps.find((d) => d.type === "parent-child")?.depends_on_id;
  const blocked = b.status === "blocked" || deps.some((d) => d.type === "blocks");
  return {
    kind: "bead",
    id: b.id,
    title: b.title,
    status: b.status,
    priority: b.priority,
    trade: b.issue_type,
    owner: b.assignee ?? b.owner,
    assignee: b.assignee,
    updatedAt: new Date(b.updated_at),
    closedAt: b.closed_at ? new Date(b.closed_at) : undefined,
    closeReason: b.close_reason,
    blocked,
    parent,
    labels: b.labels ?? [],
  };
}

export function ciVerdict(p: Pr): "pass" | "fail" | "pending" | "none" {
  const checks = p.statusCheckRollup ?? [];
  if (checks.length === 0) return "none";
  if (checks.some((c) => c.conclusion && /FAIL|ERROR|CANCEL/i.test(c.conclusion))) return "fail";
  if (checks.some((c) => !c.conclusion || c.status === "IN_PROGRESS" || c.status === "QUEUED"))
    return "pending";
  return "pass";
}

export function fromPr(p: Pr): Item {
  const ci = ciVerdict(p);
  const status = p.isDraft ? "draft" : p.reviewDecision === "APPROVED" ? "approved" : "review";
  return {
    kind: "pr",
    id: `#${p.number}`,
    title: p.title,
    status,
    priority: ci === "fail" ? 0 : p.reviewDecision === "REVIEW_REQUIRED" ? 1 : 2,
    trade: "inspector",
    owner: p.author.login,
    updatedAt: new Date(p.updatedAt),
    blocked: ci === "fail",
    labels: ci === "none" ? [] : [`ci:${ci}`],
    url: p.url,
  };
}

export const STALE_DAYS = 7;

export function ageDays(item: Item, now = new Date()): number {
  return Math.floor((now.getTime() - item.updatedAt.getTime()) / 86_400_000);
}

export function isStale(item: Item, now = new Date(), days = STALE_DAYS): boolean {
  return item.kind === "bead" && item.status !== "closed" && ageDays(item, now) >= days;
}

export function byUrgency(a: Item, b: Item): number {
  return a.priority - b.priority || b.updatedAt.getTime() - a.updatedAt.getTime();
}
