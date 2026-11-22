import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-sources-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { resetCryptoCache, setLegacyKeyLoader } = await import("./crypto.ts");
const { createHttpEndpointStore, createMcpServerStore } =
  await import("./source-configs.ts");
const { httpEndpointsPath, mcpServersPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface Named {
  id: string;
  name: string;
}

const parse = (raw: unknown): Named | null => {
  const value = raw as Partial<Named>;
  return typeof value.name === "string"
    ? { id: String(value.id), name: value.name }
    : null;
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

describe("source config stores", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("keeps MCP servers and HTTP endpoints in their own encrypted files", async () => {
    const servers = createMcpServerStore(parse);
    const endpoints = createHttpEndpointStore(parse);
    await servers.save({ id: "s1", name: "Stripe" });
    await endpoints.save({ id: "e1", name: "Status API" });

    await expect(servers.list()).resolves.toStrictEqual([
      { id: "s1", name: "Stripe" },
    ]);
    await expect(endpoints.list()).resolves.toStrictEqual([
      { id: "e1", name: "Status API" },
    ]);
    const onDisk = await fs.readFile(mcpServersPath(), "utf8");
    expect(onDisk).not.toContain("Stripe");
    await expect(fs.access(httpEndpointsPath())).resolves.toBeUndefined();
  });
});
