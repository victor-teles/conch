import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { optionId } from "@/components/launcher/launcher-row";
import { MiniAppsProvider } from "@/components/mini-app/mini-apps-provider";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { deskApp } from "@/test/mini-app-fixtures";

import type { RootNavigation } from "./root-view";

import { appItemId, BUILD_APP_ITEM_ID } from "./root-items";
import { RootView } from "./root-view";

const navigation = (): RootNavigation => ({
  addToBoard: vi.fn(),
  buildApp: vi.fn(),
  changeApp: vi.fn(),
  dismiss: vi.fn(),
  editConnection: vi.fn(),
  newBoard: vi.fn(),
  newSourceWidget: vi.fn(),
  openActivity: vi.fn(),
  openApp: vi.fn(),
  openBoard: vi.fn(),
  openHistory: vi.fn(),
  openImport: vi.fn(),
  openSettings: vi.fn(),
  openThemes: vi.fn(),
  renameApp: vi.fn(),
  renameBoard: vi.fn(),
  runWidget: vi.fn(),
  watchWidget: vi.fn(),
});

function Harness({ navigate }: { navigate: RootNavigation }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ width: 760 }}>
      <MiniAppsProvider>
        <RootView
          ask={{ reopen: null, start: vi.fn(), startSql: vi.fn() }}
          inputRef={inputRef}
          lookup={{ offer: null, start: vi.fn() }}
          navigate={navigate}
          onQueryChange={setQuery}
          query={query}
        />
      </MiniAppsProvider>
    </div>
  );
}

const analytics = makeConnection({ id: "analytics", name: "analytics" });

const setup = (apps = [deskApp()]) => {
  const ipc = {
    deleteMiniApp: vi.fn(),
    duplicateMiniApp: vi.fn(() => deskApp({ id: "app-copy" })),
  };
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ...ipc,
      getActiveConnection: () => ({
        connectionId: "analytics",
        database: null,
      }),
      getAiSettings: () => ({
        baseUrl: null,
        hasKey: true,
        keyHint: "abcd",
        model: null,
        provider: "anthropic",
      }),
      listMiniApps: () => apps,
    },
  });
  const navigate = navigation();
  const screen = renderWithConnections(<Harness navigate={navigate} />);
  return { ipc, navigate, screen };
};

type Screen = ReturnType<typeof setup>["screen"];

const selectRow = async (screen: Screen, id: string) => {
  const input = screen.getByRole("combobox", { name: "Search commands" });
  await input.click();
  for (let step = 0; step < 14; step += 1) {
    if (
      input.element().getAttribute("aria-activedescendant") === optionId(id)
    ) {
      return;
    }
    await userEvent.keyboard("{ArrowDown}");
  }
  throw new Error(`row ${id} never became selected`);
};

describe("root view apps", () => {
  it("lists apps with what they read and do", async () => {
    const { screen } = setup();
    const row = screen.getByRole("option", { name: /Refund desk/u });
    await expect.element(row).toBeVisible();
    await expect
      .element(row)
      .toHaveTextContent("Failed charges next to their orders.");
    await expect.element(row).toHaveTextContent("analytics · 2 actions");
    await expect
      .element(screen.getByRole("group", { name: "Apps" }))
      .toBeVisible();
    expect(
      screen.getByRole("group", { name: "Apps" }).element()
    ).toMatchSnapshot();
  });

  it("opens an app on Enter", async () => {
    const { navigate, screen } = setup();
    await expect
      .element(screen.getByRole("option", { name: /Refund desk/u }))
      .toBeVisible();
    await selectRow(screen, appItemId("app-desk"));
    await userEvent.keyboard("{Enter}");
    expect(navigate.openApp).toHaveBeenCalledWith("app-desk");
  });

  it("offers Build an app after Ask for typed text", async () => {
    const { navigate, screen } = setup([]);
    const input = screen.getByRole("combobox", { name: "Search commands" });
    await input.fill("refund desk");
    const build = screen.getByRole("option", { name: /Build an app/u });
    await expect.element(build).toBeVisible();
    await selectRow(screen, BUILD_APP_ITEM_ID);
    await userEvent.keyboard("{Enter}");
    expect(navigate.buildApp).toHaveBeenCalledWith("refund desk", "analytics");
  });

  it("explains how to make an app when there are none", async () => {
    const { screen } = setup([]);
    await screen.getByRole("combobox", { name: "Search commands" }).fill("app");
    await expect
      .element(screen.getByText("Describe a tool and press ↵ on Build an app"))
      .toBeVisible();
  });

  it("leads the app menu with Open and runs Rename on ⌘↵", async () => {
    const { navigate, screen } = setup();
    await expect
      .element(screen.getByRole("option", { name: /Refund desk/u }))
      .toBeVisible();
    await selectRow(screen, appItemId("app-desk"));
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await expect
      .element(screen.getByRole("menuitem", { name: /Open/u }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("menuitem", { name: /Change with a Prompt/u }))
      .toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(navigate.renameApp).toHaveBeenCalledWith(deskApp());
  });

  it("changes, duplicates and deletes (in two presses) from the menu", async () => {
    const { ipc, navigate, screen } = setup();
    await expect
      .element(screen.getByRole("option", { name: /Refund desk/u }))
      .toBeVisible();
    await selectRow(screen, appItemId("app-desk"));
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen
      .getByRole("menuitem", { name: /Change with a Prompt/u })
      .click();
    expect(navigate.changeApp).toHaveBeenCalledWith("app-desk");
    await selectRow(screen, appItemId("app-desk"));
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Duplicate/u }).click();
    await expect.poll(() => ipc.duplicateMiniApp.mock.calls.length).toBe(1);
    await selectRow(screen, appItemId("app-desk"));
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Delete/u }).click();
    expect(ipc.deleteMiniApp).not.toHaveBeenCalled();
    await screen.getByRole("menuitem", { name: /Delete/u }).click();
    await expect.poll(() => ipc.deleteMiniApp.mock.calls.length).toBe(1);
  });
});
