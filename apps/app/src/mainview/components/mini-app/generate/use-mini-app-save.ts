import { useCallback, useState } from "react";

import type { MiniApp, MiniAppDraft } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { saveMiniApp } from "@/lib/ipc";

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; app: MiniApp }
  | { status: "failed"; message: string };

// A change from an app window names the build it came from, so bun can
// check every new part against the draft it generated itself.
export const useMiniAppSave = (
  onSaved: (app: MiniApp) => void,
  fromGenId?: string
) => {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const save = useCallback(
    async (draft: MiniAppDraft, reviewedActionIds: string[]) => {
      setState({ status: "saving" });
      try {
        const app = await saveMiniApp(draft, reviewedActionIds, fromGenId);
        setState({ app, status: "saved" });
        onSaved(app);
      } catch (error) {
        setState({
          message: getErrorMessage(error, "The app could not be saved."),
          status: "failed",
        });
      }
    },
    [fromGenId, onSaved]
  );
  return { save, state };
};
