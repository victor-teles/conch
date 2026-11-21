import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ListLayoutContext } from "./list-layout";
import { RowTrailing } from "./row-trailing";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

describe("rowTrailing", () => {
  it("shows its fact but not the kind in a sectioned list", async () => {
    const screen = await render(
      <RowTrailing kind="Board">3 tiles</RowTrailing>
    );
    await expect.element(screen.getByText("3 tiles")).toBeVisible();
    expect(screen.getByText("Board").query()).toBeNull();
  });

  it("names the kind in a flat list", async () => {
    reduced.value = false;
    const screen = await render(
      <ListLayoutContext value="flat">
        <RowTrailing kind="Board">3 tiles</RowTrailing>
      </ListLayoutContext>
    );
    const kind = screen.getByText("Board");
    await expect.element(kind).toBeVisible();
    expect((kind.element() as HTMLElement).dataset.motion).toBe("fade");
  });

  it("shows the kind at once under reduced motion", async () => {
    reduced.value = true;
    const screen = await render(
      <ListLayoutContext value="flat">
        <RowTrailing kind="Widget" />
      </ListLayoutContext>
    );
    const kind = screen.getByText("Widget").element() as HTMLElement;
    expect(kind.dataset.motion).toBe("instant");
    reduced.value = false;
  });
});
