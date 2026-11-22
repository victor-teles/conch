import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { PrefixHints } from "./prefix-hints";

describe("prefixHints", () => {
  it("hands the picked prefix back", async () => {
    const onPick = vi.fn();
    const screen = render(<PrefixHints onPick={onPick} visible />);

    await screen.getByRole("button", { name: "SQL mode (type >)" }).click();
    await screen.getByRole("button", { name: "Tables mode (type #)" }).click();

    expect(onPick.mock.calls).toStrictEqual([["> "], ["#"]]);
    expect(screen.container).toMatchSnapshot();
  });

  it("stays out of the tab order and keeps focus where it was", async () => {
    const screen = render(
      <>
        <input aria-label="Query" />
        <PrefixHints onPick={vi.fn()} visible />
      </>
    );
    const field = screen.getByRole("textbox", { name: "Query" });
    await field.click();

    const sql = screen.getByRole("button", { name: "SQL mode (type >)" });
    await expect.element(sql).toHaveAttribute("tabindex", "-1");
    await sql.click();
    await expect.element(field).toHaveFocus();
  });

  it("renders nothing when hidden", () => {
    const screen = render(<PrefixHints onPick={vi.fn()} visible={false} />);
    expect(screen.getByRole("button").query()).toBeNull();
  });
});
