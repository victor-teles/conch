import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { CardInsight } from "./card-insight";

describe("cardInsight", () => {
  it.each(["up", "down"] as const)(
    "shows a quiet %s glyph next to the text",
    async (trend) => {
      const screen = render(<CardInsight text="Signups grew." trend={trend} />);
      await expect.element(screen.getByText("Signups grew.")).toBeVisible();
      expect(screen.container.querySelector("svg")).not.toBeNull();
    }
  );

  it("shows a flat insight as plain text, without a glyph", async () => {
    const screen = render(<CardInsight text="Revenue held." trend="flat" />);
    await expect.element(screen.getByText("Revenue held.")).toBeVisible();
    expect(screen.container.querySelector("svg")).toBeNull();
  });
});
