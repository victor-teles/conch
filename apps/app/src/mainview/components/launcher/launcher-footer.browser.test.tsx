import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { FooterHint } from "./launcher-footer";

import { LauncherFooter } from "./launcher-footer";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const ASK_HINTS: FooterHint[] = [
  { keys: ["⌘", "↩"], label: "New question" },
  { keys: ["↑", "↓"], label: "Steps" },
  { keys: ["⌘", "K"], label: "Actions" },
  { keys: ["⌘", "S"], label: "Save" },
  { disabled: true, keys: ["⌘", "E"], label: "SQL" },
];

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const requiredSlot = (container: HTMLElement, name: string): HTMLElement => {
  const element = slot(container, name);
  if (!element) {
    throw new Error(`missing ${name}`);
  }
  return element;
};

describe("launcherFooter", () => {
  it("floats a status capsule and an actions capsule", async () => {
    reduced.value = false;
    const screen = await render(
      <LauncherFooter
        actionLabel="Ask"
        hints={[{ keys: ["⌘", "K"], label: "Actions" }]}
        status={<span>Production</span>}
      />
    );
    const footer = screen.getByRole("contentinfo");
    await expect.element(footer).toBeInTheDocument();
    await expect.element(screen.getByText("Production")).toBeVisible();
    const actions = slot(screen.container, "footer-actions");
    expect(actions?.textContent).toContain("Ask");
    expect(actions?.textContent).toContain("Actions");
    expect(actions?.dataset.motion).toBe("pop");
    expect(footer.element()).toMatchSnapshot();
  });

  it("leaves out the actions capsule when nothing can run", async () => {
    const screen = await render(
      <LauncherFooter actionLabel={null} status={<span>Watching 2</span>} />
    );
    expect(slot(screen.container, "footer-actions")).toBeNull();
    expect(screen.getByRole("contentinfo").element()).toMatchSnapshot();
  });

  it("keeps an empty status mounted but transparent", async () => {
    const screen = await render(
      <LauncherFooter
        actionLabel="Back"
        status={<span role="status">{null}</span>}
      />
    );
    const status = requiredSlot(screen.container, "footer-status");
    await expect.poll(() => getComputedStyle(status).opacity).toBe("0");
    expect(status.querySelector('[role="status"]')).not.toBeNull();
  });

  it("separates five hints and dims a disabled one", async () => {
    const screen = await render(
      <LauncherFooter
        actionLabel="Refine"
        hints={ASK_HINTS}
        status={<span>Revenue by region</span>}
      />
    );
    const disabled = screen.getByText("SQL").element().parentElement;
    expect(disabled?.getAttribute("aria-disabled")).toBe("true");
    expect(disabled?.className).toContain("opacity-50");
    const separated = slot(
      screen.container,
      "footer-actions"
    )?.querySelectorAll(".border-l");
    expect(separated?.length).toBe(ASK_HINTS.length);
    expect(screen.getByRole("contentinfo").element()).toMatchSnapshot();
  });

  it("does not separate the first hint when there is no action label", async () => {
    const screen = await render(
      <LauncherFooter
        actionLabel={null}
        hints={[
          { keys: ["⌫"], label: "Remove" },
          { keys: ["⌘", "K"], label: "Actions" },
        ]}
        status={null}
      />
    );
    const separated = slot(
      screen.container,
      "footer-actions"
    )?.querySelectorAll(".border-l");
    expect(separated?.length).toBe(1);
  });

  it("only fades the actions capsule under reduced motion", async () => {
    reduced.value = true;
    const screen = await render(
      <LauncherFooter actionLabel="Run" status={null} />
    );
    expect(slot(screen.container, "footer-actions")?.dataset.motion).toBe(
      "fade"
    );
    reduced.value = false;
  });

  it("swaps the actions capsule in and out with the view's actions", async () => {
    const screen = await render(
      <LauncherFooter actionLabel={null} status={<span>History</span>} />
    );
    expect(slot(screen.container, "footer-actions")).toBeNull();
    await screen.rerender(
      <LauncherFooter actionLabel="Ask again" status={<span>History</span>} />
    );
    await expect.element(screen.getByText("Ask again")).toBeInTheDocument();
    await screen.rerender(
      <LauncherFooter actionLabel={null} status={<span>History</span>} />
    );
    await expect
      .poll(() => slot(screen.container, "footer-actions"))
      .toBeNull();
  });
});
