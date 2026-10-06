import { describe, expect, it } from "vitest";
import {
  ageDays,
  byUrgency,
  ciVerdict,
  fromBead,
  fromPr,
  isStale,
  type Bead,
  type Pr,
} from "../src/model.js";

const bead = (over: Partial<Bead> = {}): Bead => ({
  id: "x-1",
  title: "fix tap",
  status: "open",
  priority: 2,
  issue_type: "bug",
  owner: "dave",
  updated_at: "2026-10-01T00:00:00Z",
  ...over,
});

const pr = (over: Partial<Pr> = {}): Pr => ({
  number: 7,
  title: "roof",
  state: "OPEN",
  isDraft: false,
  reviewDecision: "REVIEW_REQUIRED",
  updatedAt: "2026-10-05T00:00:00Z",
  url: "u",
  author: { login: "dave" },
  ...over,
});

describe("fromBead", () => {
  it("maps type to trade and parent from parent-child dep", () => {
    const item = fromBead(bead({ dependencies: [{ depends_on_id: "x-0", type: "parent-child" }] }));
    expect(item.trade).toBe("bug");
    expect(item.parent).toBe("x-0");
    expect(item.blocked).toBe(false);
  });
  it("is blocked on a blocks dep or blocked status", () => {
    expect(fromBead(bead({ dependencies: [{ depends_on_id: "x-0", type: "blocks" }] })).blocked).toBe(true);
    expect(fromBead(bead({ status: "blocked" })).blocked).toBe(true);
  });
  it("prefers assignee over owner", () => {
    expect(fromBead(bead({ assignee: "sal" })).owner).toBe("sal");
  });
});

describe("fromPr", () => {
  it("failing CI is rain: blocked, top priority", () => {
    const item = fromPr(pr({ statusCheckRollup: [{ conclusion: "FAILURE" }] }));
    expect(item.blocked).toBe(true);
    expect(item.priority).toBe(0);
    expect(item.labels).toContain("ci:fail");
  });
  it("draft, review, approved statuses", () => {
    expect(fromPr(pr({ isDraft: true })).status).toBe("draft");
    expect(fromPr(pr()).status).toBe("review");
    expect(fromPr(pr({ reviewDecision: "APPROVED" })).status).toBe("approved");
  });
  it("ci verdict", () => {
    expect(ciVerdict(pr())).toBe("none");
    expect(ciVerdict(pr({ statusCheckRollup: [{ conclusion: "SUCCESS" }] }))).toBe("pass");
    expect(ciVerdict(pr({ statusCheckRollup: [{ status: "IN_PROGRESS" }] }))).toBe("pending");
  });
});

describe("staleness and order", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  it("a bead untouched 7 days is stale; prs never are", () => {
    expect(ageDays(fromBead(bead()), now)).toBe(9);
    expect(isStale(fromBead(bead()), now)).toBe(true);
    expect(isStale(fromBead(bead({ updated_at: "2026-10-08T00:00:00Z" })), now)).toBe(false);
    expect(isStale(fromPr(pr({ updatedAt: "2026-01-01T00:00:00Z" })), now)).toBe(false);
  });
  it("orders by priority then most recently touched", () => {
    const a = fromBead(bead({ id: "a", priority: 1 }));
    const b = fromBead(bead({ id: "b", priority: 0, updated_at: "2026-09-01T00:00:00Z" }));
    const c = fromBead(bead({ id: "c", priority: 0, updated_at: "2026-10-02T00:00:00Z" }));
    expect([a, b, c].sort(byUrgency).map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
});
