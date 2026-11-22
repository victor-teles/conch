import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { SourceBadge } from "./source-badge";
import { SourceGlyph } from "./source-glyph";

describe("source glyphs", () => {
  it("names the source and its kind", async () => {
    const screen = render(
      <div>
        <SourceGlyph kind="mcp" name="stripe" />
        <SourceGlyph kind="http" name={null} />
      </div>
    );
    await expect
      .element(screen.getByRole("img", { name: "stripe · MCP" }))
      .toHaveTextContent("SMCP");
    await expect
      .element(screen.getByRole("img", { name: "HTTP" }))
      .toHaveTextContent("?HTTP");
    expect(screen.container).toMatchSnapshot();
  });

  it("badges MCP and HTTP tiles and leaves SQL tiles alone", async () => {
    const screen = render(
      <div>
        <SourceBadge kind="sql" />
        <SourceBadge kind="mcp" />
        <SourceBadge kind="http" />
      </div>
    );
    await expect.element(screen.getByText("MCP")).toBeVisible();
    expect(
      screen.container.querySelectorAll("[data-source-kind]")
    ).toHaveLength(2);
  });
});
