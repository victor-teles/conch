import { CARD_SPEC_VERSION } from "@conch/rpc";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type {
  McpSource,
  ParamDef,
  SourcePreviewResult,
  SourceProposal,
} from "@/lib/ipc";

import { mockLauncherIpc } from "@/test/launcher-ipc";
import {
  makeEndpoint,
  makeServer,
  renderWithSources,
  TOOLS,
} from "@/test/source-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { SourceDraftView } from "./source-draft-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const STATUS: ParamDef = {
  default: "needs_response",
  label: "Status",
  name: "status",
  options: ["needs_response", "won"],
  type: "select",
};

const PROPOSED_SOURCE: McpSource = {
  args: { limit: 20, status: { $param: "status" } },
  kind: "mcp",
  select: "$.data[*]",
  serverId: "stripe",
  tool: "list_disputes",
};

const PROPOSAL: SourceProposal = {
  draft: { params: [STATUS], source: PROPOSED_SOURCE },
};

const PREVIEW: SourcePreviewResult = {
  compiled: {
    args: { limit: 20, status: "needs_response" },
    kind: "mcp",
    server: "Stripe",
    tool: "list_disputes",
  },
  result: {
    columns: [
      { name: "id", typeName: "TEXT" },
      { name: "amount", typeName: "NUMERIC" },
    ],
    executionTimeMs: 120,
    isTruncated: false,
    resultType: "tabular",
    rowCount: 2,
    rows: [
      ["dp_1", 1200],
      ["dp_2", 840],
    ],
  },
  spec: {
    formats: {},
    title: "Open disputes",
    version: CARD_SPEC_VERSION,
    view: { kind: "table" },
  },
  values: { status: "needs_response" },
};

type Handler = (payload: Record<string, unknown>) => unknown;

const setup = (
  target: { type: "mcp" | "http"; id: string },
  handlers: Record<string, Handler> = {}
) => {
  const calls = {
    previewSource: vi.fn((_payload: Record<string, unknown>) => PREVIEW),
    proposeSourceWidget: vi.fn((_payload: Record<string, unknown>) => PROPOSAL),
    saveWidget: vi.fn((_payload: Record<string, unknown>) =>
      makeWidget({ id: "w-new", name: "Open disputes" })
    ),
  };
  mockLauncherIpc({
    handlers: {
      ...calls,
      cancelWidgetRun: () => null,
      listHttpEndpoints: () => [makeEndpoint()],
      listMcpServers: () => [makeServer()],
      listMcpTools: () => TOOLS,
      ...handlers,
    },
  });
  const onRun = vi.fn();
  const screen = renderWithSources(
    <div style={{ height: 680, width: 760 }}>
      <SourceDraftView onBack={vi.fn()} onRun={onRun} target={target} />
    </div>
  );
  return { calls, onRun, screen };
};

describe.each([false, true])(
  "source draft (reduced motion %s)",
  (isReduced) => {
    beforeEach(() => {
      reduced.value = isReduced;
    });

    it("proposes a call, previews it, saves it and runs it", async () => {
      const reply = Promise.withResolvers<SourceProposal>();
      const { calls, onRun, screen } = setup(
        { id: "stripe", type: "mcp" },
        { proposeSourceWidget: () => reply.promise, saveWidget: calls_save }
      );
      await screen
        .getByRole("textbox", { name: "Describe the widget" })
        .fill("open disputes by status");
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByText("Reading tools…")).toBeVisible();
      await expect.element(screen.getByText("Choosing a call…")).toBeVisible();
      reply.resolve(PROPOSAL);

      await expect
        .element(screen.getByRole("combobox", { name: "Tool" }))
        .toHaveValue("list_disputes");
      await expect
        .element(screen.getByRole("textbox", { name: "Arguments" }))
        .toHaveValue(JSON.stringify(PROPOSED_SOURCE.args, null, 2));
      await expect
        .element(screen.getByRole("list", { name: "Inputs" }))
        .toHaveTextContent("Status");

      await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
      await expect
        .element(screen.getByRole("region", { name: "Open disputes" }))
        .toBeVisible();
      expect(calls.previewSource).toHaveBeenCalledWith(
        expect.objectContaining({
          params: [STATUS],
          prompt: "open disputes by status",
          source: PROPOSED_SOURCE,
          values: {},
        })
      );

      await userEvent.keyboard("{Meta>}s{/Meta}");
      const name = screen.getByRole("textbox", { name: "Name" });
      await expect.element(name).toHaveValue("Open disputes");
      await userEvent.keyboard("{Enter}");
      await expect.element(screen.getByText("Saved · ⌥↵ to run")).toBeVisible();
      expect(saved[0]).toMatchObject({
        widget: {
          name: "Open disputes",
          params: [STATUS],
          prompt: "open disputes by status",
          source: PROPOSED_SOURCE,
          spec: { title: "Open disputes" },
          view: "table",
        },
      });
      await userEvent.keyboard("{Alt>}{Enter}{/Alt}");
      expect(onRun).toHaveBeenCalledWith("w-new");
    });
  }
);

const saved: unknown[] = [];
function calls_save(payload: Record<string, unknown>) {
  saved.push(payload);
  return makeWidget({ id: "w-new", name: "Open disputes" });
}

describe("source draft by hand", () => {
  beforeEach(() => {
    reduced.value = false;
    saved.length = 0;
  });

  it("only offers read tools and explains bad arguments", async () => {
    const { calls, screen } = setup({ id: "stripe", type: "mcp" });
    const tool = screen.getByRole("combobox", { name: "Tool" });
    await expect
      .element(tool)
      .toHaveTextContent("List disputes (list_disputes)");
    expect(tool.element().textContent).not.toContain("refund_charge");
    await tool.selectOptions("list_disputes");
    await screen.getByRole("textbox", { name: "Arguments" }).fill("{ nope");
    await expect
      .element(screen.getByText("The arguments aren't valid JSON.").first())
      .toBeVisible();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.element(screen.getByText("The preview failed.")).toBeVisible();
    expect(calls.previewSource).not.toHaveBeenCalled();
  });

  it("asks for a preview before saving and shows proposal errors", async () => {
    const { screen } = setup(
      { id: "stripe", type: "mcp" },
      {
        proposeSourceWidget: () => ({
          error: "Add an AI provider in Settings, or fill the call in by hand.",
        }),
      }
    );
    await screen
      .getByRole("textbox", { name: "Describe the widget" })
      .fill("refunds");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(
        screen.getByText(
          "Add an AI provider in Settings, or fill the call in by hand."
        )
      )
      .toBeVisible();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect
      .element(screen.getByText("Preview the widget before saving it."))
      .toBeVisible();
  });

  it("builds an HTTP GET from a path and query rows", async () => {
    const { calls, screen } = setup({ id: "status", type: "http" });
    await screen.getByRole("textbox", { name: "Path" }).fill("/incidents");
    await screen.getByRole("button", { name: "Add query value" }).click();
    await screen.getByRole("textbox", { name: "Query name" }).fill("state");
    await screen.getByRole("textbox", { name: "state value" }).fill("open");
    await screen
      .getByRole("textbox", { name: "Rows at" })
      .fill("$.incidents[*]");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.poll(() => calls.previewSource.mock.calls.length).toBe(1);
    expect(calls.previewSource.mock.calls[0]?.[0]).toMatchObject({
      source: {
        endpointId: "status",
        kind: "http",
        method: "GET",
        path: "/incidents",
        query: { state: "open" },
        select: "$.incidents[*]",
      },
    });
    await screen.getByRole("button", { name: "Remove state" }).click();
    await expect
      .poll(() => screen.getByRole("textbox", { name: "Query name" }).query())
      .toBeNull();
  });

  it("keeps the last card dimmed while a preview reruns and reports a failure", async () => {
    const second = Promise.withResolvers<SourcePreviewResult>();
    const { screen } = setup(
      { id: "stripe", type: "mcp" },
      {
        previewSource: vi
          .fn()
          .mockReturnValueOnce(PREVIEW)
          .mockReturnValue(second.promise),
      }
    );
    await screen
      .getByRole("textbox", { name: "Describe the widget" })
      .fill("open disputes");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("combobox", { name: "Tool" }))
      .toHaveValue("list_disputes");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("region", { name: "Open disputes" }))
      .toBeVisible();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect
      .element(screen.getByRole("region", { name: "Preview" }))
      .toHaveAttribute("aria-busy", "true");
    await expect
      .element(screen.getByRole("region", { name: "Open disputes" }))
      .toBeVisible();
    second.reject(
      Object.assign(new Error("Stripe: rate limited"), {
        code: "SOURCE_FAILED",
      })
    );
    await expect
      .element(screen.getByText("Stripe: rate limited"))
      .toBeVisible();
  });
});
