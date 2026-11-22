import { useEffect, useEffectEvent } from "react";

import { matchesAccelerator } from "@/lib/accelerator";

interface MiniAppHotkeys {
  launcherHotkey: string | null;
  onLauncher: () => void;
  onRefresh: () => void;
  onToggleEdit: () => void;
  onChange: () => void;
  onEscape: (() => void) | null;
}

// ⌘R refreshes, ⌘E edits, ⌘⇧E changes the app with a prompt, Esc leaves
// whichever of those is open. The launcher chord is forwarded, as on boards.
export const useMiniAppHotkeys = ({
  launcherHotkey,
  onLauncher,
  onRefresh,
  onToggleEdit,
  onChange,
  onEscape,
}: MiniAppHotkeys) => {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (launcherHotkey && matchesAccelerator(event, launcherHotkey)) {
      event.preventDefault();
      onLauncher();
      return;
    }
    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (!event.metaKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      onRefresh();
    } else if (key === "e" && event.shiftKey) {
      event.preventDefault();
      onChange();
    } else if (key === "e") {
      event.preventDefault();
      onToggleEdit();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
