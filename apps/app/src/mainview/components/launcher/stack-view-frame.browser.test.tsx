import { AnimatePresence } from "motion/react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { motionPreset } from "@/lib/motion";

import { stackVariants } from "./stack-variants";
import { StackViewFrame } from "./stack-view-frame";

const variants = stackVariants(motionPreset(false));

function Stack({ view }: { view: string }) {
  return (
    <div className="relative flex flex-col">
      <AnimatePresence initial={false} mode="popLayout">
        <StackViewFrame direction={1} key={view} variants={variants}>
          <button style={{ height: 120 }} type="button">
            {view}
          </button>
        </StackViewFrame>
      </AnimatePresence>
    </div>
  );
}

describe("stackViewFrame", () => {
  it("takes a leaving view out of focus, input and the accessibility tree", async () => {
    const screen = render(<Stack view="root" />);
    await expect
      .element(screen.getByRole("button", { name: "root" }))
      .toBeVisible();

    await screen.rerender(<Stack view="settings" />);

    const leaving = screen
      .getByText("root")
      .element()
      .closest("[data-leaving]");
    expect(leaving).toMatchObject({ inert: true });
    expect(leaving?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "root" }).query()).toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "settings" }))
      .toBeVisible();
    expect(
      screen.getByText("settings").element().closest("[inert]")
    ).toBeNull();
  });

  it("lifts the leaving view out of the flow so the next view starts at the top", async () => {
    const screen = render(<Stack view="root" />);
    await expect
      .element(screen.getByRole("button", { name: "root" }))
      .toBeVisible();
    const top = (label: string) =>
      screen.getByText(label).element().getBoundingClientRect().top;
    const rootTop = top("root");

    await screen.rerender(<Stack view="settings" />);

    const leaving = screen.getByText("root").element().parentElement;
    expect(leaving).toHaveAttribute("data-leaving", "true");
    expect(leaving).toHaveStyle({ position: "absolute" });
    expect(top("settings")).toBeCloseTo(rootTop, 0);
  });

  it("still removes the leaving view once its exit settles", async () => {
    const screen = render(<Stack view="root" />);
    await screen.rerender(<Stack view="settings" />);
    await expect.poll(() => screen.getByText("root").query()).toBeNull();
  });
});
