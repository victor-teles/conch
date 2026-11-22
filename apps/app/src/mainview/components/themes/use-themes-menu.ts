import { useCallback, useState } from "react";

import type { ThemeEditSource } from "@/components/themes/theme-edit-source";

import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { getErrorMessage } from "@/lib/error-message";
import { deleteTheme, exportTheme, importTheme } from "@/lib/ipc";
import { themeActions as store } from "@/lib/theme/theme-store";

import type { ThemeAction, ThemeActionId } from "./theme-actions";
import type { ThemeItem } from "./theme-items";

import { themeActions } from "./theme-actions";

interface UseThemesMenuOptions {
  onEdit: (source: ThemeEditSource) => void;
  onUsed: (item: ThemeItem) => void;
  onImported: (themeId: string) => void;
  notify: (message: string) => void;
  onClosed: () => void;
}

const IMPORT_FAILURES = {
  cancelled: null,
  "not-a-theme": "That file is not a Conch theme.",
  unreadable: "That file could not be read.",
} as const;

export const useThemesMenu = ({
  onEdit,
  onUsed,
  onImported,
  notify,
  onClosed,
}: UseThemesMenuOptions) => {
  const [menuItem, setMenuItem] = useState<ThemeItem | null>(null);
  const { arm, armed, disarm } = useArmedConfirm();

  const close = useCallback(() => {
    disarm();
    setMenuItem(null);
    onClosed();
  }, [disarm, onClosed]);

  const open = useCallback(
    (item: ThemeItem) => {
      disarm();
      setMenuItem(item);
    },
    [disarm]
  );

  const perform = useCallback(
    async (id: ThemeActionId, item: ThemeItem) => {
      switch (id) {
        case "use": {
          await store.selectTheme(item.id);
          onUsed(item);
          return;
        }
        case "edit": {
          onEdit({ kind: "existing", theme: item.theme });
          return;
        }
        case "duplicate":
        case "new": {
          onEdit({ from: item.theme, kind: "new" });
          return;
        }
        case "export": {
          const saved = await exportTheme(item.id);
          notify(`Saved ${saved.fileName} to Downloads`);
          return;
        }
        case "import": {
          const result = await importTheme();
          if (result.ok) {
            onImported(result.theme.id);
            notify(`Imported ${result.theme.name}`);
            return;
          }
          const failure = IMPORT_FAILURES[result.reason];
          if (failure) {
            notify(failure);
          }
          return;
        }
        case "delete": {
          await deleteTheme(item.id);
          notify(`Deleted ${item.theme.name}`);
          return;
        }
        default: {
          break;
        }
      }
    },
    [notify, onEdit, onImported, onUsed]
  );

  const run = useCallback(
    async (id: ThemeActionId, item: ThemeItem | null) => {
      if (!(item && themeActions(item).some((action) => action.id === id))) {
        return;
      }
      if (id === "delete" && !armed) {
        arm();
        return;
      }
      close();
      try {
        await perform(id, item);
      } catch (error) {
        notify(getErrorMessage(error, "That did not work."));
      }
    },
    [arm, armed, close, notify, perform]
  );

  const runMenuAction = useCallback(
    (action: ThemeAction) => run(action.id, menuItem),
    [menuItem, run]
  );

  return {
    actions: menuItem ? themeActions(menuItem) : [],
    armed,
    close,
    disarm,
    menuItem,
    open,
    run,
    runMenuAction,
  };
};
