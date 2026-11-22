import type * as NodeOs from "node:os";

import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_HOME = mkdtempSync(path.join(os.tmpdir(), "conch-core-mini-apps-"));

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
const { createMiniAppStore } = await import("./mini-apps.ts");
const { miniAppsPath } = await import("./paths.ts");
const { appConfigDir } = await import("./test-utils.ts");

interface TestApp {
  id: string;
  name: string;
  version: 1;
}

const parseApp = (raw: unknown): TestApp | null => {
  const value = raw as Partial<TestApp>;
  return value.version === 1 && typeof value.name === "string"
    ? { id: String(value.id), name: value.name, version: 1 }
    : null;
};

// oxlint-disable-next-line require-await -- placeholder loader for tests
const noLegacyKey = async (): Promise<string | null> => null;

const apps = createMiniAppStore(parseApp);

const storedRecords = async (): Promise<unknown[]> => {
  const raw = await fs.readFile(miniAppsPath(), "utf8");
  return JSON.parse(await decryptLine(raw.trim()));
};

describe("mini-app store", () => {
  beforeEach(async () => {
    resetCryptoCache();
    setLegacyKeyLoader(noLegacyKey);
    await fs.rm(appConfigDir(TMP_HOME), { force: true, recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_HOME, { force: true, recursive: true });
  });

  it("saves, lists, updates and deletes, encrypted on disk", async () => {
    await expect(apps.listMiniApps()).resolves.toStrictEqual([]);
    await apps.saveMiniApp({ id: "a1", name: "Refund desk", version: 1 });
    await apps.saveMiniApp({ id: "a2", name: "Signups", version: 1 });
    await apps.updateMiniApp("a1", (app) => ({ ...app, name: "Refunds" }));

    await expect(apps.getMiniApp("a1")).resolves.toStrictEqual({
      id: "a1",
      name: "Refunds",
      version: 1,
    });
    const raw = await fs.readFile(miniAppsPath(), "utf8");
    expect(raw).not.toContain("Refunds");

    await apps.deleteMiniApp("a1");
    await expect(apps.listMiniApps()).resolves.toStrictEqual([
      { id: "a2", name: "Signups", version: 1 },
    ]);
  });

  it("keeps a version 2 record through a v1 save", async () => {
    await fs.mkdir(path.dirname(miniAppsPath()), { recursive: true });
    await fs.writeFile(
      miniAppsPath(),
      await encryptLine(
        JSON.stringify([{ id: "future", name: "Later", version: 2 }])
      )
    );
    await apps.saveMiniApp({ id: "a1", name: "Refund desk", version: 1 });

    await expect(apps.listMiniApps()).resolves.toStrictEqual([
      { id: "a1", name: "Refund desk", version: 1 },
    ]);
    await expect(storedRecords()).resolves.toContainEqual({
      id: "future",
      name: "Later",
      version: 2,
    });
  });

  it("sets a corrupt file aside instead of overwriting it", async () => {
    await fs.mkdir(path.dirname(miniAppsPath()), { recursive: true });
    await fs.writeFile(miniAppsPath(), "not-encrypted-garbage");
    const warn = vi.spyOn(console, "warn").mockReturnValue();

    await expect(apps.listMiniApps()).resolves.toStrictEqual([]);
    await apps.saveMiniApp({ id: "a1", name: "Refund desk", version: 1 });

    const files = await fs.readdir(path.dirname(miniAppsPath()));
    expect(
      files.some((name) => name.startsWith("mini-apps.enc.corrupt-"))
    ).toBeTruthy();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
