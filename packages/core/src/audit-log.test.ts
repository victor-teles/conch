import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-audit-"));

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
  appendAudit,
  archiveAudit,
  lineHash,
  readAudit,
  verifyAudit,
  ZERO_HASH,
} = await import("./audit-log.ts");
const { actionsAuditPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

interface Entry {
  id: string;
  prevHash: string;
}

const parseEntry = (raw: unknown): Entry | null => {
  const value = raw as Partial<Entry> | null;
  return typeof value?.id === "string" && typeof value.prevHash === "string"
    ? { id: value.id, prevHash: value.prevHash }
    : null;
};

const lines = async (): Promise<string[]> => {
  const content = await fs.readFile(actionsAuditPath(), "utf8");
  return content.split("\n").filter((line) => line.length > 0);
};

describe("audit log", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("verifies an empty log", async () => {
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 0,
      entries: 0,
      ok: true,
    });
    await expect(readAudit({ limit: 10 }, parseEntry)).resolves.toStrictEqual(
      []
    );
  });

  it("chains each entry to the encrypted line before it", async () => {
    await appendAudit({ id: "e1" });
    await appendAudit({ id: "e2" });
    await appendAudit({ id: "e3" });

    const [first = "", second = ""] = await lines();
    const entries = await readAudit({ limit: 10 }, parseEntry);
    expect(entries).toStrictEqual([
      { id: "e3", prevHash: lineHash(second) },
      { id: "e2", prevHash: lineHash(first) },
      { id: "e1", prevHash: ZERO_HASH },
    ]);
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 0,
      entries: 3,
      ok: true,
    });
  });

  it("encrypts every line", async () => {
    await appendAudit({ id: "secret-entry" });
    const raw = await lines();
    expect(raw).toHaveLength(1);
    expect(raw.join("")).not.toContain("secret-entry");
  });

  it("pages newest first", async () => {
    for (const id of ["e1", "e2", "e3", "e4"]) {
      await appendAudit({ id });
    }
    const page = await readAudit({ limit: 2, offset: 1 }, parseEntry);
    expect(page.map((entry) => entry.id)).toStrictEqual(["e3", "e2"]);
  });

  it("detects a removed middle line", async () => {
    for (const id of ["e1", "e2", "e3"]) {
      await appendAudit({ id });
    }
    const [first, , third] = await lines();
    await fs.writeFile(actionsAuditPath(), `${first}\n${third}\n`);
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 0,
      brokenAt: 1,
      entries: 2,
      ok: false,
    });
  });

  it("reports an unreadable line without throwing", async () => {
    await appendAudit({ id: "e1" });
    await fs.appendFile(actionsAuditPath(), "not-a-cipher\n");
    await appendAudit({ id: "e3" });
    await expect(verifyAudit()).resolves.toMatchObject({
      brokenAt: 1,
      ok: false,
    });
    const entries = await readAudit({ limit: 10 }, parseEntry);
    expect(entries.map((entry) => entry.id)).toStrictEqual(["e3", "e1"]);
  });

  it("serializes concurrent appends into one chain", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, index) => appendAudit({ id: `e${index}` }))
    );
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 0,
      entries: 12,
      ok: true,
    });
  });

  it("chains across a long previous line", async () => {
    await appendAudit({ id: "big", pad: "x".repeat(200_000) });
    await appendAudit({ id: "next" });
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 0,
      entries: 2,
      ok: true,
    });
  });

  it("creates the log readable by the owner only", async () => {
    await appendAudit({ id: "e1" });
    const { mode } = await fs.stat(actionsAuditPath());
    expect((mode % 0o1000).toString(8)).toBe("600");
  });

  it("sets the old log aside instead of deleting it and counts it", async () => {
    await appendAudit({ id: "e1" });
    await archiveAudit(new Date("2026-11-21T10:00:00.000Z"));
    const names = await fs.readdir(path.dirname(actionsAuditPath()));
    expect(names).toContain("actions-audit-2026-11-21T10-00-00.000Z.enc");
    await expect(verifyAudit()).resolves.toStrictEqual({
      archived: 1,
      entries: 0,
      ok: true,
    });
  });
});
