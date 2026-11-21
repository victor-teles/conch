import { describe, expect, it } from "vitest";

import { firstQueryLine } from "./history-row";

describe("firstQueryLine", () => {
  it("takes the first line that says something, whitespace collapsed", () => {
    expect(firstQueryLine("\n\n  select  plan,\n count(*) from x")).toBe(
      "select plan,"
    );
  });

  it("skips the comment generated SQL opens with", () => {
    expect(
      firstQueryLine("-- Monthly revenue\nselect month, sum(mrr)\nfrom x")
    ).toBe("select month, sum(mrr)");
    expect(firstQueryLine("-- only a comment")).toBe("-- only a comment");
  });

  it("is empty for empty SQL", () => {
    expect(firstQueryLine("   \n ")).toBe("");
  });
});
