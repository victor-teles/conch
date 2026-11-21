// @vitest-environment node
import type { DatabaseConnection } from "@conch/core";
import type { McpSettings } from "@conch/rpc";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { connect } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { McpHostDeps } from "./index.ts";

import { createActivityTracker } from "./activity.ts";
import { createMcpServerHost } from "./index.ts";

const TOKEN = `${"x".repeat(39)}9f3a`;

const connection = (id: string): DatabaseConnection => ({
  createdAt: "",
  database: "db",
  host: "h",
  id,
  lastConnectedAt: null,
  name: id,
  password: "p",
  pinned: false,
  port: 1,
  type: "postgresql",
  username: "u",
});

const roots: string[] = [];
const hosts: ReturnType<typeof createMcpServerHost>[] = [];

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function done(): Promise<void> {
  return Promise.resolve();
}

const cleanUp = async () => {
  for (const host of hosts.splice(0)) {
    await host.stop();
  }
  for (const root of roots.splice(0)) {
    await fs.rm(root, { force: true, recursive: true });
  }
};

const setup = (overrides: Partial<McpHostDeps> = {}) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "conch-host-"));
  roots.push(root);
  const runDir = path.join(root, "run");
  let saved: McpSettings = {
    enabled: false,
    exposedConnectionIds: ["c1", "gone"],
    rowLimit: 100,
    token: TOKEN,
    version: 1,
  };
  const settings = {
    read: vi.fn<McpHostDeps["settings"]["read"]>(() => resolved(saved)),
    write: vi.fn<McpHostDeps["settings"]["write"]>((next) => {
      saved = next;
      return done();
    }),
  };
  const writeClipboard = vi.fn();
  const audit = {
    append: vi.fn<McpHostDeps["audit"]["append"]>(() => done()),
    clear: vi.fn<McpHostDeps["audit"]["clear"]>(() => done()),
    list: vi.fn<McpHostDeps["audit"]["list"]>(() => resolved([])),
  };
  const host = createMcpServerHost({
    activity: createActivityTracker({
      clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
      now: () => new Date(),
      publish: () => null,
      setTimer: (run, ms) => setTimeout(run, ms),
      setTray: () => null,
    }),
    audit,
    listConnections: () => resolved([connection("c1"), connection("c2")]),
    now: () => new Date("2026-11-21T09:41:00.000Z"),
    paths: {
      bridgePath:
        "/Applications/Conch.app/Contents/Resources/app/bun/mcp-bridge.js",
      bunPath: "/Applications/Conch.app/Contents/MacOS/bun",
      runDir,
      socketPath: path.join(runDir, "mcp.sock"),
    },
    serverVersion: () => resolved("0.0.10"),
    settings,
    supported: true,
    tools: {
      askPorts: vi.fn(),
      hasAiModel: () => resolved(true),
      listWidgets: () => resolved([]),
      loadSchema: vi.fn(),
      resolveDatabase: vi.fn(),
      runAsk: vi.fn(),
      runWidget: vi.fn(),
    },
    writeClipboard,
    ...overrides,
  });
  hosts.push(host);
  return {
    audit,
    host,
    runDir,
    settings,
    socketPath: path.join(runDir, "mcp.sock"),
    writeClipboard,
  };
};

const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
};

describe("createMcpServerHost", () => {
  afterEach(cleanUp);

  it("has no socket while agents are off", async () => {
    const { host, socketPath } = setup();
    await host.start();
    await expect(exists(socketPath)).resolves.toBeFalsy();
  });

  it("starts listening when turned on and stops when turned off", async () => {
    const { host, socketPath } = setup();
    const on = await host.saveSettings({ enabled: true });

    expect(on).toMatchObject({
      enabled: true,
      listening: true,
      socketPath,
      startError: null,
      tokenPreview: "conch_…9f3a",
    });
    expect(JSON.stringify(on)).not.toContain(TOKEN);
    await expect(exists(socketPath)).resolves.toBeTruthy();

    const off = await host.saveSettings({ enabled: false });
    expect(off.listening).toBeFalsy();
    await expect(exists(socketPath)).resolves.toBeFalsy();
  });

  it("forgets exposed connections that were deleted", async () => {
    const { host, settings } = setup();
    const shown = await host.getSettings();
    expect(shown.exposedConnectionIds).toStrictEqual(["c1"]);
    expect(settings.write).toHaveBeenCalledOnce();
    await host.getSettings();
    expect(settings.write).toHaveBeenCalledOnce();
  });

  it("validates updates", async () => {
    const { host } = setup();
    await expect(host.saveSettings({ rowLimit: 5 })).rejects.toThrow(
      "Too small"
    );
    await expect(
      host.saveSettings({ exposedConnectionIds: ["c2"], rowLimit: 250 })
    ).resolves.toMatchObject({ exposedConnectionIds: ["c2"], rowLimit: 250 });
  });

  it("rotates the token and drops connected clients", async () => {
    const { host, socketPath } = setup();
    await host.saveSettings({ enabled: true });
    const socket = connect(socketPath).resume();
    const closed = Promise.withResolvers<void>();
    socket.once("close", () => closed.resolve());
    socket.write(`${JSON.stringify({ conch: "hello", token: TOKEN, v: 1 })}\n`);
    await vi.waitFor(async () => {
      const shown = await host.getSettings();
      expect(shown.clients).toHaveLength(1);
    });

    const rotated = await host.rotateToken();
    expect(rotated.tokenPreview).not.toBe("conch_…9f3a");
    await closed.promise;
  });

  it("copies the client config in bun and returns nothing", async () => {
    const { host, writeClipboard, socketPath } = setup();
    await expect(host.copyClientConfig("json")).resolves.toBeUndefined();
    const copied = writeClipboard.mock.calls[0]?.[0] as string;
    expect(JSON.parse(copied)).toMatchObject({
      mcpServers: {
        conch: {
          args: [
            expect.stringContaining("mcp-bridge.js"),
            "--socket",
            socketPath,
          ],
          env: { CONCH_MCP_TOKEN: TOKEN },
        },
      },
    });
    await expect(host.copyClientConfig("telnet" as "json")).rejects.toThrow(
      "Invalid option"
    );
  });

  it("reports a start failure and retries on the next save", async () => {
    const { host, runDir } = setup();
    await fs.mkdir(runDir, { recursive: true });
    await fs.chmod(runDir, 0o755);
    const failed = await host.saveSettings({ enabled: true });
    expect(failed.listening).toBeFalsy();
    expect(failed.startError).toContain("private");

    await fs.chmod(runDir, 0o700);
    const retried = await host.saveSettings({ enabled: true });
    expect(retried).toMatchObject({ listening: true, startError: null });
  });

  it("does not start off macOS", async () => {
    const { host } = setup({ supported: false });
    const shown = await host.saveSettings({ enabled: true });
    expect(shown).toMatchObject({
      listening: false,
      startError: "Agents (MCP) works on macOS only for now.",
    });
  });

  it("lists and clears the audit log", async () => {
    const { audit, host } = setup();
    await host.listAudit();
    await host.listAudit({ limit: 5 });
    expect(audit.list.mock.calls).toStrictEqual([[200], [5]]);
    await expect(host.listAudit({ limit: 0 })).rejects.toThrow("Too small");
    await host.clearAudit();
    expect(audit.clear).toHaveBeenCalledOnce();
  });
});
