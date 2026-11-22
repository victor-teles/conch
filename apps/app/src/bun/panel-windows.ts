import { boardFramesPath } from "@conch/core";
import { BrowserWindow, Screen } from "electrobun/main";
import fs from "node:fs/promises";
import path from "node:path";

import type { BoardFrames } from "./board-frames.ts";
import type { FocusState } from "./focus-policy.ts";
import type { PanelRef } from "./panel-ref.ts";
import type { AppRpc } from "./rpc.ts";

import { parseBoardFrames, restoredBoardFrame } from "./board-frames.ts";
import { workAreaForPoint } from "./launcher-geometry.ts";
import { panelUrl, windowKey } from "./panel-ref.ts";

const SAVE_FRAMES_AFTER_MS = 600;

interface OpenPanel {
  window: BrowserWindow;
  rpc: AppRpc;
}

interface PanelWindowsDeps {
  baseUrl: string;
  createRpc(ref: PanelRef): AppRpc;
  now(): number;
  releaseRpc(rpc: AppRpc): void;
}

const cursorWorkArea = () => {
  const primary = Screen.getPrimaryDisplay().workArea;
  const areas = Screen.getAllDisplays().map((display) => display.workArea);
  return {
    areas,
    current: workAreaForPoint(areas, Screen.getCursorScreenPoint(), primary),
  };
};

const readFrames = async (): Promise<BoardFrames> => {
  try {
    return parseBoardFrames(await fs.readFile(boardFramesPath(), "utf8"));
  } catch {
    return {};
  }
};

export const createPanelWindows = ({
  baseUrl,
  createRpc,
  releaseRpc,
  now,
}: PanelWindowsDeps) => {
  const open = new Map<string, OpenPanel>();
  let focusedKey: string | null = null;
  const blurredAt = new Map<string, number>();
  let frames: BoardFrames = {};
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const loadFrames = async () => {
    frames = { ...(await readFrames()), ...frames };
  };
  const loaded = loadFrames();

  const persistFrames = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await fs.mkdir(path.dirname(boardFramesPath()), { recursive: true });
        await fs.writeFile(boardFramesPath(), JSON.stringify(frames));
      } catch (error) {
        console.error(
          `[windows] could not remember window frames: ${String(error)}`
        );
      }
    }, SAVE_FRAMES_AFTER_MS);
  };

  const rememberFrame = (key: string, window: BrowserWindow) => {
    frames[key] = window.getFrame();
    persistFrames();
  };

  const activate = (key: string): boolean => {
    const entry = open.get(key);
    if (!entry) {
      return false;
    }
    if (entry.window.isMinimized()) {
      entry.window.unminimize();
    }
    entry.window.show();
    entry.window.activate();
    return true;
  };

  const create = async (ref: PanelRef, title: string) => {
    await loaded;
    const key = windowKey(ref);
    const { areas, current } = cursorWorkArea();
    const rpc = createRpc(ref);
    const window = new BrowserWindow({
      frame: restoredBoardFrame(frames[key], areas, current),
      rpc,
      title,
      titleBarStyle: "hiddenInset",
      url: panelUrl(baseUrl, ref),
    });
    open.set(key, { rpc, window });
    window.on("focus", () => {
      focusedKey = key;
    });
    window.on("blur", () => {
      blurredAt.set(key, now());
      if (focusedKey === key) {
        focusedKey = null;
      }
    });
    window.on("move", () => rememberFrame(key, window));
    window.on("resize", () => rememberFrame(key, window));
    window.on("close", () => {
      open.delete(key);
      blurredAt.delete(key);
      releaseRpc(rpc);
      if (focusedKey === key) {
        focusedKey = null;
      }
    });
    window.activate();
  };

  return {
    activate,
    close(ref: PanelRef): void {
      open.get(windowKey(ref))?.window.close();
    },
    // A press in a window blurs it a moment later when the launcher shows,
    // so "recently" covers the click that staged the action.
    focusedWithin(ref: PanelRef, ms: number): boolean {
      const key = windowKey(ref);
      if (focusedKey === key) {
        return true;
      }
      const blurred = blurredAt.get(key);
      return blurred !== undefined && now() - blurred <= ms;
    },
    async open(ref: PanelRef, title: string): Promise<void> {
      if (!activate(windowKey(ref))) {
        await create(ref, title);
      }
    },
    setTitle(ref: PanelRef, title: string): void {
      open.get(windowKey(ref))?.window.setTitle(title);
    },
    state(returnWindowKey: string | null): FocusState {
      const openWindowKeys = [...open.entries()]
        .filter(
          ([, entry]) => entry.window.isVisible() && !entry.window.isMinimized()
        )
        .map(([key]) => key);
      return { focusedWindowKey: focusedKey, openWindowKeys, returnWindowKey };
    },
  };
};

export type PanelWindows = ReturnType<typeof createPanelWindows>;
