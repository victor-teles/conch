import type { ElectrobunConfig } from "electrobun";

import { existsSync } from "node:fs";
import path from "node:path";

import {
  ASSETS_BUN_DIR,
  HOTKEY_LIBRARY,
  nativeBunModules,
} from "./scripts/native-bun-assets.ts";

// One rolling GitHub release holds the update feed of every channel; the
// files are prefixed with the channel, so stable and canary never collide.
const UPDATE_FEED_URL =
  "https://github.com/victor-teles/conch/releases/download/updates";

const isSet = (name: string): boolean => Boolean(process.env[name]);

const bunExternals = nativeBunModules.flatMap((m) => [...m.externals]);
const bunAssetCopy = Object.fromEntries(
  nativeBunModules.flatMap((m) =>
    m.assets.map(
      (a) => [`assets/bun/${a.fileName}`, `bun/${a.fileName}`] as const
    )
  )
);

// Built by scripts/copy-bun-assets.ts on macOS when clang is available.
const hotkeyLibraryCopy: Record<string, string> = existsSync(
  path.join(ASSETS_BUN_DIR, HOTKEY_LIBRARY)
)
  ? { [`assets/bun/${HOTKEY_LIBRARY}`]: `bun/${HOTKEY_LIBRARY}` }
  : {};

export default {
  app: {
    identifier: "dev.conch.app",
    name: "Conch",
    urlSchemes: ["conch"],
    version: "0.0.10",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      external: bunExternals,
    },
    copy: {
      ...bunAssetCopy,
      ...hotkeyLibraryCopy,
      "assets/bun/mcp-bridge.js": "bun/mcp-bridge.js",
      "assets/tray-active-template.png":
        "views/assets/tray-active-template.png",
      "assets/tray-template.png": "views/assets/tray-template.png",
      dist: "views/mainview",
    },
    linux: {
      bundleCEF: false,
      icon: "assets/icon.png",
    },
    mac: {
      bundleCEF: false,
      codesign: isSet("ELECTROBUN_DEVELOPER_ID"),
      icons: "assets/icon.iconset",
      notarize: isSet("ELECTROBUN_APPLEID") || isSet("ELECTROBUN_APPLEAPIKEY"),
    },
    mainProcess: "bun",
    win: {
      bundleCEF: false,
      icon: "assets/icon.ico",
    },
  },
  release: {
    baseUrl: UPDATE_FEED_URL,
    generatePatch: isSet("CI"),
  },
} satisfies ElectrobunConfig;
