import { ageDays, type Item } from "../server/model.js";
import { act, show } from "./client.js";
import { score, type Cast } from "./cast.js";
import { REVIEW_REF, reviewPrompt, short, type Review } from "../server/review.js";
import type { Config } from "../server/defaults.js";
import { fillPrompt, type Prompts } from "../server/source.js";
import { mermaid } from "../server/deps.js";

const card = document.getElementById("card")!;
const board = document.getElementById("board")!;
const toastEl = document.getElementById("toast")!;

let onSite: Item[] = [];
let can = new Set<string>();
let prompts: Prompts = { work: "{id}: {title}", plan: "{id}: {title}" };
export const setItems = (items: Item[], actions: string[] = [...can], p = prompts) => (
  (onSite = items),
  (can = new Set(actions)),
  (prompts = p)
);
const button = (act: string, label: string) =>
  can.has(act) ? `<button data-act="${act}">${label}</button>` : "";

function depLines(item: Item): string {
  const open = new Map(onSite.map((i) => [i.id, i]));
  const waits = item.waitsOn.filter((id) => open.has(id));
  const blocks = onSite.filter((i) => i.waitsOn.includes(item.id)).map((i) => i.id);
  const row = (h: string, ids: string[]) =>
    ids.length
      ? `<div class="deps">${h}: ${ids.map((id) => `<a data-open="${esc(id)}">${esc(id)}</a>`).join(", ")}</div>`
      : "";
  return row("waits on", waits) + row("blocks", blocks);
}

export function prompt(item: Item, plan: boolean): string {
  return fillPrompt(plan ? prompts.plan : prompts.work, item);
}

export function copyText(text: string, msg: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast(msg),
    () => toast("couldn't copy"),
  );
}

export const idChip = (id: string) =>
  `<span class="copy" data-copy="${esc(id)}" title="copy id">${esc(id)} ⧉</span>`;

export function wireCopy(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-copy]"))
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      copyText(el.dataset.copy!, `copied ${el.dataset.copy}`);
    });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2500);
}

const BY_HAND = "tradies.byHand";
let byHandOpen = !!localStorage.getItem(BY_HAND);
const byHand = (inner: string) =>
  inner
    ? `<details class="by-hand"${byHandOpen ? " open" : ""}><summary>by hand</summary>${inner}</details>`
    : "";
function wireByHand(root: HTMLElement) {
  root.querySelector<HTMLDetailsElement>("details.by-hand")?.addEventListener("toggle", (e) => {
    byHandOpen = (e.target as HTMLDetailsElement).open;
    localStorage.setItem(BY_HAND, byHandOpen ? "1" : "");
  });
}
let cardSeq = 0;
export async function openCard(item: Item) {
  const seq = ++cardSeq;
  card.classList.add("open");
  card.innerHTML = `<h3>${idChip(item.id)} ${esc(item.title)}</h3><pre>loading…</pre>`;
  let detail: string;
  try {
    detail = await show(item.id);
  } catch (e) {
    detail = `couldn't load: ${(e as Error).message}`;
  }
  if (seq !== cardSeq) return;
  const hands = ["claim", "note", "close"].filter((a) => can.has(a));
  const beadActions = `
    <div class="row hand-over"><button class="primary" data-prompt="work">copy prompt</button><button data-prompt="plan">plan</button></div>
    ${byHand(
      hands.length
        ? `${can.has("note") || can.has("close") ? `<input data-text placeholder="note or close reason" />` : ""}
      <div class="row">${button("claim", "claim")}${button("note", "note")}${button("close", "close bead")}</div>`
        : "",
    )}`;
  const prActions = `<div class="row">${button("merge", "merge")}</div>`;
  card.innerHTML = `<h3>${idChip(item.id)} ${esc(item.title)}</h3>${depLines(item)}<pre>${esc(detail)}</pre>${item.kind === "bead" ? beadActions : prActions}`;
  wireCopy(card);
  wireByHand(card);
  for (const a of card.querySelectorAll<HTMLElement>("[data-open]"))
    a.addEventListener("click", () => {
      const next = onSite.find((i) => i.id === a.dataset.open);
      if (next) void openCard(next);
    });
  for (const b of card.querySelectorAll<HTMLButtonElement>("[data-prompt]"))
    b.addEventListener("click", () => copyText(prompt(item, b.dataset.prompt === "plan"), "prompt copied"));
  for (const b of card.querySelectorAll<HTMLButtonElement>("[data-act]")) {
    b.addEventListener("click", async () => {
      const text = card.querySelector<HTMLInputElement>("[data-text]")?.value ?? "";
      if ((b.dataset.act === "note" || b.dataset.act === "close") && !text.trim())
        return toast("needs a word");
      try {
        toast(await act(b.dataset.act!, item.id, text));
        closeCard();
      } catch (e) {
        toast(`strewth: ${(e as Error).message}`);
      }
    });
  }
}

export function openReview(r: Review, site: string, cfg: Config) {
  card.classList.add("open");
  const when = r.markedAt
    ? ` (${short(r.from)}, ${new Date(r.markedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })})`
    : "";
  const since = r.marked
    ? `since the last inspection${when}`
    : `with no inspection on record — looking at the last ${r.commits}`;
  const stopped = r.commits >= cfg.reviewAfter * 2 ? "\nSITE STOPPED until the inspection is done." : "";
  card.innerHTML = `<h3>health &amp; safety</h3><pre>${r.commits} commits, ${r.lines} lines ${since}.${stopped}</pre>
    <div class="row"><button data-review>copy review prompt</button><button data-copy="git update-ref ${REVIEW_REF} ${r.head}">copy mark-as-inspected</button></div>
    ${r.report ? `<h4>last inspection</h4><pre>${esc(r.report)}</pre>` : ""}`;
  wireCopy(card);
  card
    .querySelector("[data-review]")!
    .addEventListener("click", () =>
      copyText(reviewPrompt(r, site, cfg.reviewSkill, cfg.hazardLabels[0] ?? "hs"), "review prompt copied"),
    );
}

export function closeCard() {
  card.classList.remove("open");
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function openBoard(ready: Item[], title = "job board", pinnable = true) {
  closeCard();
  pinnable &&= can.has("create");
  board.classList.add("open");
  document.body.classList.add("board-open");
  const chits = ready
    .map(
      (i) =>
        `<div class="chit p${i.priority}" data-id="${esc(i.id)}" data-text="${esc(`${i.id} ${i.title} ${i.labels.join(" ")} ${i.closeReason ?? ""}`.toLowerCase())}"><b>P${i.priority}</b> <span class="trade">${esc(i.trade)} · ${ageDays(i)}d</span> <span class="title">${esc(i.title)}</span>${i.closeReason ? `<div class="why">${esc(i.closeReason.slice(0, 120))}</div>` : ""}<div class="id">${idChip(i.id)}</div></div>`,
    )
    .join("");
  board.innerHTML = `
    <div class="head"><h3>${esc(title)} · ${ready.length}</h3><input class="filter" placeholder="find…" autocomplete="off" /></div>
    ${byHand(
      pinnable
        ? `<form class="new"><input name="title" placeholder="new job…" autocomplete="off" />
      <select name="priority"><option>2</option><option>0</option><option>1</option><option>3</option><option>4</option></select>
      <select name="kind"><option>task</option><option>bug</option><option>feature</option><option>chore</option></select>
      <button>pin it</button></form>`
        : "",
    )}
    <div class="chits">${chits || "<i>nobody here.</i>"}</div>`;
  const filter = board.querySelector<HTMLInputElement>("input.filter")!;
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    for (const c of board.querySelectorAll<HTMLElement>(".chit")) {
      const hit = !q || c.dataset.text!.includes(q);
      c.hidden = !hit;
      if (hit) shown++;
    }
    board.querySelector("h3")!.textContent = `${title} · ${q ? `${shown} of ` : ""}${ready.length}`;
  });
  filter.focus();
  wireByHand(board);
  board.querySelector<HTMLFormElement>("form.new")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return toast("needs a title");
    try {
      toast(
        await act("create", "", title, { priority: String(f.get("priority")), kind: String(f.get("kind")) }),
      );
      closeBoard();
    } catch (err) {
      toast(`strewth: ${(err as Error).message}`);
    }
  });
  wireCopy(board);
  for (const c of board.querySelectorAll<HTMLElement>(".chit"))
    c.addEventListener("click", () => {
      const item = ready.find((i) => i.id === c.dataset.id);
      if (item) void openCard(item);
    });
}

type Mermaid = {
  initialize: (c: object) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
let mermaidLib: Promise<Mermaid> | undefined;
const loadMermaid = () =>
  (mermaidLib ??= import(/* @vite-ignore */ MERMAID_URL).then(
    (m: { default: Mermaid }) => (m.default.initialize({ startOnLoad: false, theme: "dark" }), m.default),
  ));

export async function openPlans(items: Item[], houseOf: (i: Item) => string | undefined, deferred: Item[]) {
  closeCard();
  board.classList.add("open", "plans");
  document.body.classList.add("board-open");
  const text = mermaid(items, houseOf);
  const edges = text.split("\n").filter((l) => l.includes("-->")).length;
  board.innerHTML = `
    <div class="head"><h3>the plans · ${edges} dependencies</h3><span><button data-mmd>copy mermaid</button><button data-deferred>${deferred.length} deferred</button></span></div>
    <div class="graph">${edges ? "drawing…" : "<i>no dependencies between open beads.</i>"}</div>`;
  board.querySelector("[data-mmd]")!.addEventListener("click", () => copyText(text, "mermaid copied"));
  board
    .querySelector("[data-deferred]")!
    .addEventListener("click", () => openBoard(deferred, "on the plans", false));
  if (!edges) return;
  const graph = board.querySelector<HTMLElement>(".graph")!;
  try {
    const { svg } = await (await loadMermaid()).render(`plans${Date.now()}`, text);
    graph.innerHTML = svg;
    for (const n of graph.querySelectorAll<SVGGElement>("g.node"))
      n.addEventListener("click", () => {
        const id = /-flowchart-(.+)-\d+$/.exec(n.id)?.[1];
        const item = items.find((i) => i.id.replace(/[^a-zA-Z0-9]/g, "_") === id);
        if (item) void openCard(item);
      });
  } catch (e) {
    graph.innerHTML = `<i>couldn't draw (${esc((e as Error).message)}). the mermaid text still copies.</i>`;
  }
}

export function closeBoard() {
  board.classList.remove("open", "knockoff", "plans");
  document.body.classList.remove("board-open");
  knockoffClose?.();
  knockoffClose = undefined;
}

document.addEventListener("pointerdown", (e) => {
  const t = e.target as Node;
  if (!card.contains(t)) closeCard();
  if (!board.contains(t)) closeBoard();
});
for (const el of [card, board, document.getElementById("hud")!])
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "wheel"])
    el.addEventListener(type, (e) => e.stopPropagation());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") (closeCard(), closeBoard());
});

export function openKnockoff(today: Item[], c: Cast, onClose: () => void, title = "knock-off", site = "") {
  closeCard();
  board.classList.add("open", "knockoff");
  document.body.classList.add("board-open");
  const now = new Date();
  const row = (i: Item, extra = "") =>
    `<div class="line" data-id="${esc(i.id)}"><b>${idChip(i.id)}</b> ${esc(i.title.slice(0, 70))}${extra}</div>`;
  const worry = [...c.working, ...c.waiting, ...c.smoko, ...c.inspectors, ...c.needsYou]
    .sort((a, b) => score(b, now, c.cfg) - score(a, now, c.cfg))
    .slice(0, 3);
  board.innerHTML = `
    <div class="head"><h3>${title} · ${now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</h3><button data-md>copy as markdown</button></div>
    <h4>${today.length ? `${today.length} beer${today.length === 1 ? "" : "s"} cracked ${"🍺".repeat(Math.min(today.length, 12))}` : "dry day. none closed."}</h4>
    ${today.map((i) => row(i, i.closeReason ? `<div class="why">${esc(i.closeReason.slice(0, 120))}</div>` : "")).join("")}
    ${c.needsYou.length ? `<h4>${c.needsYou.length} waiting on the foreman</h4>${c.needsYou.map((i) => row(i)).join("")}` : ""}
    <h4>the Kelpie's worried about</h4>
    ${worry.map((i) => row(i, ` <span class="why">${ageDays(i)}d · P${i.priority}</span>`)).join("") || "<i>nothing. good girl.</i>"}
    <h4>${c.smoko.length} still on smoko, ${c.waiting.length} waiting on materials, ${c.ready.length} ready for tomorrow</h4>
    ${c.ready
      .slice(0, 3)
      .map((i) => row(i))
      .join("")}`;
  wireCopy(board);
  board
    .querySelector("[data-md]")!
    .addEventListener("click", () => copyText(briefingMarkdown(today, c, worry, site), "briefing copied"));
  for (const l of board.querySelectorAll<HTMLElement>(".line"))
    l.addEventListener("click", () => {
      const item = [...today, ...worry, ...c.ready, ...c.needsYou].find((i) => i.id === l.dataset.id);
      if (item) void openCard(item);
    });
  knockoffClose = onClose;
}

let knockoffClose: (() => void) | undefined;

export function briefingMarkdown(today: Item[], c: Cast, worry: Item[], site: string): string {
  const li = (i: Item, extra = "") => `- ${i.id} — ${i.title}${extra}`;
  const section = (h: string, items: Item[], f = (i: Item) => li(i)) =>
    items.length ? [`## ${h}`, ...items.map(f), ""] : [];
  return [
    `# ${site || "site"} briefing · ${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}`,
    "",
    ...section(`closed today (${today.length})`, today, (i) =>
      li(i, i.closeReason ? ` (${i.closeReason})` : ""),
    ),
    ...section(`waiting on the foreman (${c.needsYou.length})`, c.needsYou),
    ...section("the kelpie's worried about", worry, (i) => li(i, ` · ${ageDays(i)}d · P${i.priority}`)),
    ...section(`on the tools (${c.working.length})`, c.working, (i) =>
      li(i, c.asleep.includes(i) ? " · asleep" : ""),
    ),
    `## counts`,
    `- ${c.ready.length} ready, ${c.waiting.length} waiting on materials, ${c.smoko.length} on smoko, ${c.deferred.length} on the plans, ${c.gone.length} gone home`,
    "",
    ...section("next up", c.ready.slice(0, 5)),
  ].join("\n");
}
