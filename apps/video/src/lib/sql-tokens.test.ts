import { describe, expect, it } from "vitest";

import { tokenizeSqlLine } from "./sql-tokens";

const kinds = (line: string) =>
  tokenizeSqlLine(line)
    .filter((token) => token.text.trim() !== "")
    .map((token) => [token.kind, token.text]);

describe("tokenizeSqlLine", () => {
  it("marks keywords, functions and punctuation", () => {
    expect(kinds("select sum(s.amount) as mrr")).toStrictEqual([
      ["keyword", "select"],
      ["function", "sum"],
      ["punctuation", "("],
      ["plain", "s"],
      ["punctuation", "."],
      ["plain", "amount"],
      ["punctuation", ")"],
      ["keyword", "as"],
      ["plain", "mrr"],
    ]);
  });

  it("keeps a whole comment as one token", () => {
    expect(kinds("-- Revenue by region")).toStrictEqual([
      ["comment", "-- Revenue by region"],
    ]);
  });

  it("reads strings and numbers", () => {
    expect(kinds("where status = 'active' limit 500")).toStrictEqual([
      ["keyword", "where"],
      ["plain", "status"],
      ["punctuation", "="],
      ["string", "'active'"],
      ["keyword", "limit"],
      ["number", "500"],
    ]);
  });

  it("treats an unfinished string as a string while it streams", () => {
    expect(kinds("= 'acti")).toStrictEqual([
      ["punctuation", "="],
      ["string", "'acti"],
    ]);
  });

  it("round-trips the original text", () => {
    const line = "  and s.billed_at >= date '2026-01-01'";
    expect(
      tokenizeSqlLine(line)
        .map((token) => token.text)
        .join("")
    ).toBe(line);
  });

  it("colours double-quoted strings and Redis commands", () => {
    expect(kinds('ZREVRANGE "board" 0 4 WITHSCORES')).toStrictEqual([
      ["keyword", "ZREVRANGE"],
      ["string", '"board"'],
      ["number", "0"],
      ["number", "4"],
      ["keyword", "WITHSCORES"],
    ]);
  });

  it("reads Mongo operators and brackets", () => {
    expect(kinds("{ $sum: 1 }")).toStrictEqual([
      ["punctuation", "{"],
      ["plain", "$sum"],
      ["punctuation", ":"],
      ["number", "1"],
      ["punctuation", "}"],
    ]);
  });
});
