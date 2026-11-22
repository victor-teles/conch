import { isSqlDialect } from "@conch/core/client";
import { askLink } from "@conch/rpc";
import { useCallback, useState } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { RootAlert } from "@/components/watches/use-alerts";
import type { DatabaseConnection } from "@/lib/connections";
import type { RecentAsk } from "@/lib/ipc";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { copyText } from "@/lib/clipboard";
import { deleteRecentAsk } from "@/lib/ipc";

import type { RootItem } from "./root-items";
import type { RowAction, RowMenuItem } from "./row-actions";

import { isShownAnswer } from "./root-items";
import { rowActions } from "./row-actions";

export interface RowActionHandlers {
  runItem: (item: RootItem) => void;
  startSql: (sql: string, target: AskTarget, title?: string) => void;
  dismissAlert: (alert: RootAlert) => void;
  discardDraft: () => void;
  focusColumns: (() => void) | null;
  recentsChanged: () => void;
}

interface UseRowActionsMenuOptions {
  connections: readonly DatabaseConnection[];
  lastAnswerId: string | null;
  handlers: RowActionHandlers;
  onClosed: () => void;
}

const COPIED: Partial<Record<RowAction["id"], string>> = {
  "copy-ask-link": "Copied link",
  "copy-prompt": "Copied the prompt",
  "copy-sql": "Copied the SQL",
  "copy-table": "Copied the table name",
  "copy-value": "Copied the value",
};

const NOTICE_MS = 2000;

const promptOf = (item: RowMenuItem): string | null => {
  if (item.kind === "ask" || item.kind === "build-app") {
    return item.prompt;
  }
  return item.kind === "recent" ? item.ask.prompt : null;
};

const sqlOf = (item: RowMenuItem): string | null => {
  if (item.kind === "sql") {
    return item.sql;
  }
  return item.kind === "recent" ? item.ask.sql : null;
};

// The link names the connection, not its id, so it works on a colleague's machine.
const askLinkOf = (
  item: RowMenuItem,
  connections: readonly DatabaseConnection[]
): string | null => {
  if (item.kind !== "recent") {
    return null;
  }
  const connection = connections.find(
    (entry) => entry.id === item.ask.connectionId
  );
  return askLink(item.ask.prompt, connection?.name ?? null);
};

const copiedText = (
  item: RowMenuItem,
  id: RowAction["id"],
  connections: readonly DatabaseConnection[]
): string | null => {
  switch (id) {
    case "copy-ask-link": {
      return askLinkOf(item, connections);
    }
    case "copy-prompt": {
      return promptOf(item);
    }
    case "copy-sql": {
      return sqlOf(item);
    }
    case "copy-value": {
      return item.kind === "lookup" ? item.value.value : null;
    }
    case "copy-table": {
      if (item.kind !== "table") {
        return null;
      }
      return item.schema
        ? `${item.schema}.${item.table.name}`
        : item.table.name;
    }
    default: {
      return null;
    }
  }
};

// Stored SQL only runs where it was written, and only if it is SQL.
const sqlRunnableFor = (
  item: RowMenuItem,
  connections: readonly DatabaseConnection[]
): boolean =>
  item.kind === "recent" &&
  isSqlDialect(item.ask.dialect) &&
  connections.some((connection) => connection.id === item.ask.connectionId);

const recentTarget = (ask: RecentAsk): AskTarget => ({
  connectionId: ask.connectionId,
  database: ask.database,
});

export const useRowActionsMenu = ({
  connections,
  lastAnswerId,
  handlers,
  onClosed,
}: UseRowActionsMenuOptions) => {
  const [item, setItem] = useState<RowMenuItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { arm, armed, disarm } = useArmedConfirm();

  const actionsFor = useCallback(
    (target: RowMenuItem) =>
      rowActions(target, {
        shownAnswer: isShownAnswer(target, lastAnswerId),
        sqlRunnable: sqlRunnableFor(target, connections),
      }),
    [connections, lastAnswerId]
  );

  const announce = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(
      () => setNotice((current) => (current === text ? null : current)),
      NOTICE_MS
    );
  }, []);

  const perform = useCallback(
    async (target: RowMenuItem, action: RowAction) => {
      const copied = copiedText(target, action.id, connections);
      if (copied !== null) {
        if (await copyText(copied)) {
          announce(COPIED[action.id] ?? "Copied");
        }
        return;
      }
      switch (action.id) {
        case "run": {
          handlers.runItem(target);
          break;
        }
        case "run-sql": {
          if (target.kind === "recent") {
            handlers.startSql(
              target.ask.sql,
              recentTarget(target.ask),
              target.ask.spec.title
            );
          }
          break;
        }
        case "show-columns": {
          handlers.focusColumns?.();
          break;
        }
        case "remove-recent": {
          if (target.kind === "recent") {
            await deleteRecentAsk(target.ask.id);
            handlers.recentsChanged();
            announce("Removed from history");
          }
          break;
        }
        case "dismiss-alert": {
          if (target.kind === "alert") {
            handlers.dismissAlert(target.alert);
          }
          break;
        }
        case "discard-draft": {
          handlers.discardDraft();
          break;
        }
        default: {
          break;
        }
      }
    },
    [announce, connections, handlers]
  );

  const close = useCallback(() => {
    disarm();
    setItem(null);
    onClosed();
  }, [disarm, onClosed]);

  const open = useCallback(
    (next: RowMenuItem) => {
      disarm();
      setItem(next);
    },
    [disarm]
  );

  const run = useCallback(
    async (action: RowAction) => {
      if (!item) {
        return;
      }
      if (action.tone === "destructive" && !armed) {
        arm();
        return;
      }
      const target = item;
      close();
      await perform(target, action);
    },
    [arm, armed, close, item, perform]
  );

  // Runs the action a key combination is labelled with, as the menu shows it.
  const runKeys = useCallback(
    async (target: RowMenuItem, keys: readonly string[]) => {
      const action = actionsFor(target).find(
        (candidate) => candidate.keys?.join(" ") === keys.join(" ")
      );
      if (action && !action.disabled) {
        await perform(target, action);
      }
    },
    [actionsFor, perform]
  );

  return {
    actions: item ? actionsFor(item) : [],
    armed,
    close,
    item,
    notice,
    open,
    run,
    runKeys,
  };
};
