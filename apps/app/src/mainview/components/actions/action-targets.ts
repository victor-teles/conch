import type { ActionContext, ActionDraft } from "@/lib/ipc";

export interface ActionEditTarget {
  widgetId: string;
  actionId: string | null;
  draft: ActionDraft | null;
  context: ActionContext | null;
  columns: readonly string[];
}

export interface ActionReviewTarget {
  widgetId: string;
  draft: ActionDraft;
  context: ActionContext | null;
}

export interface ActionNavigation {
  onEditAction: (target: ActionEditTarget) => void;
  onManageActions: (
    target: Omit<ActionEditTarget, "actionId" | "draft">
  ) => void;
}
