import { useMemo } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type { Board, LookupValue } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { parseLauncherInput } from "@/components/launcher/input-mode";
import {
  aiSetupCommand,
  fallbackCommands,
  rootCommands,
} from "@/components/launcher/root-commands";
import {
  catalogTables,
  searchTables,
} from "@/components/launcher/schema/table-search";
import { useTableCatalog } from "@/components/launcher/schema/use-table-catalog";
import { useMiniApps } from "@/components/mini-app/mini-apps-provider";
import { useAlerts } from "@/components/watches/use-alerts";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { isSqlDatabase } from "@/lib/connections";

import type { ModeView } from "./mode-items";
import type { RootNavigation } from "./root-view";
import type { PreviewTarget } from "./use-root-run";

import { modeView } from "./mode-items";
import { buildRootSections, flattenSections } from "./root-items";
import { useAiReadiness } from "./use-ai-readiness";

type CommandNavigation = Pick<
  RootNavigation,
  | "openSettings"
  | "openHistory"
  | "dismiss"
  | "editConnection"
  | "newBoard"
  | "buildApp"
  | "newSourceWidget"
  | "openActivity"
  | "openImport"
  | "openThemes"
> & { exportAll: () => void; startMode: (prefix: string) => void };

interface UseRootSectionsOptions {
  query: string;
  boards: readonly Board[];
  navigate: CommandNavigation;
  offer: LookupValue | null;
  askWith?: DatabaseConnection | null;
}

const APP_WORDS = new Set(["app", "apps"]);

// With no apps yet, typing "app" explains how to make one.
const appsNote = (query: string, count: number) =>
  count === 0 && APP_WORDS.has(query.trim().toLowerCase())
    ? {
        text: "Describe a tool and press ↵ on Build an app",
        tone: "tip" as const,
      }
    : null;

export const useRootSections = ({
  query,
  boards,
  navigate,
  offer,
  askWith = null,
}: UseRootSectionsOptions) => {
  const { state, activeConnection } = useConnections();
  const aiReady = useAiReadiness();
  const { widgets, recents } = useWidgets();
  const { apps } = useMiniApps();
  const {
    openSettings,
    openHistory,
    dismiss,
    editConnection,
    newBoard,
    buildApp,
    newSourceWidget,
    openActivity,
    openImport,
    openThemes,
    exportAll,
    startMode,
  } = navigate;
  const activeId = activeConnection?.id ?? null;
  const { alerts } = useAlerts();

  const commands = useMemo(
    () =>
      rootCommands({
        addConnection: () => editConnection(null),
        dismiss,
        exportAll,
        newApp: () => buildApp("", activeId),
        newBoard,
        newSourceWidget,
        openActivity,
        openHistory,
        openImport,
        openSettings,
        openThemes,
        startMode,
      }),
    [
      activeId,
      buildApp,
      dismiss,
      editConnection,
      exportAll,
      newBoard,
      newSourceWidget,
      openActivity,
      openHistory,
      openImport,
      openSettings,
      openThemes,
      startMode,
    ]
  );

  const input = useMemo(() => parseLauncherInput(query), [query]);
  const sqlConnection =
    activeConnection && isSqlDatabase(activeConnection.type)
      ? activeConnection
      : null;
  const tableConnection = input.mode === "table" ? sqlConnection : null;
  const canFindTable = sqlConnection !== null;
  const fallbacks = useMemo(
    () =>
      fallbackCommands(query, {
        findTable: canFindTable ? (text) => startMode(`#${text}`) : null,
        searchHistory: openHistory,
      }),
    [canFindTable, openHistory, query, startMode]
  );
  const { catalog, retry } = useTableCatalog(tableConnection);
  const peek = catalog.status === "ready" ? catalog.peek : null;
  const tables = useMemo(
    () =>
      peek && input.mode === "table"
        ? searchTables(catalogTables(peek.schema), input.needle)
        : [],
    [input, peek]
  );

  const view: ModeView =
    input.mode === "search"
      ? {
          note: appsNote(query, apps.length),
          sections: buildRootSections({
            aiSetup: aiReady === false ? aiSetupCommand(openSettings) : null,
            alerts,
            apps,
            askWith: aiReady === true ? (askWith ?? activeConnection) : null,
            boards,
            commands,
            connections: state.connections,
            draft: state.draft,
            fallbacks,
            lookup: input.lookup,
            lookupWith: sqlConnection,
            offer,
            query,
            recents,
            widgets,
          }),
        }
      : modeView({
          active: activeConnection,
          connections: state.connections,
          input,
          tables,
        });

  const preview: PreviewTarget | null =
    tableConnection && peek
      ? { connectionId: tableConnection.id, dialect: peek.dialect }
      : null;

  return {
    ...view,
    input,
    items: flattenSections(view.sections),
    query,
    tables: tableConnection ? { catalog, preview, retry } : null,
  };
};

export type RootSectionsView = ReturnType<typeof useRootSections>;
