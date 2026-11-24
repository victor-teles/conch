import type {
  ColumnDetail,
  ColumnInfo,
  ConnectionParams,
  DatabaseConnection,
  DialectType,
  DocumentResult,
  ExecuteResult,
  ForeignKeyItem,
  HistoryEntry,
  HistoryFilters,
  IndexItem,
  LookupValue,
  QueryParams,
  QueryResult,
  RedisKey,
  RedisKeyKind,
  SchemaInfo,
  SchemaItem,
  TableItem,
  TabularResult,
  TestConnectionResult,
  ViewItem,
} from "@conch/core/client";
import type {
  ActionActivity,
  ActionActivityPage,
  ActionContext,
  ActionDraft,
  ActionEffect,
  ActionOutcome,
  ActionPreview,
  ActionProposal,
  ActionReview,
  ActionScope,
  ActionTarget,
  ActionTargetKind,
  AuditIntegrity,
  BindSource,
  BoundValue,
  CompiledAction,
  ListedAction,
  ProposeActionRequest,
  WidgetAction,
  WriteTargetKind,
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  ApplyImportRequest,
  AskErrorCode,
  AskEvent,
  AskParams,
  AskPhase,
  AvailableUpdate,
  Board,
  BoardDraft,
  BoardTile,
  Bundle,
  CardSpec,
  CardView,
  ChartView,
  ColumnFormat,
  ConnectionPlan,
  ExportBundleResult,
  ExportDestination,
  ExportScope,
  ImportIssue,
  ImportPlan,
  ImportPreview,
  ImportResult,
  ImportSource,
  LauncherNavigateView,
  LookupErrorCode,
  LookupEvent,
  LookupHit,
  McpActivity,
  McpAuditEntry,
  McpClientKind,
  McpSettingsUpdate,
  ParamDef,
  ParamType,
  ParamValue,
  ParamValues,
  ProposeParamsResult,
  RecentAsk,
  RedactedAiSettings,
  RedactedMcpSettings,
  RefineContext,
  RefreshInterval,
  RpcSchema,
  RunSqlParams,
  SchemaPeek,
  SqlAssumption,
  SqlAssumptions,
  TileSize,
  TimeGrain,
  UpdateChannel,
  Watch,
  WatchCondition,
  WatchDraft,
  WatchInterval,
  WatchState,
  WatchStatus,
  ImportThemeResult,
  Theme,
  ThemeDraft,
  ThemeSettings,
  ThemeState,
  Widget,
  WidgetDraft,
  WidgetPlan,
  WidgetRunResult,
  WidgetTrend,
  CompiledSource,
  ExternalSource,
  HttpEndpointInput,
  HttpSource,
  McpServerInput,
  McpSource,
  McpToolSummary,
  ParamRef,
  PreviewSourceRequest,
  QueryLeaf,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  RedactedSecret,
  SetMcpToolReadRequest,
  Source,
  SourceKind,
  SourcePreviewResult,
  SourceProposal,
  SourceTarget,
  SourceTestResult,
  SqlSource,
} from "@conch/rpc";
import type {
  AppActionDraft,
  CardElement,
  DraftPatch,
  DraftState,
  GenerateMiniAppRequest,
  MiniApp,
  MiniAppActionRequest,
  MiniAppDraft,
  MiniAppGenErrorCode,
  MiniAppGenEvent,
  MiniAppGenPhase,
  MiniAppSourceRun,
  MiniAppTarget,
  PanelElement,
  PanelElementOf,
  PanelElementType,
  PanelLayout,
  Visibility,
} from "@conch/rpc/mini-app";

import { decodeRpcError } from "@conch/rpc";
import { Electroview } from "electrobun/view";

import { createBrowserIpcStub } from "@/lib/browser-ipc-stub";

export type {
  LookupErrorCode,
  LookupEvent,
  LookupHit,
  LookupValue,
  RunSqlParams,
  SchemaPeek,
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  AskErrorCode,
  AskEvent,
  AskParams,
  AskPhase,
  AvailableUpdate,
  Board,
  BoardDraft,
  BoardTile,
  CardSpec,
  CardView,
  ChartView,
  ColumnDetail,
  ColumnFormat,
  ColumnInfo,
  ConnectionParams,
  DatabaseConnection,
  DocumentResult,
  ExecuteResult,
  ForeignKeyItem,
  HistoryEntry,
  HistoryFilters,
  IndexItem,
  LauncherNavigateView,
  ParamDef,
  ParamType,
  ParamValue,
  ParamValues,
  ProposeParamsResult,
  QueryParams,
  QueryResult,
  RecentAsk,
  RedactedAiSettings,
  RefineContext,
  RedisKey,
  RedisKeyKind,
  RpcSchema,
  SchemaInfo,
  SchemaItem,
  SqlAssumption,
  SqlAssumptions,
  TableItem,
  TabularResult,
  TestConnectionResult,
  TimeGrain,
  RefreshInterval,
  TileSize,
  UpdateChannel,
  ViewItem,
  Watch,
  WatchCondition,
  WatchDraft,
  WatchInterval,
  WatchState,
  WatchStatus,
  Widget,
  WidgetDraft,
  WidgetRunResult,
  WidgetTrend,
};
export type {
  ApplyImportRequest,
  Bundle,
  ConnectionPlan,
  ExportBundleResult,
  ExportDestination,
  ExportScope,
  ImportIssue,
  ImportPlan,
  ImportPreview,
  ImportResult,
  ImportSource,
  WidgetPlan,
};
export type {
  ActionActivity,
  ActionActivityPage,
  ActionContext,
  ActionDraft,
  ActionEffect,
  ActionOutcome,
  ActionPreview,
  ActionProposal,
  ActionReview,
  ActionScope,
  ActionTarget,
  ActionTargetKind,
  AuditIntegrity,
  BindSource,
  BoundValue,
  CompiledAction,
  ListedAction,
  ProposeActionRequest,
  WidgetAction,
  WriteTargetKind,
};
export type {
  McpActivity,
  McpAuditEntry,
  McpClientKind,
  McpSettingsUpdate,
  RedactedMcpSettings,
};
export type {
  CompiledSource,
  ExternalSource,
  HttpEndpointInput,
  HttpSource,
  McpServerInput,
  McpSource,
  McpToolSummary,
  ParamRef,
  PreviewSourceRequest,
  QueryLeaf,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  RedactedSecret,
  SetMcpToolReadRequest,
  Source,
  SourceKind,
  SourcePreviewResult,
  SourceProposal,
  SourceTarget,
  SourceTestResult,
  SqlSource,
};
export type {
  AppActionDraft,
  CardElement,
  DraftPatch,
  DraftState,
  GenerateMiniAppRequest,
  MiniApp,
  MiniAppActionRequest,
  MiniAppDraft,
  MiniAppGenErrorCode,
  MiniAppGenEvent,
  MiniAppGenPhase,
  MiniAppSourceRun,
  MiniAppTarget,
  PanelElement,
  PanelElementOf,
  PanelElementType,
  PanelLayout,
  Visibility,
};

const IOS_UA_RE = /iPhone|iPad|iPod/i;
const MAC_UA_RE = /Mac/i;

export const isMacOS = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  return MAC_UA_RE.test(ua) && !IOS_UA_RE.test(ua);
};

interface AppRpcSchema {
  bun: RpcSchema;
  webview: { requests: Record<string, never>; messages: RpcSchema["messages"] };
}

type RpcMessages = RpcSchema["messages"];
type MessageName = keyof RpcMessages;
type MessageHandler<M extends MessageName> = (payload: RpcMessages[M]) => void;

const messageHandlers: {
  [M in MessageName]: Set<MessageHandler<M>>;
} = {
  askEvent: new Set(),
  boardChanged: new Set(),
  launcherDismiss: new Set(),
  launcherNavigate: new Set(),
  launcherShown: new Set(),
  launcherToggle: new Set(),
  lookupEvent: new Set(),
  mcpActivity: new Set(),
  miniAppChanged: new Set(),
  miniAppGenEvent: new Set(),
  miniAppRefresh: new Set(),
  themeChanged: new Set(),
  updateProgress: new Set(),
  watchesChanged: new Set(),
  widgetSampled: new Set(),
};

const dispatchMessage = <M extends MessageName>(
  name: M,
  payload: RpcMessages[M]
): void => {
  for (const handler of messageHandlers[name]) {
    handler(payload);
  }
};

const subscribe = <M extends MessageName>(
  name: M,
  handler: MessageHandler<M>
): (() => void) => {
  messageHandlers[name].add(handler);
  return () => {
    messageHandlers[name].delete(handler);
  };
};

// Bun sends a navigate right after the handshake (a cold-start link), which
// can land before the launcher mounts and subscribes.
const unheardNavigation: { view: LauncherNavigateView | null } = { view: null };

const bunReadyHandlers = new Set<() => void>();
const bunReadyState = { fired: false };

const definedRpc = Electroview.defineRPC<AppRpcSchema>({
  handlers: {
    messages: {
      askEvent: (payload) => dispatchMessage("askEvent", payload),
      boardChanged: (payload) => dispatchMessage("boardChanged", payload),
      launcherDismiss: (payload) => dispatchMessage("launcherDismiss", payload),
      launcherNavigate: (payload) => {
        if (messageHandlers.launcherNavigate.size === 0) {
          unheardNavigation.view = payload.view;
          return;
        }
        dispatchMessage("launcherNavigate", payload);
      },
      launcherShown: (payload) => dispatchMessage("launcherShown", payload),
      launcherToggle: (payload) => dispatchMessage("launcherToggle", payload),
      lookupEvent: (payload) => dispatchMessage("lookupEvent", payload),
      mcpActivity: (payload) => dispatchMessage("mcpActivity", payload),
      miniAppChanged: (payload) => dispatchMessage("miniAppChanged", payload),
      miniAppGenEvent: (payload) => dispatchMessage("miniAppGenEvent", payload),
      miniAppRefresh: (payload) => dispatchMessage("miniAppRefresh", payload),
      themeChanged: (payload) => dispatchMessage("themeChanged", payload),
      updateProgress: (payload) => dispatchMessage("updateProgress", payload),
      watchesChanged: (payload) => dispatchMessage("watchesChanged", payload),
      widgetSampled: (payload) => dispatchMessage("widgetSampled", payload),
    },
    requests: {},
  },
  // Long queries may legitimately run for minutes; the cancel requests are the
  // user-driven recovery path for hung calls, not a transport-level timeout.
  maxRequestTime: Number.POSITIVE_INFINITY,
});

const isElectrobunHost = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    (window as Window & { __electrobunWebviewId?: number })
      .__electrobunWebviewId !== undefined
  );
};

const createElectroview = () => new Electroview({ rpc: definedRpc });

const buildRequest = (): NonNullable<
  ReturnType<typeof createElectroview>["rpc"]
>["request"] => {
  if (isElectrobunHost()) {
    const electroview = createElectroview();
    if (!electroview.rpc) {
      throw new Error("Electroview RPC client failed to initialize");
    }
    return electroview.rpc.request;
  }
  return createBrowserIpcStub(dispatchMessage) as never;
};

const request = buildRequest();

const handshake = async (): Promise<void> => {
  try {
    await request.rendererReady({});
    bunReadyState.fired = true;
    for (const handler of bunReadyHandlers) {
      handler();
    }
  } catch (error) {
    console.error("[ipc] rendererReady handshake failed", error);
  }
};

// oxlint-disable-next-line jest/require-hook
handshake();

const callRpc = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    throw decodeRpcError(error);
  }
};

export type LauncherShown = RpcMessages["launcherShown"];

export const onLauncherShown = (
  handler: (shown: LauncherShown) => void
): (() => void) => subscribe("launcherShown", handler);

export const onLauncherToggle = (handler: () => void): (() => void) =>
  subscribe("launcherToggle", handler);

export const onLauncherDismiss = (handler: () => void): (() => void) =>
  subscribe("launcherDismiss", handler);

export const onLauncherNavigate = (
  handler: (view: LauncherNavigateView) => void
): (() => void) => {
  const unsubscribe = subscribe("launcherNavigate", (payload) =>
    handler(payload.view)
  );
  const missed = unheardNavigation.view;
  if (missed !== null) {
    unheardNavigation.view = null;
    handler(missed);
  }
  return unsubscribe;
};

export function onBunReady(handler: () => void): () => void {
  bunReadyHandlers.add(handler);
  if (bunReadyState.fired) {
    handler();
  }
  return () => {
    bunReadyHandlers.delete(handler);
  };
}

export const onAskEvent = (
  askId: string,
  handler: (event: AskEvent) => void
): (() => void) =>
  subscribe("askEvent", (payload) => {
    if (payload.askId === askId) {
      handler(payload.event);
    }
  });

export const onLookupEvent = (
  lookupId: string,
  handler: (event: LookupEvent) => void
): (() => void) =>
  subscribe("lookupEvent", (payload) => {
    if (payload.lookupId === lookupId) {
      handler(payload.event);
    }
  });

export const onBoardChanged = (
  handler: (boardId: string) => void
): (() => void) =>
  subscribe("boardChanged", (payload) => handler(payload.boardId));

export const onThemeChanged = (
  handler: (state: ThemeState) => void
): (() => void) => subscribe("themeChanged", handler);

export const onUpdateProgress = (
  handler: (progress: RpcMessages["updateProgress"]) => void
): (() => void) => subscribe("updateProgress", handler);

export const onWatchesChanged = (handler: () => void): (() => void) =>
  subscribe("watchesChanged", handler);

export const onMcpActivity = (
  handler: (active: McpActivity[]) => void
): (() => void) =>
  subscribe("mcpActivity", (payload) => handler(payload.active));

export const onWidgetSampled = (
  handler: (sampled: RpcMessages["widgetSampled"]) => void
): (() => void) => subscribe("widgetSampled", handler);

function paramsFor(
  conn: Omit<
    DatabaseConnection,
    "id" | "name" | "createdAt" | "pinned" | "lastConnectedAt"
  >
): ConnectionParams {
  return {
    authSource: conn.authSource ?? null,
    database: conn.database,
    host: conn.host,
    password: conn.password,
    port: conn.port,
    trustServerCertificate: conn.trustServerCertificate ?? null,
    type: conn.type,
    username: conn.username,
  };
}

export const testConnection = (
  conn: Omit<
    DatabaseConnection,
    "id" | "name" | "createdAt" | "pinned" | "lastConnectedAt"
  >
): Promise<TestConnectionResult> =>
  callRpc(() => request.testConnection({ params: paramsFor(conn) }));

export const connectToDatabase = (
  connectionId: string,
  conn: Omit<DatabaseConnection, "id" | "name" | "createdAt">
): Promise<void> =>
  callRpc(() =>
    request.connectToDatabase({ connectionId, params: paramsFor(conn) })
  );

export const disconnectFromDatabase = (connectionId: string): Promise<void> =>
  callRpc(() => request.disconnectFromDatabase({ connectionId }));

export const getServerVersion = (connectionId: string): Promise<string> =>
  callRpc(() => request.getServerVersion({ connectionId }));

export const listDatabases = (connectionId: string): Promise<string[]> =>
  callRpc(() => request.listConnectionDatabases({ connectionId }));

export const getSchema = (
  connectionId: string,
  databaseName: string,
  options?: { force?: boolean }
): Promise<SchemaInfo> =>
  callRpc(() =>
    request.getSchema({
      connectionId,
      databaseName,
      force: options?.force ?? false,
    })
  );

export const formatSql = (sql: string, dialect: string): Promise<string> =>
  callRpc(() => request.formatSql({ dialect, sql }));

export const describeSql = (
  sql: string,
  dialect: DialectType
): Promise<SqlAssumptions | null> =>
  callRpc(() => request.describeSql({ dialect, sql }));

export const appendHistory = (entry: HistoryEntry): Promise<void> =>
  callRpc(() => request.appendHistory({ entry }));

export const getHistory = (
  connectionId: string,
  limit?: number | null,
  offset?: number | null
): Promise<HistoryEntry[]> =>
  callRpc(() => request.getHistory({ connectionId, limit, offset }));

export const getAllHistory = (
  filters?: HistoryFilters | null
): Promise<HistoryEntry[]> => callRpc(() => request.getAllHistory({ filters }));

export const getConnections = (): Promise<DatabaseConnection[]> =>
  callRpc(() => request.getConnections({} as never));

export const saveConnections = (
  connections: DatabaseConnection[]
): Promise<void> => callRpc(() => request.saveConnections({ connections }));

export const resetSecrets = (): Promise<void> =>
  callRpc(() => request.resetSecrets({} as never));

export const getAiSettings = (): Promise<RedactedAiSettings | null> =>
  callRpc(() => request.getAiSettings({} as never));
export const saveAiSettings = (
  input: AiSettingsInput
): Promise<RedactedAiSettings> => callRpc(() => request.saveAiSettings(input));
export const clearAiKey = (): Promise<RedactedAiSettings | null> =>
  callRpc(() => request.clearAiKey({} as never));
export const testAiSettings = (input: AiSettingsInput): Promise<AiTestResult> =>
  callRpc(() => request.testAiSettings(input));

export const getActiveConnection = (): Promise<ActiveConnection | null> =>
  callRpc(() => request.getActiveConnection({} as never));
export const setActiveConnection = (
  active: ActiveConnection | null
): Promise<void> => callRpc(() => request.setActiveConnection({ active }));

export const getLauncherHotkey = (): Promise<string> =>
  callRpc(() => request.getLauncherHotkey({} as never));
export const getAppVersion = (): Promise<string> =>
  callRpc(() => request.getAppVersion({} as never));

export const getUpdateChannel = (): Promise<UpdateChannel> =>
  callRpc(() => request.getUpdateChannel({} as never));
export const addSampleDatabase = (): Promise<DatabaseConnection> =>
  callRpc(() => request.addSampleDatabase({} as never));
export const checkForUpdate = (): Promise<AvailableUpdate | null> =>
  callRpc(() => request.checkForUpdate({} as never));
export const installUpdate = (): Promise<boolean> =>
  callRpc(() => request.installUpdate({} as never));

export const copyImage = (pngBase64: string): Promise<void> =>
  callRpc(() => request.copyImage({ pngBase64 }));

export interface SavedFile {
  fileName: string;
  savedId: string;
}

export const saveCsvToDownloads = (
  baseName: string,
  content: string
): Promise<SavedFile> =>
  callRpc(() =>
    request.saveToDownloads({ baseName, content, extension: "csv" })
  );

export const revealSaved = (savedId: string): Promise<void> =>
  callRpc(() => request.revealSaved({ savedId }));

export const resizeLauncher = (height: number): Promise<void> =>
  callRpc(() => request.resizeLauncher({ height }));

export const hideLauncher = (): Promise<void> =>
  callRpc(() => request.hideLauncher({} as never));

export const ask = (params: AskParams): Promise<void> =>
  callRpc(() => request.ask(params));

export const runSql = (params: RunSqlParams): Promise<void> =>
  callRpc(() => request.runSql(params));

export const peekSchema = (connectionId: string): Promise<SchemaPeek> =>
  callRpc(() => request.peekSchema({ connectionId }));

export const cancelAsk = (askId: string): Promise<void> =>
  callRpc(() => request.cancelAsk({ askId }));

export const lookup = (
  params: RpcSchema["requests"]["lookup"]["params"]
): Promise<void> => callRpc(() => request.lookup(params));

export const cancelLookup = (lookupId: string): Promise<void> =>
  callRpc(() => request.cancelLookup({ lookupId }));

export const getClipboardLookups = async (): Promise<boolean> => {
  const setting = await callRpc(() => request.getClipboardLookups({} as never));
  return setting.enabled;
};

export const setClipboardLookups = async (
  enabled: boolean
): Promise<boolean> => {
  const setting = await callRpc(() => request.setClipboardLookups({ enabled }));
  return setting.enabled;
};

export const getThemeState = (): Promise<ThemeState> =>
  callRpc(() => request.getThemeState({} as never));

export const setThemeSettings = (
  settings: ThemeSettings
): Promise<ThemeState> => callRpc(() => request.setThemeSettings({ settings }));

export const saveTheme = (theme: ThemeDraft): Promise<Theme> =>
  callRpc(() => request.saveTheme({ theme }));

export const deleteTheme = (themeId: string): Promise<ThemeState> =>
  callRpc(() => request.deleteTheme({ themeId }));

export const exportTheme = (
  themeId: string
): Promise<{ fileName: string; savedId: string }> =>
  callRpc(() => request.exportTheme({ themeId }));

export const importTheme = (): Promise<ImportThemeResult> =>
  callRpc(() => request.importTheme({} as never));

export const listWidgets = (): Promise<Widget[]> =>
  callRpc(() => request.listWidgets({} as never));

export const saveWidget = (widget: WidgetDraft): Promise<Widget> =>
  callRpc(() => request.saveWidget({ widget }));

export const deleteWidget = (widgetId: string): Promise<void> =>
  callRpc(() => request.deleteWidget({ widgetId }));

export const listRecentAsks = (limit?: number): Promise<RecentAsk[]> =>
  callRpc(() => request.listRecentAsks(limit === undefined ? {} : { limit }));

export const deleteRecentAsk = (askId: string): Promise<void> =>
  callRpc(() => request.deleteRecentAsk({ askId }));

export const clearRecentAsks = (): Promise<void> =>
  callRpc(() => request.clearRecentAsks({} as never));

export const proposeWidgetParams = (
  input: RpcSchema["requests"]["proposeWidgetParams"]["params"]
): Promise<ProposeParamsResult> =>
  callRpc(() => request.proposeWidgetParams(input));

export const runWidget = (
  input: RpcSchema["requests"]["runWidget"]["params"]
): Promise<WidgetRunResult> => callRpc(() => request.runWidget(input));

export const cancelWidgetRun = (runId: string): Promise<void> =>
  callRpc(() => request.cancelWidgetRun({ runId }));

export const loadParamOptions = (
  widgetId: string,
  paramName: string
): Promise<string[]> =>
  callRpc(() => request.loadParamOptions({ paramName, widgetId }));

export const listBoards = (): Promise<Board[]> =>
  callRpc(() => request.listBoards({} as never));

export const getBoard = (boardId: string): Promise<Board | null> =>
  callRpc(() => request.getBoard({ boardId }));

export const saveBoard = (board: BoardDraft): Promise<Board> =>
  callRpc(() => request.saveBoard({ board }));

export const deleteBoard = (boardId: string): Promise<void> =>
  callRpc(() => request.deleteBoard({ boardId }));

export const addBoardTile = (
  boardId: string,
  widgetId: string
): Promise<Board> => callRpc(() => request.addBoardTile({ boardId, widgetId }));

export const openBoard = (boardId: string): Promise<void> =>
  callRpc(() => request.openBoard({ boardId }));

export const toggleLauncher = (fromWindowKey: string | null): Promise<void> =>
  callRpc(() => request.toggleLauncher({ fromWindowKey }));

export const openWidgetInLauncher = (widgetId: string): Promise<void> =>
  callRpc(() => request.openWidgetInLauncher({ widgetId }));

export const exportBundle = (
  scope: ExportScope,
  destination: ExportDestination
): Promise<ExportBundleResult> =>
  callRpc(() => request.exportBundle({ destination, scope }));

export const previewImport = (source: ImportSource): Promise<ImportPreview> =>
  callRpc(() => request.previewImport({ source }));

export const applyImport = (input: ApplyImportRequest): Promise<ImportResult> =>
  callRpc(() => request.applyImport(input));
export const listWatches = (): Promise<Watch[]> =>
  callRpc(() => request.listWatches({} as never));

export const saveWatch = (watch: WatchDraft): Promise<Watch> =>
  callRpc(() => request.saveWatch({ watch }));

export const deleteWatch = (watchId: string): Promise<void> =>
  callRpc(() => request.deleteWatch({ watchId }));

export const listWatchStatuses = (): Promise<WatchStatus[]> =>
  callRpc(() => request.listWatchStatuses({} as never));

export const listWidgetTrends = (
  widgetIds: string[]
): Promise<Record<string, WidgetTrend>> =>
  callRpc(() => request.listWidgetTrends({ widgetIds }));

export const acknowledgeAlert = (watchId: string): Promise<void> =>
  callRpc(() => request.acknowledgeAlert({ watchId }));

export const setWatchingPaused = (paused: boolean): Promise<void> =>
  callRpc(() => request.setWatchingPaused({ paused }));

export const getWatchingPaused = (): Promise<boolean> =>
  callRpc(() => request.getWatchingPaused({} as never));

export const getMcpSettings = (): Promise<RedactedMcpSettings> =>
  callRpc(() => request.getMcpSettings({} as never));

export const saveMcpSettings = (
  update: McpSettingsUpdate
): Promise<RedactedMcpSettings> =>
  callRpc(() => request.saveMcpSettings(update));

export const rotateMcpToken = (): Promise<RedactedMcpSettings> =>
  callRpc(() => request.rotateMcpToken({} as never));

export const copyMcpClientConfig = (client: McpClientKind): Promise<void> =>
  callRpc(() => request.copyMcpClientConfig({ client }));

export const listMcpAudit = (limit?: number): Promise<McpAuditEntry[]> =>
  callRpc(() => request.listMcpAudit(limit === undefined ? {} : { limit }));

export const clearMcpAudit = (): Promise<void> =>
  callRpc(() => request.clearMcpAudit({} as never));

export const listMcpServers = (): Promise<RedactedMcpServer[]> =>
  callRpc(() => request.listMcpServers({} as never));

export const saveMcpServer = (
  server: McpServerInput
): Promise<RedactedMcpServer | null> =>
  callRpc(() => request.saveMcpServer({ server }));

export const deleteMcpServer = (
  serverId: string
): Promise<{ widgetNames: string[] }> =>
  callRpc(() => request.deleteMcpServer({ serverId }));

export const testMcpServer = (serverId: string): Promise<SourceTestResult> =>
  callRpc(() => request.testMcpServer({ serverId }));

export const listMcpTools = (serverId: string): Promise<McpToolSummary[]> =>
  callRpc(() => request.listMcpTools({ serverId }));

export const setMcpToolRead = (
  input: SetMcpToolReadRequest
): Promise<RedactedMcpServer | null> =>
  callRpc(() => request.setMcpToolRead(input));

export const listHttpEndpoints = (): Promise<RedactedHttpEndpoint[]> =>
  callRpc(() => request.listHttpEndpoints({} as never));

export const saveHttpEndpoint = (
  endpoint: HttpEndpointInput
): Promise<RedactedHttpEndpoint> =>
  callRpc(() => request.saveHttpEndpoint({ endpoint }));

export const deleteHttpEndpoint = (
  endpointId: string
): Promise<{ widgetNames: string[] }> =>
  callRpc(() => request.deleteHttpEndpoint({ endpointId }));

export const testHttpEndpoint = (
  endpointId: string
): Promise<SourceTestResult> =>
  callRpc(() => request.testHttpEndpoint({ endpointId }));

export const proposeSourceWidget = (
  target: SourceTarget,
  prompt: string
): Promise<SourceProposal> =>
  callRpc(() => request.proposeSourceWidget({ prompt, target }));

export const previewSource = (
  input: PreviewSourceRequest
): Promise<SourcePreviewResult> => callRpc(() => request.previewSource(input));

export const listActions = (widgetId: string): Promise<ListedAction[]> =>
  callRpc(() => request.listActions({ widgetId }));

export const saveAction = (
  widgetId: string,
  draft: ActionDraft
): Promise<ListedAction> =>
  callRpc(() => request.saveAction({ draft, widgetId }));

export const deleteAction = (actionId: string): Promise<void> =>
  callRpc(() => request.deleteAction({ actionId }));

export const reviewAction = (
  widgetId: string,
  draft: ActionDraft,
  context: ActionContext
): Promise<ActionReview> =>
  callRpc(() => request.reviewAction({ context, draft, widgetId }));

export const prepareAction = (
  actionId: string,
  context: ActionContext
): Promise<ActionPreview> =>
  callRpc(() => request.prepareAction({ actionId, context }));

export const executeAction = (token: string): Promise<ActionOutcome> =>
  callRpc(() => request.executeAction({ token }));

export const discardActionToken = (token: string): Promise<void> =>
  callRpc(() => request.discardActionToken({ token }));

export const proposeAction = (
  input: ProposeActionRequest
): Promise<ActionProposal> => callRpc(() => request.proposeAction(input));

export const listWritePermissions = (): Promise<
  { kind: WriteTargetKind; id: string }[]
> => callRpc(() => request.listWritePermissions({} as never));

export const setWriteActionsAllowed = (
  kind: WriteTargetKind,
  id: string,
  allowed: boolean
): Promise<{ allowed: boolean }> =>
  callRpc(() => request.setWriteActionsAllowed({ allowed, id, kind }));

export const listActionActivity = (
  limit?: number
): Promise<ActionActivityPage> =>
  callRpc(() =>
    request.listActionActivity(limit === undefined ? {} : { limit })
  );

export const onMiniAppGenEvent = (
  genId: string,
  handler: (event: MiniAppGenEvent) => void
): (() => void) =>
  subscribe("miniAppGenEvent", (payload) => {
    if (payload.genId === genId) {
      handler(payload.event);
    }
  });

export const onMiniAppChanged = (
  handler: (appId: string) => void
): (() => void) =>
  subscribe("miniAppChanged", (payload) => handler(payload.appId));

export const onMiniAppRefresh = (
  handler: (refresh: RpcMessages["miniAppRefresh"]) => void
): (() => void) => subscribe("miniAppRefresh", handler);

export const listMiniApps = (): Promise<MiniApp[]> =>
  callRpc(() => request.listMiniApps({} as never));

export const getMiniApp = (appId: string): Promise<MiniApp | null> =>
  callRpc(() => request.getMiniApp({ appId }));

export const saveMiniApp = (
  draft: MiniAppDraft,
  reviewedActionIds: string[] = [],
  fromGenId?: string
): Promise<MiniApp> =>
  callRpc(() =>
    request.saveMiniApp(
      fromGenId === undefined
        ? { draft, reviewedActionIds }
        : { draft, fromGenId, reviewedActionIds }
    )
  );

export const deleteMiniApp = (appId: string): Promise<void> =>
  callRpc(() => request.deleteMiniApp({ appId }));

export const duplicateMiniApp = (appId: string): Promise<MiniApp> =>
  callRpc(() => request.duplicateMiniApp({ appId }));

export const setMiniAppValues = (
  appId: string,
  values: ParamValues
): Promise<MiniApp | null> =>
  callRpc(() => request.setMiniAppValues({ appId, values }));

export const runMiniAppSource = (
  input: RpcSchema["requests"]["runMiniAppSource"]["params"]
): Promise<MiniAppSourceRun> => callRpc(() => request.runMiniAppSource(input));

export const cancelMiniAppRun = (runId: string): Promise<void> =>
  callRpc(() => request.cancelMiniAppRun({ runId }));

export const loadMiniAppInputOptions = (
  target: MiniAppTarget,
  inputName: string
): Promise<string[]> =>
  callRpc(() => request.loadMiniAppInputOptions({ inputName, target }));

export const generateMiniApp = (input: GenerateMiniAppRequest): Promise<void> =>
  callRpc(() => request.generateMiniApp(input));

export const cancelMiniAppGeneration = (genId: string): Promise<void> =>
  callRpc(() => request.cancelMiniAppGeneration({ genId }));

export const openMiniApp = (appId: string): Promise<void> =>
  callRpc(() => request.openMiniApp({ appId }));

export const stageMiniAppAction = (
  input: MiniAppActionRequest
): Promise<void> => callRpc(() => request.stageMiniAppAction(input));

export const prepareMiniAppAction = (
  input: MiniAppActionRequest
): Promise<ActionPreview> => callRpc(() => request.prepareMiniAppAction(input));
