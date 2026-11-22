import { useEffect, useEffectEvent } from "react";

interface VisibleIntervalOptions {
  refreshMs: number | null;
  updatedAt: number | null;
  onTick: () => void;
}

const isVisible = () => document.visibilityState === "visible";

// Ticks only while the window is visible, and catches up once when it comes
// back if a tick was missed.
export const useVisibleInterval = ({
  refreshMs,
  updatedAt,
  onTick,
}: VisibleIntervalOptions) => {
  const tick = useEffectEvent(() => {
    if (isVisible()) {
      onTick();
    }
  });

  const catchUp = useEffectEvent(() => {
    const stale =
      updatedAt === null ||
      refreshMs === null ||
      Date.now() - updatedAt >= refreshMs;
    if (isVisible() && refreshMs !== null && stale) {
      onTick();
    }
  });

  useEffect(() => {
    if (refreshMs === null) {
      return;
    }
    const timer = window.setInterval(tick, refreshMs);
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [refreshMs]);
};
