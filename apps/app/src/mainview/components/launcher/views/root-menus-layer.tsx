import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import type { ConnectionAction } from "@/components/launcher/connections/connection-actions";

import { ActionsMenu } from "@/components/launcher/actions/actions-menu";
import { ConnectionActionsMenu } from "@/components/launcher/connections/connection-actions-menu";
import { optionId } from "@/components/launcher/launcher-row";

import type { RootMenus } from "./use-root-menus";

import { catalogTitle } from "./catalog-actions";
import { rowMenuTitle } from "./row-actions";

interface RootMenusLayerProps {
  menus: RootMenus["layer"];
}

export function RootMenusLayer({ menus }: RootMenusLayerProps) {
  const { catalog, connection, rows } = menus;
  const { menuConnection, run: runConnection } = connection;
  const { close: handleCloseConnection } = connection;
  const { close: handleCloseCatalog, run: handleRunCatalog } = catalog;
  const { close: handleCloseRow, run: handleRunRow } = rows;
  const handleRunConnection = useCallback(
    (action: ConnectionAction) => {
      if (menuConnection) {
        runConnection(action, menuConnection);
      }
    },
    [menuConnection, runConnection]
  );
  const armedRowAction = rows.armed
    ? (rows.actions.find((action) => action.tone === "destructive")?.id ?? null)
    : null;

  return (
    <AnimatePresence>
      {menuConnection ? (
        <ConnectionActionsMenu
          actions={connection.actions}
          armed={connection.armed}
          connection={menuConnection}
          key={menuConnection.id}
          onClose={handleCloseConnection}
          onRun={handleRunConnection}
        />
      ) : null}
      {catalog.item ? (
        <ActionsMenu
          actions={catalog.actions}
          anchorId={optionId(catalog.item.id)}
          armedId={catalog.armed ? "delete-board" : null}
          key={catalog.item.id}
          onClose={handleCloseCatalog}
          onRun={handleRunCatalog}
          title={catalogTitle(catalog.item)}
        />
      ) : null}
      {rows.item ? (
        <ActionsMenu
          actions={rows.actions}
          anchorId={optionId(rows.item.id)}
          armedId={armedRowAction}
          key={rows.item.id}
          onClose={handleCloseRow}
          onRun={handleRunRow}
          title={rowMenuTitle(rows.item)}
        />
      ) : null}
    </AnimatePresence>
  );
}
