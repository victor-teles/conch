import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { Watch } from "@/lib/ipc";

import { actionsMenuHeight } from "@/components/launcher/actions/actions-menu";
import {
  SECOND_KEYS,
  secondActionOf,
} from "@/components/launcher/actions/menu-action";
import { connectionActions } from "@/components/launcher/connections/connection-actions";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { useConnectionActionsMenu } from "@/components/launcher/connections/use-connection-actions-menu";
import {
  useWatches,
  watchForWidget,
} from "@/components/watches/watches-provider";

import type { CatalogItem } from "./catalog-actions";
import type { RootItem } from "./root-items";
import type { CatalogNavigation } from "./use-catalog-menu";
import type { RowActionHandlers } from "./use-row-actions-menu";

import { catalogActions, isCatalogItem } from "./catalog-actions";
import { isRowMenuItem } from "./row-actions";
import { useCatalogMenu } from "./use-catalog-menu";
import { useRowActionsMenu } from "./use-row-actions-menu";

const catalogMenuFor = (
  item: CatalogItem | null,
  watches: readonly Watch[]
) => {
  if (!item) {
    return [];
  }
  const watch =
    item.kind === "widget" ? watchForWidget(watches, item.widget.id) : null;
  return catalogActions(item, watch);
};

interface UseRootMenusOptions {
  catalogNavigation: CatalogNavigation;
  lastAnswerId: string | null;
  rowHandlers: RowActionHandlers;
  onBoardsChanged: () => void;
  onActivate: (connection: DatabaseConnection) => void;
  onEdit: (connectionId: string) => void;
  onClosed: () => void;
}

// One ⌘K for every root row: connections, saved widgets and boards keep their
// own menus, every other row gets the row menu. ⌘↵ runs the item each menu
// labels ⌘↩.
export const useRootMenus = ({
  catalogNavigation,
  lastAnswerId,
  rowHandlers,
  onBoardsChanged,
  onActivate,
  onEdit,
  onClosed,
}: UseRootMenusOptions) => {
  const { state } = useConnections();
  const { watches } = useWatches();
  const connection = useConnectionActionsMenu({ onActivate, onClosed, onEdit });
  const catalog = useCatalogMenu({
    navigate: catalogNavigation,
    onChanged: onBoardsChanged,
    onClosed,
  });
  const rows = useRowActionsMenu({
    connections: state.connections,
    handlers: rowHandlers,
    lastAnswerId,
    onClosed,
  });
  const { liveIds } = state;
  const { open: openConnection, run: runConnection } = connection;
  const { open: openCatalog, runOn: runCatalog } = catalog;
  const { open: openRow, runKeys: runRowKeys } = rows;

  const openActions = useCallback(
    (item: RootItem) => {
      if (item.kind === "connection") {
        openConnection(item.connection.id);
      } else if (isCatalogItem(item)) {
        openCatalog(item);
      } else if (isRowMenuItem(item)) {
        openRow(item);
      }
    },
    [openCatalog, openConnection, openRow]
  );

  const runSecond = useCallback(
    async (item: RootItem) => {
      if (item.kind === "connection") {
        const live = liveIds.includes(item.connection.id);
        const second = secondActionOf(connectionActions(item.connection, live));
        if (second) {
          runConnection(second, item.connection);
        }
        return;
      }
      if (isCatalogItem(item)) {
        const second = secondActionOf(catalogMenuFor(item, watches));
        if (second && !second.disabled) {
          await runCatalog(item, second);
        }
        return;
      }
      if (isRowMenuItem(item)) {
        await runRowKeys(item, SECOND_KEYS);
      }
    },
    [liveIds, runCatalog, runConnection, runRowKeys, watches]
  );

  const runShortcut = useCallback(
    async (item: RootItem, keys: readonly string[]) => {
      if (isRowMenuItem(item)) {
        await runRowKeys(item, keys);
      }
    },
    [runRowKeys]
  );

  const menuConnection =
    state.connections.find((entry) => entry.id === connection.openId) ?? null;
  const connectionMenu = menuConnection
    ? connectionActions(menuConnection, liveIds.includes(menuConnection.id))
    : [];
  const catalogMenu = catalogMenuFor(catalog.item, watches);
  const minHeight = Math.max(
    menuConnection ? actionsMenuHeight(connectionMenu.length) : 0,
    catalog.item ? actionsMenuHeight(catalogMenu.length) : 0,
    rows.item ? actionsMenuHeight(rows.actions.length) : 0
  );
  const armedId =
    (connection.armed && connection.openId) ||
    (catalog.armed && catalog.item?.id) ||
    (rows.armed && rows.item?.id) ||
    null;

  return {
    armedId,
    layer: {
      catalog: { ...catalog, actions: catalogMenu },
      connection: { ...connection, actions: connectionMenu, menuConnection },
      rows,
    },
    minHeight,
    notice: rows.notice,
    openActions,
    runSecond,
    runShortcut,
  };
};

export type RootMenus = ReturnType<typeof useRootMenus>;
