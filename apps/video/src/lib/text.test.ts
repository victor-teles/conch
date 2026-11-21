import { describe, expect, it } from "vitest";

import { streamedText, typedText, typingEnd } from "./text";

describe("typedText", () => {
  it("is empty before typing starts", () => {
    expect(typedText("hello", 9, 10, 2)).toBe("");
  });

  it("reveals one character per step", () => {
    expect(typedText("hello", 10, 10, 2)).toBe("h");
    expect(typedText("hello", 13, 10, 2)).toBe("he");
  });

  it("stops at the full text", () => {
    expect(typedText("hello", 100, 10, 2)).toBe("hello");
  });

  it("finishes on the frame typingEnd reports", () => {
    const end = typingEnd("hello", 10, 2);
    expect(typedText("hello", end, 10, 2)).toBe("hello");
    expect(typedText("hello", end - 1, 10, 2)).toBe("hell");
  });
});

describe("streamedText", () => {
  it("is empty before streaming starts", () => {
    expect(streamedText("select 1", 4, 5, 3)).toBe("");
  });

  it("reveals a chunk per frame", () => {
    expect(streamedText("select 1", 5, 5, 3)).toBe("sel");
    expect(streamedText("select 1", 6, 5, 3)).toBe("select");
    expect(streamedText("select 1", 7, 5, 3)).toBe("select 1");
  });
});
