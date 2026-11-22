import type { Socket } from "node:net";

import { spawn } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";

export const TOKEN_ENV = "CONCH_MCP_TOKEN";
const HELLO_TIMEOUT_MS = 5000;
const LAUNCH_WAIT_MS = 10_000;
const RETRY_MS = 250;

export const BRIDGE_MESSAGES = {
  busy: "Too many agents are connected to Conch. Close one and try again.",
  disabled: "Turn on Agents (MCP) in Conch Settings.",
  noSocket: "Pass --socket <path>. Copy the client config from Conch Settings.",
  noToken: `Set ${TOKEN_ENV}. Copy the client config from Conch Settings.`,
  notRunning: "Conch is not running.",
  protocol: "Conch closed the connection.",
  token:
    "The token was rotated. Copy the client config again from Conch Settings.",
  version:
    "This bridge does not match the running Conch. Copy the client config again from Conch Settings.",
} as const;

type Failure = keyof typeof BRIDGE_MESSAGES;

export interface BridgeArgs {
  socket: string | null;
  launch: boolean;
}

export const parseArgs = (argv: readonly string[]): BridgeArgs => {
  const at = argv.indexOf("--socket");
  return {
    launch: !argv.includes("--no-launch"),
    socket: at === -1 ? null : (argv[at + 1] ?? null),
  };
};

export const appBundleOf = (scriptPath: string): string | null => {
  let dir = path.dirname(scriptPath);
  while (dir !== path.dirname(dir)) {
    if (dir.endsWith(".app")) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
};

const connectOnce = (socketPath: string): Promise<Socket | null> => {
  const { promise, resolve } = Promise.withResolvers<Socket | null>();
  const socket = connect(socketPath);
  socket.once("connect", () => resolve(socket));
  socket.once("error", () => resolve(null));
  return promise;
};

const sleep = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

const connectWithLaunch = async (args: BridgeArgs, socketPath: string) => {
  const first = await connectOnce(socketPath);
  const app = appBundleOf(process.argv[1] ?? "");
  if (first || !args.launch || !app) {
    return first;
  }
  spawn("open", ["-g", app], { detached: true, stdio: "ignore" }).unref();
  const deadline = Date.now() + LAUNCH_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(RETRY_MS);
    const socket = await connectOnce(socketPath);
    if (socket) {
      return socket;
    }
  }
  return null;
};

const REASONS = new Set<string>(["disabled", "token", "busy", "version"]);

const verdictOf = (line: string): "ok" | Failure => {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null) {
      return "protocol";
    }
    const { conch, reason } = parsed as { conch?: unknown; reason?: unknown };
    if (conch === "ok") {
      return "ok";
    }
    return conch === "denied" &&
      typeof reason === "string" &&
      REASONS.has(reason)
      ? (reason as Failure)
      : "protocol";
  } catch {
    return "protocol";
  }
};

export interface HandshakeResult {
  verdict: "ok" | Failure;
  rest: Buffer;
}

export const handshake = (
  socket: Socket,
  token: string
): Promise<HandshakeResult> => {
  const { promise, resolve } = Promise.withResolvers<HandshakeResult>();
  let buffered = Buffer.alloc(0);
  const finish = (verdict: "ok" | Failure, rest = Buffer.alloc(0)) => {
    clearTimeout(timer);
    socket.off("data", onData);
    socket.off("close", onClose);
    socket.pause();
    resolve({ rest, verdict });
  };
  const onData = (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    const newline = buffered.indexOf("\n");
    if (newline !== -1) {
      finish(
        verdictOf(buffered.subarray(0, newline).toString("utf8")),
        buffered.subarray(newline + 1)
      );
    }
  };
  const onClose = () => finish("protocol");
  const timer = setTimeout(() => finish("protocol"), HELLO_TIMEOUT_MS);
  socket.on("data", onData);
  socket.once("close", onClose);
  socket.write(`${JSON.stringify({ conch: "hello", token, v: 1 })}\n`);
  return promise;
};

const fail = (failure: Failure): never => {
  process.stderr.write(`${BRIDGE_MESSAGES[failure]}\n`);
  process.exit(1);
};

const pipe = (socket: Socket, rest: Buffer): void => {
  if (rest.length > 0) {
    process.stdout.write(rest);
  }
  socket.pipe(process.stdout);
  process.stdin.pipe(socket);
  socket.resume();
  socket.once("close", () => process.exit(0));
  socket.on("error", () => process.exit(1));
  process.stdin.once("end", () => socket.end());
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env[TOKEN_ENV];
  if (!args.socket) {
    fail("noSocket");
    return;
  }
  if (!token) {
    fail("noToken");
    return;
  }
  const socket = await connectWithLaunch(args, args.socket);
  if (!socket) {
    fail("notRunning");
    return;
  }
  const { verdict, rest } = await handshake(socket, token);
  if (verdict !== "ok") {
    socket.destroy();
    fail(verdict);
    return;
  }
  pipe(socket, rest);
};

if (import.meta.main) {
  await main();
}
