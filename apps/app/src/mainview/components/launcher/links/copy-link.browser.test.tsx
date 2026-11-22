import { parseConchLink } from "@conch/rpc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { LauncherPanel } from "@/components/launcher/launcher-panel";
import { optionId } from "@/components/launcher/launcher-row";
import {
  boardItemId,
  widgetItemId,
} from "@/components/launcher/views/root-items";
import { makeBoard } from "@/test/board-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import { makeWidget, runResult } from "@/test/widget-fixtures";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const setup = () => {
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      cancelWidgetRun: () => null,
      listBoards: () => [makeBoard({ id: "b-ops", name: "Ops" })],
      listWidgets: () => [makeWidget()],
      runWidget: () => runResult({ period: "ytd", region: "North America" }),
    },
  });
  render(
    <AppProviders>
      <LauncherPanel />
    </AppProviders>
  );
  return { writeText };
};

const search = () => page.getByRole("combobox", { name: "Search commands" });

const selectRow = async (id: string) => {
  await search().click();
  for (let step = 0; step < 12; step += 1) {
    if (
      search().element().getAttribute("aria-activedescendant") === optionId(id)
    ) {
      return;
    }
    await userEvent.keyboard("{ArrowDown}");
  }
  throw new Error(`row ${id} never became selected`);
};

const copyFromMenu = async (label: string) => {
  await userEvent.keyboard("{Meta>}k{/Meta}");
  await page.getByRole("menuitem", { name: label }).click();
};

const copied = (writeText: ReturnType<typeof setup>["writeText"]) =>
  String(writeText.mock.lastCall?.[0] ?? "");

describe("copy link", () => {
  beforeEach(() => {
    reduced.value = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies a widget link from its root menu, with a check in the footer", async () => {
    const { writeText } = setup();
    await expect
      .element(page.getByRole("option", { name: /Revenue by region/ }))
      .toBeVisible();
    await selectRow(widgetItemId("w-revenue"));

    await copyFromMenu("Copy Link");

    await expect.poll(() => copied(writeText)).toBe("conch://widget/w-revenue");
    await expect.element(page.getByText("Copied link")).toBeVisible();
    await expect
      .element(page.getByRole("img", { name: "Done" }))
      .toBeInTheDocument();
  });

  it("copies a board link from its root menu", async () => {
    const { writeText } = setup();
    await expect
      .element(page.getByRole("option", { name: /Ops/ }))
      .toBeVisible();
    await selectRow(boardItemId("b-ops"));

    await copyFromMenu("Copy Link");

    await expect.poll(() => copied(writeText)).toBe("conch://board/b-ops");
  });

  it("copies the shown inputs from a widget run, and the link opens them again", async () => {
    const { writeText } = setup();
    await expect.element(search()).toBeVisible();
    emitIpcMessage("launcherNavigate", {
      view: { kind: "widget-run", widgetId: "w-revenue" },
    });
    await expect
      .element(page.getByRole("region", { name: "Revenue by region" }))
      .toBeVisible();

    await copyFromMenu("Copy Link with Inputs");

    await expect
      .poll(() => copied(writeText))
      .toBe("conch://widget/w-revenue?region=North+America&period=ytd");
    expect(parseConchLink(copied(writeText))).toStrictEqual({
      link: {
        kind: "widget",
        values: { period: "ytd", region: "North America" },
        widgetId: "w-revenue",
      },
      ok: true,
    });
  });
});
