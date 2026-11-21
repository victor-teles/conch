import { HistoryIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { FooterLocation } from "./footer-location";

describe("footerLocation", () => {
  it("names the view with a decorative icon", async () => {
    const screen = await render(
      <FooterLocation icon={HistoryIcon} label="History" />
    );
    await expect.element(screen.getByText("History")).toBeVisible();
    const icon = screen.container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
