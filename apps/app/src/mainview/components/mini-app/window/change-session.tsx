import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import type { MiniAppStateStore } from "@/components/mini-app/mini-app-state";
import type { MiniApp } from "@/lib/ipc";

import { GenError } from "@/components/mini-app/generate/gen-error";
import { useGenerateHotkeys } from "@/components/mini-app/generate/use-generate-hotkeys";
import { useMiniAppSave } from "@/components/mini-app/generate/use-mini-app-save";
import { usePreviewControls } from "@/components/mini-app/generate/use-preview-controls";
import { useWritePermissions } from "@/components/mini-app/generate/use-write-permissions";
import { PanelControlsProvider } from "@/components/mini-app/panel-controls";
import { PanelRenderer } from "@/components/mini-app/panel-renderer";
import { MiniAppReviewSheet } from "@/components/mini-app/review/mini-app-review-sheet";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";

import { useChangeSession } from "./use-change-session";
import { useTargetNames } from "./use-target-names";

interface ChangeSessionProps {
  app: MiniApp;
  prompt: string;
  store: MiniAppStateStore;
  onSaved: (app: MiniApp) => void;
  onDiscard: () => void;
}

const skip = (): undefined => undefined;

// A window has no Settings view of its own; the opt-in lives in the launcher.
export function ChangeSession({
  app,
  prompt,
  store,
  onSaved,
  onDiscard,
}: ChangeSessionProps) {
  const { genId, retry, state } = useChangeSession(app, prompt, store);
  const [reviewing, setReviewing] = useState(false);
  const { save, state: saveState } = useMiniAppSave(onSaved, genId);
  const permissions = useWritePermissions(reviewing);
  const targetName = useTargetNames();
  const preview = usePreviewControls(state.draft, skip, state.changed);
  const ready = state.status === "ready";
  const openReview = useCallback(() => setReviewing(true), []);
  const closeReview = useCallback(() => setReviewing(false), []);
  const reviewHandlers = useMemo(
    () => ({
      onClose: closeReview,
      onOpenSettings: skip,
      onSave: save,
      targetName,
    }),
    [closeReview, save, targetName]
  );
  const reviewDraft = useMemo(
    () =>
      state.result
        ? {
            ...state.result,
            id: app.id,
            layout: {
              ...state.result.layout,
              elements: preview.layout.elements,
            },
          }
        : null,
    [app.id, preview.layout.elements, state.result]
  );
  const saveStatus = useMemo(
    () => ({
      error: saveState.status === "failed" ? saveState.message : null,
      saving: saveState.status === "saving",
    }),
    [saveState]
  );
  useGenerateHotkeys({ onOpen: null, onReview: ready ? openReview : null });

  return (
    <>
      <div className="flex items-center gap-3 border-b border-panel-border px-6 py-2">
        <span className="min-w-0 flex-1 truncate type-body text-foreground">
          “{prompt}”
        </span>
        <span className="type-meta text-panel-muted" role="status">
          <SwapText
            value={state.status === "failed" ? "Stopped" : state.detail}
          />
        </span>
        {ready ? (
          <Pressable
            className="h-7 rounded-[7px] bg-primary px-2.5 type-meta text-primary-foreground"
            onClick={openReview}
          >
            Review and Save ⌘S
          </Pressable>
        ) : null}
        <Pressable
          className="h-7 rounded-[7px] px-2.5 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground"
          onClick={onDiscard}
        >
          Discard · esc
        </Pressable>
      </div>
      <AnimatePresence>
        {reviewing && reviewDraft ? (
          <div className="pt-3" key="review">
            <MiniAppReviewSheet
              draft={reviewDraft}
              handlers={reviewHandlers}
              permissions={permissions}
              status={saveStatus}
            />
          </div>
        ) : null}
      </AnimatePresence>
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-10">
        {state.error ? (
          <GenError error={state.error} onOpenSettings={skip} onRetry={retry} />
        ) : null}
        <PanelControlsProvider controls={preview.controls}>
          <PanelRenderer layout={preview.layout} store={store} />
        </PanelControlsProvider>
      </main>
    </>
  );
}
