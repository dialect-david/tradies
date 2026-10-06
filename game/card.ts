import { ageDays, type Item } from "../server/model.js";
import { act, show } from "./client.js";
import { score, type Cast } from "./cast.js";

const card = document.getElementById("card")!;
const board = document.getElementById("board")!;
const toastEl = document.getElementById("toast")!;

export function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

export async function openCard(item: Item) {
  card.classList.add("open");
  card.innerHTML = `<h3>${item.id} · ${esc(item.title)}</h3><pre>loading…</pre>`;
  const detail = await show(item.id);
  const beadActions = `
    <div class="row"><button data-act="claim">claim</button></div>
    <input data-text placeholder="note or close reason" />
    <div class="row"><button data-act="note">note</button><button data-act="close">close bead</button></div>`;
  const prActions = `<div class="row"><button data-act="merge">merge</button></div>`;
  card.innerHTML = `<h3>${item.id} · ${esc(item.title)}</h3><pre>${esc(detail)}</pre>${item.kind === "bead" ? beadActions : prActions}`;
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

export function closeCard() {
  card.classList.remove("open");
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function openBoard(ready: Item[], title = "job board", claimable = true) {
  closeCard();
  board.classList.add("open");
  const chits = ready
    .map(
      (i) =>
        `<div class="chit p${i.priority}" data-id="${i.id}"><b>P${i.priority}</b> <span class="trade">${i.trade} · ${ageDays(i)}d</span> <span class="title">${esc(i.title)}</span><div class="id">${i.id}</div>${claimable ? `<button data-claim="${i.id}">claim</button>` : ""}</div>`,
    )
    .join("");
  board.innerHTML = `
    <div class="head"><h3>${title} · ${ready.length}</h3></div>
    <form class="new" ${claimable ? "" : "hidden"}><input name="title" placeholder="new job…" autocomplete="off" />
      <select name="priority"><option>2</option><option>0</option><option>1</option><option>3</option><option>4</option></select>
      <select name="kind"><option>task</option><option>bug</option><option>feature</option><option>chore</option></select>
      <button>pin it</button></form>
    <div class="chits">${chits || "<i>nobody here.</i>"}</div>`;
  board.querySelector<HTMLFormElement>("form.new")!.addEventListener("submit", async (e) => {
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
  for (const b of board.querySelectorAll<HTMLButtonElement>("[data-claim]"))
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        toast(await act("claim", b.dataset.claim!));
        closeBoard();
      } catch (err) {
        toast(`strewth: ${(err as Error).message}`);
      }
    });
  for (const c of board.querySelectorAll<HTMLElement>(".chit"))
    c.addEventListener("click", () => {
      const item = ready.find((i) => i.id === c.dataset.id);
      if (item) void openCard(item);
    });
}

export function closeBoard() {
  board.classList.remove("open", "knockoff");
  knockoffClose?.();
  knockoffClose = undefined;
}

document.addEventListener("pointerdown", (e) => {
  const t = e.target as Node;
  if (!card.contains(t)) closeCard();
  if (!board.contains(t)) closeBoard();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") (closeCard(), closeBoard());
});

export function openKnockoff(today: Item[], c: Cast, onClose: () => void) {
  closeCard();
  board.classList.add("open", "knockoff");
  const now = new Date();
  const row = (i: Item, extra = "") =>
    `<div class="line" data-id="${i.id}"><b>${i.id}</b> ${esc(i.title.slice(0, 70))}${extra}</div>`;
  const worry = [...c.working, ...c.waiting, ...c.smoko, ...c.inspectors, ...c.needsYou]
    .sort((a, b) => score(b, now) - score(a, now))
    .slice(0, 3);
  board.innerHTML = `
    <div class="head"><h3>knock-off · ${now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</h3></div>
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
  for (const l of board.querySelectorAll<HTMLElement>(".line"))
    l.addEventListener("click", () => {
      const item = [...today, ...worry, ...c.ready, ...c.needsYou].find((i) => i.id === l.dataset.id);
      if (item) void openCard(item);
    });
  knockoffClose = onClose;
}

let knockoffClose: (() => void) | undefined;
