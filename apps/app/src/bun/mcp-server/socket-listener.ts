import type { McpClientInfo } from "@conch/rpc";
import type { Server, Socket } from "node:net";

import { timingSafeEqual } from "node:crypto";
import { unlinkSync } from "node:fs";
import fs from "node:fs/promises";
import { connect, createServer } from "node:net";
import { z } from "zod";

export const HANDSHAKE_VERSION = 1;
export const MAX_CLIENTS = 8;
export const HELLO_TIMEOUT_MS = 5000;
const MAX_HELLO_BYTES = 1024;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_SOCKET_MODE = 0o600;
const GROUP_OTHER_BITS = 0o077;
// macOS sockaddr_un.sun_path holds 104 bytes including the terminator.
const MAX_SOCKET_PATH_BYTES = 103;

const Hello = z.object({
  conch: z.literal("hello"),
  token: z.string().max(200),
  v: z.number().int(),
});

export type DenyReason = "disabled" | "token" | "busy" | "version";

export class McpStartError extends Error {
  readonly code: "MCP_DIR_UNSAFE" | "MCP_IN_USE" | "MCP_PATH_TOO_LONG";

  constructor(code: McpStartError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface ClientSession {
  info: McpClientInfo;
}

export interface AttachedClient {
  close(): Promise<void>;
}

type Admission =
  | { kind: "ok" }
  | { kind: "deny"; reason: DenyReason }
  | { kind: "invalid" };

interface Session extends ClientSession {
  close: AttachedClient["close"] | null;
}

export interface ListenerDeps {
  runDir: string;
  socketPath: string;
  readSettings(): Promise<{ enabled: boolean; token: string }>;
  attach(socket: Socket, session: ClientSession): Promise<AttachedClient>;
  now(): Date;
  maxClients?: number;
  helloTimeoutMs?: number;
  onClientsChanged?(): void;
}

const tokensMatch = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const reply = (socket: Socket, body: object): void => {
  socket.write(`${JSON.stringify(body)}\n`);
};

const deny = (socket: Socket, reason: DenyReason): void => {
  socket.end(`${JSON.stringify({ conch: "denied", reason })}\n`);
};

const ensurePrivateDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { mode: PRIVATE_DIR_MODE, recursive: true });
  const stat = await fs.stat(dir);
  const owned = process.getuid ? stat.uid === process.getuid() : false;
  // oxlint-disable-next-line no-bitwise -- permission bits are a bitmask
  const shared = (stat.mode & GROUP_OTHER_BITS) !== 0;
  if (!owned || shared) {
    throw new McpStartError(
      "MCP_DIR_UNSAFE",
      `${dir} must belong to you and be private (chmod 700).`
    );
  }
};

const socketAnswers = (socketPath: string): Promise<boolean> => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const probe = connect(socketPath);
  probe.once("connect", () => {
    probe.destroy();
    resolve(true);
  });
  probe.once("error", () => resolve(false));
  return promise;
};

const clearStaleSocket = async (socketPath: string): Promise<void> => {
  try {
    await fs.lstat(socketPath);
  } catch {
    return;
  }
  if (await socketAnswers(socketPath)) {
    throw new McpStartError(
      "MCP_IN_USE",
      "Another copy of Conch is already serving agents."
    );
  }
  await fs.unlink(socketPath);
};

const parseHelloLine = (buffered: Buffer): unknown => {
  const newline = buffered.indexOf("\n");
  if (newline !== buffered.length - 1 || newline > MAX_HELLO_BYTES) {
    return null;
  }
  try {
    return JSON.parse(buffered.subarray(0, newline).toString("utf8"));
  } catch {
    return null;
  }
};

const readHello = (socket: Socket, timeoutMs: number): Promise<unknown> => {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  let buffered = Buffer.alloc(0);
  const finish = (value: unknown) => {
    clearTimeout(timer);
    socket.pause();
    socket.off("data", onData);
    socket.off("close", onClose);
    resolve(value);
  };
  const onData = (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    if (buffered.includes("\n")) {
      finish(parseHelloLine(buffered));
    } else if (buffered.length > MAX_HELLO_BYTES) {
      finish(null);
    }
  };
  const onClose = () => finish(null);
  const timer = setTimeout(() => finish(null), timeoutMs);
  socket.on("data", onData);
  socket.once("close", onClose);
  return promise;
};

const listenOn = (server: Server, socketPath: string): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.once("error", reject);
  server.listen(socketPath, () => {
    server.off("error", reject);
    resolve();
  });
  return promise;
};

const closeServer = (server: Server): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  server.close(() => resolve());
  return promise;
};

const closeQuietly = async (session: Session): Promise<void> => {
  try {
    await session.close?.();
  } catch {
    // the socket is destroyed right after; nothing is left to clean up
  }
};

export const createSocketListener = (deps: ListenerDeps) => {
  const maxClients = deps.maxClients ?? MAX_CLIENTS;
  const sessions = new Map<Socket, Session>();
  let server: Server | null = null;

  const changed = () => deps.onClientsChanged?.();

  const admit = async (socket: Socket): Promise<Admission> => {
    const parsed = Hello.safeParse(
      await readHello(socket, deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS)
    );
    if (!parsed.success) {
      return { kind: "invalid" };
    }
    if (parsed.data.v !== HANDSHAKE_VERSION) {
      return { kind: "deny", reason: "version" };
    }
    const settings = await deps.readSettings();
    if (!settings.enabled) {
      return { kind: "deny", reason: "disabled" };
    }
    if (!tokensMatch(parsed.data.token, settings.token)) {
      return { kind: "deny", reason: "token" };
    }
    return sessions.size >= maxClients
      ? { kind: "deny", reason: "busy" }
      : { kind: "ok" };
  };

  const accept = async (socket: Socket): Promise<void> => {
    const session: Session = {
      close: null,
      info: {
        connectedAt: deps.now().toISOString(),
        name: "unknown",
        version: "",
      },
    };
    sessions.set(socket, session);
    socket.once("close", () => {
      sessions.delete(socket);
      changed();
    });
    reply(socket, { conch: "ok" });
    const attached = await deps.attach(socket, session);
    session.close = attached.close;
    changed();
  };

  const handle = async (socket: Socket): Promise<void> => {
    socket.on("error", () => socket.destroy());
    const admission = await admit(socket);
    if (socket.destroyed) {
      return;
    }
    switch (admission.kind) {
      case "ok": {
        await accept(socket);
        return;
      }
      case "deny": {
        deny(socket, admission.reason);
        return;
      }
      default: {
        socket.destroy();
      }
    }
  };

  const serve = async (socket: Socket): Promise<void> => {
    try {
      await handle(socket);
    } catch {
      socket.destroy();
    }
  };

  const closeClients = (): void => {
    for (const [socket, session] of sessions) {
      closeQuietly(session);
      socket.destroy();
    }
  };

  return {
    clients: (): McpClientInfo[] =>
      [...sessions.values()].map((session) => ({ ...session.info })),

    closeClients,

    listening: (): boolean => server?.listening ?? false,

    async start(): Promise<void> {
      if (server) {
        return;
      }
      if (Buffer.byteLength(deps.socketPath) > MAX_SOCKET_PATH_BYTES) {
        throw new McpStartError(
          "MCP_PATH_TOO_LONG",
          `The socket path ${deps.socketPath} is too long for macOS.`
        );
      }
      await ensurePrivateDir(deps.runDir);
      await clearStaleSocket(deps.socketPath);
      const next = createServer(serve);
      await listenOn(next, deps.socketPath);
      await fs.chmod(deps.socketPath, PRIVATE_SOCKET_MODE);
      server = next;
    },

    async stop(): Promise<void> {
      const current = server;
      server = null;
      closeClients();
      if (!current) {
        return;
      }
      const closed = closeServer(current);
      try {
        unlinkSync(deps.socketPath);
      } catch {
        // already gone
      }
      await closed;
    },
  };
};

export type SocketListener = ReturnType<typeof createSocketListener>;
