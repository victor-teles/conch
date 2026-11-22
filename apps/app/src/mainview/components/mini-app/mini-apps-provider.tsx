import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { MiniApp } from "@/lib/ipc";

import { listMiniApps, onMiniAppChanged } from "@/lib/ipc";

interface MiniAppsContextValue {
  apps: MiniApp[];
  refresh: () => Promise<void>;
}

const ignore = async (): Promise<void> => {
  await Promise.resolve();
};

// Without the launcher's provider (a board window, a focused test) there
// are simply no apps to list.
const MiniAppsContext = createContext<MiniAppsContextValue>({
  apps: [],
  refresh: ignore,
});

export function MiniAppsProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<MiniApp[]>([]);

  const refresh = useCallback(async () => {
    try {
      setApps(await listMiniApps());
    } catch (error) {
      console.error("[apps] could not load", error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(
    () =>
      onMiniAppChanged(() => {
        refresh();
      }),
    [refresh]
  );

  const value = useMemo(() => ({ apps, refresh }), [apps, refresh]);
  return <MiniAppsContext value={value}>{children}</MiniAppsContext>;
}

export const useMiniApps = (): MiniAppsContextValue => use(MiniAppsContext);
