import type { WidgetRunFailure } from "@/components/widgets/widget-run-reducer";

import { failureCopy } from "@/components/widgets/widget-error";

export const REPAIRING = "REPAIRING";

const APP_TITLES: Partial<Record<string, string>> = {
  CONNECTION_MISSING: "This part's connection no longer exists.",
  DRAFT_GONE: "This preview has ended.",
  SOURCE_MISSING: "This server was removed.",
  SOURCE_NOT_FOUND: "This part's source is gone from the app.",
};

export interface CardFailureCopy {
  title: string;
  detail: string | null;
  retry: boolean;
}

export const cardFailureCopy = (failure: WidgetRunFailure): CardFailureCopy => {
  const copy = failureCopy(failure);
  return {
    detail: copy.showDetail ? failure.message : null,
    retry: copy.remedy === "retry",
    title: APP_TITLES[failure.code] ?? copy.title,
  };
};
