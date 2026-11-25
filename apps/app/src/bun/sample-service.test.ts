import type { DatabaseConnection } from "@conch/core";

import { assertReadOnly } from "@conch/agent";
import { SAMPLE_CONNECTION_ID, WidgetDraft } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";

import type { SampleServiceDeps } from "./sample-service.ts";

import { createSampleService, sampleWidgetDrafts } from "./sample-service.ts";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const FILE = "/home/.config/conch/sample/store.sqlite";

const existing: DatabaseConnection = {
  createdAt: "2026-01-01T00:00:00.000Z",
  database: "app",
  host: "localhost",
  id: "prod",
  lastConnectedAt: null,
  name: "Production",
  password: "secret",
  pinned: true,
  port: 5432,
  type: "postgresql",
  username: "app",
};

const serviceWith = (overrides: Partial<SampleServiceDeps> = {}) => {
  const deps: SampleServiceDeps = {
    fileExists: vi.fn().mockResolvedValue(false),
    filePath: FILE,
    getConnections: vi.fn().mockResolvedValue([existing]),
    now: () => NOW,
    saveConnections: vi.fn().mockResolvedValue(null),
    saveWidget: vi.fn().mockResolvedValue(null),
    writeDatabase: vi.fn(),
    ...overrides,
  };
  return { deps, service: createSampleService(deps) };
};

describe("sample widgets", () => {
  it("are valid, read-only drafts on the sample connection", () => {
    const drafts = sampleWidgetDrafts();

    expect(drafts.map((draft) => draft.name)).toStrictEqual([
      "Revenue by month",
      "Orders by status",
      "Top products",
    ]);
    for (const draft of drafts) {
      expect(WidgetDraft.parse(draft).source).toMatchObject({
        connectionId: SAMPLE_CONNECTION_ID,
        dialect: "sqlite",
        kind: "sql",
      });
    }
  });

  it.each(sampleWidgetDrafts())("$name passes the read-only guard", (draft) => {
    const source = WidgetDraft.parse(draft).source as { sqlTemplate: string };

    expect(() => assertReadOnly(source.sqlTemplate, "sqlite")).not.toThrow();
  });
});

describe("sample service", () => {
  it("writes the file, adds the connection after the others and saves the widgets", async () => {
    const { deps, service } = serviceWith();

    const connection = await service.add();

    expect(deps.writeDatabase).toHaveBeenCalledExactlyOnceWith(FILE, NOW);
    expect(connection).toMatchObject({
      database: FILE,
      id: SAMPLE_CONNECTION_ID,
      name: "Sample Store",
      password: "",
      type: "sqlite",
    });
    expect(deps.saveConnections).toHaveBeenCalledExactlyOnceWith([
      existing,
      connection,
    ]);
    expect(deps.saveWidget).toHaveBeenCalledTimes(3);
  });

  it("keeps a file that is already there", async () => {
    const { deps, service } = serviceWith({
      fileExists: vi.fn().mockResolvedValue(true),
    });

    await service.add();

    expect(deps.writeDatabase).not.toHaveBeenCalled();
  });

  it("returns the connection it added before instead of a second one", async () => {
    const first = serviceWith();
    const added = await first.service.add();
    const { deps, service } = serviceWith({
      getConnections: vi.fn().mockResolvedValue([existing, added]),
    });

    await expect(service.add()).resolves.toBe(added);
    expect(deps.saveConnections).not.toHaveBeenCalled();
  });

  it("saves nothing when the file cannot be written", async () => {
    const { deps, service } = serviceWith({
      writeDatabase: vi.fn(() => {
        throw new Error("disk full");
      }),
    });

    await expect(service.add()).rejects.toThrow("disk full");
    expect(deps.saveConnections).not.toHaveBeenCalled();
    expect(deps.saveWidget).not.toHaveBeenCalled();
  });
});
