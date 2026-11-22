import type { ChangeEvent, KeyboardEvent } from "react";

import { needsReview } from "@conch/rpc/mini-app";
import { motion } from "motion/react";
import { useCallback, useState } from "react";

import type { MiniAppDraft } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

import type { ReviewGate } from "./review-action-row";

import { ReviewActionRow } from "./review-action-row";
import { draftEffect, reviewedDraft, writesAllowed } from "./review-draft";
import { ReviewInputs } from "./review-inputs";
import { ReviewSources } from "./review-sources";
import { toggleIn } from "./toggle-set";

export interface ReviewHandlers {
  onSave: (draft: MiniAppDraft, reviewedActionIds: string[]) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  targetName: (draft: MiniAppDraft["actions"][number]) => string;
}

interface MiniAppReviewSheetProps {
  draft: MiniAppDraft;
  permissions: ReadonlySet<string>;
  status: { saving: boolean; error: string | null };
  handlers: ReviewHandlers;
}

const gateOf = (
  action: MiniAppDraft["actions"][number],
  permissions: ReadonlySet<string>
): ReviewGate => {
  if (!needsReview(action.target)) {
    return "none";
  }
  if (draftEffect(action) !== "write") {
    return "needs-review";
  }
  return writesAllowed(action, permissions) ? "needs-review" : "writes-off";
};

export function MiniAppReviewSheet({
  draft,
  permissions,
  status,
  handlers,
}: MiniAppReviewSheetProps) {
  const { soft, fadeIn, fadeOut, reduced } = useMotionPreset();
  const [name, setName] = useState(draft.name);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(new Set());
  const gates = draft.actions.map((action) => gateOf(action, permissions));
  const blocked = draft.actions.some(
    (action, index) =>
      gates[index] === "writes-off" ||
      (gates[index] === "needs-review" && !reviewed.has(action.id))
  );
  const { onSave, onClose, onOpenSettings, targetName } = handlers;

  const toggleInput = useCallback(
    (inputName: string) => setRemoved((set) => toggleIn(set, inputName)),
    []
  );
  const toggleReviewed = useCallback(
    (actionId: string) => setReviewed((set) => toggleIn(set, actionId)),
    []
  );
  const handleName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );
  const save = useCallback(() => {
    if (!blocked && !status.saving) {
      onSave(reviewedDraft(draft, { name, removedInputs: removed }), [
        ...reviewed,
      ]);
    }
  }, [blocked, draft, name, onSave, removed, reviewed, status.saving]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        save();
      }
    },
    [onClose, save]
  );

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      aria-label="Review the app"
      className="mx-3 mb-2 flex max-h-[360px] flex-col gap-3 overflow-y-auto rounded-[14px] border border-panel-border bg-card px-4 py-3"
      exit={{ opacity: 0, transition: fadeOut }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
      layout
      onKeyDown={handleKeyDown}
      transition={{ layout: soft, opacity: fadeIn, y: soft }}
    >
      <label className="flex items-center gap-3">
        <span className="w-16 shrink-0 type-meta text-panel-muted">Name</span>
        <input
          aria-label="App name"
          autoFocus
          className="h-8 min-w-0 flex-1 rounded-[8px] bg-row-hover px-2.5 type-body text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
          maxLength={60}
          onChange={handleName}
          value={name}
        />
      </label>
      <ReviewInputs
        inputs={draft.inputs}
        onToggle={toggleInput}
        removed={removed}
      />
      <ReviewSources sources={draft.sources} />
      {draft.actions.length > 0 ? (
        <ul aria-label="Actions" className="flex flex-col gap-1.5">
          {draft.actions.map((action, index) => (
            <ReviewActionRow
              action={action}
              gate={gates[index] ?? "none"}
              key={action.id}
              onOpenSettings={onOpenSettings}
              onToggle={toggleReviewed}
              reviewed={reviewed.has(action.id)}
              targetName={targetName(action)}
            />
          ))}
        </ul>
      ) : null}
      {status.error ? (
        <p className="type-meta text-danger-ink" role="alert">
          {status.error}
        </p>
      ) : null}
      <Pressable
        aria-disabled={blocked || status.saving || undefined}
        className="ml-auto h-8 rounded-[8px] bg-primary px-3 type-body text-primary-foreground aria-disabled:opacity-50"
        onClick={save}
      >
        {status.saving ? "Saving…" : "Save App ⌘↵"}
      </Pressable>
    </motion.section>
  );
}
