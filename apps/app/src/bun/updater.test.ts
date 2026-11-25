import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdaterPort } from "./updater.ts";

import {
  channelOf,
  CHECK_EVERY_MS,
  createUpdateService,
  FIRST_CHECK_MS,
} from "./updater.ts";

type Status = Parameters<
  NonNullable<Parameters<UpdaterPort["onStatusChange"]>[0]>
>[0];

const state = (overrides: Partial<ReturnType<UpdaterPort["updateInfo"]>>) => ({
  error: "",
  updateAvailable: false,
  updateReady: false,
  version: "0.2.0",
  ...overrides,
});

const fakeUpdater = (overrides: Partial<UpdaterPort> = {}) => {
  const listeners: ((entry: Status) => void)[] = [];
  const updater: UpdaterPort = {
    applyUpdate: vi.fn().mockResolvedValue(null),
    checkForUpdate: vi.fn().mockResolvedValue(state({ updateAvailable: true })),
    downloadUpdate: vi.fn().mockResolvedValue(null),
    getLocalInfo: vi
      .fn()
      .mockResolvedValue({ channel: "stable", version: "0.1.0" }),
    onStatusChange: (listener) => {
      listeners.length = 0;
      if (listener) {
        listeners.push(listener);
      }
    },
    updateInfo: () => state({ updateAvailable: true, updateReady: true }),
    ...overrides,
  };
  const emit = (entry: Status) => {
    for (const listener of listeners) {
      listener(entry);
    }
  };
  return { emit, updater };
};

const serviceOf = (updater: UpdaterPort) => {
  const onProgress = vi.fn();
  const onReady = vi.fn();
  const service = createUpdateService({ onProgress, onReady, updater });
  return { onProgress, onReady, service };
};

describe("channelOf", () => {
  it.each([
    ["stable", "stable"],
    ["canary", "beta"],
    ["dev", "dev"],
    ["anything-else", "dev"],
  ])("maps the %s build to %s", (build, channel) => {
    expect(channelOf(build)).toBe(channel);
  });
});

describe("update service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockReturnValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports an available update with both versions", async () => {
    const { service } = serviceOf(fakeUpdater().updater);

    await expect(service.check()).resolves.toStrictEqual({
      currentVersion: "0.1.0",
      date: null,
      notes: null,
      version: "0.2.0",
    });
  });

  it("reports nothing when the build is current", async () => {
    const { updater } = fakeUpdater({
      checkForUpdate: vi.fn().mockResolvedValue(state({})),
    });

    await expect(serviceOf(updater).service.check()).resolves.toBeNull();
  });

  it("fails the check when the feed cannot be read", async () => {
    const { updater } = fakeUpdater({
      checkForUpdate: vi.fn().mockResolvedValue(state({ error: "HTTP 404" })),
    });

    await expect(serviceOf(updater).service.check()).rejects.toMatchObject({
      code: "UPDATE_CHECK_FAILED",
    });
  });

  it("downloads, then applies the update", async () => {
    const { updater } = fakeUpdater();

    await expect(serviceOf(updater).service.install()).resolves.toBeTruthy();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(updater.applyUpdate).toHaveBeenCalledOnce();
  });

  it("does not apply an update that never became ready", async () => {
    const { updater } = fakeUpdater({
      updateInfo: () => state({ updateAvailable: true }),
    });

    await expect(serviceOf(updater).service.install()).rejects.toMatchObject({
      code: "UPDATE_DOWNLOAD_FAILED",
    });
    expect(updater.applyUpdate).not.toHaveBeenCalled();
  });

  it("names the channel of the running build", async () => {
    const { updater } = fakeUpdater({
      getLocalInfo: vi
        .fn()
        .mockResolvedValue({ channel: "canary", version: "0.1.0-beta.1" }),
    });

    await expect(serviceOf(updater).service.channel()).resolves.toBe("beta");
  });

  it("prepares an update in the background and says when it is ready", async () => {
    const { updater } = fakeUpdater();
    const { onReady, service } = serviceOf(updater);

    service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);

    expect(onReady).toHaveBeenCalledExactlyOnceWith("0.2.0");
    expect(updater.applyUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(updater.checkForUpdate).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it("stays quiet when a background check fails", async () => {
    const { updater } = fakeUpdater({
      checkForUpdate: vi.fn().mockRejectedValue(new Error("offline")),
    });
    const { onReady, service } = serviceOf(updater);

    service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);

    expect(onReady).not.toHaveBeenCalled();
    service.stop();
  });

  it("forwards download progress and nothing else", () => {
    const { emit, updater } = fakeUpdater();
    const { onProgress, service } = serviceOf(updater);

    service.start();
    emit({ status: "checking" });
    emit({
      details: { bytesDownloaded: 5, progress: 50, totalBytes: 10 },
      status: "download-progress",
    });

    expect(onProgress).toHaveBeenCalledExactlyOnceWith({
      downloaded: 5,
      percent: 50,
      total: 10,
    });
    service.stop();
  });

  it("stops checking once stopped", async () => {
    const { updater } = fakeUpdater();
    const { service } = serviceOf(updater);

    service.start();
    service.stop();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS + CHECK_EVERY_MS);

    expect(updater.checkForUpdate).not.toHaveBeenCalled();
  });
});
