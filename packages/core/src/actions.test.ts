import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-actions-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { resetCryptoCache, setLegacyKeyLoader } = await import("./crypto.ts");
const { createActionStore, createPermissionStore, permissionKey } =
  await import("./actions.ts");
const { actionsPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

interface Action {
  id: string;
  widgetId: string;
  label: string;
}

interface Permission {
  id: string;
  kind: string;
  targetId: string;
}

const parseAction = (raw: unknown): Action | null => {
  const value = raw as Partial<Action> | null;
  return typeof value?.id === "string" &&
    typeof value.widgetId === "string" &&
    typeof value.label === "string"
    ? (value as Action)
    : null;
};

const parsePermission = (raw: unknown): Permission | null => {
  const value = raw as Partial<Permission> | null;
  return typeof value?.kind === "string" ? (value as Permission) : null;
};

const permission = (kind: string, targetId: string): Permission => ({
  id: permissionKey(kind, targetId),
  kind,
  targetId,
});

describe("action store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("lists actions per widget and removes them with the widget", async () => {
    const store = createActionStore(parseAction);
    await store.save({ id: "a1", label: "Refund", widgetId: "w1" });
    await store.save({ id: "a2", label: "Open", widgetId: "w1" });
    await store.save({ id: "a3", label: "Ship", widgetId: "w2" });

    const listed = await store.listForWidget("w1");
    expect(listed.map((a) => a.id)).toStrictEqual(["a1", "a2"]);
    await store.removeForWidget("w1");
    await expect(store.listForWidget("w1")).resolves.toStrictEqual([]);
    await expect(store.get("a3")).resolves.toMatchObject({ label: "Ship" });
  });

  it("encrypts the file at rest", async () => {
    const store = createActionStore(parseAction);
    await store.save({ id: "a1", label: "Refund charge", widgetId: "w1" });
    const raw = await fs.readFile(actionsPath(), "utf8");
    expect(raw).not.toContain("Refund");
  });

  it("removes one action", async () => {
    const store = createActionStore(parseAction);
    await store.save({ id: "a1", label: "Refund", widgetId: "w1" });
    await store.remove("a1");
    await expect(store.get("a1")).resolves.toBeNull();
  });
});

describe("permission store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  it("defaults to not allowed", async () => {
    const store = createPermissionStore(parsePermission);
    await expect(store.isAllowed("connection", "c1")).resolves.toBeFalsy();
  });

  it("allows, revokes and prunes permissions", async () => {
    const store = createPermissionStore(parsePermission);
    await store.save(permission("connection", "c1"));
    await store.save(permission("connection", "c2"));
    await store.save(permission("mcp", "s1"));
    await expect(store.isAllowed("connection", "c1")).resolves.toBeTruthy();
    await expect(store.isAllowed("mcp", "c1")).resolves.toBeFalsy();

    await store.remove("connection", "c1");
    await expect(store.isAllowed("connection", "c1")).resolves.toBeFalsy();

    await store.removeWhere((record) => record.kind === "connection");
    const kept = await store.list();
    expect(kept.map((record) => record.id)).toStrictEqual(["mcp:s1"]);
  });
});
