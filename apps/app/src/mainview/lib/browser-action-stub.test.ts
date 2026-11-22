import { afterEach, describe, expect, it, vi } from "vitest";

import { makeListed } from "@/test/action-fixtures";
import { makeWidget, runResult } from "@/test/widget-fixtures";

import { createActionEmulator } from "./browser-action-stub";

const NOW = new Date("2026-11-21T10:00:00.000Z");

const setup = () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  localStorage.clear();
  return createActionEmulator(
    {
      connectionName: () => ({ environment: "prod", name: "analytics" }),
      endpointOf: () => null,
      serverName: () => null,
      toolsOf: () => [],
      widgetById: (id) => (id === "w-revenue" ? makeWidget() : null),
    },
    () => NOW
  );
};

const { action } = makeListed();
const draft = {
  bind: action.bind,
  label: action.label,
  scope: action.scope,
  target: action.target,
};
const context = { rowIndex: 1, runId: "r1", values: {} };

describe("browser action emulator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("walks save → prepare → execute → activity like bun", async () => {
    const actions = setup();
    const saved = actions.saveAction({ draft, widgetId: "w-revenue" });
    expect([
      saved.effect,
      actions.listActions({ widgetId: "w-revenue" }).length,
    ]).toStrictEqual(["write", 1]);

    actions.recordRun("r1", "w-revenue", runResult().result);
    expect(() =>
      actions.prepareAction({ actionId: saved.action.id, context })
    ).toThrow("Write actions are off for analytics");

    actions.setWriteActionsAllowed({
      allowed: true,
      id: "analytics",
      kind: "connection",
    });
    const preview = actions.prepareAction({
      actionId: saved.action.id,
      context,
    });
    expect(preview.bound[1]).toMatchObject({
      name: "month",
      value: "2026-08-01",
    });

    const pending = actions.executeAction({ token: preview.token });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(actions.listActionActivity().activity).toHaveLength(1);
  });

  it("refuses a replayed token", async () => {
    const actions = setup();
    const saved = actions.saveAction({ draft, widgetId: "w-revenue" });
    actions.recordRun("r1", "w-revenue", runResult().result);
    actions.setWriteActionsAllowed({
      allowed: true,
      id: "analytics",
      kind: "connection",
    });
    expect(actions.listWritePermissions()).toStrictEqual([
      { id: "analytics", kind: "connection" },
    ]);
    const { token } = actions.prepareAction({
      actionId: saved.action.id,
      context,
    });
    const first = actions.executeAction({ token });
    await vi.runAllTimersAsync();
    await first;
    await expect(actions.executeAction({ token })).rejects.toMatchObject({
      code: "TOKEN_UNKNOWN",
    });
  });

  it("asks for a fresh run when the run is unknown", () => {
    const actions = setup();
    const saved = actions.saveAction({ draft, widgetId: "w-revenue" });
    expect(() =>
      actions.reviewAction({ context, draft, widgetId: "w-revenue" })
    ).toThrow("Run the widget again");
    actions.deleteAction({ actionId: saved.action.id });
    expect(actions.listActions({ widgetId: "w-revenue" })).toStrictEqual([]);
  });

  it("proposes a SQL draft only", async () => {
    const actions = setup();
    const sql = actions.proposeAction({
      prompt: "mark reviewed",
      scope: "row",
      target: { id: "analytics", kind: "sql" },
      widgetId: "w-revenue",
    });
    await vi.runAllTimersAsync();
    await expect(sql).resolves.toHaveProperty("draft");
  });
});
