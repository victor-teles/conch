import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordedGeneration,
  refundDeskDraft,
} from "./browser-mini-app-recordings";
import { createMiniAppEmulator } from "./browser-mini-app-stub";

const setup = () => {
  const emit = vi.fn();
  const apps = createMiniAppEmulator(
    emit,
    () => new Date("2026-11-21T10:00:00Z")
  );
  return { apps, emit };
};

const emitted = (emit: ReturnType<typeof vi.fn>, name: string) =>
  emit.mock.calls
    .filter(([message]) => message === name)
    .map(([, payload]) => payload);

const savedDesk = (apps: ReturnType<typeof setup>["apps"]) =>
  apps.save({
    draft: refundDeskDraft("analytics"),
    reviewedActionIds: ["refund"],
  });

describe("browser mini-app stub", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "conch-write-permissions",
      JSON.stringify(["connection:analytics"])
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replays a recorded build under the genId and keeps the draft", () => {
    vi.useFakeTimers();
    const { apps, emit } = setup();
    apps.generate({
      connectionId: "analytics",
      genId: "g1",
      prompt: "a refund desk",
    });
    vi.runAllTimers();
    const events = emitted(emit, "miniAppGenEvent");
    expect(events.at(-1)).toMatchObject({
      event: { type: "done" },
      genId: "g1",
    });
    expect(
      apps.run({
        runId: "r1",
        sourceName: "charges",
        target: { genId: "g1", kind: "draft" },
        values: {},
      }).result.rowCount
    ).toBe(2);
  });

  it("fails a broken build after two repairs and can be cancelled", () => {
    expect(
      recordedGeneration("a broken thing", "analytics").at(-1)
    ).toMatchObject({
      code: "INVALID_APP",
      type: "error",
    });
    vi.useFakeTimers();
    const { apps, emit } = setup();
    apps.generate({
      connectionId: null,
      genId: "g2",
      prompt: "orders by status",
    });
    apps.cancel({ genId: "g2" });
    vi.runAllTimers();
    expect(emitted(emit, "miniAppGenEvent")).toStrictEqual([]);
  });

  it("saves a write action only when reviewed and allowed", () => {
    const { apps } = setup();
    expect(() =>
      apps.save({
        draft: refundDeskDraft("analytics"),
        reviewedActionIds: [],
      })
    ).toThrow("Review “Refund” before saving the app.");
    localStorage.setItem("conch-write-permissions", "[]");
    expect(() => savedDesk(apps)).toThrow(/write actions are off/u);
  });

  it("resolves a row action from its own record of the run", () => {
    const { apps, emit } = setup();
    localStorage.setItem(
      "conch-write-permissions",
      JSON.stringify(["connection:analytics"])
    );
    const app = savedDesk(apps);
    apps.run({
      runId: "r1",
      sourceName: "charges",
      target: { appId: app.id, kind: "saved" },
      values: {},
    });
    const preview = apps.prepare({
      actionId: "refund",
      appId: app.id,
      context: { rowIndex: 1, runId: "r1", values: {} },
    });
    expect(preview.bound).toStrictEqual([
      {
        detail: "row.charge_id",
        from: "row",
        name: "charge_id",
        value: "ch_1043",
      },
    ]);
    expect(apps.execute(preview.token)).toMatchObject({
      ok: true,
      summary: "1 row changed",
    });
    expect(apps.execute(preview.token)).toBeNull();
    expect(emitted(emit, "miniAppRefresh")).toStrictEqual([
      { appId: app.id, sources: ["charges"] },
    ]);
  });

  it("refuses a row from a run it never made", () => {
    const { apps } = setup();
    const app = savedDesk(apps);
    expect(() =>
      apps.prepare({
        actionId: "refund",
        appId: app.id,
        context: { rowIndex: 0, runId: "nope", values: {} },
      })
    ).toThrow("Run the widget again to act on its rows.");
  });

  it("stages an action into the launcher and opens apps in a tab", () => {
    const { apps, emit } = setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const app = savedDesk(apps);
    apps.stage({
      actionId: "refund",
      appId: app.id,
      context: { rowIndex: 0, runId: "r", values: {} },
    });
    expect(emitted(emit, "launcherNavigate")).toHaveLength(1);
    apps.open({ appId: app.id });
    expect(open).toHaveBeenCalledWith(`#/app/${app.id}`, "_blank");
    open.mockRestore();
  });

  it("lists, duplicates, keeps values and deletes", () => {
    const { apps } = setup();
    const app = savedDesk(apps);
    const copy = apps.duplicateMiniApp({ appId: app.id });
    expect(apps.listMiniApps().map((item) => item.name)).toStrictEqual([
      "Refund desk copy",
      "Refund desk",
    ]);
    expect(
      apps.setValues({ appId: app.id, values: { "region:text": "US" } }).values
    ).toStrictEqual({
      "region:text": "US",
    });
    apps.deleteMiniApp({ appId: copy.id });
    expect(apps.getMiniApp({ appId: copy.id })).toBeNull();
  });
});
