// @vitest-environment node
import type { Socket } from "node:net";

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { appBundleOf, BRIDGE_MESSAGES, parseArgs } from "./main.ts";

const BRIDGE = path.join(import.meta.dirname, "main.ts");
const TOKEN = "k".repeat(43);

type Answer = "ok" | "disabled" | "token";

const answerHello = (socket: Socket, answer: Answer, line: string): void => {
  const hello = JSON.parse(line) as { token?: string };
  if (answer === "ok" && hello.token === TOKEN) {
    socket.write('{"conch":"ok"}\n');
    return;
  }
  const reason = answer === "ok" ? "token" : answer;
  socket.end(`${JSON.stringify({ conch: "denied", reason })}\n`);
};

const echoRequests = (socket: Socket, lines: string[]): void => {
  for (const line of lines) {
    const { id } = JSON.parse(line) as { id: number };
    socket.write(
      `${JSON.stringify({ id, jsonrpc: "2.0", result: { serverInfo: { name: "conch" } } })}\n`
    );
  }
};

const fakeApp = (socket: Socket, answer: Answer): void => {
  let buffered = "";
  let greeted = false;
  socket.on("data", (chunk: Buffer) => {
    buffered += chunk.toString("utf8");
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    const [first, ...rest] = lines;
    const requests = greeted ? lines : rest;
    if (!greeted && first !== undefined) {
      greeted = true;
      answerHello(socket, answer, first);
    }
    echoRequests(socket, requests);
  });
};

const listen = async (answer: Answer = "ok") => {
  const root = mkdtempSync(path.join(os.tmpdir(), "conch-bridge-"));
  const socketPath = path.join(root, "mcp.sock");
  const server = createServer((socket) => fakeApp(socket, answer));
  const listening = Promise.withResolvers<void>();
  server.listen(socketPath, () => listening.resolve());
  await listening.promise;
  return {
    [Symbol.asyncDispose]: async () => {
      const closed = Promise.withResolvers<void>();
      server.close(() => closed.resolve());
      await closed.promise;
      await fs.rm(root, { force: true, recursive: true });
    },
    socketPath,
  };
};

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

const envWith = (token: string | null): NodeJS.ProcessEnv => {
  const { CONCH_MCP_TOKEN: _unused, ...env } = process.env;
  return token === null ? env : { ...env, CONCH_MCP_TOKEN: token };
};

const runBridge = (
  args: string[],
  { token = TOKEN, input = "" }: { token?: string | null; input?: string } = {}
): Promise<Run> => {
  const { promise, resolve } = Promise.withResolvers<Run>();
  const child = spawn("bun", [BRIDGE, ...args], { env: envWith(token) });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
    if (stdout.includes("\n")) {
      child.stdin.end();
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  child.once("close", (code) => resolve({ code, stderr, stdout }));
  child.stdin.write(input);
  if (!input) {
    child.stdin.end();
  }
  return promise;
};

const INITIALIZE = `${JSON.stringify({
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
    protocolVersion: "2025-06-18",
  },
})}\n`;

describe("bridge", () => {
  it("pipes MCP between stdio and the app", async () => {
    await using app = await listen();
    const run = await runBridge(["--socket", app.socketPath, "--no-launch"], {
      input: INITIALIZE,
    });

    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    const lines = run.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(run.stdout)).toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: { serverInfo: { name: "conch" } },
    });
  });

  it("says the app is not running when the socket is missing", async () => {
    const run = await runBridge([
      "--socket",
      path.join(os.tmpdir(), "conch-missing.sock"),
      "--no-launch",
    ]);
    expect(run).toStrictEqual({
      code: 1,
      stderr: `${BRIDGE_MESSAGES.notRunning}\n`,
      stdout: "",
    });
  });

  it("asks for the config again after a rotation", async () => {
    await using app = await listen();
    const run = await runBridge(["--socket", app.socketPath, "--no-launch"], {
      token: "z".repeat(43),
    });
    expect(run).toStrictEqual({
      code: 1,
      stderr: `${BRIDGE_MESSAGES.token}\n`,
      stdout: "",
    });
  });

  it("asks to turn agents on when they are off", async () => {
    await using app = await listen("disabled");
    const run = await runBridge(["--socket", app.socketPath, "--no-launch"]);
    expect(run.stderr).toBe(`${BRIDGE_MESSAGES.disabled}\n`);
    expect(run.code).toBe(1);
  });

  it("needs a token and a socket", async () => {
    const noToken = await runBridge(["--socket", "/tmp/x.sock"], {
      token: null,
    });
    const noSocket = await runBridge([]);
    expect(noToken.stderr).toBe(`${BRIDGE_MESSAGES.noToken}\n`);
    expect(noSocket.stderr).toBe(`${BRIDGE_MESSAGES.noSocket}\n`);
  });
});

describe("parseArgs", () => {
  it("reads the socket and the launch flag", () => {
    expect(parseArgs(["--socket", "/s.sock"])).toStrictEqual({
      launch: true,
      socket: "/s.sock",
    });
    expect(parseArgs(["--no-launch", "--socket"])).toStrictEqual({
      launch: false,
      socket: null,
    });
  });
});

describe("appBundleOf", () => {
  it("finds the enclosing .app", () => {
    expect(
      appBundleOf(
        "/Applications/Conch.app/Contents/Resources/app/bun/mcp-bridge.js"
      )
    ).toBe("/Applications/Conch.app");
    expect(appBundleOf("/repo/src/mcp-bridge/main.ts")).toBeNull();
  });
});
