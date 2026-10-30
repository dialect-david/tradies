import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromShown, type Shown } from "../server/beads.ts";

const [shown] = JSON.parse(
  readFileSync(new URL("./fixtures/beads/show.json", import.meta.url), "utf8"),
) as Shown[];

describe("fromShown", () => {
  it("maps bd show --json into regions", () => {
    const d = fromShown(shown!);
    expect(d.summary).toMatch(/^Source\.show returns structured detail/);
    expect(d.more).toMatch(/Beads impl: bd show --json/);
    expect(d.acceptance).toMatch(/^Card has no <pre>/);
    expect(d.notes).toEqual([
      { text: expect.stringMatching(/^Graceful fallback/) },
      { who: "dave", when: "2026-10-26T04:44:00Z", text: "spike comment" },
    ]);
    expect(d).not.toHaveProperty("text");
    expect(d).not.toHaveProperty("design");
    expect(d).not.toHaveProperty("closeReason");
  });
  it("keeps only parent-child dependents as children", () => {
    const d = fromShown({
      ...shown!,
      dependents: [
        ...(shown!.dependents ?? []),
        {
          id: "k",
          title: "kid",
          status: "closed",
          priority: 3,
          issue_type: "task",
          updated_at: "2026-10-01T00:00:00Z",
          dependency_type: "parent-child",
        },
      ],
    });
    expect(d.children).toEqual([
      { id: "k", title: "kid", status: "closed", priority: 3, updatedAt: "2026-10-01T00:00:00Z", trade: "task" },
    ]);
  });

  it("nests a sub-epic's children when its show is supplied", () => {
    const sub = {
      id: "e",
      title: "sub epic",
      status: "open",
      priority: 2,
      issue_type: "epic",
      updated_at: "2026-10-01T00:00:00Z",
      dependency_type: "parent-child",
    };
    const d = fromShown(
      { ...shown!, dependents: [sub] },
      {
        e: {
          ...sub,
          dependents: [
            { ...sub, id: "e.1", title: "leaf", issue_type: "task", status: "closed" },
            { ...sub, id: "e.2", title: "leaf2", issue_type: "task" },
          ],
        } as never,
      },
    );
    expect(d.children?.[0]?.children?.map((r) => r.id)).toEqual(["e.1", "e.2"]);
  });
  it("empty fields are missing keys", () => {
    const bare: Shown = {
      id: "x",
      title: "t",
      status: "open",
      priority: 2,
      issue_type: "task",
      updated_at: "2026-10-01T00:00:00Z",
    };
    expect(fromShown(bare)).toEqual({ summary: "" });
    expect(
      fromShown({
        ...bare,
        description: "",
        acceptance_criteria: "",
        design: "",
        notes: "",
        comments: [],
        dependents: [],
      }),
    ).toEqual({ summary: "" });
    expect(fromShown({ ...bare, close_reason: "shipped", design: "## plan\n- a" })).toEqual({
      summary: "",
      closeReason: "shipped",
      design: "## plan\n- a",
    });
  });
});
