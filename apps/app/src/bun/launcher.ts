import type { LookupValue } from "@conch/core/client";
import type { LauncherNavigateView } from "@conch/rpc";

import Electrobun, {
  BrowserWindow,
  GlobalShortcut,
  Screen,
  Tray,
  Utils,
} from "electrobun/main";

import type { AppRpc } from "./rpc.ts";
import type { TrayStatus } from "./tray-status.ts";

import { createMacAccessibility } from "./accessibility-native.ts";
import { requireAccessibility } from "./accessibility.ts";
import { createSystemHotkey } from "./hotkey-native.ts";
import { blurResponse } from "./launcher-blur.ts";
import {
  heightRoom,
  LAUNCHER_MIN_HEIGHT,
  launcherFrame,
  resizedFrame,
  workAreaForPoint,
} from "./launcher-geometry.ts";
import { registerLauncherHotkey } from "./launcher-hotkey.ts";
import { createNavigationGate } from "./launcher-navigation.ts";
import { summonPayload } from "./summon-payload.ts";
import {
  EMPTY_TRAY_STATUS,
  TRAY_IMAGES,
  trayActionOf,
  trayMenu,
  trayTitle,
} from "./tray-status.ts";

export interface LauncherController {
  hide(): void;
  markRendererReady(): void;
  navigate(view: LauncherNavigateView): void;
  resize(height: number): void;
  runModal<T>(openPanel: () => Promise<T>): Promise<T>;
  setTrayStatus(status: TrayStatus): void;
  setTrayActivity(line: string | null): void;
  setTrayUpdate(version: string | null): void;
  show(): void;
  toggle(): void;
}

interface CreateLauncherOptions {
  hotkey: string;
  rpc: AppRpc;
  url: string;
  releaseFocus: () => void;
  summonOffer: () => LookupValue | null;
  onWatchedOpened: (watchId: string) => void;
  onInstallUpdate: () => void;
  onHotkeyPressed: () => void;
}

const cursorWorkArea = () => {
  const primary = Screen.getPrimaryDisplay().workArea;
  const workAreas = Screen.getAllDisplays().map((display) => display.workArea);
  return workAreaForPoint(workAreas, Screen.getCursorScreenPoint(), primary);
};

export function createLauncher({
  hotkey,
  rpc,
  url,
  releaseFocus,
  summonOffer,
  onWatchedOpened,
  onInstallUpdate,
  onHotkeyPressed,
}: CreateLauncherOptions): LauncherController {
  let contentHeight = LAUNCHER_MIN_HEIGHT;
  let room = heightRoom(cursorWorkArea());
  let modal = false;
  const shownTray = { image: TRAY_IMAGES.idle as string, menu: "", title: "" };
  const trayState = {
    agentLine: null as string | null,
    status: EMPTY_TRAY_STATUS,
    updateVersion: null as string | null,
  };

  const window = new BrowserWindow({
    frame: launcherFrame(cursorWorkArea(), contentHeight),
    rpc,
    title: "Conch",
    titleBarStyle: "hidden",
    transparent: true,
    url,
  });
  window.setAlwaysOnTop(true);
  window.setVisibleOnAllWorkspaces(true);

  const show = () => {
    const workArea = cursorWorkArea();
    room = heightRoom(workArea);
    const frame = launcherFrame(workArea, contentHeight);
    window.setFrame(frame.x, frame.y, frame.width, frame.height);
    window.show();
    window.activate();
    rpc.send.launcherShown({ ...summonPayload(summonOffer), maxHeight: room });
  };
  // A cold-start blur can hide the panel before the renderer is ready, so
  // delivering a held view shows it again.
  const navigation = createNavigationGate<LauncherNavigateView>((view) => {
    if (!window.isVisible()) {
      show();
    }
    rpc.send.launcherNavigate({ view });
  });

  const tray = new Tray({
    height: 18,
    image: TRAY_IMAGES.idle,
    template: true,
    width: 18,
  });
  // Native menu rebuilds are not free; skip them when nothing visible changed.
  const renderTray = () => {
    const { status, agentLine, updateVersion } = trayState;
    const title = trayTitle(status);
    const menu = trayMenu(status, agentLine, updateVersion);
    const menuKey = JSON.stringify(menu);
    const image = agentLine ? TRAY_IMAGES.active : TRAY_IMAGES.idle;
    if (title !== shownTray.title) {
      tray.setTitle(title);
      shownTray.title = title;
    }
    if (menuKey !== shownTray.menu) {
      tray.setMenu(menu);
      shownTray.menu = menuKey;
    }
    if (image !== shownTray.image) {
      tray.setImage(image);
      shownTray.image = image;
    }
  };
  const setTrayStatus = (status: TrayStatus) => {
    trayState.status = status;
    renderTray();
  };
  const setTrayActivity = (line: string | null) => {
    trayState.agentLine = line;
    renderTray();
  };
  const setTrayUpdate = (version: string | null) => {
    trayState.updateVersion = version;
    renderTray();
  };
  renderTray();

  const controller: LauncherController = {
    hide: () => {
      window.hide();
      releaseFocus();
    },
    markRendererReady: navigation.markReady,
    navigate: (view) => {
      if (!window.isVisible()) {
        show();
      }
      navigation.navigate(view);
    },
    resize: (height) => {
      const frame = resizedFrame(window.getFrame(), height, room);
      contentHeight = frame.height;
      window.setFrame(frame.x, frame.y, frame.width, frame.height);
    },
    runModal: async (openPanel) => {
      modal = true;
      window.setAlwaysOnTop(false);
      try {
        return await openPanel();
      } finally {
        window.setAlwaysOnTop(true);
        window.activate();
        modal = false;
      }
    },
    setTrayActivity,
    setTrayStatus,
    setTrayUpdate,
    show,
    toggle: () => {
      if (window.isVisible()) {
        rpc.send.launcherToggle({});
        return;
      }
      show();
    },
  };

  window.on("blur", () => {
    const response = blurResponse({
      modal,
      rendererReady: navigation.isReady(),
      visible: window.isVisible(),
    });
    if (response === "dismiss") {
      rpc.send.launcherDismiss({});
    } else if (response === "hide") {
      controller.hide();
    }
  });

  const onHotkey = () => {
    onHotkeyPressed();
    controller.toggle();
  };
  const registration = registerLauncherHotkey({
    accelerator: hotkey,
    monitor: GlobalShortcut,
    onPress: onHotkey,
    system: createSystemHotkey(),
  });
  console.info(`[launcher] hotkey ${hotkey}: ${registration}`);
  // Only the event monitor needs Accessibility trust to see keys.
  const accessibility =
    registration === "monitor" ? createMacAccessibility() : null;
  if (accessibility) {
    requireAccessibility(accessibility, () => {
      GlobalShortcut.unregister(hotkey);
      GlobalShortcut.register(hotkey, onHotkey);
    });
  }

  tray.on("tray-clicked", (event) => {
    const action = trayActionOf(event);
    switch (action?.kind) {
      case "open": {
        show();
        break;
      }
      case "settings": {
        controller.navigate("settings");
        break;
      }
      case "quit": {
        Utils.quit();
        break;
      }
      case "update": {
        onInstallUpdate();
        break;
      }
      case "watches": {
        controller.navigate("watches");
        break;
      }
      case "open-watched": {
        controller.navigate({ kind: "widget-run", widgetId: action.widgetId });
        onWatchedOpened(action.watchId);
        break;
      }
      default: {
        break;
      }
    }
  });

  Utils.setDockIconVisible(false);
  // macOS re-shows the Dock icon when the app is reopened from Finder/Spotlight.
  Electrobun.events.on("reopen", () => {
    Utils.setDockIconVisible(false);
    show();
  });

  return controller;
}
