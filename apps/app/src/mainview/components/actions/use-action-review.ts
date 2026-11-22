import { useEffect, useState } from "react";

import type { ActionContext, ActionDraft, ActionReview } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { reviewAction } from "@/lib/ipc";

export type ReviewLoad =
  | { status: "loading" }
  | { status: "ready"; review: ActionReview }
  | { status: "error"; message: string };

const NO_RUN: ActionContext = { rowIndex: null, runId: "none", values: {} };

// Samples the first row when none is selected, so a row action can be read
// with real values before it is saved.
export const useActionReview = (
  widgetId: string,
  draft: ActionDraft,
  context: ActionContext | null
) => {
  const [load, setLoad] = useState<ReviewLoad>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const sample = context
      ? { ...context, rowIndex: context.rowIndex ?? 0 }
      : NO_RUN;
    const run = async () => {
      try {
        const review = await reviewAction(widgetId, draft, sample);
        if (!cancelled) {
          setLoad({ review, status: "ready" });
        }
      } catch (error) {
        if (!cancelled) {
          setLoad({
            message: getErrorMessage(error, "The action can't be previewed."),
            status: "error",
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [context, draft, widgetId]);
  return load;
};
