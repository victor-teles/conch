import { useCallback } from "react";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { hexOf } from "./hex-color";

interface ColorPickerProps {
  label: string;
  value: string;
  alpha: boolean;
  onChange: (value: string) => void;
}

// A popover inside the webview, never the native color panel: a native panel
// takes focus and the launcher hides on blur.
export function ColorPicker({
  label,
  value,
  alpha,
  onChange,
}: ColorPickerProps) {
  const Picker = alpha ? HexAlphaColorPicker : HexColorPicker;
  const handlePick = useCallback(
    (next: string) => onChange(hexOf(next)),
    [onChange]
  );
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Pick ${label}`}
        className="size-7 rounded-[7px] ring-1 ring-panel-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ backgroundColor: value }}
      />
      <PopoverContent
        align="end"
        aria-label={`${label} picker`}
        className="w-auto popover-material p-2"
      >
        <Picker color={hexOf(value)} onChange={handlePick} />
      </PopoverContent>
    </Popover>
  );
}
