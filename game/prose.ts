export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const inline = (t: string) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>");

const list = (lines: string[], tag: "ul" | "ol", strip: RegExp) =>
  `<${tag}>${lines.map((l) => `<li>${inline(l.replace(strip, ""))}</li>`).join("")}</${tag}>`;

/** Markdown-lite: paragraphs, - bullets, 1. lists, `code`, ## headings as a bold line, ``` fences. */
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
