// Don't import @conch/core here: evaluating its WASM top-level await before electrobun/main deadlocks the worker.
import Electrobun, { ApplicationMenu } from "electrobun/main";

import type { BoardWindows } from "./board-windows.ts";
import type { LauncherController } from "./launcher.ts";

import { migrateAppData } from "./app-data.ts";
import { createAppActivation } from "./app-hide-native.ts";
import { createBoardWindows } from "./board-windows.ts";
import { focusAfterLauncherHides } from "./focus-policy.ts";
import { readLauncherHotkey } from "./launcher-config.ts";
import { createLauncher } from "./launcher.ts";
import { createLinkRouter, urlOfOpenEvent } from "./link-router.ts";
import { APPLICATION_MENU, MENU_ACTIONS } from "./menu.ts";
import { createAppRpcs } from "./rpc.ts";
import { LAUNCHER_URL } from "./window.ts";

const menuActionOf = (event: unknown): string | undefined =>
  (event as { data?: { action?: string } }).data?.action;

async function main(): Promise<void> {
  let launcher: LauncherController | null = null;
  let rpcs: ReturnType<typeof createAppRpcs> | null = null;
  const links = createLinkRouter({
    launcher: () => launcher,
    log: (route) => console.info(`[link] ${route}`),
    openBoardWindow: async (boardId) =>
      rpcs ? await rpcs.openBoardWindow(boardId) : "missing",
  });
  // A cold-start link arrives once; it is lost unless this runs before the first await.
  Electrobun.events.on("open-url", (event) => {
    const url = urlOfOpenEvent(event);
    if (url !== null) {
      links.handle(url);
    }
  });

  await migrateAppData();
  let boards: BoardWindows | null = null;
  let returnBoardId: string | null = null;
  const activation = createAppActivation();

  rpcs = createAppRpcs({
    boardWindows: () => boards,
    launcher: () => launcher,
    toggleLauncherFrom: (boardId) => {
      returnBoardId = boardId;
      launcher?.toggle();
    },
  });
  boards = createBoardWindows({
    baseUrl: LAUNCHER_URL,
    createRpc: rpcs.createWindowRpc,
    releaseRpc: rpcs.releaseWindowRpc,
  });

  const releaseFocus = () => {
    const next = boards
      ? focusAfterLauncherHides(boards.state(returnBoardId))
      : ({ kind: "hide" } as const);
    returnBoardId = null;
    switch (next.kind) {
      case "activate": {
        boards?.activate(next.boardId);
        break;
      }
      case "deactivate": {
        activation?.deactivate();
        break;
      }
      case "hide": {
        activation?.hide();
        break;
      }
      default: {
        break;
      }
    }
  };

  try {
    launcher = createLauncher({
      hotkey: await readLauncherHotkey(),
      onWatchedOpened: rpcs.background.acknowledge,
      releaseFocus,
      rpc: rpcs.launcherRpc,
      summonOffer: rpcs.summonOffer,
      url: LAUNCHER_URL,
    });
  } catch (error) {
    console.error("[launcher] failed to start", error);
    return;
  }
  links.flush();

  ApplicationMenu.setApplicationMenu(APPLICATION_MENU);
  ApplicationMenu.on("application-menu-clicked", (event) => {
    if (menuActionOf(event) === MENU_ACTIONS.settings) {
      launcher?.navigate("settings");
    }
  });

  Electrobun.events.on("beforeQuit", rpcs.background.stop);
  await rpcs.background.start();
}

// oxlint-disable-next-line jest/require-hook
main();
