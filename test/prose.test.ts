import { describe, expect, it } from "vitest";
import { prose } from "../game/prose.ts";

describe("prose", () => {
  it("paragraphs join soft breaks, escape html", () =>
    expect(prose("a <b>\nb\n\nc")).toBe("<p>a &lt;b&gt; b</p><p>c</p>"));
  it("bullets and numbered lists", () => {
    expect(prose("- one\n* two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(prose("1. one\n2) two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });
  it("backtick code inline", () =>
    expect(prose("run `bd show x`")).toBe("<p>run <code>bd show x</code></p>"));
  it("## heading is a bold line", () =>
    expect(prose("## Plan\n\ntext")).toBe("<p><b>Plan</b></p><p>text</p>"));
  it("fenced code is the only pre", () =>
    expect(prose("before\n\n```sh\nbd list\n  --json\n```\nafter")).toBe(
      "<p>before</p><pre>bd list\n  --json</pre><p>after</p>",
    ));
  it("plain text has no pre", () => expect(prose("x\ny\n\nz")).not.toContain("<pre"));
});
