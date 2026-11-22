import { useEffect, useState } from "react";

import type { McpActivity } from "@/lib/ipc";

import { onMcpActivity } from "@/lib/ipc";

export const ACTIVITY_LINGER_MS = 1500;

const newestOf = (active: readonly McpActivity[]): McpActivity | null => {
  let newest: McpActivity | null = null;
  for (const activity of active) {
    if (!newest || activity.startedAt >= newest.startedAt) {
      newest = activity;
    }
  }
  return newest;
};

// Keeps the last call on screen briefly after the agents go quiet, so a fast
// call still reads instead of flashing.
export const useAgentActivity = (): McpActivity | null => {
  const [shown, setShown] = useState<McpActivity | null>(null);

  useEffect(() => {
    let timer = 0;
    const unsubscribe = onMcpActivity((active) => {
      window.clearTimeout(timer);
      const newest = newestOf(active);
      if (newest) {
        setShown(newest);
        return;
      }
      timer = window.setTimeout(() => setShown(null), ACTIVITY_LINGER_MS);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return shown;
};
