import { boardLink, draftOf, widgetLink } from "@conch/rpc";
import { useCallback, useState } from "react";

import type { Board, ExportScope, Widget } from "@/lib/ipc";

import { useMenuBarToggle } from "@/components/watches/use-menu-bar-toggle";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { useFlashMessage } from "@/hooks/use-flash-message";
import { copyText } from "@/lib/clipboard";
import { deleteBoard, saveBoard } from "@/lib/ipc";

import type { CatalogAction, CatalogItem } from "./catalog-actions";

export interface CatalogNavigation {
  openBoard: (boardId: string) => void;
  renameBoard: (board: Board) => void;
  runWidget: (widgetId: string) => void;
  addToBoard: (widgetId: string) => void;
  exportScope: (scope: ExportScope) => void;
  watchWidget: (widgetId: string) => void;
}

interface UseCatalogMenuOptions {
  navigate: CatalogNavigation;
  onChanged: () => void;
  onClosed: () => void;
}

const runWidgetAction = async (
  action: CatalogAction,
  widget: Widget,
  navigate: CatalogNavigation,
  toggleMenuBar: (widget: Widget) => Promise<boolean>
) => {
  switch (action.id) {
    case "run-widget": {
      navigate.runWidget(widget.id);
      break;
    }
    case "add-to-board": {
      navigate.addToBoard(widget.id);
      break;
    }
    case "watch": {
      navigate.watchWidget(widget.id);
      break;
    }
    case "export-widget": {
      navigate.exportScope({ kind: "widget", widgetId: widget.id });
      break;
    }
    case "menu-bar": {
      await toggleMenuBar(widget);
      break;
    }
    default: {
      break;
    }
  }
};

export const COPIED_LINK = "Copied link";
const NOTICE_MS = 2000;

const linkOf = (item: CatalogItem): string =>
  item.kind === "board" ? boardLink(item.board.id) : widgetLink(item.widget.id);

const duplicateOf = (board: Board) => {
  const { id: _id, ...draft } = draftOf(board);
  return { ...draft, name: `${board.name} copy`.slice(0, 60) };
};

export const useCatalogMenu = ({
  navigate,
  onChanged,
  onClosed,
}: UseCatalogMenuOptions) => {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const { arm, armed, disarm } = useArmedConfirm();
  const toggleMenuBar = useMenuBarToggle();
  const { flash, message: notice } = useFlashMessage(NOTICE_MS);

  const close = useCallback(() => {
    disarm();
    setItem(null);
    onClosed();
  }, [disarm, onClosed]);

  const open = useCallback(
    (next: CatalogItem) => {
      disarm();
      setItem(next);
    },
    [disarm]
  );

  const runOn = useCallback(
    async (target: CatalogItem, action: CatalogAction) => {
      if (action.id === "copy-link") {
        if (await copyText(linkOf(target))) {
          flash(COPIED_LINK);
        }
        return;
      }
      if (target.kind === "widget") {
        await runWidgetAction(action, target.widget, navigate, toggleMenuBar);
        return;
      }
      switch (action.id) {
        case "open-board": {
          navigate.openBoard(target.board.id);
          break;
        }
        case "rename-board": {
          navigate.renameBoard(target.board);
          break;
        }
        case "export-board": {
          navigate.exportScope({ boardId: target.board.id, kind: "board" });
          break;
        }
        case "duplicate-board": {
          await saveBoard(duplicateOf(target.board));
          onChanged();
          break;
        }
        case "delete-board": {
          await deleteBoard(target.board.id);
          onChanged();
          break;
        }
        default: {
          break;
        }
      }
    },
    [flash, navigate, onChanged, toggleMenuBar]
  );

  const run = useCallback(
    async (action: CatalogAction) => {
      if (!item) {
        return;
      }
      if (action.id === "delete-board" && !armed) {
        arm();
        return;
      }
      close();
      await runOn(item, action);
    },
    [arm, armed, close, item, runOn]
  );

  return { armed, close, item, notice, open, run, runOn };
};
