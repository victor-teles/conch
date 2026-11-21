// @vitest-environment node
import type { Socket } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { connect, createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ClientSession, ListenerDeps } from "./socket-listener.ts";

import { createSocketListener } from "./socket-listener.ts";
import { SocketTransport } from "./socket-transport.ts";

const TOKEN = "a".repeat(43);
const BRIDGE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "mcp-bridge",
  "main.ts"
);

const INITIALIZE = `${JSON.stringify({
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "claude-code", version: "2.1.0" },
    protocolVersion: "2025-06-18",
  },
})}\n`;

const throughBridge = (socketPath: string): Promise<string> => {
  const { promise, resolve } = Promise.withResolvers<string>();
  const child = spawn("bun", [BRIDGE, "--socket", socketPath, "--no-launch"], {
    env: { ...process.env, CONCH_MCP_TOKEN: TOKEN },
  });
  let stdout = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
    if (stdout.includes("\n")) {
      child.stdin.end();
    }
  });
  child.once("close", () => resolve(stdout));
  child.stdin.write(INITIALIZE);
  return promise;
};

function resolved<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

const modeOf = async (file: string): Promise<number> => {
  const stat = await fs.stat(file);
  return stat.mode % 0o1000;
};

const tempRoot = () => mkdtempSync(path.join(os.tmpdir(), "conch-mcp-"));

interface Fixture {
  listener: ReturnType<typeof createSocketListener>;
  runDir: string;
  socketPath: string;
  settings: { enabled: boolean; token: string };
}

const fixtures: Fixture[] = [];

const attachServer = async (socket: Socket, session: ClientSession) => {
  const server = new McpServer({ name: "conch", version: "test" });
  server.server.oninitialized = () => {
    const info = server.server.getClientVersion();
    session.info = {
      ...session.info,
      name: info?.name ?? "unknown",
      version: info?.version ?? "",
    };
  };
  await server.connect(new SocketTransport(socket));
  return { close: () => server.close() };
};

const setup = (overrides: Partial<ListenerDeps> = {}): Fixture => {
  const root = tempRoot();
  const runDir = path.join(root, "run");
  const socketPath = path.join(runDir, "mcp.sock");
  const settings = { enabled: true, token: TOKEN };
  const listener = createSocketListener({
    attach: attachServer,
    helloTimeoutMs: 300,
    now: () => new Date("2026-11-21T09:41:00.000Z"),
    readSettings: () => resolved(settings),
    runDir,
    socketPath,
    ...overrides,
  });
  const fixture = { listener, runDir, settings, socketPath };
  fixtures.push(fixture);
  return fixture;
};

const cleanUp = async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.listener.stop();
    await fs.rm(path.dirname(fixture.runDir), { force: true, recursive: true });
  }
};

const open = (socketPath: string): Promise<Socket> => {
  const { promise, resolve, reject } = Promise.withResolvers<Socket>();
  const socket = connect(socketPath);
  socket.once("connect", () => resolve(socket));
  socket.once("error", reject);
  return promise;
};

const listenElsewhere = async (socketPath: string) => {
  const other = createServer();
  const listening = Promise.withResolvers<void>();
  other.listen(socketPath, () => listening.resolve());
  await listening.promise;
  return {
    close: async () => {
      const closed = Promise.withResolvers<void>();
      other.close(() => closed.resolve());
      await closed.promise;
    },
  };
};

const firstReply = (socket: Socket): Promise<string> => {
  const { promise, resolve } = Promise.withResolvers<string>();
  socket.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
  return promise;
};

const exchange = async (
  socketPath: string,
  hello: string
): Promise<{ reply: string; closed: boolean }> => {
  const socket = await open(socketPath);
  const { promise, resolve } = Promise.withResolvers<{
    reply: string;
    closed: boolean;
  }>();
  let reply = "";
  socket.on("data", (chunk: Buffer) => {
    reply += chunk.toString("utf8");
  });
  socket.once("close", () => resolve({ closed: true, reply }));
  socket.write(hello);
  return await promise;
};

const helloLine = (token = TOKEN, v = 1) =>
  `${JSON.stringify({ conch: "hello", token, v })}\n`;

describe("socket listener", () => {
  afterEach(cleanUp);

  it("creates a private socket in a private directory", async () => {
    const { listener, runDir, socketPath } = setup();
    await listener.start();

    expect(listener.listening()).toBeTruthy();
    await expect(modeOf(runDir)).resolves.toBe(0o700);
    await expect(modeOf(socketPath)).resolves.toBe(0o600);
  });

  it("refuses to start in a directory others can read", async () => {
    const { listener, runDir } = setup();
    await fs.mkdir(runDir, { mode: 0o755, recursive: true });
    await fs.chmod(runDir, 0o755);

    await expect(listener.start()).rejects.toMatchObject({
      code: "MCP_DIR_UNSAFE",
    });
    expect(listener.listening()).toBeFalsy();
  });

  it("replaces a stale socket file", async () => {
    const { listener, runDir, socketPath } = setup();
    await fs.mkdir(runDir, { mode: 0o700, recursive: true });
    await fs.writeFile(socketPath, "");

    await listener.start();
    expect(listener.listening()).toBeTruthy();
  });

  it("leaves a socket another listener owns alone", async () => {
    const { listener, runDir, socketPath } = setup();
    await fs.mkdir(runDir, { mode: 0o700, recursive: true });
    const other = await listenElsewhere(socketPath);

    await expect(listener.start()).rejects.toMatchObject({
      code: "MCP_IN_USE",
    });
    await listener.stop();
    await expect(fs.stat(socketPath)).resolves.toBeTruthy();
    await other.close();
  });

  it("denies a wrong token and closes", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    await expect(
      exchange(socketPath, helloLine("b".repeat(43)))
    ).resolves.toStrictEqual({
      closed: true,
      reply: '{"conch":"denied","reason":"token"}\n',
    });
    await expect(
      exchange(socketPath, helloLine("short"))
    ).resolves.toMatchObject({
      reply: '{"conch":"denied","reason":"token"}\n',
    });
  });

  it("denies when agents are turned off", async () => {
    const { listener, settings, socketPath } = setup();
    await listener.start();
    settings.enabled = false;
    await expect(exchange(socketPath, helloLine())).resolves.toMatchObject({
      reply: '{"conch":"denied","reason":"disabled"}\n',
    });
  });

  it("denies another protocol version", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    await expect(
      exchange(socketPath, helloLine(TOKEN, 2))
    ).resolves.toMatchObject({
      reply: '{"conch":"denied","reason":"version"}\n',
    });
  });

  it.each([
    ["extra bytes after the hello", `${helloLine()}{"jsonrpc":"2.0"}\n`],
    ["a malformed hello", "not json\n"],
    ["an oversized hello", `${"x".repeat(2000)}`],
  ])("closes without a reply on %s", async (_label, hello) => {
    const { listener, socketPath } = setup();
    await listener.start();
    await expect(exchange(socketPath, hello)).resolves.toStrictEqual({
      closed: true,
      reply: "",
    });
  });

  it("closes a client that never says hello", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    await expect(exchange(socketPath, "")).resolves.toStrictEqual({
      closed: true,
      reply: "",
    });
  });

  it("speaks MCP after the handshake and tracks the client", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    const socket = await open(socketPath);
    const ok = firstReply(socket);
    socket.write(helloLine());
    await expect(ok).resolves.toBe('{"conch":"ok"}\n');

    const client = new Client({ name: "claude-code", version: "2.1.0" });
    await client.connect(new SocketTransport(socket));
    expect(client.getServerVersion()).toMatchObject({ name: "conch" });
    await expect
      .poll(() => listener.clients())
      .toStrictEqual([
        {
          connectedAt: "2026-11-21T09:41:00.000Z",
          name: "claude-code",
          version: "2.1.0",
        },
      ]);

    listener.closeClients();
    await expect.poll(() => listener.clients()).toStrictEqual([]);
  });

  it("serves a client through the stdio bridge", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    const reply = await throughBridge(socketPath);
    expect(JSON.parse(reply)).toMatchObject({
      id: 1,
      result: { serverInfo: { name: "conch", version: "test" } },
    });
  });

  it("turns clients away past the limit", async () => {
    const { listener, socketPath } = setup({ maxClients: 1 });
    await listener.start();
    const first = await open(socketPath);
    first.write(helloLine());
    await expect.poll(() => listener.clients()).toHaveLength(1);

    await expect(exchange(socketPath, helloLine())).resolves.toMatchObject({
      reply: '{"conch":"denied","reason":"busy"}\n',
    });
    first.destroy();
  });

  it("refuses a socket path macOS cannot bind", async () => {
    const { listener } = setup({
      socketPath: path.join(os.tmpdir(), "x".repeat(120), "mcp.sock"),
    });
    await expect(listener.start()).rejects.toMatchObject({
      code: "MCP_PATH_TOO_LONG",
    });
  });

  it("unlinks the socket on stop", async () => {
    const { listener, socketPath } = setup();
    await listener.start();
    await listener.stop();
    await expect(fs.stat(socketPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(listener.listening()).toBeFalsy();
  });
});
