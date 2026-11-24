import type { HotkeyCombo } from "./hotkey-combo.ts";

import { parseHotkeyCombo } from "./hotkey-combo.ts";

export interface SystemHotkey {
  register(combo: HotkeyCombo, onPress: () => void): boolean;
}

export interface MonitorHotkey {
  register(accelerator: string, onPress: () => void): boolean;
}

export type HotkeyRegistration = "system" | "monitor" | "failed";

interface RegisterLauncherHotkeyOptions {
  accelerator: string;
  onPress: () => void;
  system: SystemHotkey | null;
  monitor: MonitorHotkey;
}

// The system hot key needs no Accessibility trust and swallows the keystroke.
// The event monitor is the fallback for a key the system refuses.
export const registerLauncherHotkey = ({
  accelerator,
  onPress,
  system,
  monitor,
}: RegisterLauncherHotkeyOptions): HotkeyRegistration => {
  const combo = parseHotkeyCombo(accelerator);
  if (system && combo && system.register(combo, onPress)) {
    return "system";
  }
  return monitor.register(accelerator, onPress) ? "monitor" : "failed";
};
