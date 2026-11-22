import type {
  McpServerConfig,
  WritePermission,
  WriteTargetKind,
} from "@conch/rpc";

import { DbError } from "@conch/core";
import {
  canonicalJson,
  SetWriteActionsRequest,
  writePermissionId,
} from "@conch/rpc";

import type { ConfirmNative } from "./native-confirm.ts";

export interface PermissionStore {
  isAllowed(kind: string, targetId: string): Promise<boolean>;
  list(): Promise<WritePermission[]>;
  save(record: WritePermission): Promise<WritePermission>;
  remove(kind: string, targetId: string): Promise<void>;
  removeWhere(matches: (record: WritePermission) => boolean): Promise<void>;
}

// What makes a target the same target: the fields a renderer edit could
// repoint. A permission stays valid only while these hash the same.
export interface WriteTargetInfo {
  name: string;
  identity: unknown;
}

export interface WritePermissionsDeps {
  store: PermissionStore;
  confirm: ConfirmNative;
  describe(kind: WriteTargetKind, id: string): Promise<WriteTargetInfo | null>;
  sha256(text: string): string;
  now(): Date;
}

export const connectionIdentity = (connection: {
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  authSource?: string | null;
}) => ({
  authSource: connection.authSource ?? null,
  database: connection.database,
  host: connection.host,
  port: connection.port,
  type: connection.type,
  username: connection.username,
});

export const endpointIdentity = (endpoint: { baseUrl: string }) => {
  const url = new URL(endpoint.baseUrl);
  return { origin: url.origin, path: url.pathname };
};

// Secret values may rotate without a new grant; the names that a server is
// given (env keys, header names) are part of what it is.
export const serverIdentity = (server: McpServerConfig) =>
  server.transport === "stdio"
    ? {
        args: server.args,
        command: server.command,
        env: Object.keys(server.env).toSorted(),
        transport: "stdio",
      }
    : {
        headers: Object.keys(server.headers).toSorted(),
        transport: "http",
        url: server.url,
      };

const NOUNS: Record<WriteTargetKind, string> = {
  connection: "connection",
  http: "endpoint",
  mcp: "server",
};

export const allowWritesPrompt = (kind: WriteTargetKind, name: string) => ({
  confirmLabel: "Allow Write Actions",
  detail: `Saved actions will be able to change data on this ${NOUNS[kind]}. Every write still asks you first.`,
  message: `Allow write actions on ${name}?`,
  title: "Allow write actions",
});

// Turning writes on always needs a native dialog a webview can't click;
// turning them off never does, and applies to tokens already issued.
export const createWritePermissions = (deps: WritePermissionsDeps) => {
  const fingerprintOf = (target: WriteTargetInfo): string =>
    deps.sha256(canonicalJson(target.identity));

  // A target repointed since writes were allowed (another host, database,
  // origin or launch line) is no longer permitted, and the grant is dropped.
  const isAllowed = async (
    kind: WriteTargetKind,
    id: string
  ): Promise<boolean> => {
    const records = await deps.store.list();
    const record = records.find(
      (item) => item.kind === kind && item.targetId === id
    );
    if (!record) {
      return false;
    }
    const target = await deps.describe(kind, id);
    if (target && fingerprintOf(target) === record.fingerprint) {
      return true;
    }
    await deps.store.remove(kind, id);
    return false;
  };

  return {
    forget: (kind: WriteTargetKind, id: string): Promise<void> =>
      deps.store.remove(kind, id),

    isAllowed,

    keepConnections: (ids: readonly string[]): Promise<void> => {
      const kept = new Set(ids);
      return deps.store.removeWhere(
        (record) => record.kind === "connection" && !kept.has(record.targetId)
      );
    },

    // Lists only grants that still hold, so the switch never shows On for a
    // target that has since been repointed.
    async list(): Promise<{ kind: WriteTargetKind; id: string }[]> {
      const records = await deps.store.list();
      const checks = await Promise.all(
        records.map(async (record) =>
          (await isAllowed(record.kind, record.targetId))
            ? [{ id: record.targetId, kind: record.kind }]
            : []
        )
      );
      return checks.flat();
    },

    async setAllowed(request: unknown): Promise<{ allowed: boolean }> {
      const { allowed, id, kind } = SetWriteActionsRequest.parse(request);
      if (!allowed) {
        await deps.store.remove(kind, id);
        return { allowed: false };
      }
      const target = await deps.describe(kind, id);
      if (!target) {
        throw new DbError("TARGET_MISSING", "This source no longer exists.");
      }
      const fingerprint = fingerprintOf(target);
      const records = await deps.store.list();
      const current = records.find(
        (item) => item.kind === kind && item.targetId === id
      );
      if (current?.fingerprint === fingerprint) {
        return { allowed: true };
      }
      if (!(await deps.confirm(allowWritesPrompt(kind, target.name)))) {
        return { allowed: false };
      }
      await deps.store.save({
        allowedAt: deps.now().toISOString(),
        fingerprint,
        id: writePermissionId(kind, id),
        kind,
        targetId: id,
      });
      return { allowed: true };
    },
  };
};

export type WritePermissions = ReturnType<typeof createWritePermissions>;
