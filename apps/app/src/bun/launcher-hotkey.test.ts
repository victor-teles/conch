import { describe, expect, it, vi } from "vitest";

import type { MonitorHotkey, SystemHotkey } from "./launcher-hotkey.ts";

import { registerLauncherHotkey } from "./launcher-hotkey.ts";

const systemThat = (accepts: boolean): SystemHotkey => ({
  register: vi.fn().mockReturnValue(accepts),
});

const monitorThat = (accepts: boolean): MonitorHotkey => ({
  register: vi.fn().mockReturnValue(accepts),
});

const ACCELERATOR = "Option+Shift+Space";

describe("registerLauncherHotkey", () => {
  it("prefers the system hot key and leaves the monitor alone", () => {
    const onPress = vi.fn();
    const system = systemThat(true);
    const monitor = monitorThat(true);

    expect(
      registerLauncherHotkey({
        accelerator: ACCELERATOR,
        monitor,
        onPress,
        system,
      })
    ).toBe("system");
    expect(system.register).toHaveBeenCalledExactlyOnceWith(
      { keyCode: 49, modifiers: 0x8_00 + 0x2_00 },
      onPress
    );
    expect(monitor.register).not.toHaveBeenCalled();
  });

  it("falls back to the monitor when the system refuses the key", () => {
    const onPress = vi.fn();
    const monitor = monitorThat(true);

    expect(
      registerLauncherHotkey({
        accelerator: ACCELERATOR,
        monitor,
        onPress,
        system: systemThat(false),
      })
    ).toBe("monitor");
    expect(monitor.register).toHaveBeenCalledExactlyOnceWith(
      ACCELERATOR,
      onPress
    );
  });

  it("uses the monitor when the native helper is missing", () => {
    expect(
      registerLauncherHotkey({
        accelerator: ACCELERATOR,
        monitor: monitorThat(true),
        onPress: vi.fn(),
        system: null,
      })
    ).toBe("monitor");
  });

  it("hands a key it cannot parse to the monitor", () => {
    const system = systemThat(true);

    expect(
      registerLauncherHotkey({
        accelerator: "Option+Shift+§",
        monitor: monitorThat(true),
        onPress: vi.fn(),
        system,
      })
    ).toBe("monitor");
    expect(system.register).not.toHaveBeenCalled();
  });

  it("reports failure when nothing takes the key", () => {
    expect(
      registerLauncherHotkey({
        accelerator: ACCELERATOR,
        monitor: monitorThat(false),
        onPress: vi.fn(),
        system: systemThat(false),
      })
    ).toBe("failed");
  });
});
