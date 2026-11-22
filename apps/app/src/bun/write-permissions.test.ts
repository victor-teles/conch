import type { WritePermission } from "@conch/rpc";

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { PermissionStore } from "./write-permissions.ts";

import {
  connectionIdentity,
  createWritePermissions,
  endpointIdentity,
  serverIdentity,
} from "./write-permissions.ts";

const resolved = <T>(value: T): Promise<T> => {
  const settled = value;
  return Promise.resolve(settled);
};

const memoryStore = (): PermissionStore & { records: WritePermission[] } => {
  const records: WritePermission[] = [];
  return {
    isAllowed: (kind, id) =>
      resolved(
        records.some((record) => record.kind === kind && record.targetId === id)
      ),
    list: () => resolved([...records]),
    records,
    remove: (kind, id) => {
      const index = records.findIndex(
        (record) => record.kind === kind && record.targetId === id
      );
      if (index !== -1) {
        records.splice(index, 1);
      }
      return Promise.resolve();
    },
    removeWhere: (matches) => {
      for (const record of records.filter(matches)) {
        records.splice(records.indexOf(record), 1);
      }
      return Promise.resolve();
    },
    save: (record) => {
      records.push(record);
      return resolved(record);
    },
  };
};

const setup = (answer: boolean) => {
  const store = memoryStore();
  const confirm = vi.fn(() => resolved(answer));
  const target = {
    connection: connectionIdentity({
      database: "shop",
      host: "db.internal",
      port: 5432,
      type: "postgresql",
      username: "conch",
    }),
  };
  const permissions = createWritePermissions({
    confirm,
    describe: (_kind, id) =>
      resolved(
        id === "gone"
          ? null
          : { identity: target.connection, name: "analytics-prod" }
      ),
    now: () => new Date("2026-11-21T10:00:00Z"),
    sha256: (text) => createHash("sha256").update(text).digest("hex"),
    store,
  });
  return { confirm, permissions, store, target };
};

describe("write permissions", () => {
  it("defaults to off", async () => {
    const { permissions } = setup(true);
    await expect(
      permissions.isAllowed("connection", "c1")
    ).resolves.toBeFalsy();
  });

  it("asks natively before enabling, with Cancel as the default", async () => {
    const { confirm, permissions } = setup(true);
    await expect(
      permissions.setAllowed({ allowed: true, id: "c1", kind: "connection" })
    ).resolves.toStrictEqual({ allowed: true });
    expect(confirm).toHaveBeenCalledWith({
      confirmLabel: "Allow Write Actions",
      detail:
        "Saved actions will be able to change data on this connection. Every write still asks you first.",
      message: "Allow write actions on analytics-prod?",
      title: "Allow write actions",
    });
    await expect(
      permissions.isAllowed("connection", "c1")
    ).resolves.toBeTruthy();
  });

  it("changes nothing when the dialog is declined", async () => {
    const { permissions, store } = setup(false);
    await expect(
      permissions.setAllowed({ allowed: true, id: "s1", kind: "mcp" })
    ).resolves.toStrictEqual({ allowed: false });
    expect(store.records).toStrictEqual([]);
  });

  it("disables without asking", async () => {
    const { confirm, permissions } = setup(true);
    await permissions.setAllowed({
      allowed: true,
      id: "c1",
      kind: "connection",
    });
    confirm.mockClear();
    await expect(
      permissions.setAllowed({ allowed: false, id: "c1", kind: "connection" })
    ).resolves.toStrictEqual({ allowed: false });
    expect(confirm).not.toHaveBeenCalled();
    await expect(
      permissions.isAllowed("connection", "c1")
    ).resolves.toBeFalsy();
  });

  it("refuses a target that no longer exists", async () => {
    const { permissions } = setup(true);
    await expect(
      permissions.setAllowed({ allowed: true, id: "gone", kind: "http" })
    ).rejects.toMatchObject({ code: "TARGET_MISSING" });
  });

  it("drops permissions for deleted connections and forgotten sources", async () => {
    const { permissions } = setup(true);
    await permissions.setAllowed({
      allowed: true,
      id: "c1",
      kind: "connection",
    });
    await permissions.setAllowed({
      allowed: true,
      id: "c2",
      kind: "connection",
    });
    await permissions.setAllowed({ allowed: true, id: "s1", kind: "mcp" });
    await permissions.keepConnections(["c2"]);
    await permissions.forget("mcp", "s1");
    await expect(permissions.list()).resolves.toStrictEqual([
      { id: "c2", kind: "connection" },
    ]);
  });

  it("rejects a malformed request", async () => {
    const { permissions } = setup(true);
    await expect(
      permissions.setAllowed({ allowed: true, id: "c1", kind: "root" })
    ).rejects.toBeDefined();
  });

  it("lists a repointed target as off", async () => {
    const { permissions, target } = setup(true);
    await permissions.setAllowed({
      allowed: true,
      id: "c1",
      kind: "connection",
    });
    await expect(permissions.list()).resolves.toStrictEqual([
      { id: "c1", kind: "connection" },
    ]);
    target.connection = { ...target.connection, database: "other" };
    await expect(permissions.list()).resolves.toStrictEqual([]);
  });

  it("drops a grant when the connection is repointed to another server", async () => {
    const { confirm, permissions, store, target } = setup(true);
    await permissions.setAllowed({
      allowed: true,
      id: "c1",
      kind: "connection",
    });
    confirm.mockClear();
    target.connection = { ...target.connection, host: "prod-db.example.com" };
    await expect(
      permissions.isAllowed("connection", "c1")
    ).resolves.toBeFalsy();
    expect(store.records).toStrictEqual([]);
    await expect(permissions.list()).resolves.toStrictEqual([]);
    await permissions.setAllowed({
      allowed: true,
      id: "c1",
      kind: "connection",
    });
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("fingerprints endpoints by origin and path, servers by launch line", () => {
    expect(
      endpointIdentity({ baseUrl: "https://api.example.com/v1?x=1" })
    ).toStrictEqual({ origin: "https://api.example.com", path: "/v1" });
    expect(
      serverIdentity({
        args: ["--live"],
        command: "/usr/bin/stripe-mcp",
        createdAt: "",
        env: { KEY: "secret" },
        id: "s",
        name: "Stripe",
        readTools: [],
        transport: "stdio",
        updatedAt: "",
      })
    ).toStrictEqual({
      args: ["--live"],
      command: "/usr/bin/stripe-mcp",
      env: ["KEY"],
      transport: "stdio",
    });
  });
});
