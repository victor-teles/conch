import type { ReactNode } from "react";

import { lazy, Suspense } from "react";

import type {
  ActionEditTarget,
  ActionReviewTarget,
} from "@/components/actions/action-targets";
import type { ActionDraft, SourceTarget, Widget, WidgetDraft } from "@/lib/ipc";

import { ActionReviewView } from "@/components/actions/action-review-view";
import { ActionEditView } from "@/components/actions/editor/action-edit-view";
import { WidgetActionsView } from "@/components/actions/widget-actions-view";
import { ActivityEntryView } from "@/components/activity/activity-entry-view";
import { ActivityView } from "@/components/activity/activity-view";
import { AgentsView } from "@/components/agents/agents-view";
import { AuditView } from "@/components/agents/audit-view";
import { ImportView } from "@/components/bundle/import-view";
import { loadGenerateView } from "@/components/mini-app/generate/load-generate-view";
import { MiniAppActionView } from "@/components/mini-app/launcher/mini-app-action-view";
import { SourceDraftView } from "@/components/sources/draft/source-draft-view";
import { SourceEditView } from "@/components/sources/editor/source-edit-view";
import { SourcePickerView } from "@/components/sources/source-picker-view";
import { WatchView } from "@/components/watches/watch-view";
import { WatchesView } from "@/components/watches/watches-view";
import { WidgetInputsView } from "@/components/widgets/widget-inputs-view";
import { WidgetRunView } from "@/components/widgets/widget-run-view";

import type { LauncherView, SourceEditTarget } from "./use-launcher-stack";

import { BoardNameView } from "./views/board-name-view";
import { BoardPickerView } from "./views/board-picker-view";
import { ConnectionEditView } from "./views/connection-edit-view";
import { SettingsView } from "./views/settings-view";

// The panel renderer only loads once someone builds an app.
const MiniAppGenerateView = lazy(async () => {
  const module = await loadGenerateView();
  return { default: module.MiniAppGenerateView };
});

// While the builder loads, a build keeps its full frame instead of collapsing.
function GenerateFallback({ building }: { building: boolean }) {
  return building ? (
    <div aria-hidden style={{ height: "var(--panel-max-height)" }} />
  ) : null;
}

const MiniAppNameView = lazy(async () => {
  const module =
    await import("@/components/mini-app/launcher/mini-app-name-view");
  return { default: module.MiniAppNameView };
});

export interface ViewSlots {
  root: ReactNode;
  ask: ReactNode;
  history: ReactNode;
  lookup: ReactNode;
  onBack: () => void;
  onEditInputs: (draft: WidgetDraft) => void;
  onInputsSaved: (widget: Widget, mode: "create" | "edit") => void;
  onAddToBoard: (widgetId: string) => void;
  onNewBoard: (widgetId: string) => void;
  onBoardDone: () => void;
  onImportDone: (firstWidgetId: string | null) => void;
  onWatch: (widgetId: string) => void;
  onOpenWatches: () => void;
  onOpenAgents: () => void;
  onOpenAgentsAudit: () => void;
  sources: SourceNavigation;
  actions: ActionViewNavigation;
  apps: AppViewNavigation;
}

export interface AppViewNavigation {
  onOpenSettings: () => void;
  onDone: () => void;
}

const renderAppView = (
  view: LauncherView,
  apps: AppViewNavigation,
  onBack: () => void
): ReactNode => {
  const { onDone, onOpenSettings } = apps;
  switch (view.kind) {
    case "mini-app-generate": {
      return (
        <Suspense
          fallback={<GenerateFallback building={view.target.prompt !== ""} />}
        >
          <MiniAppGenerateView
            onDone={onDone}
            onOpenSettings={onOpenSettings}
            target={view.target}
          />
        </Suspense>
      );
    }
    case "mini-app-action": {
      return <MiniAppActionView onBack={onBack} request={view.request} />;
    }
    case "mini-app-name": {
      return (
        <Suspense fallback={null}>
          <MiniAppNameView app={view.app} onBack={onBack} onDone={onDone} />
        </Suspense>
      );
    }
    default: {
      return null;
    }
  }
};

export interface ActionViewNavigation {
  onEdit: (target: ActionEditTarget) => void;
  onManage: (target: Omit<ActionEditTarget, "actionId" | "draft">) => void;
  onReview: (target: ActionReviewTarget) => void;
  onSaved: () => void;
  onOpenActivity: () => void;
  onOpenEntry: (executionId: string) => void;
}

const reviewTargetOf =
  (target: ActionEditTarget, onReview: ActionViewNavigation["onReview"]) =>
  (draft: ActionDraft) =>
    onReview({ context: target.context, draft, widgetId: target.widgetId });

export interface SourceNavigation {
  onOpenSettings: () => void;
  onEdit: (target: SourceEditTarget) => void;
  onDraft: (target: SourceTarget) => void;
  onRunWidget: (widgetId: string) => void;
}

const renderActionView = (
  view: LauncherView,
  actions: ActionViewNavigation,
  onBack: () => void
): ReactNode => {
  const {
    onEdit: onEditAction,
    onOpenEntry: onOpenActivityEntry,
    onReview,
    onSaved: onActionSaved,
  } = actions;
  switch (view.kind) {
    case "action-edit": {
      return (
        <ActionEditView
          onBack={onBack}
          onReview={reviewTargetOf(view.target, onReview)}
          target={view.target}
        />
      );
    }
    case "action-review": {
      return (
        <ActionReviewView
          onBack={onBack}
          onSaved={onActionSaved}
          target={view.target}
        />
      );
    }
    case "widget-actions": {
      return (
        <WidgetActionsView
          onBack={onBack}
          onEdit={onEditAction}
          target={view.target}
        />
      );
    }
    case "activity": {
      return <ActivityView onBack={onBack} onOpen={onOpenActivityEntry} />;
    }
    case "activity-entry": {
      return (
        <ActivityEntryView executionId={view.executionId} onBack={onBack} />
      );
    }
    default: {
      return null;
    }
  }
};

export const renderView = (view: LauncherView, slots: ViewSlots) => {
  const {
    root,
    ask,
    history,
    lookup,
    onBack,
    onEditInputs,
    onInputsSaved,
    onAddToBoard,
    onNewBoard,
    onBoardDone,
    onImportDone,
    onWatch,
    onOpenWatches,
    onOpenAgents,
    onOpenAgentsAudit,
    sources,
    actions,
    apps,
  } = slots;
  const {
    onOpenSettings: onOpenSources,
    onEdit: onEditSource,
    onDraft: onDraftSource,
    onRunWidget: onRunSourceWidget,
  } = sources;
  const {
    onEdit: onEditAction,
    onManage: onManageActions,
    onOpenActivity,
  } = actions;
  switch (view.kind) {
    case "ask": {
      return ask;
    }
    case "history": {
      return history;
    }
    case "lookup": {
      return lookup;
    }
    case "widget-run": {
      return (
        <WidgetRunView
          initialValues={view.values}
          onAddToBoard={onAddToBoard}
          onClose={onBack}
          onEditAction={onEditAction}
          onEditInputs={onEditInputs}
          onManageActions={onManageActions}
          onOpenSources={onOpenSources}
          onWatch={onWatch}
          widgetId={view.widgetId}
        />
      );
    }
    case "watch": {
      return <WatchView onBack={onBack} widgetId={view.widgetId} />;
    }
    case "watches": {
      return <WatchesView onBack={onBack} onOpenWatch={onWatch} />;
    }
    case "widget-inputs": {
      return (
        <WidgetInputsView
          draft={view.draft}
          mode={view.mode}
          onBack={onBack}
          onSaved={onInputsSaved}
        />
      );
    }
    case "board-picker": {
      return (
        <BoardPickerView
          onDone={onBoardDone}
          onNewBoard={onNewBoard}
          widgetId={view.widgetId}
        />
      );
    }
    case "board-name": {
      return (
        <BoardNameView
          onBack={onBack}
          onDone={onBoardDone}
          target={view.target}
        />
      );
    }
    case "settings": {
      return (
        <SettingsView
          onBack={onBack}
          onOpenActivity={onOpenActivity}
          onOpenAgents={onOpenAgents}
          onOpenSource={onEditSource}
          onOpenWatches={onOpenWatches}
        />
      );
    }
    case "agents": {
      return <AgentsView onBack={onBack} onOpenAudit={onOpenAgentsAudit} />;
    }
    case "agents-audit": {
      return <AuditView onBack={onBack} />;
    }
    case "connection-edit": {
      return (
        <ConnectionEditView connectionId={view.connectionId} onBack={onBack} />
      );
    }
    case "source-edit": {
      return <SourceEditView onBack={onBack} target={view.target} />;
    }
    case "source-picker": {
      return (
        <SourcePickerView
          onBack={onBack}
          onChoose={onDraftSource}
          onOpenSettings={onOpenSources}
        />
      );
    }
    case "source-draft": {
      return (
        <SourceDraftView
          onBack={onBack}
          onRun={onRunSourceWidget}
          target={view.target}
        />
      );
    }
    case "import": {
      return <ImportView onBack={onBack} onDone={onImportDone} />;
    }
    default: {
      return (
        renderActionView(view, actions, onBack) ??
        renderAppView(view, apps, onBack) ??
        root
      );
    }
  }
};
