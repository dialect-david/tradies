import { describe, expect, it } from "vitest";
import { fromPrView } from "../server/gh.ts";
import { fixture } from "../server/demo/fixture.ts";

const { items } = fixture(new Date("2026-10-21T12:00:00Z"));
const view = {
  title: "Pick milk, size and extras",
  body: "Modifier groups on the item card.\n\nGroups come from the menu model; extras are multi-select.",
  headRefName: "ella/demo-15-modifiers",
  statusCheckRollup: [
    { __typename: "CheckRun", name: "build", conclusion: "SUCCESS", status: "COMPLETED" },
    { __typename: "CheckRun", name: "test", conclusion: "FAILURE", status: "COMPLETED" },
    { __typename: "StatusContext", context: "deploy", state: "PENDING" },
  ],
};

describe("gh view", () => {
  it("maps pr view json to Detail", () => {
    const d = fromPrView(view, items);
    expect(d.summary).toBe("Modifier groups on the item card.");
    expect(d.more).toBe("Groups come from the menu model; extras are multi-select.");
    expect(d.branch).toBe("ella/demo-15-modifiers");
    expect(d.checks).toEqual([
      { name: "build", state: "success" },
      { name: "test", state: "failure" },
      { name: "deploy", state: "pending" },
    ]);
    expect(d.linked?.id).toBe("demo-15");
  });
  it("bare pr: no body, no checks, no link", () => {
    const d = fromPrView({ title: "Bump vite" });
    expect(d).toEqual({ summary: "" });
  });
});
