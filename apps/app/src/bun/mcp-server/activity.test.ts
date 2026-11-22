import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActivityTracker, TRAY_LINGER_MS, trayLine } from "./activity.ts";

const setup = () => {
  const publish = vi.fn();
  const setTray = vi.fn();
  const tracker = createActivityTracker({
    clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
    now: () => new Date("2026-11-21T09:41:00.000Z"),
    publish,
    setTimer: (run, ms) => setTimeout(run, ms),
    setTray,
  });
  return { publish, setTray, tracker };
};

describe("createActivityTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes calls while they run", () => {
    const { publish, setTray, tracker } = setup();
    tracker.start({
      client: "Claude Code",
      connectionName: "analytics",
      tool: "ask",
    });

    expect(publish).toHaveBeenLastCalledWith([
      expect.objectContaining({
        client: "Claude Code",
        connectionName: "analytics",
        startedAt: "2026-11-21T09:41:00.000Z",
        tool: "ask",
      }),
    ]);
    expect(setTray).toHaveBeenLastCalledWith("Claude Code · asking analytics…");
  });

  it("clears the tray only after the linger", () => {
    const { publish, setTray, tracker } = setup();
    const end = tracker.start({
      client: "Claude Code",
      connectionName: "analytics",
      tool: "ask",
    });
    end();
    end();
    expect(publish).toHaveBeenLastCalledWith([]);
    expect(publish).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(TRAY_LINGER_MS - 1);
    expect(setTray).not.toHaveBeenCalledWith(null);
    vi.advanceTimersByTime(1);
    expect(setTray).toHaveBeenLastCalledWith(null);
  });

  it("keeps the tray busy when a new call starts during the linger", () => {
    const { setTray, tracker } = setup();
    tracker.start({
      client: "Cursor",
      connectionName: null,
      tool: "list_widgets",
    })();
    tracker.start({
      client: "Cursor",
      connectionName: "billing",
      tool: "run_widget",
    });
    vi.advanceTimersByTime(TRAY_LINGER_MS * 2);
    expect(setTray).not.toHaveBeenCalledWith(null);
    expect(tracker.active()).toHaveLength(1);
    tracker.dispose();
  });
});

describe("trayLine", () => {
  it.each([
    ["describe_schema", "analytics", "Cursor · reading analytics…"],
    ["list_connections", "analytics", "Cursor · listing connections…"],
    ["run_widget", null, "Cursor · running a widget on…"],
  ] as const)("phrases %s", (tool, connectionName, expected) => {
    expect(
      trayLine({
        client: "Cursor",
        connectionName,
        id: "a",
        startedAt: "",
        tool,
      })
    ).toBe(expected);
  });
});
