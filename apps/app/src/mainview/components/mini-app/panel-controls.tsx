import type { KeyboardEvent, ReactNode } from "react";

import { createContext, use } from "react";

import type { CardViewKind } from "@/lib/card-data";
import type { ActionEffect } from "@/lib/ipc";

export interface PanelAction {
  id: string;
  label: string;
  effect: ActionEffect;
}

export interface PanelRowTarget {
  source: string;
  runId: string;
  rowIndex: number;
}

export interface PanelControls {
  actionOf: (actionId: string) => PanelAction | null;
  runAction: (actionId: string, row: PanelRowTarget | null) => void;
  actionsLocked: string | null;
  retry: (source: string) => void;
  selectView: (cardKey: string, view: CardViewKind) => void;
  tintOf: (key: string) => number | null;
  editing: boolean;
  onEditKey: (cardKey: string, event: KeyboardEvent<HTMLElement>) => void;
}

const ignore = (): undefined => undefined;

export const INERT_CONTROLS: PanelControls = {
  actionOf: () => null,
  actionsLocked: null,
  editing: false,
  onEditKey: ignore,
  retry: ignore,
  runAction: ignore,
  selectView: ignore,
  tintOf: () => null,
};

const PanelControlsContext = createContext<PanelControls>(INERT_CONTROLS);

export function PanelControlsProvider({
  controls,
  children,
}: {
  controls: PanelControls;
  children: ReactNode;
}) {
  return (
    <PanelControlsContext value={controls}>{children}</PanelControlsContext>
  );
}

export const usePanelControls = (): PanelControls => use(PanelControlsContext);
