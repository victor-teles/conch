import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-themes-"));

vi.mock<typeof NodeOs>(import("node:os"), async () => {
  const actual = await vi.importActual<typeof NodeOs>("node:os");
  return {
    ...actual,
    default: { ...actual, homedir: () => TMP_HOME },
    homedir: () => TMP_HOME,
  };
});

const { decryptLine, encryptLine, resetCryptoCache, setLegacyKeyLoader } =
  await import("./crypto.ts");
const { createThemeStore } = await import("./themes.ts");
const { themesPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface TestTheme {
  id: string;
  name: string;
  version: 1;
}

const parseTheme = (raw: unknown): TestTheme | null => {
  const value = raw as Partial<TestTheme>;
  return value.version === 1 && typeof value.name === "string"
    ? { id: String(value.id), name: value.name, version: 1 }
    : null;
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

const themes = createThemeStore(parseTheme);

const storedRecords = async (): Promise<unknown[]> => {
  const raw = await fs.readFile(themesPath(), "utf8");
  return JSON.parse(await decryptLine(raw.trim()));
};

describe("theme store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("saves, lists, replaces and deletes, encrypted on disk", async () => {
    await expect(themes.listThemes()).resolves.toStrictEqual([]);
    await themes.saveTheme({ id: "a1", name: "Ink", version: 1 });
    await themes.saveTheme({ id: "a2", name: "Paper", version: 1 });
    await themes.saveTheme({ id: "a1", name: "Refunds", version: 1 });

    await expect(themes.getTheme("a1")).resolves.toStrictEqual({
      id: "a1",
      name: "Refunds",
      version: 1,
    });
    const raw = await fs.readFile(themesPath(), "utf8");
    expect(raw).not.toContain("Refunds");

    await themes.deleteTheme("a1");
    await expect(themes.listThemes()).resolves.toStrictEqual([
      { id: "a2", name: "Paper", version: 1 },
    ]);
  });

  it("keeps a version 2 record through a v1 save", async () => {
    await fs.mkdir(path.dirname(themesPath()), { recursive: true });
    await fs.writeFile(
      themesPath(),
      await encryptLine(
        JSON.stringify([{ id: "future", name: "Later", version: 2 }])
      )
    );
    await themes.saveTheme({ id: "a1", name: "Ink", version: 1 });

    await expect(themes.listThemes()).resolves.toStrictEqual([
      { id: "a1", name: "Ink", version: 1 },
    ]);
    await expect(storedRecords()).resolves.toContainEqual({
      id: "future",
      name: "Later",
      version: 2,
    });
  });

  it("sets a corrupt file aside instead of overwriting it", async () => {
    await fs.mkdir(path.dirname(themesPath()), { recursive: true });
    await fs.writeFile(themesPath(), "not-encrypted-garbage");
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await expect(themes.listThemes()).resolves.toStrictEqual([]);
    await themes.saveTheme({ id: "a1", name: "Ink", version: 1 });

    const files = await fs.readdir(path.dirname(themesPath()));
    expect(
      files.some((name) => name.startsWith("themes.enc.corrupt-"))
    ).toBeTruthy();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
