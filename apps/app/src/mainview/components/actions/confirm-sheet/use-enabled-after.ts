import { useEffect, useState } from "react";

export const CONFIRM_ENABLE_MS = 600;

// An interaction rule, not an animation: the confirm button ignores input
// until the sheet has been on screen long enough to be read.
export const useEnabledAfter = (delayMs: number = CONFIRM_ENABLE_MS) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setEnabled(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return enabled;
};
