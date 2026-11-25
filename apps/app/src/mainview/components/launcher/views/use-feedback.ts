import { useCallback } from "react";

import { useFlashMessage } from "@/hooks/use-flash-message";
import { getErrorMessage } from "@/lib/error-message";
import { sendFeedback } from "@/lib/ipc";

import type { RootNotice } from "./use-root-menus";

export const FEEDBACK_NOTICE_MS = 4000;

// The issue opens in the browser, so the panel gets out of the way.
export const useFeedback = (dismiss: () => void) => {
  const { flash, message: notice } =
    useFlashMessage<RootNotice>(FEEDBACK_NOTICE_MS);

  const send = useCallback(async () => {
    try {
      await sendFeedback();
      dismiss();
    } catch (error) {
      flash({
        done: false,
        message: getErrorMessage(error, "The feedback page didn't open."),
      });
    }
  }, [dismiss, flash]);

  return { notice, send };
};
