import type { ActionReview } from "@/lib/ipc";

import { BoundValues } from "./bound-values";
import { ExactCall } from "./exact-call";
import { TargetLine } from "./target-line";

export const CONFIRM_DESCRIPTION_ID = "action-confirm-description";

// Shared by the confirm sheet and the save-time review, so a person
// approves exactly what they will later be asked to run.
export function ConfirmBody({ review }: { review: ActionReview }) {
  return (
    <div className="flex flex-col gap-3">
      <div id={CONFIRM_DESCRIPTION_ID}>
        <TargetLine review={review} />
      </div>
      <ExactCall compiled={review.compiled} />
      <BoundValues bound={review.bound} />
    </div>
  );
}
