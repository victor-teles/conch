import { useEffect, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { INITIAL_STATE } from "@/components/connection-form/connection-form-state";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";

import { resetFirstRunReveal } from "./first-run-note";
import { RootView } from "./root-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const NO_ASK = { reopen: null, start: vi.fn(), startSql: vi.fn() };

const analytics = makeConnection({ id: "analytics", name: "analytics" });
const scratch = makeConnection({
  database: "/tmp/scratch.duckdb",
  id: "scratch",
  name: "scratch",
  type: "duckdb",
});

const DRAFT = { ...INITIAL_STATE, host: "db.internal" };

function SeedDraft() {
  const { keepDraft } = useConnections();
  useEffect(() => {
    keepDraft(DRAFT);
  }, [keepDraft]);
  return null;
}

interface HarnessProps {
  initialQuery?: string;
  seedDraft?: boolean;
  onEditConnection?: (id: string | null) => void;
  onOpenHistory?: (query?: string) => void;
}

function Harness({
  initialQuery = "",
  seedDraft = false,
  onEditConnection = vi.fn(),
  onOpenHistory = vi.fn(),
}: HarnessProps) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      {seedDraft ? <SeedDraft /> : null}
      <RootView
        ask={NO_ASK}
        inputRef={inputRef}
        lookup={{ offer: null, start: vi.fn() }}
        navigate={{
          addToBoard: vi.fn(),
          buildApp: vi.fn(),
          changeApp: vi.fn(),
          dismiss: vi.fn(),
          editConnection: onEditConnection,
          newBoard: vi.fn(),
          newSourceWidget: vi.fn(),
          openActivity: vi.fn(),
          openApp: vi.fn(),
          openBoard: vi.fn(),
          openHistory: onOpenHistory,
          openImport: vi.fn(),
          openSettings: vi.fn(),
          openThemes: vi.fn(),
          renameApp: vi.fn(),
          renameBoard: vi.fn(),
          runWidget: vi.fn(),
          watchWidget: vi.fn(),
        }}
        onQueryChange={setQuery}
        query={query}
      />
    </>
  );
}

const renderRoot = (props: HarnessProps = {}) =>
  renderWithConnections(<Harness {...props} />);

type Screen = ReturnType<typeof renderRoot>;

const combobox = (screen: Screen) =>
  screen.getByRole("combobox", { name: "Search commands" });

const results = (screen: Screen) =>
  screen.getByRole("group", { name: /^Results/ });

const inputOf = (screen: Screen) =>
  combobox(screen).element() as HTMLInputElement;

describe.each([
  ["full motion", false, "fade"],
  ["reduced motion", true, "instant"],
])("typed results with %s", (_label, isReduced, motionKind) => {
  beforeEach(() => {
    reduced.value = isReduced;
    resetFirstRunReveal();
  });

  it("flattens matches into a counted Results list with kind labels", async () => {
    mockLauncherIpc({ connections: [analytics, scratch] });
    const screen = renderRoot();
    await expect
      .element(screen.getByRole("group", { name: "Connections" }))
      .toBeVisible();
    expect(screen.container.querySelector('[data-slot="row-kind"]')).toBeNull();

    await combobox(screen).fill("an");
    await expect.element(results(screen)).toBeVisible();
    expect(results(screen).element().textContent).toMatch(/^Results\d/);
    const kinds = [
      ...screen.container.querySelectorAll<HTMLElement>(
        '[data-slot="row-kind"]'
      ),
    ];
    expect(kinds.map((kind) => kind.textContent)).toContain("Connection");
    expect(kinds[0]?.dataset.motion).toBe(motionKind);
    expect(
      screen.getByRole("group", { name: "Connections" }).query()
    ).toBeNull();
  });

  it("returns to sections when the query is cleared", async () => {
    mockLauncherIpc({ connections: [analytics, scratch] });
    const screen = renderRoot({ initialQuery: "an" });
    await expect.element(results(screen)).toBeVisible();
    await combobox(screen).fill("");
    await expect
      .element(screen.getByRole("group", { name: "Connections" }))
      .toBeVisible();
    expect(results(screen).query()).toBeNull();
  });
});

describe("root drafts and fallbacks", () => {
  beforeEach(() => {
    reduced.value = false;
    resetFirstRunReveal();
  });

  it("leads with the draft and reopens it on Enter", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const onEditConnection = vi.fn();
    const screen = renderRoot({ onEditConnection, seedDraft: true });
    const draft = screen.getByRole("option", { name: /New Connection/ });
    await expect.element(draft).toHaveTextContent("db.internal");
    await expect.element(draft).toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByRole("contentinfo"))
      .toHaveTextContent("Open Draft");
    await combobox(screen).click();
    await userEvent.keyboard("{Enter}");
    expect(onEditConnection).toHaveBeenCalledWith(null);
  });

  it("discards the draft with Control-X", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const screen = renderRoot({ seedDraft: true });
    const draft = screen.getByRole("option", { name: /New Connection/ });
    await expect.element(draft).toBeVisible();
    await combobox(screen).click();
    await userEvent.keyboard("{Control>}x{/Control}");
    await expect
      .poll(() =>
        screen.getByRole("option", { name: /New Connection/ }).query()
      )
      .toBeNull();
  });

  it("offers Find Table for a SQL connection and fills the # prefix", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const screen = renderRoot();
    await screen.getByRole("option", { name: /analytics/ }).click();
    await combobox(screen).fill("orders");
    const findTable = screen.getByRole("option", { name: /Find Table/ });
    await findTable.click();
    await expect.element(combobox(screen)).toHaveValue("#orders");
  });

  it("starts a mode from its command and keeps focus in the input", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const screen = renderRoot();
    const runSql = screen.getByRole("option", { name: /Run SQL/ });
    await expect.element(runSql).toHaveTextContent(">");
    await runSql.click();
    await expect.element(combobox(screen)).toHaveValue("> ");
    await expect.element(combobox(screen)).toHaveFocus();
  });

  it("selects the query it comes back with, so typing replaces it", async () => {
    mockLauncherIpc({ connections: [analytics] });
    const screen = renderRoot({ initialQuery: "revenue" });
    await expect.element(combobox(screen)).toHaveValue("revenue");
    await expect
      .poll(() => [
        inputOf(screen).selectionStart,
        inputOf(screen).selectionEnd,
      ])
      .toEqual([0, 7]);
  });
});
