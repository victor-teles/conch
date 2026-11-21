import { describe, expect, it, vi } from "vitest";

import { createMcpEmulator } from "./browser-mcp-stub";

const NOW = new Date("2026-11-21T09:41:00.000Z");

const setup = () => {
  const onActivity = vi.fn();
  const emulator = createMcpEmulator({ now: () => NOW, onActivity });
  return { emulator, onActivity };
};

describe("browser MCP emulator", () => {
  it("starts off with a redacted token and no clients", () => {
    const { emulator } = setup();
    const settings = emulator.getMcpSettings();

    expect(settings).toMatchObject({
      clients: [],
      enabled: false,
      exposedConnectionIds: [],
      listening: false,
      rowLimit: 100,
      startError: null,
    });
    expect(settings.tokenPreview).toMatch(/^conch_….{4}$/);
    expect(settings).not.toHaveProperty("token");
  });

  it("listens when enabled and keeps exposure and row limit", () => {
    const { emulator } = setup();

    emulator.saveMcpSettings({ enabled: true });
    emulator.saveMcpSettings({ exposedConnectionIds: ["analytics"] });
    const saved = emulator.saveMcpSettings({ rowLimit: 250 });

    expect(saved).toMatchObject({
      enabled: true,
      exposedConnectionIds: ["analytics"],
      listening: true,
      rowLimit: 250,
    });
    expect(emulator.saveMcpSettings({ enabled: false }).listening).toBeFalsy();
  });

  it("changes the token preview on rotation", () => {
    const { emulator } = setup();
    const before = emulator.getMcpSettings().tokenPreview;

    const rotated = emulator.rotateMcpToken();

    expect(rotated.tokenPreview).not.toBe(before);
    expect(rotated.clients).toStrictEqual([]);
  });

  it("lists seeded audit entries newest first, limits and clears them", () => {
    const { emulator } = setup();

    const entries = emulator.listMcpAudit();
    expect(entries.map((entry) => entry.outcome)).toStrictEqual([
      "ok",
      "error",
      "limited",
    ]);
    expect(entries[0]?.at).toBe("2026-11-21T09:39:00.000Z");
    expect(emulator.listMcpAudit({ limit: 1 })).toHaveLength(1);

    emulator.clearMcpAudit();
    expect(emulator.listMcpAudit()).toStrictEqual([]);
    expect(emulator.copyMcpClientConfig()).toBeNull();
  });

  it("exposes an activity emitter for e2e", () => {
    const { onActivity } = setup();
    const emit = (
      globalThis as unknown as {
        __conchEmitMcpActivity: (active: unknown[]) => void;
      }
    ).__conchEmitMcpActivity;

    emit([]);

    expect(onActivity).toHaveBeenCalledWith([]);
  });
});
