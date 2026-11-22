import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import type { MiniApp, MiniAppDraft, ParamValues } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import {
  affectedSources,
  appInputs,
} from "@/components/mini-app/mini-app-inputs";
import { MiniAppInputsBar } from "@/components/mini-app/mini-app-inputs-bar";
import {
  createMiniAppStore,
  setInputs,
  usePanelValue,
} from "@/components/mini-app/mini-app-state";
import { PanelControlsProvider } from "@/components/mini-app/panel-controls";
import { PanelRenderer } from "@/components/mini-app/panel-renderer";
import { MiniAppReviewSheet } from "@/components/mini-app/review/mini-app-review-sheet";
import { useMiniAppRuns } from "@/components/mini-app/use-mini-app-runs";
import { useSources } from "@/components/sources/sources-provider";

import type { GenerationRequest } from "./use-mini-app-generation";

import { GenError } from "./gen-error";
import { GenerateHeader } from "./generate-header";
import { useGenerateHotkeys } from "./use-generate-hotkeys";
import { useMiniAppGeneration } from "./use-mini-app-generation";
import { useMiniAppSave } from "./use-mini-app-save";
import { usePreviewControls } from "./use-preview-controls";
import { useWritePermissions } from "./use-write-permissions";

export interface SessionHandlers {
  onOpenSettings: () => void;
  onSaved: (app: MiniApp) => void;
  onOpen: (app: MiniApp) => void;
}

interface GenerateSessionProps {
  request: GenerationRequest;
  handlers: SessionHandlers;
}

const footerAction = (status: string, reviewing: boolean, saved: boolean) => {
  if (saved) {
    return { keys: ["↩"], label: "Open" };
  }
  if (reviewing) {
    return { keys: ["⌘", "↩"], label: "Save App" };
  }
  return status === "ready"
    ? { keys: ["⌘", "S"], label: "Review and Save" }
    : null;
};

export function GenerateSession({ request, handlers }: GenerateSessionProps) {
  const [store] = useState(() =>
    createMiniAppStore({ inputs: {}, sources: {} })
  );
  const { genId, retry, state } = useMiniAppGeneration(request, store);
  const { onOpen, onOpenSettings, onSaved } = handlers;
  const [reviewing, setReviewing] = useState(false);
  // The review sheet closes on save; ↵ then belongs to "Open", not to the
  // field that had focus inside the sheet.
  const handleSaved = useCallback(
    (app: MiniApp) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setReviewing(false);
      onSaved(app);
    },
    [onSaved]
  );
  const { save, state: saveState } = useMiniAppSave(handleSaved);
  const permissions = useWritePermissions(reviewing);
  const { state: connections } = useConnections();
  const { state: sources } = useSources();
  const target = useMemo(
    () => (state.status === "ready" ? { genId, kind: "draft" as const } : null),
    [genId, state.status]
  );
  const sourceNames = useMemo(
    () => Object.keys(state.draft.sources),
    [state.draft.sources]
  );
  const runs = useMiniAppRuns({ refreshMs: null, sourceNames, store, target });
  const { refresh } = runs;
  const retrySource = useCallback((name: string) => refresh([name]), [refresh]);
  const preview = usePreviewControls(state.draft, retrySource, state.changed);
  const values = usePanelValue(store, (panel) => panel.inputs);
  const inputs = useMemo(
    () => appInputs(state.draft, target ?? { genId, kind: "draft" }),
    [genId, state.draft, target]
  );
  const saved = saveState.status === "saved" ? saveState.app : null;

  const applyInputs = useCallback(
    (next: ParamValues) => {
      const affected = affectedSources(state.draft, store.get().inputs, next);
      setInputs(store, next);
      if (target && affected.length > 0) {
        refresh(affected);
      }
    },
    [refresh, state.draft, store, target]
  );

  const targetName = useCallback(
    (action: MiniAppDraft["actions"][number]) => {
      const { target: actionTarget } = action;
      if (actionTarget.kind === "sql") {
        return (
          connections.connections.find(
            (item) => item.id === actionTarget.connectionId
          )?.name ?? actionTarget.connectionId
        );
      }
      if (actionTarget.kind === "mcp" && sources.status === "ready") {
        return (
          sources.servers.find((item) => item.id === actionTarget.serverId)
            ?.name ?? actionTarget.serverId
        );
      }
      if (actionTarget.kind === "http" && sources.status === "ready") {
        return (
          sources.endpoints.find((item) => item.id === actionTarget.endpointId)
            ?.name ?? actionTarget.endpointId
        );
      }
      return "this target";
    },
    [connections.connections, sources]
  );

  const reviewDraft = state.result
    ? {
        ...state.result,
        layout: { ...state.result.layout, elements: preview.layout.elements },
      }
    : null;

  useGenerateHotkeys({
    onOpen: saved ? () => onOpen(saved) : null,
    onReview:
      state.status === "ready" && !saved ? () => setReviewing(true) : null,
  });

  const action = footerAction(state.status, reviewing, saved !== null);
  return (
    <>
      <GenerateHeader
        detail={state.detail}
        prompt={request.prompt}
        status={state.status}
      />
      <AnimatePresence>
        {reviewing && reviewDraft && !saved ? (
          <MiniAppReviewSheet
            draft={reviewDraft}
            handlers={{
              onClose: () => setReviewing(false),
              onOpenSettings,
              onSave: save,
              targetName,
            }}
            key="review"
            permissions={permissions}
            status={{
              error: saveState.status === "failed" ? saveState.message : null,
              saving: saveState.status === "saving",
            }}
          />
        ) : null}
      </AnimatePresence>
      <MiniAppInputsBar
        inputs={inputs}
        onApply={applyInputs}
        values={values}
        variant="launcher"
      />
      <LauncherScrollArea className="min-h-0 flex-1">
        <div className="px-4 pt-1">
          {state.error ? (
            <GenError
              error={state.error}
              onOpenSettings={onOpenSettings}
              onRetry={retry}
            />
          ) : null}
          <PanelControlsProvider controls={preview.controls}>
            <PanelRenderer layout={preview.layout} store={store} />
          </PanelControlsProvider>
          {state.notes.length > 0 && !saved ? (
            <ul className="mt-3 flex flex-col gap-1 type-meta text-panel-muted">
              {state.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </LauncherScrollArea>
      <LauncherFooter
        actionKeys={action?.keys}
        actionLabel={action?.label ?? null}
        status={
          <span role="status">
            {saved ? "Saved · ↵ to open" : state.detail}
          </span>
        }
      />
    </>
  );
}
