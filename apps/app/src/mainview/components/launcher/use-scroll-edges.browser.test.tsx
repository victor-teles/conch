import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { LauncherScrollArea } from "./launcher-scroll-area";

function Rows({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 200 }}>
      <LauncherScrollArea className="flex-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} style={{ height: 40 }}>
            Row {index}
          </div>
        ))}
      </LauncherScrollArea>
    </div>
  );
}

const scrollerOf = (container: HTMLElement): HTMLElement => {
  const scroller = container.querySelector<HTMLElement>(".scroll-fade");
  if (!scroller) {
    throw new Error("missing scroller");
  }
  return scroller;
};

const scrollTo = (scroller: HTMLElement, top: number) => {
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event("scroll"));
};

const SETTLE = { timeout: 3000 };

const fades = (scroller: HTMLElement) => ({
  end: scroller.dataset.fadeEnd !== undefined,
  start: scroller.dataset.fadeStart !== undefined,
});

describe("launcherScrollArea edge fades", () => {
  it("fades only the edges that have more to scroll", async () => {
    const screen = await render(<Rows count={20} />);
    const scroller = scrollerOf(screen.container);
    await expect
      .poll(() => fades(scroller), SETTLE)
      .toEqual({ end: true, start: false });

    scrollTo(scroller, 200);
    await expect
      .poll(() => fades(scroller), SETTLE)
      .toEqual({ end: true, start: true });

    scrollTo(scroller, scroller.scrollHeight);
    await expect
      .poll(() => fades(scroller), SETTLE)
      .toEqual({ end: false, start: true });
  });

  it("does not fade a list that fits", async () => {
    const screen = await render(<Rows count={2} />);
    const scroller = scrollerOf(screen.container);
    await expect
      .poll(() => fades(scroller), SETTLE)
      .toEqual({ end: false, start: false });
  });

  it("starts fading when rows are added past the fold", async () => {
    const screen = await render(<Rows count={2} />);
    const scroller = scrollerOf(screen.container);
    await screen.rerender(<Rows count={20} />);
    await expect
      .poll(() => fades(scroller), SETTLE)
      .toEqual({ end: true, start: false });
  });

  it("reserves the footer's clearance below the last row", async () => {
    const screen = await render(<Rows count={20} />);
    const scroller = scrollerOf(screen.container);
    scrollTo(scroller, scroller.scrollHeight);
    const lastRow = screen.getByText("Row 19").element();
    const gap =
      scroller.getBoundingClientRect().bottom -
      lastRow.getBoundingClientRect().bottom;
    expect(gap).toBeGreaterThanOrEqual(47);
  });
});
