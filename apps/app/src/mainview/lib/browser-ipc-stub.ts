import type { DatabaseConnection } from "@conch/core/client";
import type {
  ActiveConnection,
  AiSettingsInput,
  AiTestResult,
  AskParams,
  RedactedAiSettings,
  RpcSchema,
  BoardDraft,
  ImportSource,
  LookupRequest,
  ExternalSource,
  HttpEndpointInput,
  McpServerInput,
  McpSettingsUpdate,
  PreviewSourceRequest,
  RunSqlParams,
  SetMcpToolReadRequest,
  SourceTarget,
  RunWidgetRequest,
  WatchDraft,
  WidgetDraft,
} from "@conch/rpc";

import {
  DEFAULT_CLIPBOARD_LOOKUPS,
  DEFAULT_LAUNCHER_HOTKEY,
  SAMPLE_CONNECTION_ID,
} from "@conch/rpc";

import type { createMiniAppEmulator } from "@/lib/browser-mini-app-stub";

import { createActionEmulator } from "@/lib/browser-action-stub";
import { createAskEmulator, languageForType } from "@/lib/browser-ask-stub";
import { createBoardEmulator } from "@/lib/browser-board-stub";
import { createBundleEmulator } from "@/lib/browser-bundle-stub";
import { createLinkOpener } from "@/lib/browser-link-stub";
import {
  createClipboardEmulator,
  createLookupEmulator,
} from "@/lib/browser-lookup-stub";
import { createMcpEmulator } from "@/lib/browser-mcp-stub";
import { recordedAssumptions } from "@/lib/browser-refine-stub";
import { demoSchemaPeek } from "@/lib/browser-schema-stub";
import { createSourceEmulator } from "@/lib/browser-source-stub";
import { createThemeEmulator } from "@/lib/browser-theme-stub";
import { createWatchEmulator } from "@/lib/browser-watch-stub";
import { createWidgetEmulator } from "@/lib/browser-widget-stub";

type RpcMessages = RpcSchema["messages"];

export type EmitMessage = <M extends keyof RpcMessages>(
  name: M,
  payload: RpcMessages[M]
) => void;

type RequestStub = Record<string, (payload?: unknown) => Promise<unknown>>;

const CONNECTIONS_KEY = "conch-connections";
const ACTIVE_CONNECTION_KEY = "conch-active-connection";
const AI_SETTINGS_KEY = "conch-ai-settings";
const CLIPBOARD_LOOKUPS_KEY = "conch-clipboard-lookups";

const readJson = (key: string): unknown => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readConnections = (): DatabaseConnection[] => {
  const parsed = readJson(CONNECTIONS_KEY);
  return Array.isArray(parsed) ? (parsed as DatabaseConnection[]) : [];
};

const addSampleConnection = (): DatabaseConnection => {
  const connections = readConnections();
  const existing = connections.find(
    (connection) => connection.id === SAMPLE_CONNECTION_ID
  );
  if (existing) {
    return existing;
  }
  const sample: DatabaseConnection = {
    createdAt: new Date().toISOString(),
    database: "sample/store.sqlite",
    emoji: "☕",
    environment: "dev",
    host: "",
    id: SAMPLE_CONNECTION_ID,
    lastConnectedAt: null,
    name: "Sample Store",
    password: "",
    pinned: false,
    port: 0,
    type: "sqlite",
    username: "",
  };
  localStorage.setItem(
    CONNECTIONS_KEY,
    JSON.stringify([...connections, sample])
  );
  return sample;
};

// Browser mode only backs vite-only dev and e2e; never persist credentials.
const writeConnections = (connections: DatabaseConnection[]): void => {
  const sanitized = connections.map((connection) => ({
    ...connection,
    password: "",
  }));
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(sanitized));
};

const readActiveConnection = (): ActiveConnection | null =>
  (readJson(ACTIVE_CONNECTION_KEY) as ActiveConnection | null) ?? null;

const writeActiveConnection = (active: ActiveConnection | null): void => {
  if (!active) {
    localStorage.removeItem(ACTIVE_CONNECTION_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_CONNECTION_KEY, JSON.stringify(active));
};

const KEY_HINT_MIN_LENGTH = 12;

const hintFor = (key: string | undefined): string | null =>
  key && key.length >= KEY_HINT_MIN_LENGTH ? key.slice(-4) : null;

const testAiSettings = (): AiTestResult => ({
  latencyMs: 0,
  message: "AI tests need the desktop app.",
  ok: false,
});

const readAiSettings = (): RedactedAiSettings | null =>
  (readJson(AI_SETTINGS_KEY) as RedactedAiSettings | null) ?? null;

// Stores the redacted record only; the stub never holds an API key.
const writeAiSettings = (settings: RedactedAiSettings | null): void => {
  if (settings) {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } else {
    localStorage.removeItem(AI_SETTINGS_KEY);
  }
};

const createAiSettingsStore = () => {
  const state: { settings: RedactedAiSettings | null } = {
    settings: readAiSettings(),
  };

  const save = (input: AiSettingsInput): RedactedAiSettings => {
    const current = state.settings;
    const key = input.apiKey?.trim();
    const kept =
      key === undefined && current?.provider === input.provider
        ? current
        : null;
    state.settings = {
      baseUrl: input.baseUrl?.trim() || null,
      hasKey: kept ? kept.hasKey : Boolean(key),
      keyHint: kept ? kept.keyHint : hintFor(key),
      model: input.model?.trim() || null,
      provider: input.provider,
    };
    writeAiSettings(state.settings);
    return state.settings;
  };

  const clearKey = (): RedactedAiSettings | null => {
    if (state.settings) {
      state.settings = { ...state.settings, hasKey: false, keyHint: null };
      writeAiSettings(state.settings);
    }
    return state.settings;
  };

  return { clearKey, get: () => state.settings, save };
};

const readClipboardLookups = (): boolean => {
  const stored = readJson(CLIPBOARD_LOOKUPS_KEY);
  return typeof stored === "boolean" ? stored : DEFAULT_CLIPBOARD_LOOKUPS;
};

const writeClipboardLookups = (enabled: boolean): { enabled: boolean } => {
  localStorage.setItem(CLIPBOARD_LOOKUPS_KEY, JSON.stringify(enabled));
  return { enabled };
};

const isLauncherHotkey = (event: KeyboardEvent): boolean =>
  event.altKey && event.shiftKey && event.code === "Space";

const createLauncherEmulator = (emit: EmitMessage) => {
  const launcher = { visible: true };
  const clipboard = createClipboardEmulator(readClipboardLookups);
  window.addEventListener("keydown", (event) => {
    if (!isLauncherHotkey(event)) {
      return;
    }
    event.preventDefault();
    if (launcher.visible) {
      emit("launcherToggle", {});
      return;
    }
    launcher.visible = true;
    emit("launcherShown", { clipboard: clipboard.offer() });
  });
  return {
    hide: () => {
      launcher.visible = false;
    },
    show: () => {
      if (launcher.visible) {
        return;
      }
      launcher.visible = true;
      emit("launcherShown", { clipboard: clipboard.offer() });
    },
  };
};

const noop = (): undefined => undefined;

type ActionEmulatorValue = ReturnType<typeof createActionEmulator>;
type MiniAppEmulatorValue = ReturnType<typeof createMiniAppEmulator>;

type Payload<K extends keyof MiniAppEmulatorValue> = Parameters<
  MiniAppEmulatorValue[K]
>[0];

// Loaded on first use so the production bundle never carries the stub's
// recordings; started at once so another tab's staged action still arrives.
const loadMiniAppEmulator = async (
  emit: EmitMessage
): Promise<MiniAppEmulatorValue> => {
  const module = await import("@/lib/browser-mini-app-stub");
  return module.createMiniAppEmulator(emit);
};

const miniAppHandlers = (
  loaded: Promise<MiniAppEmulatorValue>
): Record<string, (payload: unknown) => unknown> => {
  const using = async <T>(work: (apps: MiniAppEmulatorValue) => T) =>
    work(await loaded);
  return {
    cancelMiniAppGeneration: (payload) =>
      using((apps) => apps.cancel(payload as Payload<"cancel">)),
    cancelMiniAppRun: noop,
    deleteMiniApp: (payload) =>
      using((apps) => apps.deleteMiniApp(payload as Payload<"deleteMiniApp">)),
    duplicateMiniApp: (payload) =>
      using((apps) =>
        apps.duplicateMiniApp(payload as Payload<"duplicateMiniApp">)
      ),
    generateMiniApp: (payload) =>
      using((apps) => apps.generate(payload as Payload<"generate">)),
    getMiniApp: (payload) =>
      using((apps) => apps.getMiniApp(payload as Payload<"getMiniApp">)),
    listMiniApps: () => using((apps) => apps.listMiniApps()),
    loadMiniAppInputOptions: (payload) =>
      using((apps) =>
        apps.loadInputOptions(payload as Payload<"loadInputOptions">)
      ),
    openMiniApp: (payload) =>
      using((apps) => apps.open(payload as Payload<"open">)),
    prepareMiniAppAction: (payload) =>
      using((apps) => apps.prepare(payload as Payload<"prepare">)),
    runMiniAppSource: (payload) =>
      using((apps) => apps.run(payload as Payload<"run">)),
    saveMiniApp: (payload) =>
      using((apps) => apps.save(payload as Payload<"save">)),
    setMiniAppValues: (payload) =>
      using((apps) => apps.setValues(payload as Payload<"setValues">)),
    stageMiniAppAction: (payload) =>
      using((apps) => apps.stage(payload as Payload<"stage">)),
  };
};

const actionHandlers = (
  actions: ActionEmulatorValue
): Record<string, (payload: unknown) => unknown> => ({
  deleteAction: (payload) =>
    actions.deleteAction(payload as { actionId: string }),
  discardActionToken: (payload) =>
    actions.discardActionToken(payload as { token: string }),
  executeAction: (payload) =>
    actions.executeAction(payload as { token: string }),
  listActionActivity: () => actions.listActionActivity(),
  listActions: (payload) =>
    actions.listActions(payload as { widgetId: string }),
  listWritePermissions: () => actions.listWritePermissions(),
  prepareAction: (payload) =>
    actions.prepareAction(
      payload as Parameters<ActionEmulatorValue["prepareAction"]>[0]
    ),
  proposeAction: (payload) =>
    actions.proposeAction(
      payload as Parameters<ActionEmulatorValue["proposeAction"]>[0]
    ),
  reviewAction: (payload) =>
    actions.reviewAction(
      payload as Parameters<ActionEmulatorValue["reviewAction"]>[0]
    ),
  saveAction: (payload) =>
    actions.saveAction(
      payload as Parameters<ActionEmulatorValue["saveAction"]>[0]
    ),
  setWriteActionsAllowed: (payload) =>
    actions.setWriteActionsAllowed(
      payload as Parameters<ActionEmulatorValue["setWriteActionsAllowed"]>[0]
    ),
});

const openBoardTab = (boardId: string) => {
  window.open(`#/board/${encodeURIComponent(boardId)}`, "_blank");
};

const createDispatcher = (emit: EmitMessage) => {
  const ai = createAiSettingsStore();
  const launcher = createLauncherEmulator(emit);
  const sources = createSourceEmulator();
  const widgets = createWidgetEmulator(sources);
  const actions = createActionEmulator({
    connectionName: (id) => {
      const connection = readConnections().find((item) => item.id === id);
      return {
        environment: connection?.environment ?? null,
        name: connection?.name ?? id,
      };
    },
    endpointOf: (id) =>
      sources.listHttpEndpoints().find((endpoint) => endpoint.id === id) ??
      null,
    serverName: (id) =>
      sources.listMcpServers().find((server) => server.id === id)?.name ?? null,
    toolsOf: (serverId) =>
      sources.listMcpServers().some((server) => server.id === serverId)
        ? sources.listMcpTools({ serverId })
        : [],
    widgetById: (id) =>
      widgets.listWidgets().find((widget) => widget.id === id) ?? null,
  });
  const boards = createBoardEmulator({
    now: () => new Date(),
    onChanged: (boardId) => emit("boardChanged", { boardId }),
    viewOf: (widgetId) =>
      widgets.listWidgets().find((widget) => widget.id === widgetId)?.view ??
      null,
  });
  // e2e opens conch:// links through this, as macOS hands them to bun.
  Object.defineProperty(globalThis, "__conchOpenLink", {
    configurable: true,
    value: createLinkOpener({
      boardExists: (boardId) => boards.getBoard({ boardId }) !== null,
      navigate: (view) => emit("launcherNavigate", { view }),
      openBoard: openBoardTab,
      show: launcher.show,
    }),
  });
  const lookups = createLookupEmulator((payload) =>
    emit("lookupEvent", payload)
  );
  const bundles = createBundleEmulator({
    connections: () =>
      readConnections().map(({ id, name, type }) => ({ id, name, type })),
    listBoards: () => boards.listBoards(),
    listWidgets: () => widgets.listWidgets(),
    now: () => new Date(),
    saveBoard: (board) => boards.saveBoard({ board }),
    saveWidget: (widget) => widgets.saveWidget({ widget }),
  });
  const watches = createWatchEmulator({
    now: () => new Date(),
    onSampled: (widgetId, valuesKey) =>
      emit("widgetSampled", { valuesKey, widgetId }),
    onWatchesChanged: () => emit("watchesChanged", {}),
    widgetById: (widgetId) =>
      widgets.listWidgets().find((widget) => widget.id === widgetId) ?? null,
  });
  const mcp = createMcpEmulator({
    now: () => new Date(),
    onActivity: (active) => emit("mcpActivity", { active }),
  });
  const asks = createAskEmulator((payload) => emit("askEvent", payload), {
    labelFor: (connectionId) =>
      readConnections().find((connection) => connection.id === connectionId)
        ?.name ?? "demo",
    languageFor: (connectionId) =>
      languageForType(
        readConnections().find((connection) => connection.id === connectionId)
          ?.type
      ),
    onAnswered: widgets.rememberAsk,
  });

  const themes = createThemeEmulator((state) => emit("themeChanged", state));
  const miniApps = loadMiniAppEmulator(emit);
  const actionRequests = actionHandlers(actions);
  const handlers: Record<string, (payload: unknown) => unknown> = {
    ...actionRequests,
    ...miniAppHandlers(miniApps),
    acknowledgeAlert: (payload) =>
      watches.acknowledgeAlert(payload as { watchId: string }),
    addBoardTile: (payload) =>
      boards.addBoardTile(payload as { boardId: string; widgetId: string }),
    addSampleDatabase: () => addSampleConnection(),
    applyImport: (payload) => bundles.applyImport(payload),
    ask: (payload) => asks.ask(payload as AskParams),
    cancelAsk: (payload) => asks.cancel((payload as { askId: string }).askId),
    cancelLookup: (payload) =>
      lookups.cancel((payload as { lookupId: string }).lookupId),
    cancelWidgetRun: noop,
    clearAiKey: () => ai.clearKey(),
    clearMcpAudit: () => mcp.clearMcpAudit(),
    clearRecentAsks: () => widgets.clearRecentAsks(),
    connectToDatabase: noop,
    copyImage: noop,
    copyMcpClientConfig: () => mcp.copyMcpClientConfig(),
    deleteBoard: (payload) =>
      boards.deleteBoard(payload as { boardId: string }),
    deleteHttpEndpoint: (payload) =>
      sources.deleteHttpEndpoint(payload as { endpointId: string }),
    deleteMcpServer: (payload) =>
      sources.deleteMcpServer(payload as { serverId: string }),
    deleteRecentAsk: (payload) =>
      widgets.deleteRecentAsk(payload as { askId: string }),
    deleteTheme: (payload) =>
      themes.deleteTheme(payload as { themeId: string }),
    deleteWatch: (payload) =>
      watches.deleteWatch(payload as { watchId: string }),
    deleteWidget: (payload) => {
      const { widgetId } = payload as { widgetId: string };
      widgets.deleteWidget({ widgetId });
      boards.removeWidget(widgetId);
      watches.removeWidget(widgetId);
    },
    describeSql: (payload) =>
      recordedAssumptions((payload as { sql: string }).sql),
    discardActionToken: async (payload) => {
      const { token } = payload as { token: string };
      const apps = await miniApps;
      return apps.discard(token)
        ? undefined
        : actionRequests.discardActionToken?.(payload);
    },
    disconnectFromDatabase: noop,
    executeAction: async (payload) => {
      const apps = await miniApps;
      return (
        apps.execute((payload as { token: string }).token) ??
        actionRequests.executeAction?.(payload)
      );
    },
    exportBundle: (payload) => bundles.exportBundle(payload),
    exportTheme: (payload) =>
      themes.exportTheme(payload as { themeId: string }),
    getActiveConnection: () => readActiveConnection(),
    getAiSettings: () => ai.get(),
    getAllHistory: () => [],
    getAppVersion: () => "dev",
    getBoard: (payload) => boards.getBoard(payload as { boardId: string }),
    getClipboardLookups: () => ({ enabled: readClipboardLookups() }),
    getConnections: () => readConnections(),
    getHistory: () => [],
    getLauncherHotkey: () => DEFAULT_LAUNCHER_HOTKEY,
    getMcpSettings: () => mcp.getMcpSettings(),
    getThemeState: () => themes.getThemeState(),
    getUpdateChannel: () => "stable",
    getWatchingPaused: () => watches.getWatchingPaused(),
    hideLauncher: () => launcher.hide(),
    importTheme: () => themes.importTheme(),
    listBoards: () => boards.listBoards(),
    listHttpEndpoints: () => sources.listHttpEndpoints(),
    listMcpAudit: (payload) => mcp.listMcpAudit(payload as { limit?: number }),
    listMcpServers: () => sources.listMcpServers(),
    listMcpTools: (payload) =>
      sources.listMcpTools(payload as { serverId: string }),
    listRecentAsks: (payload) =>
      widgets.listRecentAsks(payload as { limit?: number }),
    listWatchStatuses: () => watches.listWatchStatuses(),
    listWatches: () => watches.listWatches(),
    listWidgetTrends: (payload) =>
      watches.listWidgetTrends(payload as { widgetIds: string[] }),
    listWidgets: () => widgets.listWidgets(),
    loadParamOptions: () => widgets.loadParamOptions(),
    lookup: (payload) => lookups.lookup(payload as LookupRequest),
    openBoard: (payload) => {
      openBoardTab((payload as { boardId: string }).boardId);
    },
    openWidgetInLauncher: noop,
    peekSchema: () => demoSchemaPeek(),
    previewImport: (payload) =>
      bundles.previewImport(payload as { source: ImportSource }),
    previewSource: (payload) =>
      sources.previewSource(
        payload as PreviewSourceRequest & { source: ExternalSource }
      ),
    proposeSourceWidget: (payload) =>
      sources.proposeSourceWidget(
        payload as { target: SourceTarget; prompt: string }
      ),
    proposeWidgetParams: (payload) =>
      widgets.proposeWidgetParams(payload as { sql: string }),
    rendererReady: noop,
    resizeLauncher: noop,
    revealSaved: noop,
    rotateMcpToken: () => mcp.rotateMcpToken(),
    runSql: (payload) => asks.runSql(payload as RunSqlParams),
    runWidget: async (payload) => {
      const request = payload as RunWidgetRequest;
      const outcome = await widgets.runWidget(request);
      actions.recordRun(request.runId, request.widgetId, outcome.result);
      return watches.decorateRun(request.widgetId, outcome);
    },
    saveAiSettings: (payload) => ai.save(payload as AiSettingsInput),
    saveBoard: (payload) => boards.saveBoard(payload as { board: BoardDraft }),
    saveConnections: (payload) =>
      writeConnections(
        (payload as { connections: DatabaseConnection[] }).connections
      ),
    saveHttpEndpoint: (payload) =>
      sources.saveHttpEndpoint(payload as { endpoint: HttpEndpointInput }),
    saveMcpServer: (payload) =>
      sources.saveMcpServer(payload as { server: McpServerInput }),
    saveMcpSettings: (payload) =>
      mcp.saveMcpSettings(payload as McpSettingsUpdate),
    saveTheme: (payload) => themes.saveTheme(payload as { theme: unknown }),
    saveToDownloads: (payload) => ({
      fileName: `${(payload as { baseName: string }).baseName}.csv`,
      savedId: "stub",
    }),
    saveWatch: (payload) => watches.saveWatch(payload as { watch: WatchDraft }),
    saveWidget: (payload) =>
      widgets.saveWidget(payload as { widget: WidgetDraft }),
    sendFeedback: () => null,
    setActiveConnection: (payload) =>
      writeActiveConnection(
        (payload as { active: ActiveConnection | null }).active
      ),
    setClipboardLookups: (payload) =>
      writeClipboardLookups((payload as { enabled: boolean }).enabled),
    setMcpToolRead: (payload) =>
      sources.setMcpToolRead(payload as SetMcpToolReadRequest),
    setThemeSettings: (payload) =>
      themes.setThemeSettings(payload as { settings: unknown }),
    setWatchingPaused: (payload) =>
      watches.setWatchingPaused(payload as { paused: boolean }),
    testAiSettings,
    testConnection: () => ({
      latencyMs: 0,
      message: "Connected",
      success: true,
    }),
    testHttpEndpoint: (payload) =>
      sources.testHttpEndpoint(payload as { endpointId: string }),
    testMcpServer: (payload) =>
      sources.testMcpServer(payload as { serverId: string }),
    toggleLauncher: noop,
  };

  return (name: string, payload: unknown): unknown => {
    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Browser-mode IPC stub does not implement '${name}'`);
    }
    return handler(payload);
  };
};

export interface IpcCall {
  name: string;
  payload: unknown;
}

// e2e reads this to assert which requests ran (for example, that a widget
// run never asked the model).
export const createBrowserIpcStub = (emit: EmitMessage): RequestStub => {
  const callLog: IpcCall[] = [];
  Object.defineProperty(globalThis, "__conchIpcLog", {
    configurable: true,
    value: callLog,
  });
  const dispatch = createDispatcher(emit);
  return new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (payload?: unknown): Promise<unknown> => {
          callLog.push({ name, payload });
          try {
            return Promise.resolve(dispatch(name, payload));
          } catch (error) {
            return Promise.reject(error);
          }
        },
    }
  );
};
