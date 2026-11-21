import type { Mock } from "vitest";

import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeRecent } from "@/test/widget-fixtures";

import type { RootAskActions } from "./root-view";

import { RootView } from "./root-view";

const reduced = vi.hoisted(() => ({ value: true }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const RECENT = makeRecent({
  sql: "select region, sum(mrr) from billing group by 1",
});

interface AskSpies {
  start: Mock<RootAskActions["start"]>;
  startSql: Mock<RootAskActions["startSql"]>;
  reopen?: Mock<() => void>;
  lastAnswerId?: string;
}

function Harness({ ask }: { ask: AskSpies }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <RootView
      ask={{
        lastAnswerId: ask.lastAnswerId ?? null,
        reopen: ask.reopen ?? null,
        start: ask.start,
        startSql: ask.startSql,
      }}
      inputRef={inputRef}
      lookup={{ offer: null, start: vi.fn() }}
      navigate={{
        addToBoard: vi.fn(),
        dismiss: vi.fn(),
        editConnection: vi.fn(),
        newBoard: vi.fn(),
        openBoard: vi.fn(),
        openHistory: vi.fn(),
        openImport: vi.fn(),
        openSettings: vi.fn(),
        renameBoard: vi.fn(),
        runWidget: vi.fn(),
        watchWidget: vi.fn(),
      }}
      onQueryChange={setQuery}
      query={query}
    />
  );
}

const setup = async (shown: Partial<AskSpies> = {}) => {
  let recents = [RECENT];
  const deleteRecentAsk = vi.fn((payload: Record<string, unknown>) => {
    recents = recents.filter((recent) => recent.id !== payload.askId);
    return null;
  });
  const store = mockLauncherIpc({
    connections: [analytics],
    handlers: {
      deleteRecentAsk,
      getAiSettings: () => ({
        baseUrl: null,
        hasKey: true,
        keyHint: null,
        model: null,
        provider: "anthropic",
      }),
      listRecentAsks: () => recents,
    },
  });
  store.active = { connectionId: "analytics", database: null };
  const ask: AskSpies = {
    start: vi.fn<RootAskActions["start"]>(),
    startSql: vi.fn<RootAskActions["startSql"]>(),
    ...shown,
  };
  const screen = renderWithConnections(<Harness ask={ask} />);
  const input = screen.getByRole("combobox", { name: "Search commands" });
  const recent = screen.getByRole("option", { name: /Revenue for Europe/ });
  await expect.element(recent).toHaveAttribute("aria-selected", "true");
  await input.click();
  return { ask, deleteRecentAsk, input, screen };
};

describe("row actions at the root", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a menu on a recent ask and runs a filtered action", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = await setup();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await expect
      .element(screen.getByRole("menu"))
      .toHaveAccessibleName("Actions for Revenue for Europe");
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Actions");

    await screen
      .getByRole("textbox", { name: "Filter actions" })
      .fill("copy sql");
    await userEvent.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith(RECENT.sql);
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Copied the SQL");
  });

  it("copies a recent ask as a link that names its connection", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = await setup();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen
      .getByRole("textbox", { name: "Filter actions" })
      .fill("ask link");
    await userEvent.keyboard("{Enter}");

    expect(writeText).toHaveBeenCalledWith(
      "conch://ask?q=Revenue+for+Europe&conn=analytics"
    );
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Copied link");
  });

  it("runs the stored SQL without the AI on Command-Enter", async () => {
    const { ask } = await setup();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(ask.startSql).toHaveBeenCalledWith(
      RECENT.sql,
      { connectionId: "analytics", database: null },
      RECENT.spec.title
    );
    expect(ask.start).not.toHaveBeenCalled();
  });

  it("removes a recent ask with Control-X", async () => {
    const { deleteRecentAsk, screen } = await setup();
    await userEvent.keyboard("{Control>}x{/Control}");
    await expect.poll(() => deleteRecentAsk.mock.calls.length).toBe(1);
    await expect
      .poll(() =>
        screen.getByRole("option", { name: /Revenue for Europe/ }).query()
      )
      .toBeNull();
  });

  it("runs the row's own action first in its menu", async () => {
    const { ask } = await setup();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.keyboard("{Enter}");
    expect(ask.start).toHaveBeenCalledWith(RECENT.prompt, {
      connectionId: "analytics",
      database: null,
    });
  });

  it("asks for a second press before removing from the menu", async () => {
    const { deleteRecentAsk, screen } = await setup();
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen
      .getByRole("textbox", { name: "Filter actions" })
      .fill("remove");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(
        screen.getByRole("menuitem", { name: /Press ↵ again to delete/ })
      )
      .toBeVisible();
    expect(deleteRecentAsk).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => deleteRecentAsk.mock.calls.length).toBe(1);
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Removed from history");
  });

  it("moves the selection with ↑ and never opens an answer", async () => {
    const reopen = vi.fn<() => void>();
    const { ask, input } = await setup({ lastAnswerId: RECENT.id, reopen });
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(reopen).not.toHaveBeenCalled();
    expect(ask.start).not.toHaveBeenCalled();
    await expect.element(input).toHaveAttribute("aria-activedescendant");
  });

  it("shows the answer still in memory on Enter instead of asking again", async () => {
    const reopen = vi.fn<() => void>();
    const { ask, screen } = await setup({ lastAnswerId: RECENT.id, reopen });
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Show Answer");
    await userEvent.keyboard("{Enter}");
    expect(reopen).toHaveBeenCalledOnce();
    expect(ask.start).not.toHaveBeenCalled();
  });

  it("does nothing on Command-Enter for a row with no second action", async () => {
    const { ask, input } = await setup();
    await input.fill("revenue by plan");
    await expect
      .element(input)
      .toHaveAttribute("aria-activedescendant", "launcher-option-ask");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(ask.start).not.toHaveBeenCalled();
    expect(ask.startSql).not.toHaveBeenCalled();
  });
});
