import { useCallback, useMemo } from "react";

import type { ActionContext, TabularResult } from "@/lib/ipc";

import { copyText } from "@/lib/clipboard";

import type { ActionMenuEntry, BuiltinRowAction } from "./action-menu-items";
import type { RowSelectionTarget } from "./row-selection";
import type { RowSelection } from "./use-row-selection";

import { actionMenuEntries } from "./action-menu-items";
import { useActionRun } from "./use-action-run";
import { useListedActions } from "./use-listed-actions";

interface WidgetRunActionsOptions {
  widgetId: string;
  result: TabularResult | null;
  rows: RowSelection;
  context: ActionContext | null;
  announce: (text: string) => void;
  openMenu: () => void;
}

const cellText = (cell: unknown): string => {
  if (cell === null || cell === undefined) {
    return "";
  }
  return typeof cell === "object" ? JSON.stringify(cell) : String(cell);
};

const builtinText = (
  builtin: BuiltinRowAction,
  columns: readonly string[],
  row: readonly unknown[]
): string =>
  builtin === "copy-value"
    ? cellText(row[0])
    : JSON.stringify(
        Object.fromEntries(columns.map((name, index) => [name, row[index]])),
        null,
        2
      );

export const columnsOf = (result: TabularResult | null): string[] =>
  result?.columns.map((column) => column.name) ?? [];

// What a widget run needs to act on its rows: the saved actions, the menu
// entries, the row target for the table and the run that confirms writes.
export const useWidgetRunActions = ({
  widgetId,
  result,
  rows,
  context,
  announce,
  openMenu,
}: WidgetRunActionsOptions) => {
  const { listed, refresh } = useListedActions(widgetId);
  const actionRun = useActionRun(announce);
  const columns = useMemo(() => columnsOf(result), [result]);
  const { select, selected } = rows;

  const rowTarget = useMemo<RowSelectionTarget | null>(
    () =>
      result
        ? {
            openMenu: (rowIndex) => {
              select(rowIndex);
              openMenu();
            },
            select,
            selected,
          }
        : null,
    [openMenu, result, select, selected]
  );

  const entries = useMemo(
    () => actionMenuEntries(listed, selected !== null),
    [listed, selected]
  );

  const { start } = actionRun;
  const runEntry = useCallback(
    async (entry: ActionMenuEntry) => {
      if (entry.kind === "declared") {
        if (context) {
          start(entry.listed, context);
        }
        return;
      }
      const row = selected === null ? null : result?.rows[selected];
      if (!row) {
        return;
      }
      const copied = await copyText(builtinText(entry.builtin, columns, row));
      if (copied) {
        announce(
          entry.builtin === "copy-value" ? "Copied value" : "Copied row"
        );
      }
    },
    [announce, columns, context, result, selected, start]
  );

  return { actionRun, entries, refresh, rowTarget, runEntry };
};
