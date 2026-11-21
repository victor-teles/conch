import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { ScopeOption } from "./scope-filter";

import { ScopeFilter } from "./scope-filter";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const OPTIONS: ScopeOption[] = [
  { id: "analytics", label: "analytics" },
  { id: "warehouse", label: "warehouse" },
];

function Harness({ onChange }: { onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const handleChange = useCallback(
    (next: string | null) => {
      setValue(next);
      onChange(next);
    },
    [onChange]
  );
  return (
    <div style={{ height: 300, position: "relative", width: 400 }}>
      <ScopeFilter
        label="All connections"
        onChange={handleChange}
        onOpenChange={setOpen}
        open={open}
        options={OPTIONS}
        value={value}
      />
    </div>
  );
}

const setup = () => {
  const onChange = vi.fn();
  const screen = render(<Harness onChange={onChange} />);
  return { onChange, screen };
};

describe("scopeFilter", () => {
  it("opens from its trigger with the everything option set apart", async () => {
    const { screen } = setup();
    await screen
      .getByRole("button", { name: "Scope: All connections" })
      .click();
    const field = screen.getByRole("textbox", { name: "Filter connections" });
    await expect.element(field).toHaveFocus();
    const options = screen.getByRole("option").all();
    expect(options.map((option) => option.element().textContent)).toStrictEqual(
      ["All connections", "analytics", "warehouse"]
    );
    await expect
      .element(screen.getByRole("option", { name: "All connections" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("separator").query()).not.toBeNull();
  });

  it("filters, picks with Enter and shows the choice on the trigger", async () => {
    const { onChange, screen } = setup();
    await screen.getByRole("button", { name: /Scope/ }).click();
    await screen
      .getByRole("textbox", { name: "Filter connections" })
      .fill("ware");
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("warehouse");
    await expect
      .element(screen.getByRole("button", { name: "Scope: warehouse" }))
      .toBeVisible();
    await expect.poll(() => screen.getByRole("listbox").query()).toBeNull();
  });

  it("clears the scope from the everything option", async () => {
    const { onChange, screen } = setup();
    await screen.getByRole("button", { name: /Scope/ }).click();
    await screen.getByRole("option", { name: "analytics" }).click();
    await screen.getByRole("button", { name: /Scope: analytics/ }).click();
    await screen.getByRole("option", { name: "All connections" }).click();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("clears its filter on Escape before it closes", async () => {
    const { screen } = setup();
    await screen.getByRole("button", { name: /Scope/ }).click();
    const field = screen.getByRole("textbox", { name: "Filter connections" });
    await field.fill("zzz");
    await expect
      .element(screen.getByText("No matching connections"))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(field).toHaveValue("");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.getByRole("listbox").query()).toBeNull();
  });

  it("returns focus to whatever opened it after a mouse pick", async () => {
    const { screen } = setup();
    const trigger = screen.getByRole("button", { name: /Scope/ });
    await trigger.click();
    await screen.getByRole("option", { name: "warehouse" }).click();
    await expect.poll(() => screen.getByRole("listbox").query()).toBeNull();
    await expect
      .element(screen.getByRole("button", { name: "Scope: warehouse" }))
      .toHaveFocus();
  });

  it("only fades under reduced motion", async () => {
    reduced.value = true;
    const { screen } = setup();
    await screen.getByRole("button", { name: /Scope/ }).click();
    const popover = screen
      .getByRole("listbox")
      .element()
      .closest<HTMLElement>("[data-motion]");
    expect(popover?.dataset.motion).toBe("fade");
    reduced.value = false;
  });
});
