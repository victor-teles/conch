import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { ActionEditTarget } from "@/components/actions/action-targets";

import { SourcesProvider } from "@/components/sources/sources-provider";
import { makeListed } from "@/test/action-fixtures";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { swapsSettled } from "@/test/wait";
import { makeWidget } from "@/test/widget-fixtures";

import { ActionEditView } from "./action-edit-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const SERVER = {
  args: [],
  command: "/usr/local/bin/stripe-mcp",
  createdAt: "",
  env: [],
  id: "stripe",
  lastTest: null,
  name: "Stripe",
  readTools: [],
  transport: "stdio" as const,
  updatedAt: "",
};

const TOOLS = [
  {
    description: "Refund a charge.",
    inputSchema: {},
    markedRead: false,
    name: "refund_charge",
    readEligible: false,
    readOnlyHint: false,
    title: null,
  },
  {
    description: "Find a charge.",
    inputSchema: {},
    markedRead: false,
    name: "get_charge",
    readEligible: true,
    readOnlyHint: true,
    title: null,
  },
];

const target = (
  overrides: Partial<ActionEditTarget> = {}
): ActionEditTarget => ({
  actionId: null,
  columns: ["month", "mrr"],
  context: { rowIndex: 0, runId: "r1", values: {} },
  draft: null,
  widgetId: "w-revenue",
  ...overrides,
});

const setup = (editTarget = target()) => {
  const calls = {
    proposeAction: vi.fn(() => ({
      draft: {
        bind: {
          month: { column: "month", from: "row" },
          status: { from: "literal", value: "reviewed" },
        },
        label: "Mark reviewed",
        scope: "row",
        target: makeListed().action.target,
      },
    })),
    saveAction: vi.fn(() => makeListed()),
  };
  mockLauncherIpc({
    connections: [makeConnection({ id: "analytics", name: "analytics" })],
    handlers: {
      ...calls,
      listHttpEndpoints: () => [],
      listMcpServers: () => [SERVER],
      listMcpTools: () => TOOLS,
      listWidgets: () => [makeWidget()],
    },
  });
  const onBack = vi.fn();
  const onReview = vi.fn();
  renderWithConnections(
    <SourcesProvider>
      <div data-testid="editor" style={{ height: 640, width: 760 }}>
        <ActionEditView
          onBack={onBack}
          onReview={onReview}
          target={editTarget}
        />
      </div>
    </SourcesProvider>
  );
  return { calls, onBack, onReview, screen: page.getByTestId("editor") };
};

describe.each([
  ["full motion", false],
  ["reduced motion", true],
])("actionEditView with %s", (_label, isReduced) => {
  it("generates one value row per placeholder as the statement changes", async () => {
    reduced.value = isReduced;
    const { screen } = setup();
    await screen.getByRole("textbox", { name: "Label" }).fill("Mark reviewed");
    await screen
      .getByRole("textbox", { name: "Statement" })
      .fill("UPDATE revenue SET status = {{status}} WHERE month = {{month}}");
    const values = screen.getByRole("list", { name: "Values" });
    await expect.element(values.getByRole("listitem").nth(1)).toBeVisible();
    expect(values.getByRole("listitem").all()).toHaveLength(2);
    await expect
      .element(screen.getByRole("combobox", { name: "Value for month" }))
      .toHaveValue("row:month");
    await screen
      .getByRole("combobox", { name: "Value for status" })
      .selectOptions("Fixed text");
    await screen
      .getByRole("textbox", { name: "Text for status" })
      .fill("reviewed");
    await expect.element(screen.getByText("Review")).toBeVisible();
    await expect.poll(() => swapsSettled(screen.element())).toBeTruthy();
    expect(screen.element()).toMatchSnapshot();
  });
});

describe("actionEditView", () => {
  it("sends a write to review with ⌘↵ instead of saving it", async () => {
    reduced.value = false;
    const { calls, onReview, screen } = setup();
    await screen.getByRole("textbox", { name: "Label" }).fill("Mark reviewed");
    await screen
      .getByRole("textbox", { name: "Statement" })
      .fill("DELETE FROM revenue WHERE month = {{month}}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        bind: { month: { column: "month", from: "row" } },
        label: "Mark reviewed",
        target: expect.objectContaining({ dialect: "postgresql", kind: "sql" }),
      })
    );
    expect(calls.saveAction).not.toHaveBeenCalled();
  });

  it("saves a copy action directly", async () => {
    const { calls, onBack, screen } = setup();
    await screen.getByRole("radio", { name: "Copy" }).click();
    await screen.getByRole("textbox", { name: "Label" }).fill("Copy month");
    await screen.getByRole("textbox", { name: "Text" }).fill("{{month}}");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => calls.saveAction.mock.calls.length).toBe(1);
    expect(onBack).toHaveBeenCalledOnce();
    await expect.poll(() => swapsSettled(screen.element())).toBeTruthy();
    expect(screen.element()).toMatchSnapshot();
  });

  it("labels each MCP tool as read-only or changing data", async () => {
    const { screen } = setup();
    await screen.getByRole("radio", { name: "MCP" }).click();
    const tool = screen.getByRole("combobox", { name: "Tool" });
    await expect
      .element(
        tool.getByRole("option", { name: "refund_charge · Changes data" })
      )
      .toBeInTheDocument();
    await expect
      .element(tool.getByRole("option", { name: "get_charge · Read-only" }))
      .toBeInTheDocument();
    await expect.poll(() => swapsSettled(screen.element())).toBeTruthy();
    expect(screen.element()).toMatchSnapshot();
  });

  it("shows the HTTP and link fields", async () => {
    const { screen } = setup();
    await screen.getByRole("radio", { name: "HTTP" }).click();
    await expect
      .element(screen.getByRole("combobox", { name: "Method" }))
      .toHaveValue("POST");
    await expect.poll(() => swapsSettled(screen.element())).toBeTruthy();
    expect(screen.element()).toMatchSnapshot();
    await screen.getByRole("radio", { name: "Link" }).click();
    await expect
      .element(screen.getByRole("textbox", { name: "Address" }))
      .toBeVisible();
    await expect.poll(() => swapsSettled(screen.element())).toBeTruthy();
    expect(screen.element()).toMatchSnapshot();
  });

  it("fills the editor from a suggestion with ⌘⇧S", async () => {
    const { calls, screen } = setup();
    await screen
      .getByRole("textbox", { name: "Label" })
      .fill("mark it reviewed");
    await userEvent.keyboard("{Meta>}{Shift>}s{/Shift}{/Meta}");
    await expect
      .element(screen.getByRole("textbox", { name: "Statement" }))
      .toHaveValue(
        "UPDATE revenue SET status = {{status}} WHERE month = {{month}}"
      );
    expect(calls.proposeAction).toHaveBeenCalledWith({
      prompt: "mark it reviewed",
      scope: "row",
      target: { id: "analytics", kind: "sql" },
      widgetId: "w-revenue",
    });
  });

  it("edits an existing action", async () => {
    const listed = makeListed();
    const { screen } = setup(
      target({
        actionId: listed.action.id,
        draft: {
          bind: listed.action.bind,
          id: listed.action.id,
          label: listed.action.label,
          scope: listed.action.scope,
          target: listed.action.target,
        },
      })
    );
    await expect
      .element(screen.getByRole("heading", { name: "Edit Action" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Label" }))
      .toHaveValue("Mark reviewed");
  });

  it("explains what is missing", async () => {
    const { screen } = setup();
    await expect
      .element(screen.getByText("Give the action a label."))
      .toBeVisible();
  });
});
