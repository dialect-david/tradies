import type { Item } from "../model.js";

export type Fixture = { items: Item[]; prs: Item[]; foreman: string };

export const FOREMAN = "you";

type Over = Partial<Item> & { id: string; title: string };

/** Every legend row of the README, themed as a cafe ordering app. Dates are relative to `now`. */
export function fixture(now = new Date()): Fixture {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 3_600_000);
  const bead = (o: Over): Item => ({
    kind: "bead",
    status: "open",
    priority: 2,
    trade: "task",
    updatedAt: ago(2),
    blocked: false,
    waitsOn: [],
    labels: [],
    ...o,
  });
  const closed = (o: Over & { days: number; why: string }): Item => {
    const { days, why, ...rest } = o;
    return bead({ status: "closed", closedAt: ago(days), updatedAt: ago(days), closeReason: why, ...rest });
  };
  const epic = (id: string, title: string, o: Partial<Item> = {}) =>
    bead({ id, title, trade: "epic", priority: 1, updatedAt: ago(1), ...o });
  const kid = (parent: string, id: string, title: string, o: Partial<Item> = {}) =>
    bead({ id, title, parent, ...o });
  const done = (
    parent: string,
    id: string,
    title: string,
    days: number,
    why: string,
    o: Partial<Item> = {},
  ) => closed({ id, title, parent, days, why, ...o });

  const items: Item[] = [
    // --- menu & ordering: mid build, one tradie on it, cones from the last review
    epic("demo-1", "Menu & ordering"),
    done("demo-1", "demo-10", "Menu data model", 12, "shipped"),
    done("demo-1", "demo-11", "Category tabs", 10, "shipped"),
    done("demo-1", "demo-12", "Item card with photo", 9, "shipped"),
    done("demo-1", "demo-13", "Cart drawer", 6, "shipped, see #41"),
    done("demo-1", "demo-14", "Dietary filter chips", 0, "merged this morning", { closedAt: ago(0, 3) }),
    kid("demo-1", "demo-15", "Modifiers: milk, size, extras", {
      status: "in_progress",
      assignee: "ella",
      owner: "ella",
      updatedAt: ago(0, 5),
      trade: "feature",
    }),
    kid("demo-1", "demo-16", "Out-of-stock badge", { priority: 3 }),
    kid("demo-1", "demo-17", "Reorder last order", { trade: "feature" }),
    kid("demo-1", "demo-18", "Allergen info sheet", { labels: ["today"] }),
    kid("demo-1", "demo-19", "Cart total rounds .005 the wrong way", {
      trade: "bug",
      priority: 1,
      labels: ["hs"],
      updatedAt: ago(1),
    }),
    kid("demo-1", "demo-1a", "Search menu by name", { priority: 3 }),

    // --- payments: early, everything waits on the provider decision
    epic("demo-2", "Payments"),
    done("demo-2", "demo-20", "Spike: Stripe vs Square fees", 4, "Square cheaper under 50k/mo", {
      trade: "spike",
    }),
    kid("demo-2", "demo-21", "Pick payment provider", { trade: "decision", priority: 1, updatedAt: ago(3) }),
    kid("demo-2", "demo-22", "Card checkout form", { blocked: true, waitsOn: ["demo-21"], trade: "feature" }),
    kid("demo-2", "demo-23", "Apple Pay / Google Pay", {
      blocked: true,
      waitsOn: ["demo-21"],
      trade: "feature",
    }),
    kid("demo-2", "demo-24", "Refund flow", { blocked: true, waitsOn: ["demo-22"] }),
    kid("demo-2", "demo-25", "Receipts by email", { blocked: true, waitsOn: ["demo-22"], priority: 3 }),
    kid("demo-2", "demo-26", "PCI checklist", {
      trade: "chore",
      labels: ["needs-review"],
      updatedAt: ago(2),
    }),
    kid("demo-2", "demo-27", "Tips at checkout", { priority: 3 }),
    kid("demo-2", "demo-28", "Split the bill", { status: "deferred", updatedAt: ago(5) }),

    // --- kitchen display: nearly done, someone fell asleep on the last ticket
    epic("demo-3", "Kitchen display"),
    done("demo-3", "demo-30", "Ticket queue view", 14, "shipped"),
    done("demo-3", "demo-31", "Bump bar keys", 13, "shipped"),
    done("demo-3", "demo-32", "Order timer colours", 11, "shipped"),
    done("demo-3", "demo-33", "Sound on new order", 8, "shipped"),
    done("demo-3", "demo-34", "Recall bumped ticket", 7, "shipped"),
    done("demo-3", "demo-35", "Print to kitchen printer", 1, "works on the Epson, Star untested"),
    kid("demo-3", "demo-36", "Tablet goes to sleep mid-shift", {
      trade: "bug",
      status: "in_progress",
      assignee: "sam",
      owner: "sam",
      updatedAt: ago(8),
    }),
    kid("demo-3", "demo-37", "Station filter: bar vs kitchen", { labels: ["today"] }),

    // --- loyalty: sold, moved across the road
    epic("demo-4", "Loyalty stamps", { status: "closed", closedAt: ago(3), updatedAt: ago(3) }),
    done("demo-4", "demo-40", "Stamp card model", 20, "shipped"),
    done("demo-4", "demo-41", "QR stamp at the till", 17, "shipped"),
    done("demo-4", "demo-42", "Free coffee redemption", 15, "shipped"),
    done("demo-4", "demo-43", "Stamp history screen", 9, "shipped"),
    done("demo-4", "demo-44", "Double stamp Tuesdays", 3, "shipped, marketing happy"),

    // --- admin with a nested reports epic
    epic("demo-5", "Admin dashboard"),
    done("demo-5", "demo-50", "Staff login", 18, "shipped"),
    done("demo-5", "demo-51", "Edit menu prices", 16, "shipped"),
    kid("demo-5", "demo-52", "Opening hours editor", { trade: "feature" }),
    kid("demo-5", "demo-53", "Bulk 86 items", { priority: 3 }),
    kid("demo-5", "demo-54", "Role: barista can't see takings", {
      trade: "bug",
      blocked: true,
      waitsOn: ["demo-50"],
      assignee: FOREMAN,
      owner: FOREMAN,
      priority: 1,
    }),
    epic("demo-6", "Reports", { parent: "demo-5" }),
    done("demo-6", "demo-60", "Daily takings", 5, "shipped"),
    kid("demo-6", "demo-61", "Best sellers by hour", { trade: "feature" }),
    kid("demo-6", "demo-62", "Export CSV", { priority: 3 }),
    kid("demo-6", "demo-63", "Wastage report", { status: "deferred", updatedAt: ago(9) }),

    // --- the shed: no house
    bead({
      id: "demo-70",
      title: "Upgrade to Node 24",
      trade: "chore",
      labels: ["today"],
      updatedAt: ago(1),
    }),
    bead({ id: "demo-71", title: "Flaky checkout e2e test", trade: "bug", updatedAt: ago(10) }),
    bead({
      id: "demo-72",
      title: "Rotate the staging API key",
      trade: "chore",
      updatedAt: ago(12),
      priority: 3,
    }),
    bead({ id: "demo-73", title: "Dark mode", trade: "feature", updatedAt: ago(35), priority: 4 }),
    bead({
      id: "demo-74",
      title: "Old onboarding copy still mentions beta",
      updatedAt: ago(41),
      priority: 4,
    }),
    bead({
      id: "demo-75",
      title: "Secrets committed in scripts/seed.sh",
      trade: "bug",
      priority: 0,
      labels: ["hs"],
    }),
    bead({ id: "demo-76", title: "Logo favicon", priority: 4 }),
    bead({ id: "demo-77", title: "README screenshots", trade: "chore", priority: 3 }),
    closed({ id: "demo-78", title: "Set up CI", days: 21, why: "green on main", trade: "chore" }),
    closed({ id: "demo-79", title: "Pick a name", days: 25, why: "brew it is", trade: "decision" }),
    closed({ id: "demo-7a", title: "Domain and DNS", days: 24, why: "brew.cafe live", trade: "chore" }),
    closed({ id: "demo-7b", title: "Error tracking", days: 19, why: "sentry wired", trade: "chore" }),
    closed({
      id: "demo-7c",
      title: "Typo on the thanks page",
      days: 0,
      why: "fixed",
      trade: "bug",
      closedAt: ago(0, 1),
    }),
    closed({
      id: "demo-7d",
      title: "Lint on commit",
      days: 0,
      why: "husky in",
      trade: "chore",
      closedAt: ago(0, 6),
    }),
    closed({ id: "demo-7e", title: "Slow menu load on 3G", days: 2, why: "images now webp", trade: "bug" }),
    closed({ id: "demo-7f", title: "Staging env", days: 15, why: "up" }),
    closed({ id: "demo-7g", title: "Design tokens", days: 13, why: "in figma and css" }),
    closed({ id: "demo-7h", title: "Analytics events", days: 11, why: "plausible, no cookies" }),
  ];

  const pr = (o: Over & { status: string; blocked?: boolean; ci?: string; priority: number }): Item => {
    const { ci, ...rest } = o;
    return {
      kind: "pr",
      trade: "inspector",
      owner: "ella",
      updatedAt: ago(1),
      blocked: false,
      waitsOn: [],
      labels: ci ? [`ci:${ci}`] : [],
      url: `https://github.com/example/brew/pull/${o.id.slice(1)}`,
      ...rest,
    };
  };
  const prs: Item[] = [
    pr({ id: "#41", title: "Cart drawer", status: "approved", priority: 2, ci: "pass" }),
    pr({ id: "#42", title: "Modifiers WIP", status: "draft", priority: 2, owner: "ella", ci: "pending" }),
    pr({
      id: "#43",
      title: "Kitchen printer support",
      status: "review",
      priority: 0,
      blocked: true,
      ci: "fail",
      owner: "sam",
    }),
    pr({ id: "#44", title: "Bump vite", status: "review", priority: 1, owner: "dependabot" }),
  ];

  return { items, prs, foreman: FOREMAN };
}
