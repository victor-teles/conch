import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { MiniAppDraft, MiniAppGenEvent } from "@/lib/ipc";

import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import {
  chargesRun,
  deskApp,
  deskDraft,
  ordersRun,
} from "@/test/mini-app-fixtures";

import { MiniAppGenerateView } from "./mini-app-generate-view";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const analytics = makeConnection({ id: "analytics", name: "analytics" });

interface Setup {
  permissions?: { kind: string; id: string }[];
  saveMiniApp?: (payload: Record<string, unknown>) => unknown;
}

const setup = ({ permissions = [], saveMiniApp }: Setup = {}) => {
  const calls = {
    cancelMiniAppGeneration: vi.fn(),
    generateMiniApp: vi.fn(),
    openMiniApp: vi.fn(),
    runMiniAppSource: vi.fn((payload: Record<string, unknown>) =>
      payload.sourceName === "charges" ? chargesRun() : ordersRun()
    ),
    saveMiniApp: vi.fn(saveMiniApp ?? (() => deskApp())),
  };
  mockLauncherIpc({
    connections: [analytics],
    handlers: {
      ...calls,
      listMiniApps: () => [],
      listWritePermissions: () => permissions,
    },
  });
  const onDone = vi.fn();
  const onOpenSettings = vi.fn();
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <MiniAppGenerateView
        onDone={onDone}
        onOpenSettings={onOpenSettings}
        target={{
          baseAppId: null,
          connectionId: "analytics",
          prompt: "refund desk",
        }}
      />
    </div>
  );
  return { calls, onDone, onOpenSettings, screen };
};

const withLink = (draft: MiniAppDraft): MiniAppDraft => ({
  ...draft,
  actions: [
    ...draft.actions,
    {
      bind: {
        id: { column: "charge_id", from: "row" },
        region: { from: "input", name: "region" },
      },
      id: "open-order",
      label: "Open order",
      scope: "row",
      target: {
        baseUrl: "https://admin.example.com",
        kind: "open-url",
        path: "/orders/{{id}}",
        query: { region: { $param: "region" }, tab: "refunds" },
      },
    },
  ],
});

const genIdOf = (calls: ReturnType<typeof setup>["calls"]): string =>
  String(calls.generateMiniApp.mock.calls[0]?.[0]?.genId ?? "");

const send = (genId: string, events: MiniAppGenEvent[]) => {
  for (const event of events) {
    emitIpcMessage("miniAppGenEvent", { event, genId });
  }
};

const elementPatches = (draft: MiniAppDraft): MiniAppGenEvent[] =>
  Object.entries(draft.layout.elements).map(([key, value]) => ({
    ops: [{ op: "add", path: `/layout/elements/${key}`, value }],
    type: "patch",
  }));

const buildEvents = (draft: MiniAppDraft): MiniAppGenEvent[] => [
  {
    ops: [
      { op: "add", path: "/name", value: draft.name },
      ...draft.inputs.map((value) => ({
        op: "add" as const,
        path: "/inputs/-",
        value,
      })),
      ...Object.entries(draft.sources).map(([name, value]) => ({
        op: "add" as const,
        path: `/sources/${name}`,
        value,
      })),
      ...draft.actions.map((value) => ({
        op: "add" as const,
        path: "/actions/-",
        value,
      })),
      { op: "add", path: "/layout/root", value: draft.layout.root },
    ],
    type: "patch",
  },
  { detail: "Laying out…", phase: "layout", type: "phase" },
  ...elementPatches(draft),
  { name: "charges", result: chargesRun().result, type: "sourceResult" },
];

const started = async (calls: ReturnType<typeof setup>["calls"]) => {
  await expect.poll(() => calls.generateMiniApp.mock.calls.length).toBe(1);
  return genIdOf(calls);
};

describe("miniAppGenerateView", () => {
  it("asks bun to build with the prompt and the chip's connection", async () => {
    const { calls } = setup();
    await started(calls);
    expect(calls.generateMiniApp).toHaveBeenCalledWith(
      expect.objectContaining({
        baseAppId: null,
        connectionId: "analytics",
        prompt: "refund desk",
      })
    );
  });

  it("assembles the panel as patches land, with skeletons until data", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, buildEvents(deskDraft()));
    await expect
      .element(screen.getByRole("heading", { name: "Refund desk" }).last())
      .toBeVisible();
    const orders = screen.getByRole("article", { name: "Matching orders" });
    await expect.element(orders.getByTestId("ask-skeleton")).toBeVisible();
    await expect
      .element(
        screen
          .getByRole("article", { name: "Failed charges" })
          .getByText("ch_2")
      )
      .toBeVisible();
    await expect.element(screen.getByText("Laying out…").first()).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("is ready to review once bun is done, and locks preview actions", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      ...buildEvents(deskDraft()),
      { draft: deskDraft(), notes: ["Review Refund."], type: "done" },
    ]);
    await expect
      .element(screen.getByText("Ready · ⌘S to save").first())
      .toBeVisible();
    await expect.element(screen.getByText("Review Refund.")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Copy region" }))
      .toHaveAttribute("aria-disabled", "true");
    await expect
      .poll(() =>
        screen.container
          .querySelector('[aria-label="Ready"] path')
          ?.getAttribute("stroke-dasharray")
      )
      .toMatch(/^1 /u);
    expect(screen.container).toMatchSnapshot();
  });

  it("re-runs only the sources an input change touches, against bun's draft", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      ...buildEvents(deskDraft()),
      { draft: deskDraft(), notes: [], type: "done" },
    ]);
    const region = screen.getByRole("textbox", { name: "Region" });
    await expect.element(region).toBeVisible();
    await region.fill("US");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.runMiniAppSource.mock.calls.length).toBe(1);
    expect(calls.runMiniAppSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceName: "orders",
        target: { genId, kind: "draft" },
        values: expect.objectContaining({ region: "US" }),
      })
    );
  });

  it("gates a write action on review and the connection's opt-in", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      ...buildEvents(deskDraft()),
      { draft: deskDraft(), notes: [], type: "done" },
    ]);
    await expect
      .element(screen.getByText("Ready · ⌘S to save").first())
      .toBeVisible();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const review = screen.getByRole("region", { name: "Review the app" });
    await expect.element(review).toBeVisible();
    await expect
      .element(review.getByText("Writes are off for analytics."))
      .toBeVisible();
    await expect
      .element(review.getByRole("button", { name: "Save App ⌘↵" }))
      .toHaveAttribute("aria-disabled", "true");
    expect(review.element()).toMatchSnapshot();
  });

  it("saves only after the write is ticked, then opens the app", async () => {
    const { calls, onDone, screen } = setup({
      permissions: [{ id: "analytics", kind: "connection" }],
    });
    const genId = await started(calls);
    send(genId, [
      ...buildEvents(deskDraft()),
      { draft: deskDraft(), notes: [], type: "done" },
    ]);
    await expect
      .element(screen.getByText("Ready · ⌘S to save").first())
      .toBeVisible();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const review = screen.getByRole("region", { name: "Review the app" });
    await review.getByRole("checkbox", { name: /I reviewed this/u }).click();
    await review.getByRole("button", { name: "Region" }).click();
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await expect.element(screen.getByText("Saved · ↵ to open")).toBeVisible();
    const saved = calls.saveMiniApp.mock.calls[0]?.[0];
    expect(saved?.reviewedActionIds).toStrictEqual(["refund"]);
    expect(JSON.stringify(saved?.draft)).toContain('"fixed":true');
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => calls.openMiniApp.mock.calls.length).toBe(1);
    await expect.poll(() => onDone.mock.calls.length).toBe(1);
  });

  it("asks for a tick on a generated link and shows its whole address", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    const draft = withLink(deskDraft());
    send(genId, [...buildEvents(draft), { draft, notes: [], type: "done" }]);
    await expect
      .element(screen.getByText("Ready · ⌘S to save").first())
      .toBeVisible();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    const review = screen.getByRole("region", { name: "Review the app" });
    await expect
      .element(
        review.getByText(
          "https://admin.example.com/orders/{{id}}?region={{region}}&tab=refunds"
        )
      )
      .toBeVisible();
    await expect
      .element(review.getByRole("list", { name: "Values for Open order" }))
      .toHaveTextContent("region ← input region");
    await expect
      .element(
        review.getByRole("checkbox", { name: /It opens the address above/u })
      )
      .toBeVisible();
  });

  it("shows why a build failed and offers to try again", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      {
        code: "INVALID_APP",
        message: "orders failed: relation missing",
        type: "error",
      },
    ]);
    await expect
      .element(
        screen.getByText(
          "Couldn't build a working app from that. Try naming the data you want."
        )
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("orders failed: relation missing"))
      .toBeVisible();
    expect(screen.container).toMatchSnapshot();
    await screen.getByRole("button", { name: "Try Again" }).click();
    await expect.poll(() => calls.generateMiniApp.mock.calls.length).toBe(2);
  });

  it("stops showing a repair on cards once the build gives up", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      ...buildEvents(deskDraft()),
      {
        message: "relation missing",
        name: "orders",
        repairing: true,
        type: "sourceError",
      },
    ]);
    const orders = screen.getByRole("article", { name: "Matching orders" });
    await expect.element(orders.getByText("Fixing this query…")).toBeVisible();

    send(genId, [
      { code: "INVALID_APP", message: "orders failed", type: "error" },
    ]);

    await expect
      .poll(() => orders.getByText("Fixing this query…").query())
      .toBeNull();
    await expect.element(orders.getByText("relation missing")).toBeVisible();
  });

  it("sends people to AI setup when no model is configured", async () => {
    const { calls, onOpenSettings, screen } = setup();
    const genId = await started(calls);
    send(genId, [
      { code: "NO_AI_SETTINGS", message: "Add an AI provider.", type: "error" },
    ]);
    await screen.getByRole("button", { name: "Set up AI" }).click();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("cancels the build when the view goes away", async () => {
    const { calls, screen } = setup();
    const genId = await started(calls);
    screen.unmount();
    await expect
      .poll(() => calls.cancelMiniAppGeneration.mock.calls.length)
      .toBe(1);
    expect(calls.cancelMiniAppGeneration).toHaveBeenCalledWith({ genId });
  });

  it("assembles without motion under reduced motion", async () => {
    reduced.value = true;
    const { calls, screen } = setup();
    const genId = await started(calls);
    send(genId, buildEvents(deskDraft()));
    await expect
      .element(screen.getByRole("article", { name: "Failed charges" }))
      .toBeVisible();
    reduced.value = false;
  });
});
