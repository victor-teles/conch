import { describe, expect, it } from "vitest";

import { feedbackUrl, ISSUES_URL } from "./feedback.ts";

describe("feedbackUrl", () => {
  const url = new URL(
    feedbackUrl({
      arch: "arm64",
      channel: "beta",
      system: "macOS (Darwin 27.2.0)",
      version: "0.1.0-beta.1",
    })
  );

  it("opens a new issue on the Conch repository", () => {
    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
  });

  it("fills in the build and the machine, and nothing else", () => {
    const body = url.searchParams.get("body");

    expect(body).toContain(
      "Conch 0.1.0-beta.1 (beta) · macOS (Darwin 27.2.0) · arm64"
    );
    expect([...url.searchParams.keys()]).toStrictEqual(["body"]);
  });
});
