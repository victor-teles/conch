import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredMcpSettings } from "./mcp-store.ts";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-mcp-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { resetCryptoCache, setLegacyKeyLoader } = await import("./crypto.ts");
const {
  appendMcpAudit,
  clearMcpAudit,
  listMcpAudit,
  MCP_AUDIT_KEEP,
  MCP_AUDIT_TRIM_AT,
  newMcpToken,
  readMcpSettings,
  writeMcpSettings,
} = await import("./mcp-store.ts");
const { mcpAuditPath, mcpSettingsPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const parseSettings = (raw: unknown): StoredMcpSettings | null => {
  const value = raw as Partial<StoredMcpSettings> | null;
  return value?.version === 1 && typeof value.token === "string"
    ? (value as StoredMcpSettings)
    : null;
};

interface Entry {
  id: string;
}

const parseEntry = (raw: unknown): Entry | null => {
  const value = raw as Partial<Entry> | null;
  return typeof value?.id === "string" ? { id: value.id } : null;
};

const reset = async () => {
  resetCryptoCache();
  setLegacyKeyLoader(noLegacyKey);
  await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
};

describe("mcp settings store", () => {
  beforeEach(reset);
  afterAll(() => fs.rm(TMP_HOME, { force: true, recursive: true }));

  it("creates disabled settings with a fresh token on first read", async () => {
    const settings = await readMcpSettings(parseSettings);

    expect(settings).toMatchObject({
      enabled: false,
      exposedConnectionIds: [],
      rowLimit: 100,
      version: 1,
    });
    expect(settings.token).toMatch(TOKEN_RE);
    await expect(readMcpSettings(parseSettings)).resolves.toStrictEqual(
      settings
    );
  });

  it("round-trips encrypted without the token in the file", async () => {
    const token = newMcpToken();
    const settings: StoredMcpSettings = {
      enabled: true,
      exposedConnectionIds: ["c1"],
      rowLimit: 250,
      token,
      version: 1,
    };
    await writeMcpSettings(settings);

    const raw = await fs.readFile(mcpSettingsPath(), "utf8");
    expect(raw).not.toContain(token);
    expect(raw).not.toContain("exposedConnectionIds");
    await expect(readMcpSettings(parseSettings)).resolves.toStrictEqual(
      settings
    );
  });

  it("falls back to fresh disabled settings when the file is unreadable", async () => {
    await fs.mkdir(path.dirname(mcpSettingsPath()), { recursive: true });
    await fs.writeFile(mcpSettingsPath(), "garbage");

    const settings = await readMcpSettings(parseSettings);

    expect(settings.enabled).toBeFalsy();
    expect(settings.token).toMatch(TOKEN_RE);
  });

  it("makes a different token every time", () => {
    expect(newMcpToken()).not.toBe(newMcpToken());
  });
});

describe("mcp audit log", () => {
  beforeEach(reset);

  it("lists newest first and honours the limit", async () => {
    await appendMcpAudit({ id: "a" });
    await appendMcpAudit({ id: "b" });
    await appendMcpAudit({ id: "c" });

    await expect(listMcpAudit(10, parseEntry)).resolves.toStrictEqual([
      { id: "c" },
      { id: "b" },
      { id: "a" },
    ]);
    await expect(listMcpAudit(1, parseEntry)).resolves.toStrictEqual([
      { id: "c" },
    ]);
    const raw = await fs.readFile(mcpAuditPath(), "utf8");
    expect(raw).not.toContain('"id"');
  });

  it("returns nothing before the first entry", async () => {
    await expect(listMcpAudit(10, parseEntry)).resolves.toStrictEqual([]);
  });

  it("skips corrupt lines and entries the parser rejects", async () => {
    await appendMcpAudit({ id: "a" });
    await fs.appendFile(mcpAuditPath(), "not-a-line\n");
    await appendMcpAudit({ other: true });
    await appendMcpAudit({ id: "b" });

    await expect(listMcpAudit(10, parseEntry)).resolves.toStrictEqual([
      { id: "b" },
      { id: "a" },
    ]);
  });

  it("trims to the newest entries once it passes the limit", async () => {
    const lines = Array.from({ length: MCP_AUDIT_TRIM_AT }, () => "x");
    await fs.mkdir(path.dirname(mcpAuditPath()), { recursive: true });
    await fs.writeFile(mcpAuditPath(), `${lines.join("\n")}\n`);
    await appendMcpAudit({ id: "newest" });

    const raw = await fs.readFile(mcpAuditPath(), "utf8");
    const kept = raw.split("\n").filter(Boolean);
    expect(kept).toHaveLength(MCP_AUDIT_KEEP);
    await expect(listMcpAudit(1, parseEntry)).resolves.toStrictEqual([
      { id: "newest" },
    ]);
  });

  it("clears the log", async () => {
    await appendMcpAudit({ id: "a" });
    await clearMcpAudit();
    await expect(listMcpAudit(10, parseEntry)).resolves.toStrictEqual([]);
    await expect(clearMcpAudit()).resolves.toBeUndefined();
  });
});
