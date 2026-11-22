import { draftOfApp } from "@conch/rpc/mini-app";
import { useMemo } from "react";

import type { MiniAppStateStore } from "@/components/mini-app/mini-app-state";
import type { MiniApp } from "@/lib/ipc";

import { useMiniAppGeneration } from "@/components/mini-app/generate/use-mini-app-generation";

const connectionOf = (app: MiniApp): string | null =>
  Object.values(app.sources).find((source) => source.kind === "sql")
    ?.connectionId ?? null;

// Ops from "Change with a prompt" patch a copy of the app; the saved app is
// untouched until the person reviews and saves the copy.
export const useChangeSession = (
  app: MiniApp,
  prompt: string,
  store: MiniAppStateStore
) => {
  const request = useMemo(
    () => ({
      base: draftOfApp(app),
      baseAppId: app.id,
      connectionId: connectionOf(app),
      database: null,
      prompt,
    }),
    [app, prompt]
  );
  return useMiniAppGeneration(request, store);
};
