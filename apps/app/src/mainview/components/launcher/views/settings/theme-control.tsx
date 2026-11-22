import type { ThemeMode } from "@conch/rpc";

import { useCallback } from "react";

import type { SegmentOption } from "@/components/ui/segmented-control";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { themeActions, useThemeState } from "@/lib/theme/theme-store";

const MODES: readonly SegmentOption<ThemeMode>[] = [
  { label: "System", value: "system" },
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

export function ThemeControl() {
  const state = useThemeState();
  const handleChange = useCallback((mode: ThemeMode) => {
    themeActions.setMode(mode);
  }, []);
  return (
    <SegmentedControl
      label="Appearance"
      onChange={handleChange}
      options={MODES}
      value={state?.settings.mode ?? "dark"}
    />
  );
}
