import type { ReactNode } from "react";

import { render } from "vitest-browser-react";

import type { DatabaseConnection } from "@/lib/connections";

import { AppProviders } from "@/components/app-providers";
import { ConnectionsProvider } from "@/components/launcher/connections/connections-provider";
import { WatchesProvider } from "@/components/watches/watches-provider";
import { WidgetsProvider } from "@/components/widgets/widgets-provider";
import { createThemeEmulator } from "@/lib/browser-theme-stub";

import type { CommandHandlers } from "./ipc-mock";

import { emitIpcMessage, mockIpc } from "./ipc-mock";
import { makeMcpSettings } from "./mcp-fixtures";

interface LauncherIpcOptions {
  connections?: DatabaseConnection[];
  handlers?: CommandHandlers;
}

// Backs the launcher with an in-memory connection store so writes made by
// one call are visible to the next, like the encrypted file on disk.
export const mockLauncherIpc = ({
  connections = [],
  handlers = {},
}: LauncherIpcOptions = {}) => {
  const store = { active: null as unknown, connections: [...connections] };
  const themes = createThemeEmulator((state) =>
    emitIpcMessage("themeChanged", state)
  );
  mockIpc({
    connectToDatabase: () => null,
    deleteTheme: (payload) =>
      themes.deleteTheme(payload as { themeId: string }),
    describeSql: () => null,
    disconnectFromDatabase: () => null,
    exportTheme: (payload) =>
      themes.exportTheme(payload as { themeId: string }),
    getActiveConnection: () => store.active,
    getAiSettings: () => null,
    getAppVersion: () => "1.4.0",
    getClipboardLookups: () => ({ enabled: false }),
    getConnections: () => store.connections,
    getLauncherHotkey: () => "Option+Shift+Space",
    getMcpSettings: () => makeMcpSettings(),
    getThemeState: () => themes.getThemeState(),
    getUpdateChannel: () => "stable",
    getWatchingPaused: () => false,
    hideLauncher: () => null,
    importTheme: () => themes.importTheme(),
    listActions: () => [],
    listBoards: () => [],
    listHttpEndpoints: () => [],
    listMcpServers: () => [],
    listRecentAsks: () => [],
    listWatchStatuses: () => [],
    listWatches: () => [],
    listWidgetTrends: () => ({}),
    listWidgets: () => [],
    listWritePermissions: () => [],
    resizeLauncher: () => null,
    saveConnections: (payload) => {
      store.connections = payload.connections as DatabaseConnection[];
      return null;
    },
    saveTheme: (payload) => themes.saveTheme(payload as { theme: unknown }),
    setActiveConnection: (payload) => {
      store.active = payload.active;
      return null;
    },
    setThemeSettings: (payload) =>
      themes.setThemeSettings(payload as { settings: unknown }),
    testConnection: () => ({ latencyMs: 12, message: "ok", success: true }),
    ...handlers,
  });
  return store;
};

export const renderWithConnections = (ui: ReactNode) =>
  render(
    <AppProviders>
      <ConnectionsProvider>
        <WidgetsProvider>
          <WatchesProvider>{ui}</WatchesProvider>
        </WidgetsProvider>
      </ConnectionsProvider>
    </AppProviders>
  );
