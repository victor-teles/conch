import { useCallback, useReducer } from "react";

import type { ActionContext, ActionPreview, ListedAction } from "@/lib/ipc";

import { failureOf } from "@/components/widgets/use-widget-run";
import { copyText } from "@/lib/clipboard";
import { getErrorMessage } from "@/lib/error-message";
import { discardActionToken, executeAction, prepareAction } from "@/lib/ipc";

import { actionRunReducer, IDLE } from "./action-run-reducer";

const discard = async (token: string) => {
  try {
    await discardActionToken(token);
  } catch {
    // tokens expire on their own
  }
};

// Reads and links run straight away and report in the footer; a write
// always stops at the confirm sheet until ⌘↵.
export const useActionRun = (announce: (text: string) => void) => {
  const [state, dispatch] = useReducer(actionRunReducer, IDLE);

  const run = useCallback(
    async (label: string, prepare: () => Promise<ActionPreview>) => {
      dispatch({ label, type: "prepare" });
      let preview;
      try {
        preview = await prepare();
      } catch (error) {
        dispatch({ failure: failureOf(error), type: "fail" });
        return;
      }
      if (preview.effect === "write") {
        dispatch({ preview, type: "review" });
        return;
      }
      dispatch({ type: "close" });
      if (preview.compiled.kind === "copy") {
        discard(preview.token);
        announce(
          (await copyText(preview.compiled.text)) ? "Copied" : "Couldn't copy"
        );
        return;
      }
      try {
        const outcome = await executeAction(preview.token);
        announce(outcome.ok ? outcome.summary : outcome.message);
      } catch (error) {
        announce(getErrorMessage(error, "The action could not run."));
      }
    },
    [announce]
  );

  const start = useCallback(
    (listed: ListedAction, context: ActionContext) =>
      run(listed.action.label, () => prepareAction(listed.action.id, context)),
    [run]
  );

  const confirm = useCallback(async () => {
    if (state.phase !== "confirm") {
      return;
    }
    const { token } = state.preview;
    dispatch({ type: "run" });
    try {
      dispatch({ outcome: await executeAction(token), type: "finish" });
    } catch (error) {
      dispatch({ failure: failureOf(error), type: "fail" });
    }
  }, [state]);

  const close = useCallback(() => {
    if (state.phase === "confirm") {
      discard(state.preview.token);
    }
    dispatch({ type: "close" });
  }, [state]);

  return { close, confirm, run, start, state };
};

export type ActionRun = ReturnType<typeof useActionRun>;
