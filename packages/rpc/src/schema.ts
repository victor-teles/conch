import type {
  ConnectionParams,
  DatabaseConnection,
  DialectType,
  HistoryEntry,
  HistoryFilters,
  SchemaInfo,
  TestConnectionResult,
} from "@conch/core";
import type { LookupValue } from "@conch/core/client";

import type {
  ActionActivityPage,
  ActionOutcome,
  ActionPreview,
  ActionProposal,
  ActionReview,
  ListedAction,
  PrepareActionRequest,
  ProposeActionRequest,
  ReviewActionRequest,
  SaveActionRequest,
  SetWriteActionsRequest,
  WriteTargetKind,
} from "./action.ts";
import type {
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  RedactedAiSettings,
} from "./ai-providers.ts";
import type { AskEventMessage, AskParams } from "./ask.ts";
import type { SqlAssumptions } from "./assumptions.ts";
import type { Board, BoardDraft } from "./board.ts";
import type {
  ApplyImportRequest,
  ExportBundleRequest,
  ExportBundleResult,
  ImportPreview,
  ImportResult,
  ImportSource,
} from "./bundle.ts";
import type { LookupEventMessage, LookupRequest } from "./lookup.ts";
import type {
  McpActivity,
  McpAuditEntry,
  McpClientKind,
  McpSettingsUpdate,
  RedactedMcpSettings,
} from "./mcp.ts";
import type {
  GenerateMiniAppRequest,
  MiniApp,
  MiniAppActionRequest,
  MiniAppGenEventMessage,
  MiniAppInputOptionsRequest,
  MiniAppSourceRun,
  RunMiniAppSourceRequest,
  SaveMiniAppRequest,
} from "./mini-app.ts";
import type {
  HttpEndpointInput,
  McpServerInput,
  McpToolSummary,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  SetMcpToolReadRequest,
  SourceTarget,
  SourceTestResult,
} from "./source-config.ts";
import type { RunSqlParams, SchemaPeek } from "./sql-run.ts";
import type {
  ImportThemeResult,
  Theme,
  ThemeDraft,
  ThemeSettings,
  ThemeState,
} from "./theme.ts";
import type { Watch, WatchDraft, WatchStatus, WidgetTrend } from "./watch.ts";
import type {
  ParamValues,
  PreviewSourceRequest,
  ProposeParamsRequest,
  ProposeParamsResult,
  RecentAsk,
  RunWidgetRequest,
  SourcePreviewResult,
  SourceProposal,
  Widget,
  WidgetDraft,
  WidgetRunResult,
} from "./widget.ts";

export type LauncherNavigateView =
  | "root"
  | "settings"
  | { kind: "widget-run"; widgetId: string }
  | "watches"
  | { kind: "ask-draft"; prompt: string; connection: string | null }
  | { kind: "widget-args"; widgetId: string; values: Record<string, string> }
  | { kind: "notice"; message: string }
  | { kind: "mini-app-action"; request: MiniAppActionRequest };

export const DEFAULT_LAUNCHER_HOTKEY = "Option+Shift+Space";
export const SAMPLE_CONNECTION_ID = "sample-store";

export const DEFAULT_CLIPBOARD_LOOKUPS = false;

export type UpdateChannel = "stable" | "beta" | "dev";

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export interface RpcSchema {
  requests: {
    testConnection: {
      params: { params: ConnectionParams };
      response: TestConnectionResult;
    };
    connectToDatabase: {
      params: { connectionId: string; params: ConnectionParams };
      response: void;
    };
    disconnectFromDatabase: {
      params: { connectionId: string };
      response: void;
    };
    getServerVersion: {
      params: { connectionId: string };
      response: string;
    };
    listConnectionDatabases: {
      params: { connectionId: string };
      response: string[];
    };
    getSchema: {
      params: {
        connectionId: string;
        databaseName: string;
        force?: boolean;
      };
      response: SchemaInfo;
    };
    formatSql: {
      params: { sql: string; dialect: string };
      response: string;
    };
    describeSql: {
      params: { sql: string; dialect: DialectType };
      response: SqlAssumptions | null;
    };

    getAiSettings: {
      params: Record<string, never>;
      response: RedactedAiSettings | null;
    };
    saveAiSettings: { params: AiSettingsInput; response: RedactedAiSettings };
    clearAiKey: {
      params: Record<string, never>;
      response: RedactedAiSettings | null;
    };
    testAiSettings: { params: AiSettingsInput; response: AiTestResult };
    getActiveConnection: {
      params: Record<string, never>;
      response: ActiveConnection | null;
    };
    setActiveConnection: {
      params: { active: ActiveConnection | null };
      response: void;
    };
    getLauncherHotkey: { params: Record<string, never>; response: string };
    getAppVersion: { params: Record<string, never>; response: string };
    appendHistory: { params: { entry: HistoryEntry }; response: void };
    getHistory: {
      params: {
        connectionId: string;
        limit?: number | null;
        offset?: number | null;
      };
      response: HistoryEntry[];
    };
    getAllHistory: {
      params: { filters?: HistoryFilters | null };
      response: HistoryEntry[];
    };
    getConnections: {
      params: Record<string, never>;
      response: DatabaseConnection[];
    };
    saveConnections: {
      params: { connections: DatabaseConnection[] };
      response: void;
    };
    resetSecrets: {
      params: Record<string, never>;
      response: void;
    };

    addSampleDatabase: {
      params: Record<string, never>;
      response: DatabaseConnection;
    };

    getUpdateChannel: {
      params: Record<string, never>;
      response: UpdateChannel;
    };
    checkForUpdate: {
      params: Record<string, never>;
      response: AvailableUpdate | null;
    };
    installUpdate: { params: Record<string, never>; response: boolean };

    copyImage: { params: { pngBase64: string }; response: void };
    saveToDownloads: {
      params: { baseName: string; extension: "csv"; content: string };
      response: { fileName: string; savedId: string };
    };
    revealSaved: { params: { savedId: string }; response: void };

    getThemeState: { params: Record<string, never>; response: ThemeState };
    setThemeSettings: {
      params: { settings: ThemeSettings };
      response: ThemeState;
    };
    saveTheme: { params: { theme: ThemeDraft }; response: Theme };
    deleteTheme: { params: { themeId: string }; response: ThemeState };
    exportTheme: {
      params: { themeId: string };
      response: { fileName: string; savedId: string };
    };
    importTheme: { params: Record<string, never>; response: ImportThemeResult };

    resizeLauncher: { params: { height: number }; response: void };
    hideLauncher: { params: Record<string, never>; response: void };

    rendererReady: {
      params: Record<string, never>;
      response: void;
    };

    ask: { params: AskParams; response: void };
    runSql: { params: RunSqlParams; response: void };
    peekSchema: { params: { connectionId: string }; response: SchemaPeek };
    cancelAsk: { params: { askId: string }; response: void };
    lookup: { params: LookupRequest; response: void };
    cancelLookup: { params: { lookupId: string }; response: void };
    getClipboardLookups: {
      params: Record<string, never>;
      response: { enabled: boolean };
    };
    setClipboardLookups: {
      params: { enabled: boolean };
      response: { enabled: boolean };
    };

    listWidgets: { params: Record<string, never>; response: Widget[] };
    saveWidget: { params: { widget: WidgetDraft }; response: Widget };
    deleteWidget: { params: { widgetId: string }; response: void };
    listRecentAsks: { params: { limit?: number }; response: RecentAsk[] };
    deleteRecentAsk: { params: { askId: string }; response: void };
    clearRecentAsks: { params: Record<string, never>; response: void };
    proposeWidgetParams: {
      params: ProposeParamsRequest;
      response: ProposeParamsResult;
    };
    runWidget: { params: RunWidgetRequest; response: WidgetRunResult };
    cancelWidgetRun: { params: { runId: string }; response: void };
    listBoards: { params: Record<string, never>; response: Board[] };
    getBoard: { params: { boardId: string }; response: Board | null };
    saveBoard: { params: { board: BoardDraft }; response: Board };
    deleteBoard: { params: { boardId: string }; response: void };
    addBoardTile: {
      params: { boardId: string; widgetId: string };
      response: Board;
    };
    openBoard: { params: { boardId: string }; response: void };
    toggleLauncher: {
      params: { fromWindowKey: string | null };
      response: void;
    };
    openWidgetInLauncher: { params: { widgetId: string }; response: void };
    loadParamOptions: {
      params: { widgetId: string; paramName: string };
      response: string[];
    };
    exportBundle: {
      params: ExportBundleRequest;
      response: ExportBundleResult;
    };
    previewImport: {
      params: { source: ImportSource };
      response: ImportPreview;
    };
    applyImport: { params: ApplyImportRequest; response: ImportResult };
    listWatches: { params: Record<string, never>; response: Watch[] };
    saveWatch: { params: { watch: WatchDraft }; response: Watch };
    deleteWatch: { params: { watchId: string }; response: void };
    listWatchStatuses: {
      params: Record<string, never>;
      response: WatchStatus[];
    };
    listWidgetTrends: {
      params: { widgetIds: string[] };
      response: Record<string, WidgetTrend>;
    };
    acknowledgeAlert: { params: { watchId: string }; response: void };
    setWatchingPaused: { params: { paused: boolean }; response: void };
    getWatchingPaused: { params: Record<string, never>; response: boolean };
    getMcpSettings: {
      params: Record<string, never>;
      response: RedactedMcpSettings;
    };
    saveMcpSettings: {
      params: McpSettingsUpdate;
      response: RedactedMcpSettings;
    };
    rotateMcpToken: {
      params: Record<string, never>;
      response: RedactedMcpSettings;
    };
    copyMcpClientConfig: {
      params: { client: McpClientKind };
      response: void;
    };
    listMcpAudit: { params: { limit?: number }; response: McpAuditEntry[] };
    clearMcpAudit: { params: Record<string, never>; response: void };
    listMcpServers: {
      params: Record<string, never>;
      response: RedactedMcpServer[];
    };
    saveMcpServer: {
      params: { server: McpServerInput };
      response: RedactedMcpServer | null;
    };
    deleteMcpServer: {
      params: { serverId: string };
      response: { widgetNames: string[] };
    };
    testMcpServer: { params: { serverId: string }; response: SourceTestResult };
    listMcpTools: {
      params: { serverId: string };
      response: McpToolSummary[];
    };
    setMcpToolRead: {
      params: SetMcpToolReadRequest;
      response: RedactedMcpServer | null;
    };
    listHttpEndpoints: {
      params: Record<string, never>;
      response: RedactedHttpEndpoint[];
    };
    saveHttpEndpoint: {
      params: { endpoint: HttpEndpointInput };
      response: RedactedHttpEndpoint;
    };
    deleteHttpEndpoint: {
      params: { endpointId: string };
      response: { widgetNames: string[] };
    };
    testHttpEndpoint: {
      params: { endpointId: string };
      response: SourceTestResult;
    };
    proposeSourceWidget: {
      params: { target: SourceTarget; prompt: string };
      response: SourceProposal;
    };
    previewSource: {
      params: PreviewSourceRequest;
      response: SourcePreviewResult;
    };
    listActions: { params: { widgetId: string }; response: ListedAction[] };
    saveAction: { params: SaveActionRequest; response: ListedAction };
    deleteAction: { params: { actionId: string }; response: void };
    reviewAction: { params: ReviewActionRequest; response: ActionReview };
    prepareAction: { params: PrepareActionRequest; response: ActionPreview };
    executeAction: { params: { token: string }; response: ActionOutcome };
    discardActionToken: { params: { token: string }; response: void };
    proposeAction: { params: ProposeActionRequest; response: ActionProposal };
    listWritePermissions: {
      params: Record<string, never>;
      response: { kind: WriteTargetKind; id: string }[];
    };
    setWriteActionsAllowed: {
      params: SetWriteActionsRequest;
      response: { allowed: boolean };
    };
    listActionActivity: {
      params: { limit?: number };
      response: ActionActivityPage;
    };
    listMiniApps: { params: Record<string, never>; response: MiniApp[] };
    getMiniApp: { params: { appId: string }; response: MiniApp | null };
    saveMiniApp: { params: SaveMiniAppRequest; response: MiniApp };
    deleteMiniApp: { params: { appId: string }; response: void };
    duplicateMiniApp: { params: { appId: string }; response: MiniApp };
    setMiniAppValues: {
      params: { appId: string; values: ParamValues };
      response: MiniApp | null;
    };
    runMiniAppSource: {
      params: RunMiniAppSourceRequest;
      response: MiniAppSourceRun;
    };
    cancelMiniAppRun: { params: { runId: string }; response: void };
    loadMiniAppInputOptions: {
      params: MiniAppInputOptionsRequest;
      response: string[];
    };
    generateMiniApp: { params: GenerateMiniAppRequest; response: void };
    cancelMiniAppGeneration: { params: { genId: string }; response: void };
    openMiniApp: { params: { appId: string }; response: void };
    stageMiniAppAction: { params: MiniAppActionRequest; response: void };
    prepareMiniAppAction: {
      params: MiniAppActionRequest;
      response: ActionPreview;
    };
  };
  messages: {
    launcherShown: { clipboard: LookupValue | null; maxHeight?: number };
    launcherToggle: Record<string, never>;
    launcherDismiss: Record<string, never>;
    launcherNavigate: { view: LauncherNavigateView };
    updateProgress: { percent: number; downloaded: number; total: number };
    askEvent: AskEventMessage;
    lookupEvent: LookupEventMessage;
    boardChanged: { boardId: string };
    watchesChanged: Record<string, never>;
    widgetSampled: { widgetId: string; valuesKey: string };
    mcpActivity: { active: McpActivity[] };
    miniAppGenEvent: MiniAppGenEventMessage;
    miniAppChanged: { appId: string };
    miniAppRefresh: { appId: string; sources: string[] };
    themeChanged: ThemeState;
  };
}
