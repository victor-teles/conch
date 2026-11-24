import { dlopen, FFIType, JSCallback } from "bun:ffi";
import { PATHS } from "electrobun/main";
import { existsSync } from "node:fs";
import path from "node:path";

import type { HotkeyCombo } from "./hotkey-combo.ts";
import type { SystemHotkey } from "./launcher-hotkey.ts";

const LIBRARY_NAME = "libconch-hotkey.dylib";

const openLibrary = (libraryPath: string) =>
  dlopen(libraryPath, {
    conch_hotkey_register: {
      args: [FFIType.u32, FFIType.u32, FFIType.function],
      returns: FFIType.i32,
    },
    conch_hotkey_unregister: { args: [], returns: FFIType.void },
  });

export const createSystemHotkey = (): SystemHotkey | null => {
  const libraryPath = path.join(
    PATHS.RESOURCES_FOLDER,
    "app/bun",
    LIBRARY_NAME
  );
  if (process.platform !== "darwin" || !existsSync(libraryPath)) {
    return null;
  }
  try {
    const library = openLibrary(libraryPath);
    let pressed: JSCallback | null = null;
    return {
      register: ({ keyCode, modifiers }: HotkeyCombo, onPress: () => void) => {
        // Carbon calls back on the main thread; bun runs on a worker.
        const next = new JSCallback(onPress, {
          args: [],
          returns: "void",
          threadsafe: true,
        });
        const status = library.symbols.conch_hotkey_register(
          keyCode,
          modifiers,
          next
        );
        if (status !== 0) {
          library.symbols.conch_hotkey_unregister();
          next.close();
          console.error(`[hotkey] system registration failed (${status})`);
          return false;
        }
        pressed?.close();
        pressed = next;
        return true;
      },
    };
  } catch (error) {
    console.error(`[hotkey] native helper unavailable: ${String(error)}`);
    return null;
  }
};
