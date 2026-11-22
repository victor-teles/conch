import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { ConchMark } from "./conch-mark";

describe("conchMark", () => {
  it("draws the shell as one decorative path", () => {
    const screen = render(<ConchMark className="size-5 text-brand" />);
    const svg = screen.container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toBe("size-5 text-brand");
    expect(svg?.querySelectorAll("path")).toHaveLength(1);
  });
});
