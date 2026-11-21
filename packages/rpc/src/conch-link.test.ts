import { describe, expect, it } from "vitest";

import type { ConchLink } from "./conch-link.ts";

import {
  askLink,
  boardLink,
  MAX_LINK_PROMPT,
  parseConchLink,
  widgetLink,
} from "./conch-link.ts";

const linkOf = (raw: string): ConchLink => {
  const parsed = parseConchLink(raw);
  if (!parsed.ok) {
    throw new Error(`expected ${raw} to parse: ${parsed.reason}`);
  }
  return parsed.link;
};

const rejects = (raw: string): boolean => !parseConchLink(raw).ok;

const keys = (count: number) =>
  Array.from({ length: count }, (_, index) => `k${index}=1`).join("&");

describe("parseConchLink routes", () => {
  it.each(["conch://", "conch://open", "conch://open/", "CONCH://OPEN"])(
    "opens the launcher for %s (stages nothing)",
    (raw) => {
      expect(linkOf(raw)).toStrictEqual({ kind: "open" });
    }
  );

  it("stages an ask with its connection (an ask only runs on ↵)", () => {
    expect(
      linkOf("conch://ask?q=revenue%20by%20region&conn=analytics")
    ).toStrictEqual({
      connection: "analytics",
      kind: "ask",
      prompt: "revenue by region",
    });
  });

  it("reads the route case-insensitively", () => {
    expect(linkOf("CONCH://Ask?q=x")).toStrictEqual({
      connection: null,
      kind: "ask",
      prompt: "x",
    });
  });

  it("opens a widget by id (runs: the saved SQL, no AI, no link values)", () => {
    expect(linkOf("conch://widget/abc-123")).toStrictEqual({
      kind: "widget",
      values: {},
      widgetId: "abc-123",
    });
  });

  it("stages widget values (they open the pills and wait for ↵)", () => {
    expect(
      linkOf(
        "conch://widget/abc-123?region=EU&range.from=2026-01-01&range.to=2026-02-01"
      )
    ).toStrictEqual({
      kind: "widget",
      values: {
        "range.from": "2026-01-01",
        "range.to": "2026-02-01",
        region: "EU",
      },
      widgetId: "abc-123",
    });
  });

  it("opens a board by id (boards refresh on their own schedule)", () => {
    expect(linkOf("conch://board/b-1")).toStrictEqual({
      boardId: "b-1",
      kind: "board",
    });
  });

  it("rejects an unknown route", () => {
    expect(parseConchLink("conch://nope")).toStrictEqual({
      ok: false,
      reason: "Unknown link.",
    });
  });
});

describe("parseConchLink ask text", () => {
  it.each([
    ["conch://ask?q=a+b", "a b"],
    ["conch://ask?q=a%20b", "a b"],
    [
      "conch://ask?q=%E2%82%AC%20by%20r%C3%A9gion%20%F0%9F%93%88",
      "€ by région 📈",
    ],
  ])("decodes %s", (raw, prompt) => {
    expect(linkOf(raw)).toMatchObject({ prompt });
  });

  it("turns line breaks and tabs into spaces", () => {
    expect(linkOf("conch://ask?q=a%0Ab%0D%0Ac%09d")).toMatchObject({
      prompt: "a b  c d",
    });
  });

  it("strips control and bidi characters so the input shows what is sent", () => {
    expect(
      linkOf("conch://ask?q=re%E2%80%AEvenue%00%C2%85%E2%81%A6x%E2%80%8F")
    ).toMatchObject({ prompt: "revenuex" });
  });

  it.each(["%3Eselect%201", "%23orders", "%40prod", "%20%3E%20%23x"])(
    "never stages a mode prefix (%s): the text stays a plain question",
    (q) => {
      expect(linkOf(`conch://ask?q=${q}`)).toMatchObject({
        kind: "ask",
        prompt: expect.not.stringMatching(/^[>#@\s]/u),
      });
    }
  );

  it("caps the question at 4,000 characters", () => {
    const longest = "a".repeat(MAX_LINK_PROMPT);
    expect(linkOf(`conch://ask?q=${longest}`)).toMatchObject({
      prompt: longest,
    });
    expect(rejects(`conch://ask?q=${longest}a`)).toBeTruthy();
  });

  it.each([
    "conch://ask",
    "conch://ask?q=",
    "conch://ask?q=%20%0A",
    "conch://ask/x?q=a",
  ])("rejects %s", (raw) => {
    expect(rejects(raw)).toBeTruthy();
  });

  it("trims the connection and drops an empty one", () => {
    expect(linkOf("conch://ask?q=a&conn=%20prod%20")).toMatchObject({
      connection: "prod",
    });
    expect(linkOf("conch://ask?q=a&conn=")).toMatchObject({
      connection: null,
    });
    expect(rejects(`conch://ask?q=a&conn=${"c".repeat(201)}`)).toBeTruthy();
  });

  it("ignores other keys on an ask", () => {
    expect(linkOf("conch://ask?q=a&run=1")).toStrictEqual({
      connection: null,
      kind: "ask",
      prompt: "a",
    });
  });
});

describe("parseConchLink ids and values", () => {
  it.each([
    "conch://widget",
    "conch://widget/",
    "conch://widget/a/b",
    "conch://widget/..",
    "conch://widget/x/../abc",
    "conch://widget/%2e%2e/abc",
    "conch://widget/a%2Fb",
    "conch://widget/a_b",
    `conch://widget/${"a".repeat(101)}`,
    "conch://board/",
    "conch://board/a/b",
  ])("rejects the id in %s", (raw) => {
    expect(rejects(raw)).toBeTruthy();
  });

  it.each([
    "conch://widget/w?Region=EU",
    "conch://widget/w?1st=a",
    "conch://widget/w?range.mid=a",
    "conch://widget/w?a-b=1",
  ])("rejects a key that is not an input name: %s", (raw) => {
    expect(rejects(raw)).toBeTruthy();
  });

  it("caps the number of values and their length", () => {
    expect(rejects(`conch://widget/w?${keys(12)}`)).toBeFalsy();
    expect(rejects(`conch://widget/w?${keys(13)}`)).toBeTruthy();
    expect(rejects(`conch://widget/w?a=${"x".repeat(200)}`)).toBeFalsy();
    expect(rejects(`conch://widget/w?a=${"x".repeat(201)}`)).toBeTruthy();
  });

  it("rejects a duplicate key", () => {
    expect(parseConchLink("conch://widget/w?a=1&a=2")).toStrictEqual({
      ok: false,
      reason: "a appears twice.",
    });
    expect(rejects("conch://ask?q=a&q=b")).toBeTruthy();
  });
});

describe("parseConchLink envelope", () => {
  it.each([
    ["another scheme", "https://ask?q=a"],
    ["not a URL", "conch"],
    ["a fragment", "conch://ask?q=a#b"],
    ["an empty fragment", "conch://ask?q=a#"],
    ["credentials", "conch://user:secret@ask?q=a"],
    ["a user", "conch://user@ask?q=a"],
    ["a port", "conch://ask:99?q=a"],
    ["a huge link", `conch://ask?q=${"a".repeat(8200)}`],
  ])("rejects %s", (_label, raw) => {
    expect(rejects(raw)).toBeTruthy();
  });
});

describe("link builders", () => {
  it("round-trips an ask by connection name", () => {
    const raw = askLink("revenue & churn by région 📈", "Prod analytics");
    expect(raw).toBe(
      "conch://ask?q=revenue+%26+churn+by+r%C3%A9gion+%F0%9F%93%88&conn=Prod+analytics"
    );
    expect(linkOf(raw)).toStrictEqual({
      connection: "Prod analytics",
      kind: "ask",
      prompt: "revenue & churn by région 📈",
    });
  });

  it("leaves the connection out when there is none", () => {
    expect(askLink("a", null)).toBe("conch://ask?q=a");
  });

  it("round-trips a widget with and without values", () => {
    expect(widgetLink("abc-123")).toBe("conch://widget/abc-123");
    const values = { "range.from": "2026-01-01", region: "North America" };
    expect(linkOf(widgetLink("abc-123", values))).toStrictEqual({
      kind: "widget",
      values,
      widgetId: "abc-123",
    });
  });

  it("round-trips a board", () => {
    expect(boardLink("b-1")).toBe("conch://board/b-1");
    expect(linkOf(boardLink("b-1"))).toStrictEqual({
      boardId: "b-1",
      kind: "board",
    });
  });
});
