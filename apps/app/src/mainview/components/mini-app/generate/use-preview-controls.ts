import { setCardView } from "@conch/rpc/mini-app";
import { useMemo, useState } from "react";

import type { PanelControls } from "@/components/mini-app/panel-controls";
import type { CardViewKind } from "@/lib/card-data";
import type { DraftState } from "@/lib/ipc";

import { INERT_CONTROLS } from "@/components/mini-app/panel-controls";
import { draftEffect } from "@/components/mini-app/review/review-draft";

export const PREVIEW_LOCK = "Save the app to use its actions.";

// A preview never runs an action: buttons show what they would do and stay
// locked until the app is reviewed and saved.
export const usePreviewControls = (
  draft: DraftState,
  retry: (source: string) => void,
  changed: Readonly<Record<string, number>>
) => {
  const [views, setViews] = useState<Readonly<Record<string, CardViewKind>>>(
    {}
  );

  const layout = useMemo(() => {
    let current = {
      elements: draft.layout.elements,
      root: draft.layout.root ?? "",
    };
    for (const [key, view] of Object.entries(views)) {
      current = setCardView(current, key, view);
    }
    return current;
  }, [draft.layout, views]);

  const controls = useMemo<PanelControls>(
    () => ({
      ...INERT_CONTROLS,
      actionOf: (id) => {
        const action = draft.actions.find((item) => item.id === id);
        return action
          ? { effect: draftEffect(action), id, label: action.label }
          : null;
      },
      actionsLocked: PREVIEW_LOCK,
      retry,
      selectView: (key, view) =>
        setViews((current) => ({ ...current, [key]: view })),
      tintOf: (key) => changed[key] ?? null,
    }),
    [changed, draft.actions, retry]
  );

  return {
    controls,
    layout: { elements: layout.elements, root: draft.layout.root },
    views,
  };
};
