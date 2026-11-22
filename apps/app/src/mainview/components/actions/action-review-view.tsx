import type { KeyboardEvent } from "react";

import { useCallback, useState } from "react";

import type { ActionReviewTarget } from "@/components/actions/action-targets";

import { ErrorNotice } from "@/components/ask/error-notice";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import { getErrorMessage } from "@/lib/error-message";
import { saveAction } from "@/lib/ipc";

import { announceActionsChanged } from "./actions-changed";
import { ConfirmBody } from "./confirm-sheet/confirm-body";
import { useActionReview } from "./use-action-review";

const SAVE_KEYS = ["⌘", "↩"] as const;

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "declined" }
  | { status: "error"; message: string };

const codeOf = (error: unknown): string | null =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : null;

const statusText = (save: SaveState): string => {
  switch (save.status) {
    case "saving": {
      return "Waiting for your approval…";
    }
    case "declined": {
      return "Not saved";
    }
    case "error": {
      return "Not saved";
    }
    default: {
      return "Review the write, then save";
    }
  }
};

interface ActionReviewViewProps {
  target: ActionReviewTarget;
  onBack: () => void;
  onSaved: () => void;
}

// The comfortable version of the save-time review; bun still asks in a
// native dialog before the action is stored.
export function ActionReviewView({
  target,
  onBack,
  onSaved,
}: ActionReviewViewProps) {
  const load = useActionReview(target.widgetId, target.draft, target.context);
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const handleSave = useCallback(async () => {
    setSave({ status: "saving" });
    try {
      await saveAction(target.widgetId, target.draft);
      announceActionsChanged(target.widgetId);
      onSaved();
    } catch (error) {
      setSave(
        codeOf(error) === "REVIEW_DECLINED"
          ? { status: "declined" }
          : {
              message: getErrorMessage(error, "The action could not be saved."),
              status: "error",
            }
      );
    }
  }, [onSaved, target.draft, target.widgetId]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" && event.metaKey && save.status !== "saving") {
        event.preventDefault();
        handleSave();
      }
    },
    [handleSave, save.status]
  );

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- ⌘↵ saves from anywhere in the review
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <ViewHeader onBack={onBack} title={`Review “${target.draft.label}”`} />
      <div className="min-h-0 flex-1 launcher-body overflow-y-auto px-4 pt-1">
        {load.status === "ready" ? (
          <Reveal>
            <ConfirmBody review={load.review} />
          </Reveal>
        ) : null}
        {load.status === "loading" ? (
          <p className="py-4 type-meta text-panel-muted" role="status">
            Preparing the preview…
          </p>
        ) : null}
        {load.status === "error" ? (
          <ErrorNotice action={null} detail={null} title={load.message} />
        ) : null}
        {save.status === "error" ? (
          <ErrorNotice action={null} detail={null} title={save.message} />
        ) : null}
      </div>
      <LauncherFooter
        actionKeys={SAVE_KEYS}
        actionLabel="Save Action"
        status={
          <span aria-live="polite">
            <SwapText value={statusText(save)} />
          </span>
        }
      />
    </div>
  );
}
