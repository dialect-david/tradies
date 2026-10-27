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
    epic("demo-1", "Menu & ordering", {
      description:
        "Customers browse the menu and build an order on their phone.\n\nThe front half of the app: categories, item cards, cart. Payments is its own house.",
    }),
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
      acceptance:
        "- Oat, soy, almond selectable on any coffee\n- Large adds 50c, shows in cart line\n- Two extras on one item in one order",
      status: "in_progress",
      assignee: "ella",
      owner: "ella",
      updatedAt: ago(0, 5),
      trade: "feature",
    }),
    kid("demo-1", "demo-16", "Badge sold-out items", {
      description:
        "Sold-out items still look orderable, so the kitchen gets tickets it has to void.\n\nRead the 86 list from admin and grey the card with a badge; keep it visible so regulars know it exists.",
      priority: 3,
    }),
    kid("demo-1", "demo-17", "Reorder my usual in one tap", {
      description:
        "Regulars want their last order back in one tap.\n\nShow the most recent order as a card at the top of the menu; tapping fills the cart with the same modifiers.",
      acceptance:
        "- Last order shows above the categories for a logged-in customer\n- One tap fills the cart, modifiers included\n- Sold-out items drop out with a note",
      trade: "feature",
    }),
    kid("demo-1", "demo-18", "Link allergen sheet from item card", {
      description:
        "The allergen sheet lives on the wall, not in the app.\n\nLink the PDF from each item card until allergens are modelled per item.",
      labels: ["today"],
    }),
    kid("demo-1", "demo-19", "Round cart total half-up, not banker's", {
      description:
        "Totals ending in .5c round down half the time, so the till and the app disagree by a cent.\n\nJS `toFixed` is banker's rounding on some engines. Use integer cents end to end and round once at display.",
      acceptance:
        "- 4.125 shows 4.13 everywhere\n- Till export matches app total on the 40 orders from Tuesday",
      trade: "bug",
      priority: 1,
      labels: ["hs"],
      updatedAt: ago(1),
    }),
    kid("demo-1", "demo-1a", "Search menu by name", {
      description:
        "Finding one item means swiping through five tabs.\n\nA search box above the tabs, matching on name only; no fuzzy matching for v1.",
      priority: 3,
    }),

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
        "Four beads wait on this call, so decide this week or checkout slips a sprint.\n\nSquare is cheaper under 50k a month (demo-20) but Stripe has Apple Pay out of the box. Either is fine on fees at our volume; wallets are the real question.",
      trade: "decision",
      priority: 1,
      updatedAt: ago(3),
    }),
    kid("demo-2", "demo-22", "Build card checkout form", {
      description:
        "The form customers pay on, using hosted fields so we never see a card number.\n\nProvider comes from demo-21. Saved cards for logged-in regulars, guest pay for everyone else.",
      acceptance:
        "- Pay as guest with a test card\n- Save a card and reuse it\n- Declined card shows the bank's reason, not ours",
      blocked: true,
      waitsOn: ["demo-21"],
      trade: "feature",
    }),
    kid("demo-2", "demo-23", "Add Apple Pay and Google Pay", {
      description:
        "Wallet pay is a one-tap checkout and most phone orders will use it.\n\nApple Pay and Google Pay through the provider's wallet SDK; needs the merchant domain verified first.",
      acceptance:
        "- Apple Pay sheet appears on Safari with a saved card\n- Google Pay on Chrome Android\n- Falls back to the card form when neither is set up",
      blocked: true,
      waitsOn: ["demo-21"],
      trade: "feature",
    }),
    kid("demo-2", "demo-24", "Refund an order from the till", {
      description:
        "Staff refund from the till today and have to re-key it in the provider dashboard.\n\nA refund button on the order in admin, full or partial, posting to the provider and marking the order.",
      blocked: true,
      waitsOn: ["demo-22"],
    }),
    kid("demo-2", "demo-25", "Email receipt after payment", {
      description:
        "Customers get no receipt after paying in the app.\n\nSend one email per paid order with items, total and the provider's reference; plain HTML, no tracking.",
      acceptance:
        "- Email arrives within a minute of payment\n- Total matches the order to the cent\n- Resend from admin",
      blocked: true,
      waitsOn: ["demo-22"],
      priority: 3,
    }),
    kid("demo-2", "demo-26", "Fill in PCI self-assessment", {
      description:
        "Nothing can go live until the PCI self-assessment is filed.\n\nSAQ A should cover us since the provider hosts the card fields; needs an owner signature.",
      trade: "chore",
      labels: ["needs-review"],
      updatedAt: ago(2),
    }),
    kid("demo-2", "demo-27", "Show tip line on the receipt", {
      description:
        "Tips are taken at the till but never show on the emailed receipt.\n\nAdd a tip line between subtotal and total when it is non-zero.",
      blocked: true,
      waitsOn: ["demo-25"],
      priority: 3,
    }),
    kid("demo-2", "demo-28", "Split the bill between cards", {
      description:
        "Groups ask to split one order across cards.\n\nParked until card checkout ships; needs partial captures from the provider.",
      status: "deferred",
      updatedAt: ago(5),
    }),

    // --- kitchen display: nearly done, sam fell asleep on the sleepy tablet
    epic("demo-3", "Kitchen display", {
      description:
        "The screen on the kitchen wall shows tickets as orders come in.\n\nRuns on the old iPad; everything is keyboard and chime, no touch targets smaller than a thumb.",
    }),
    done("demo-3", "demo-30", "List open tickets oldest first", 14, "up on the old iPad"),
    done("demo-3", "demo-31", "Bump ticket with keyboard", 13, "space bumps, b brings back"),
    done("demo-3", "demo-32", "Colour tickets by wait time", 11, "amber at 5, red at 10"),
    done("demo-3", "demo-33", "Chime on new order", 8, "kitchen asked for quieter, done"),
    done("demo-3", "demo-34", "Recall a bumped ticket", 7, "last ten, that's plenty"),
    done("demo-3", "demo-35", "Print ticket to kitchen printer", 1, "works on the Epson, Star untested"),
    kid("demo-3", "demo-36", "Stop tablet sleeping mid-shift", {
      description:
        "The kitchen iPad sleeps after two minutes and misses the chime.\n\nHold a wake lock while the display is open. The Screen Wake Lock API covers Safari 16.4+, which is what is on the wall.",
      acceptance: "- Display stays on through a quiet half hour\n- Lock releases when the tab is hidden",
      trade: "bug",
      status: "in_progress",
      assignee: "sam",
      owner: "sam",
      updatedAt: ago(8),
    }),
    kid("demo-3", "demo-37", "Filter tickets by station", {
      description:
        "Coffee and food share one ticket list, so the barista scrolls past sandwiches.\n\nA station toggle at the top of the display, remembered per device.",
      labels: ["today"],
    }),

    // --- loyalty: sold, moved across the road
    epic("demo-4", "Loyalty stamps", { status: "closed", closedAt: ago(3), updatedAt: ago(3) }),
    done("demo-4", "demo-40", "Model stamp card per customer", 20, "ten stamps, one free"),
    done("demo-4", "demo-41", "Scan QR stamp at the till", 17, "first stamp was Marg's flat white"),
    done("demo-4", "demo-42", "Redeem free coffee", 15, "first free coffee claimed day one"),
    done("demo-4", "demo-43", "Show stamp history", 9, "shipped"),
    done("demo-4", "demo-44", "Double stamps on Tuesdays", 3, "Tuesdays up 30 percent, marketing happy"),

    // --- admin, with reports nested inside
    epic("demo-5", "Admin dashboard", {
      description:
        "Owner and managers run the cafe from here: staff, menu, hours, takings.\n\nReports is a house of its own inside this one.",
    }),
    done("demo-5", "demo-50", "Log in staff with a PIN", 18, "four digits, locks after five goes"),
    done("demo-5", "demo-51", "Edit menu prices inline", 16, "shipped, no more redeploy for a price"),
    kid("demo-5", "demo-52", "Edit opening hours", {
      description:
        "Opening hours are hard-coded, so public holidays mean a redeploy.\n\nA weekly grid in admin plus a list of closed dates; the menu shows closed outside hours.",
      trade: "feature",
    }),
    kid("demo-5", "demo-53", "86 several items at once", {
      description:
        "86ing five items at close takes five trips into the editor.\n\nCheckboxes on the menu list and one 86 button for the lot.",
      priority: 3,
    }),
    kid("demo-5", "demo-54", "Hide takings from barista role", {
      description:
        "Baristas can see the day's takings on the admin home.\n\nShould be owner and manager only. Depends on roles landing with the PIN login.",
      acceptance: "- Barista PIN sees no takings tile\n- Manager and owner still do",
      trade: "bug",
      blocked: true,
      waitsOn: ["demo-50"],
      assignee: FOREMAN,
      owner: FOREMAN,
      priority: 1,
    }),
    epic("demo-6", "Reports", {
      description:
        "Reports tell the owner what sold and when.\n\nDaily takings first, then by hour and by item.",
      parent: "demo-5",
    }),
    done("demo-6", "demo-60", "Show daily takings", 5, "matches the till to the cent"),
    kid("demo-6", "demo-61", "Chart best sellers by hour", {
      description:
        "The owner wants to know what sells at 7am versus 2pm to plan the bake.\n\nA bar chart per hour for a chosen day or week, top five items.",
      trade: "feature",
    }),
    kid("demo-6", "demo-62", "Export takings as CSV", {
      description:
        "The accountant wants takings in a spreadsheet, not a screen.\n\nOne CSV per date range, same columns as the daily takings table.",
      priority: 3,
    }),
    kid("demo-6", "demo-63", "Report wastage by item", {
      description:
        "Wastage is counted on paper at close.\n\nParked until the kitchen is willing to enter it on the display.",
      status: "deferred",
      updatedAt: ago(9),
    }),

    // --- the shed: odd jobs with no house
    bead({
      id: "demo-70",
      title: "Upgrade to Node 24",
      description:
        "Node 22 goes out of maintenance next year and CI already warns.\n\nBump engines and the CI image; check the sharp binary builds.",
      trade: "chore",
      labels: ["today"],
      updatedAt: ago(1),
    }),
    bead({
      id: "demo-71",
      title: "Fix flaky checkout e2e, fails on CI only",
      description:
        "Checkout e2e fails one run in four on CI and never locally.\n\nLikely a race on the cart drawer animation; CI runners are slower than a laptop.",
      trade: "bug",
      updatedAt: ago(10),
    }),
    bead({
      id: "demo-72",
      title: "Rotate staging API key, waiting on ops",
      description:
        "The staging API key is in a leaked log and should be rotated.\n\nOps holds the vault; ask them for a new one and update the staging secret.",
      trade: "chore",
      updatedAt: ago(12),
      priority: 3,
    }),
    bead({
      id: "demo-73",
      title: "Add dark mode, nobody asked",
      description:
        "Nobody asked for dark mode.\n\nTokens are in place from demo-7g so it is cheap, but it is still a nice-to-have.",
      trade: "feature",
      updatedAt: ago(35),
      priority: 4,
    }),
    bead({
      id: "demo-74",
      title: "Drop 'beta' from onboarding copy",
      description: "Onboarding still says beta and we launched a month ago.\n\nCopy change on three screens.",
      updatedAt: ago(41),
      priority: 4,
    }),
    bead({
      id: "demo-75",
      title: "Remove secrets from scripts/seed.sh",
      description:
        "scripts/seed.sh has live API keys committed in it.\n\nMove them to env, rotate the keys, and scrub the history.",
      acceptance: "- No secret strings in the repo at HEAD or history\n- Seed script reads from .env",
      trade: "bug",
      priority: 0,
      labels: ["hs"],
    }),
    bead({
      id: "demo-76",
      title: "Draw a favicon",
      description: "The tab shows the Vite default icon.\n\nA cup, 32px, from the design tokens.",
      priority: 4,
    }),
    bead({
      id: "demo-77",
      title: "Refresh README screenshots",
      description:
        "README screenshots show the old green menu.\n\nRetake on the current build at phone width.",
      trade: "chore",
      priority: 3,
    }),
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
