import type { AvailableUpdate, UpdateChannel } from "@conch/rpc";

import { DbError } from "@conch/core";

export const FIRST_CHECK_MS = 30 * 1000;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

interface UpdateState {
  version: string;
  updateAvailable: boolean;
  updateReady: boolean;
  error: string;
}

interface UpdateStatus {
  status: string;
  details?: {
    progress?: number;
    bytesDownloaded?: number;
    totalBytes?: number;
  };
}

export interface UpdaterPort {
  checkForUpdate(): Promise<UpdateState>;
  downloadUpdate(): Promise<void>;
  applyUpdate(): Promise<void>;
  updateInfo(): UpdateState;
  getLocalInfo(): Promise<{ version: string; channel: string }>;
  onStatusChange(listener: ((entry: UpdateStatus) => void) | null): void;
}

export interface UpdateProgress {
  percent: number;
  downloaded: number;
  total: number;
}

export interface UpdateServiceOptions {
  updater: UpdaterPort;
  onProgress: (progress: UpdateProgress) => void;
  onReady: (version: string | null) => void;
}

export const channelOf = (buildChannel: string): UpdateChannel => {
  if (buildChannel === "stable") {
    return "stable";
  }
  return buildChannel === "canary" ? "beta" : "dev";
};

const progressOf = ({ status, details }: UpdateStatus): UpdateProgress | null =>
  status === "download-progress" && details?.progress !== undefined
    ? {
        downloaded: details.bytesDownloaded ?? 0,
        percent: details.progress,
        total: details.totalBytes ?? 0,
      }
    : null;

export const createUpdateService = ({
  updater,
  onProgress,
  onReady,
}: UpdateServiceOptions) => {
  let timers: ReturnType<typeof setTimeout>[] = [];

  const check = async (): Promise<AvailableUpdate | null> => {
    const [info, local] = await Promise.all([
      updater.checkForUpdate(),
      updater.getLocalInfo(),
    ]);
    if (info.error) {
      throw new DbError("UPDATE_CHECK_FAILED", "Could not check for updates.");
    }
    return info.updateAvailable
      ? {
          currentVersion: local.version,
          date: null,
          notes: null,
          version: info.version,
        }
      : null;
  };

  const download = async (): Promise<string | null> => {
    await updater.downloadUpdate();
    const info = updater.updateInfo();
    return info.updateReady ? info.version : null;
  };

  const install = async (): Promise<boolean> => {
    if ((await download()) === null) {
      throw new DbError(
        "UPDATE_DOWNLOAD_FAILED",
        "The update could not be downloaded."
      );
    }
    await updater.applyUpdate();
    return true;
  };

  const prepareInBackground = async () => {
    try {
      if ((await check()) !== null) {
        onReady(await download());
      }
    } catch (error) {
      console.error(`[updater] background check failed: ${String(error)}`);
    }
  };

  return {
    channel: async (): Promise<UpdateChannel> => {
      const local = await updater.getLocalInfo();
      return channelOf(local.channel);
    },
    check,
    install,
    start: () => {
      updater.onStatusChange((entry) => {
        const progress = progressOf(entry);
        if (progress) {
          onProgress(progress);
        }
      });
      timers = [
        setTimeout(prepareInBackground, FIRST_CHECK_MS),
        setInterval(prepareInBackground, CHECK_EVERY_MS),
      ];
    },
    stop: () => {
      updater.onStatusChange(null);
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers = [];
    },
  };
};

export type UpdateService = ReturnType<typeof createUpdateService>;
