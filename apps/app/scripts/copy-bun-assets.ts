import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  APP_DIR,
  ASSETS_BUN_DIR,
  HOTKEY_LIBRARY,
  nativeBunModules,
} from "./native-bun-assets.ts";

mkdirSync(ASSETS_BUN_DIR, { recursive: true });

for (const module of nativeBunModules) {
  for (const asset of module.assets) {
    const source = asset.resolveSource();
    const dest = path.join(ASSETS_BUN_DIR, asset.fileName);
    copyFileSync(source, dest);
    console.log(
      `[${module.id}] ${path.relative(APP_DIR, source)} → ${path.relative(APP_DIR, dest)}`
    );
  }
}

const bridge = await Bun.build({
  entrypoints: [path.join(APP_DIR, "src", "mcp-bridge", "main.ts")],
  naming: "mcp-bridge.js",
  outdir: ASSETS_BUN_DIR,
  target: "bun",
});
if (!bridge.success) {
  for (const log of bridge.logs) {
    console.error(log);
  }
  throw new Error("[mcp-bridge] build failed");
}
console.log(
  `[mcp-bridge] src/mcp-bridge/main.ts → ${path.relative(APP_DIR, path.join(ASSETS_BUN_DIR, "mcp-bridge.js"))}`
);

// Without clang (no Xcode command line tools) the app still runs: the launcher
// falls back to Electrobun's event monitor.
const buildHotkeyLibrary = (): void => {
  if (process.platform !== "darwin") {
    return;
  }
  const source = path.join(APP_DIR, "native", "hotkey.c");
  const output = path.join(ASSETS_BUN_DIR, HOTKEY_LIBRARY);
  const clang = Bun.spawnSync([
    "xcrun",
    "clang",
    "-dynamiclib",
    "-O2",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-arch",
    "arm64",
    "-arch",
    "x86_64",
    "-mmacosx-version-min=11.0",
    "-framework",
    "Carbon",
    "-o",
    output,
    source,
  ]);
  if (clang.exitCode !== 0) {
    if (process.env.CI) {
      throw new Error(`[hotkey] clang failed: ${clang.stderr.toString()}`);
    }
    console.warn(
      `[hotkey] skipped, clang is unavailable: ${clang.stderr.toString().trim()}`
    );
    return;
  }
  console.log(`[hotkey] native/hotkey.c → ${path.relative(APP_DIR, output)}`);
};

buildHotkeyLibrary();
