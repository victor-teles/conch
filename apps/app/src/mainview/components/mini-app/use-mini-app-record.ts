import { draftOfApp } from "@conch/rpc/mini-app";
import { useCallback, useEffect, useState } from "react";

import type { MiniApp, MiniAppDraft } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { getMiniApp, onMiniAppChanged } from "@/lib/ipc";

export type MiniAppRecord =
  | { status: "loading" | "none" }
  | { status: "missing" }
  | { status: "error"; message: string }
  | { status: "ready"; app: MiniApp; draft: MiniAppDraft };

// Loads one saved app and follows bun's change broadcasts for it.
export const useMiniAppRecord = (appId: string | null) => {
  const [record, setRecord] = useState<MiniAppRecord>({
    status: appId ? "loading" : "none",
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!appId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const app = await getMiniApp(appId);
        if (!cancelled) {
          setRecord(
            app
              ? { app, draft: draftOfApp(app), status: "ready" }
              : { status: "missing" }
          );
        }
      } catch (error) {
        if (!cancelled) {
          setRecord({
            message: getErrorMessage(error, "The app could not load."),
            status: "error",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [appId, version]);

  useEffect(
    () =>
      onMiniAppChanged((changed) => {
        if (changed === appId) {
          reload();
        }
      }),
    [appId, reload]
  );

  const replace = useCallback((app: MiniApp) => {
    setRecord({ app, draft: draftOfApp(app), status: "ready" });
  }, []);

  return { record, reload, replace };
};
