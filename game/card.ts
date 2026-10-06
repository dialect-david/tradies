import type { Item } from "../server/model.js";
import { act, show } from "./client.js";

const card = document.getElementById("card")!;
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
    <div class="row"><button data-act="claim">claim</button><button data-close>close</button></div>
    <input data-text placeholder="note or close reason" />
    <div class="row"><button data-act="note">note</button><button data-act="close">close bead</button></div>`;
  const prActions = `<div class="row"><button data-act="merge">merge</button><button data-close>close</button></div>`;
  card.innerHTML = `<h3>${item.id} · ${esc(item.title)}</h3><pre>${esc(detail)}</pre>${item.kind === "bead" ? beadActions : prActions}`;
  card.querySelector("[data-close]")!.addEventListener("click", closeCard);
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
