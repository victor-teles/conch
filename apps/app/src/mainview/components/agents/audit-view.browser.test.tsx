import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { McpAuditEntry } from "@/lib/ipc";
import type { CommandHandlers } from "@/test/ipc-mock";

import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { LOCAL_9_41, makeAuditEntry } from "@/test/mcp-fixtures";

import { AuditView } from "./audit-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const ENTRIES: McpAuditEntry[] = [
  makeAuditEntry(),
  makeAuditEntry({
    at: new Date(Date.parse(LOCAL_9_41) - 60_000).toISOString(),
    code: "LIMITED",
    connectionId: null,
    durationMs: 0,
    id: "audit-2",
    outcome: "limited",
    question: null,
    rowCount: null,
    sql: null,
    tool: "list_connections",
  }),
];

const setup = ({
  entries = ENTRIES,
  handlers = {},
}: { entries?: McpAuditEntry[]; handlers?: CommandHandlers } = {}) => {
  const store = { entries: [...entries] };
  const ipc = {
    clearMcpAudit: vi.fn(() => {
      store.entries = [];
      return null;
    }),
  };
  mockLauncherIpc({
    connections: [makeConnection()],
    handlers: {
      ...ipc,
      listMcpAudit: () => store.entries,
      ...handlers,
    },
  });
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <AuditView onBack={vi.fn()} />
    </div>
  );
  return { ipc, screen, store };
};

describe("auditView", () => {
  beforeEach(() => {
    reduced.value = false;
  });

  it("says when no agent has called yet", async () => {
    const { screen } = setup({ entries: [] });

    await expect.element(screen.getByText("No agent calls yet.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Clear activity" }).query()
    ).toBeNull();
    expect(screen.container).toMatchSnapshot();
  });

  it("shows skeleton rows while a slow load is pending", async () => {
    const pending = Promise.withResolvers<McpAuditEntry[]>();
    const { screen } = setup({
      handlers: { listMcpAudit: () => pending.promise },
    });

    await expect
      .element(screen.getByRole("status", { name: "Loading agent activity" }))
      .toBeVisible();
    pending.resolve([]);
    await expect.element(screen.getByText("No agent calls yet.")).toBeVisible();
  });

  it("lists calls newest first with client, tool, connection and outcome", async () => {
    const { screen } = setup({ entries: [...ENTRIES].toReversed() });

    const list = screen.getByRole("listbox", { name: "Agent calls" });
    await expect.element(list).toBeVisible();
    const options = list.getByRole("option").elements();
    expect(options[0]?.textContent).toContain("Revenue by region");
    expect(options[0]?.textContent).toContain(
      "Claude Code · ask · analytics · 27 rows · 1.2 s"
    );
    expect(options[1]?.textContent).toContain("Listed connections");
    expect(
      options[1]?.querySelector("[data-outcome='limited']")?.className
    ).toContain("text-danger-ink");
    await expect.element(screen.getByText("2 agent calls")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("reports a load failure and retries", async () => {
    const { screen } = setup({
      handlers: {
        listMcpAudit: vi
          .fn()
          .mockRejectedValueOnce(new Error("Locked"))
          .mockResolvedValue(ENTRIES),
      },
    });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Agent activity couldn’t load.");
    expect(screen.container).toMatchSnapshot();
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect
      .element(screen.getByRole("listbox", { name: "Agent calls" }))
      .toBeVisible();
  });

  it("copies the selected call's SQL with return and from ⌘K", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    const { screen } = setup();
    const list = screen.getByRole("listbox", { name: "Agent calls" });
    await expect.element(list).toBeVisible();
    (list.element() as HTMLElement).focus();

    await userEvent.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith(ENTRIES[0]?.sql);

    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Copy Question/ }).click();
    expect(writeText).toHaveBeenLastCalledWith("Revenue by region");
  });

  it("refreshes and pulses a new call while open", async () => {
    const { screen, store } = setup();
    await expect
      .element(screen.getByRole("listbox", { name: "Agent calls" }))
      .toBeVisible();

    store.entries = [
      makeAuditEntry({
        at: new Date(Date.parse(LOCAL_9_41) + 60_000).toISOString(),
        id: "audit-new",
        question: "Signups this week",
      }),
      ...store.entries,
    ];
    emitIpcMessage("mcpActivity", { active: [] });

    await expect.element(screen.getByText("Signups this week")).toBeVisible();
    await expect.element(screen.getByTestId("fresh-pulse")).toBeInTheDocument();
    await expect.element(screen.getByText("3 agent calls")).toBeVisible();
  });

  it("clears activity only on a second press", async () => {
    const { ipc, screen } = setup();

    await screen.getByRole("button", { name: "Clear activity" }).click();
    expect(ipc.clearMcpAudit).not.toHaveBeenCalled();
    await screen.getByRole("button", { name: "Press again to clear" }).click();

    expect(ipc.clearMcpAudit).toHaveBeenCalledOnce();
    await expect.element(screen.getByText("No agent calls yet.")).toBeVisible();
  });

  it("clears from the actions menu after arming", async () => {
    const { ipc, screen } = setup();
    const list = screen.getByRole("listbox", { name: "Agent calls" });
    await expect.element(list).toBeVisible();
    (list.element() as HTMLElement).focus();

    await userEvent.keyboard("{Meta>}k{/Meta}");
    const clear = screen.getByRole("menuitem", { name: /Clear Activity/ });
    await clear.click();
    expect(ipc.clearMcpAudit).not.toHaveBeenCalled();
    await clear.click();

    expect(ipc.clearMcpAudit).toHaveBeenCalledOnce();
  });

  it("renders rows without stagger or pulse under reduced motion", async () => {
    reduced.value = true;
    const { screen, store } = setup();
    await expect
      .element(screen.getByRole("listbox", { name: "Agent calls" }))
      .toBeVisible();
    expect(
      screen.container.querySelector("[data-motion='stagger']")
    ).toBeNull();

    store.entries = [makeAuditEntry({ id: "audit-new" }), ...store.entries];
    emitIpcMessage("mcpActivity", { active: [] });

    await expect.element(screen.getByText("3 agent calls")).toBeVisible();
    expect(screen.getByTestId("fresh-pulse").query()).toBeNull();
  });
});
