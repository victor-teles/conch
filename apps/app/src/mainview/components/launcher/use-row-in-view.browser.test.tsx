import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { LauncherListbox, LauncherSection } from "./launcher-list";
import { LauncherRow, optionId } from "./launcher-row";
import { LauncherScrollArea } from "./launcher-scroll-area";

const ids = Array.from({ length: 20 }, (_, index) => `row-${index}`);

function ScrollingList({ selectedId }: { selectedId: string }) {
  return (
    <div
      data-testid="frame"
      style={{ display: "flex", flexDirection: "column", height: 160 }}
    >
      <LauncherScrollArea className="flex-1">
        <LauncherListbox id="list" label="Results">
          <LauncherSection label="Recent">
            {ids.map((id) => (
              <LauncherRow
                id={id}
                key={id}
                onHover={vi.fn()}
                onRun={vi.fn()}
                selected={id === selectedId}
              >
                <span className="relative">{id}</span>
              </LauncherRow>
            ))}
          </LauncherSection>
        </LauncherListbox>
      </LauncherScrollArea>
    </div>
  );
}

const scrollerOf = (frame: Element): Element => {
  const scroller = frame.firstElementChild;
  if (!scroller) {
    throw new Error("missing scroller");
  }
  return scroller;
};

const box = (element: Element) => element.getBoundingClientRect();

const isInside = (element: Element, scroller: Element) =>
  box(element).top >= box(scroller).top - 1 &&
  box(element).bottom <= box(scroller).bottom + 1;

const rowOf = (id: string) => {
  const row = document.querySelector(`#${CSS.escape(optionId(id))}`);
  if (!row) {
    throw new Error(`missing ${id}`);
  }
  return row;
};

describe("useRowInView", () => {
  it("scrolls a row selected off screen into the list", async () => {
    const screen = render(<ScrollingList selectedId="row-0" />);
    const scroller = scrollerOf(screen.getByTestId("frame").element());

    await screen.rerender(<ScrollingList selectedId="row-15" />);

    await expect.poll(() => isInside(rowOf("row-15"), scroller)).toBe(true);
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it("shows the section heading again when the first row is selected", async () => {
    const screen = render(<ScrollingList selectedId="row-19" />);
    const scroller = scrollerOf(screen.getByTestId("frame").element());
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);

    await screen.rerender(<ScrollingList selectedId="row-0" />);

    await expect
      .poll(() => isInside(screen.getByText("Recent").element(), scroller))
      .toBe(true);
    console.log(
      "DBG",
      JSON.stringify([
        box(scroller),
        box(rowOf("row-0")),
        box(screen.getByText("Recent").element()),
        scroller.scrollTop,
      ])
    );
    expect(isInside(rowOf("row-0"), scroller)).toBeTruthy();
  });

  it("leaves the list alone when the pointer selected the row", async () => {
    const screen = render(<ScrollingList selectedId="row-0" />);
    const scroller = scrollerOf(screen.getByTestId("frame").element());
    await userEvent.hover(screen.getByText("row-3", { exact: true }));
    scroller.scrollTop = 30;

    await screen.rerender(<ScrollingList selectedId="row-3" />);

    expect(scroller.scrollTop).toBe(30);
  });
});
