import {
  ClipboardCopyIcon,
  LayoutGridIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import type { MenuAction } from "./menu-action";

import { ActionsMenu } from "./actions-menu";

const ACTIONS: MenuAction[] = [
  { icon: PlayIcon, id: "run", keys: ["↩"], label: "Run", tone: "default" },
  {
    icon: LayoutGridIcon,
    id: "add",
    keys: ["⌘", "↩"],
    label: "Add to Board…",
    tone: "default",
  },
  {
    disabled: true,
    icon: ClipboardCopyIcon,
    id: "copy",
    label: "Copy SQL",
    tone: "default",
  },
  { icon: Trash2Icon, id: "delete", label: "Delete", tone: "destructive" },
];

function Harness({ onRun }: { onRun: (action: MenuAction) => void }) {
  const [open, setOpen] = useState(true);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div style={{ height: 400, position: "relative", width: 400 }}>
      <div id="anchor">Revenue</div>
      {open ? (
        <ActionsMenu
          actions={ACTIONS}
          anchorId="anchor"
          armedId={null}
          onClose={close}
          onRun={onRun}
          title="Revenue"
        />
      ) : null}
    </div>
  );
}

const setup = () => {
  const onRun = vi.fn();
  const screen = render(<Harness onRun={onRun} />);
  const field = screen.getByRole("textbox", { name: "Filter actions" });
  return { field, onRun, screen };
};

const labels = (screen: ReturnType<typeof setup>["screen"]) =>
  screen
    .getByRole("menuitem")
    .all()
    .map(
      (item) =>
        item.element().querySelector('[data-slot="swap-text"]')?.textContent
    );

describe("actionsMenu", () => {
  it("names its row, focuses the filter and sets destructive actions apart", async () => {
    const { field, screen } = setup();
    await expect
      .element(screen.getByRole("menu"))
      .toHaveAccessibleName("Actions for Revenue");
    await expect.element(field).toHaveFocus();
    expect(labels(screen)).toStrictEqual([
      "Run",
      "Add to Board…",
      "Copy SQL",
      "Delete",
    ]);
    const separator = screen.getByRole("separator").element();
    expect(separator.nextElementSibling?.textContent).toContain("Delete");
  });

  it("narrows as you type and runs the highlighted match on Enter", async () => {
    const { field, onRun, screen } = setup();
    await field.fill("board");
    expect(labels(screen)).toStrictEqual(["Add to Board…"]);
    await userEvent.keyboard("{Enter}");
    expect(onRun).toHaveBeenCalledWith(ACTIONS[1]);
  });

  it("says so when nothing matches and ignores Enter", async () => {
    const { field, onRun, screen } = setup();
    await field.fill("zzz");
    await expect.element(screen.getByText("No matching actions")).toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(onRun).not.toHaveBeenCalled();
  });

  it("clears the filter on the first Escape and closes on the second", async () => {
    const { field, screen } = setup();
    await field.fill("run");
    await userEvent.keyboard("{Escape}");
    await expect.element(field).toHaveValue("");
    expect(labels(screen)).toHaveLength(ACTIONS.length);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
  });

  it("does not run a disabled action", async () => {
    const { onRun } = setup();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onRun).not.toHaveBeenCalled();
  });

  it("keeps typing in the field after a click", async () => {
    const { field, onRun, screen } = setup();
    await screen.getByRole("menuitem", { name: /^Run/ }).click();
    expect(onRun).toHaveBeenCalledWith(ACTIONS[0]);
    await expect.element(field).toHaveFocus();
    await userEvent.keyboard("del");
    expect(labels(screen)).toStrictEqual(["Delete"]);
  });

  it("moves with the arrows and closes on Tab", async () => {
    const { onRun, screen } = setup();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onRun).toHaveBeenCalledWith(ACTIONS[1]);
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => screen.getByRole("menu").query()).toBeNull();
  });
});
