export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const inline = (t: string) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>");

const BOX = /^\[([ xX])\]\s+/;
const li = (text: string) => {
  const box = BOX.exec(text);
  if (!box) return `<li>${inline(text)}</li>`;
  const done = box[1] !== " ";
  return `<li class="${done ? "done" : "todo"}">${done ? "✓" : "○"} ${inline(text.slice(box[0].length))}</li>`;
};
const list = (lines: string[], tag: "ul" | "ol", strip: RegExp) =>
  `<${tag}>${lines.map((l) => li(l.replace(strip, ""))).join("")}</${tag}>`;

/** Markdown-lite: paragraphs, - bullets, - [x] ticks as ✓/○, 1. lists, `code`, ## headings as a bold line, ``` fences. */
export function prose(text: string): string {
  const out: string[] = [];
  const parts = text.replace(/\r\n/g, "\n").split(/^```[^\n]*\n?/m);
  parts.forEach((part, n) => {
    if (n % 2) return void out.push(`<pre>${esc(part.replace(/\n$/, ""))}</pre>`);
    for (const block of part.split(/\n{2,}/)) {
      const lines = block.split("\n").filter((l) => l.trim());
      if (!lines.length) continue;
      if (lines.every((l) => /^\s*[-*]\s/.test(l))) out.push(list(lines, "ul", /^\s*[-*]\s+/));
      else if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) out.push(list(lines, "ol", /^\s*\d+[.)]\s+/));
      else if (lines.length === 1 && /^#{1,6}\s/.test(lines[0]!))
        out.push(`<p><b>${inline(lines[0]!.replace(/^#+\s+/, ""))}</b></p>`);
      else out.push(`<p>${lines.map((l) => inline(l.trim())).join(" ")}</p>`);
    }
  });
  return out.join("");
}
