import type { Item } from "../model.ts";

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
    // --- menu & ordering: mid build, ella on modifiers, a cone from the last review
    epic("demo-1", "Menu & ordering"),
    done(
      "demo-1",
      "demo-10",
      "Model menu, categories and items",
      12,
      "schema in, seeded from the chalkboard",
    ),
    done("demo-1", "demo-11", "Render category tabs", 10, "swipes on mobile"),
    done("demo-1", "demo-12", "Show item card with photo", 9, "Priya shot all 38 items"),
    done("demo-1", "demo-13", "Add cart drawer", 6, "slides up, see #41"),
    done("demo-1", "demo-14", "Filter menu by dietary tag", 0, "merged this morning, vegan chips work", {
      closedAt: ago(0, 3),
    }),
    kid("demo-1", "demo-15", "Pick milk, size and extras", {
      description:
        "Customers can't order an oat flat white yet; modifiers are the top request from the till.\n\nEach item gets modifier groups (milk, size, extras) with a price delta. Groups come from the menu model in demo-10, so no new tables. Extras are multi-select, milk and size are single.",
      acceptance: "- Oat, soy, almond selectable on any coffee\n- Large adds 50c, shows in cart line\n- Two extras on one item in one order",
      status: "in_progress",
      assignee: "ella",
      owner: "ella",
      updatedAt: ago(0, 5),
      trade: "feature",
    }),
    kid("demo-1", "demo-16", "Badge sold-out items", { priority: 3 }),
    kid("demo-1", "demo-17", "Reorder my usual in one tap", { trade: "feature" }),
    kid("demo-1", "demo-18", "Link allergen sheet from item card", { labels: ["today"] }),
    kid("demo-1", "demo-19", "Round cart total half-up, not banker's", {
      description:
        "Totals ending in .5c round down half the time, so the till and the app disagree by a cent.\n\nJS `toFixed` is banker's rounding on some engines. Use integer cents end to end and round once at display.",
      acceptance: "- 4.125 shows 4.13 everywhere\n- Till export matches app total on the 40 orders from Tuesday",
      trade: "bug",
      priority: 1,
      labels: ["hs"],
      updatedAt: ago(1),
    }),
    kid("demo-1", "demo-1a", "Search menu by name", { priority: 3 }),

    // --- payments: early, the whole chain waits on the provider decision
    epic("demo-2", "Payments", {
      description:
        "Take money in the app. Card first, then wallets, refunds from the till and emailed receipts; the whole chain waits on which provider we pick and the PCI self-assessment has to be filed before anything goes live so that is on the list too.",
    }),
    done("demo-2", "demo-20", "Compare Stripe and Square fees", 4, "Square cheaper under 50k a month", {
      trade: "spike",
    }),
    kid("demo-2", "demo-21", "Decide payment provider", {
      description:
        "Four beads wait on this call. Square is cheaper under 50k a month (demo-20) but Stripe has Apple Pay out of the box. Decide this week or the checkout slips a sprint.",
      trade: "decision",
      priority: 1,
      updatedAt: ago(3),
    }),
    kid("demo-2", "demo-22", "Build card checkout form", {
      description: "The form customers pay on. Hosted fields from whichever provider demo-21 picks, so we never see a card number. Saved cards for logged-in regulars, guest pay for everyone else.",
      acceptance: "- Pay as guest with a test card\n- Save a card and reuse it\n- Declined card shows the bank's reason, not ours",
      blocked: true,
      waitsOn: ["demo-21"],
      trade: "feature",
    }),
    kid("demo-2", "demo-23", "Add Apple Pay and Google Pay", {
      blocked: true,
      waitsOn: ["demo-21"],
      trade: "feature",
    }),
    kid("demo-2", "demo-24", "Refund an order from the till", { blocked: true, waitsOn: ["demo-22"] }),
    kid("demo-2", "demo-25", "Email receipt after payment", {
      blocked: true,
      waitsOn: ["demo-22"],
      priority: 3,
    }),
    kid("demo-2", "demo-26", "Fill in PCI self-assessment", {
      trade: "chore",
      labels: ["needs-review"],
      updatedAt: ago(2),
    }),
    kid("demo-2", "demo-27", "Show tip line on the receipt", {
      blocked: true,
      waitsOn: ["demo-25"],
      priority: 3,
    }),
    kid("demo-2", "demo-28", "Split the bill between cards", { status: "deferred", updatedAt: ago(5) }),

    // --- kitchen display: nearly done, sam fell asleep on the sleepy tablet
    epic("demo-3", "Kitchen display"),
    done("demo-3", "demo-30", "List open tickets oldest first", 14, "up on the old iPad"),
    done("demo-3", "demo-31", "Bump ticket with keyboard", 13, "space bumps, b brings back"),
    done("demo-3", "demo-32", "Colour tickets by wait time", 11, "amber at 5, red at 10"),
    done("demo-3", "demo-33", "Chime on new order", 8, "kitchen asked for quieter, done"),
    done("demo-3", "demo-34", "Recall a bumped ticket", 7, "last ten, that's plenty"),
    done("demo-3", "demo-35", "Print ticket to kitchen printer", 1, "works on the Epson, Star untested"),
    kid("demo-3", "demo-36", "Stop tablet sleeping mid-shift", {
      description: "Kitchen iPad sleeps after 2 minutes and misses the chime. Needs a wake lock while the display is open; the Screen Wake Lock API covers Safari 16.4+, which is what's on the wall.",
      trade: "bug",
      status: "in_progress",
      assignee: "sam",
      owner: "sam",
      updatedAt: ago(8),
    }),
    kid("demo-3", "demo-37", "Filter tickets by station", { labels: ["today"] }),

    // --- loyalty: sold, moved across the road
    epic("demo-4", "Loyalty stamps", { status: "closed", closedAt: ago(3), updatedAt: ago(3) }),
    done("demo-4", "demo-40", "Model stamp card per customer", 20, "ten stamps, one free"),
    done("demo-4", "demo-41", "Scan QR stamp at the till", 17, "first stamp was Marg's flat white"),
    done("demo-4", "demo-42", "Redeem free coffee", 15, "first free coffee claimed day one"),
    done("demo-4", "demo-43", "Show stamp history", 9, "shipped"),
    done("demo-4", "demo-44", "Double stamps on Tuesdays", 3, "Tuesdays up 30 percent, marketing happy"),

    // --- admin, with reports nested inside
    epic("demo-5", "Admin dashboard"),
    done("demo-5", "demo-50", "Log in staff with a PIN", 18, "four digits, locks after five goes"),
    done("demo-5", "demo-51", "Edit menu prices inline", 16, "shipped, no more redeploy for a price"),
    kid("demo-5", "demo-52", "Edit opening hours", { trade: "feature" }),
    kid("demo-5", "demo-53", "86 several items at once", { priority: 3 }),
    kid("demo-5", "demo-54", "Hide takings from barista role", {
      description: "Baristas can see the day's takings on the admin home. Should be owner and manager only. Depends on roles landing with the PIN login.",
      trade: "bug",
      blocked: true,
      waitsOn: ["demo-50"],
      assignee: FOREMAN,
      owner: FOREMAN,
      priority: 1,
    }),
    epic("demo-6", "Reports", { parent: "demo-5" }),
    done("demo-6", "demo-60", "Show daily takings", 5, "matches the till to the cent"),
    kid("demo-6", "demo-61", "Chart best sellers by hour", { trade: "feature" }),
    kid("demo-6", "demo-62", "Export takings as CSV", { priority: 3 }),
    kid("demo-6", "demo-63", "Report wastage by item", { status: "deferred", updatedAt: ago(9) }),

    // --- the shed: odd jobs with no house
    bead({
      id: "demo-70",
      title: "Upgrade to Node 24",
      trade: "chore",
      labels: ["today"],
      updatedAt: ago(1),
    }),
    bead({
      id: "demo-71",
      title: "Fix flaky checkout e2e, fails on CI only",
      trade: "bug",
      updatedAt: ago(10),
    }),
    bead({
      id: "demo-72",
      title: "Rotate staging API key, waiting on ops",
      trade: "chore",
      updatedAt: ago(12),
      priority: 3,
    }),
    bead({
      id: "demo-73",
      title: "Add dark mode, nobody asked",
      trade: "feature",
      updatedAt: ago(35),
      priority: 4,
    }),
    bead({
      id: "demo-74",
      title: "Drop 'beta' from onboarding copy",
      updatedAt: ago(41),
      priority: 4,
    }),
    bead({
      id: "demo-75",
      title: "Remove secrets from scripts/seed.sh",
      trade: "bug",
      priority: 0,
      labels: ["hs"],
    }),
    bead({ id: "demo-76", title: "Draw a favicon", priority: 4 }),
    bead({ id: "demo-77", title: "Refresh README screenshots", trade: "chore", priority: 3 }),
    closed({ id: "demo-79", title: "Pick a name", days: 25, why: "brew it is", trade: "decision" }),
    closed({
      id: "demo-7a",
      title: "Register domain and DNS",
      days: 24,
      why: "brew.cafe live",
      trade: "chore",
    }),
    closed({
      id: "demo-78",
      title: "Set up CI",
      days: 21,
      why: "green on main, first commit",
      trade: "chore",
    }),
    closed({
      id: "demo-7b",
      title: "Wire error tracking",
      days: 19,
      why: "sentry caught one already",
      trade: "chore",
    }),
    closed({ id: "demo-7f", title: "Stand up staging", days: 15, why: "staging.brew.cafe up" }),
    closed({ id: "demo-7g", title: "Define design tokens", days: 13, why: "in figma and css" }),
    closed({ id: "demo-7h", title: "Add analytics events", days: 11, why: "plausible, no cookie banner" }),
    closed({
      id: "demo-7e",
      title: "Speed up menu load on 3G",
      days: 2,
      why: "images webp, 4s to 1s",
      trade: "bug",
    }),
    closed({
      id: "demo-7d",
      title: "Lint on commit",
      days: 0,
      why: "husky in, no more prettier commits",
      trade: "chore",
      closedAt: ago(0, 6),
    }),
    closed({
      id: "demo-7c",
      title: "Fix typo on the thanks page",
      days: 0,
      why: "'recieved' no more",
      trade: "bug",
      closedAt: ago(0, 1),
    }),
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
    pr({ id: "#41", title: "Add cart drawer (demo-13)", status: "approved", priority: 2, ci: "pass" }),
    pr({
      id: "#42",
      title: "Pick milk, size and extras (demo-15)",
      status: "draft",
      priority: 2,
      owner: "ella",
      ci: "pending",
    }),
    pr({
      id: "#43",
      title: "Print ticket to kitchen printer (demo-35)",
      status: "review",
      priority: 1,
      ci: "pass",
      owner: "sam",
    }),
    pr({ id: "#44", title: "Bump vite to 8.3", status: "review", priority: 1, owner: "dependabot" }),
  ];

  return { items, prs, foreman: FOREMAN };
}
