import type { DatabaseConnection } from "@conch/core";
import type { RpcSchema } from "@conch/rpc";

import { runAsk } from "@conch/agent";
import {
  appendAudit,
  appendHistory,
  appendMcpAudit,
  clearMcpAudit,
  createActionStore,
  createBoardStore,
  createHttpEndpointStore,
  createMcpServerStore,
  createPermissionStore,
  createWatchStore,
  DbError,
  describeSqlAssumptions,
  formatSql as doFormatSql,
  getAllHistory,
  getConnections,
  getHistory,
  listMcpAudit,
  mcpRunDir,
  readAudit,
  readMcpSettings,
  resetSecrets,
  sampleDatabasePath,
  saveConnections,
  supportsGuardedWrites,
  verifyAudit,
  writeMcpSettings,
} from "@conch/core";
import { createThemeStore } from "@conch/core/themes";
import { ConnectionPoolManager, getDriver } from "@conch/drivers";
import {
  Board,
  BUNDLE_EXTENSION,
  connectionIdOf,
  DEFAULT_CLIPBOARD_LOOKUPS,
  Dialect,
  encodeRpcError,
  HttpEndpointConfig,
  MAX_REFINE_SQL,
  McpAuditEntry,
  McpServerConfig,
  McpSettings,
  parseStoredTheme,
  Watch,
  WidgetAction,
  WritePermission,
} from "@conch/rpc";
import { defineElectrobunRPC, PATHS, Updater, Utils } from "electrobun/main";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import type { LauncherController } from "./launcher.ts";
import type { SaveOrigin } from "./mini-app-service.ts";
import type { PanelRef } from "./panel-ref.ts";
import type { PanelWindows } from "./panel-windows.ts";

import { createActionExecutor, writesUnavailable } from "./action-executor.ts";
import { createActionService } from "./action-service.ts";
import {
  loadAskModel,
  readAiSettings,
  removeAiKey,
  testAiSettings,
  writeAiSettings,
} from "./ai-settings-service.ts";
import { createAlertNotifier } from "./alert-notifier.ts";
import { buildAskPorts } from "./ask-ports.ts";
import { createAskService } from "./ask-service.ts";
import { createBoardService } from "./board-service.ts";
import { createBundleService, readTextUpTo } from "./bundle-service.ts";
import { decodePng } from "./clipboard-image.ts";
import { createClipboardOffer } from "./clipboard-offer.ts";
import { resolveCommand } from "./command-path.ts";
import {
  ensurePool,
  findConnection,
  resolveSchemaName,
} from "./connection-access.ts";
import { createDownloads, writeExclusive } from "./downloads.ts";
import { feedbackUrl } from "./feedback.ts";
import {
  ACTION_RESPONSE_BYTES,
  fetchJson,
  probeHttp,
  requestJson,
} from "./http-fetch.ts";
import {
  readActiveConnection,
  readClipboardLookups,
  readLauncherHotkey,
  readThemeSettings,
  readWatchingPaused,
  writeActiveConnection,
  writeClipboardLookups,
  writeThemeSettings,
  writeWatchingPaused,
} from "./launcher-config.ts";
import { createLookupService } from "./lookup-service.ts";
import { createMcpClientManager } from "./mcp-clients.ts";
import { connectMcpServer } from "./mcp-connect.ts";
import { createActivityTracker } from "./mcp-server/activity.ts";
import { createMcpServerHost } from "./mcp-server/index.ts";
import { buildGenerationCatalog } from "./mini-app-catalog.ts";
import { createMiniAppGenService } from "./mini-app-gen-service.ts";
import {
  createMiniAppService,
  defaultMiniAppStore,
} from "./mini-app-service.ts";
import { createNativeConfirm } from "./native-confirm.ts";
import { windowKey } from "./panel-ref.ts";
import { createPasteboardTypes } from "./pasteboard-types-native.ts";
import { createPowerProbe } from "./power-native.ts";
import { createRunCache } from "./run-cache.ts";
import { buildSampleData } from "./sample-data.ts";
import { writeSampleDatabase } from "./sample-database.ts";
import { createSampleService } from "./sample-service.ts";
import { createSchemaCache } from "./schema-cache.ts";
import { createSchemaPeek } from "./schema-peek.ts";
import { createSourceRunner } from "./source-runner.ts";
import { createSourceSettingsService } from "./source-settings-service.ts";
import { createThemeService } from "./theme-service.ts";
import { createUpdateService } from "./updater.ts";
import { createWatchService } from "./watch-service.ts";
import {
  createWidgetService,
  defaultRecentAskStore,
  defaultRunLogStore,
  defaultWidgetStore,
} from "./widget-service.ts";
import {
  connectionIdentity,
  createWritePermissions,
  endpointIdentity,
  serverIdentity,
} from "./write-permissions.ts";

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): T | null =>
    schema.safeParse(raw).data ?? null;

const describeSqlParams = z.object({
  dialect: Dialect,
  sql: z.string().max(MAX_REFINE_SQL),
});

const pools = new ConnectionPoolManager();
const schemas = createSchemaCache(pools);
const schemaPeek = createSchemaPeek({ pools, schemas });
const downloads = createDownloads({
  dir: () => Utils.paths.downloads,
  reveal: (path) => Utils.showItemInFolder(path),
  writeExclusive,
});

interface AppRpcSchema {
  bun: RpcSchema;
  // The webview doesn't expose any RPC requests of its own; the empty object
  // literal is required so defineElectrobunRPC's generic structural match
  // against BaseRPCRequestsSchema succeeds and the bun-side handler params
  // are inferred from RpcSchema instead of falling back to `any`.
  // oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types
  webview: { requests: {}; messages: RpcSchema["messages"] };
}

type RequestHandlers = {
  [M in keyof RpcSchema["requests"]]: (
    params: RpcSchema["requests"][M]["params"]
  ) =>
    | RpcSchema["requests"][M]["response"]
    | Promise<RpcSchema["requests"][M]["response"]>;
};

type RawHandler = (params: unknown) => unknown;

const TRACED_METHODS = new Set([
  "connectToDatabase",
  "disconnectFromDatabase",
  "listConnectionDatabases",
  "getSchema",
  "getServerVersion",
  "peekSchema",
]);

const wrapHandlers = (handlers: RequestHandlers): RequestHandlers => {
  const wrapped: Record<string, RawHandler> = {};
  for (const [key, fn] of Object.entries(handlers)) {
    const handler = fn as RawHandler;
    const traced = TRACED_METHODS.has(key);
    wrapped[key] = async (params: unknown) => {
      try {
        const result = await handler(params);
        if (traced) {
          console.log(`[rpc] ok  ${key}`);
        }
        return result;
      } catch (error) {
        const err = error as Error & { code?: string };
        console.log(
          `[rpc] err ${key}: name=${err?.name ?? "-"} code=${err?.code ?? "-"} msg=${err?.message ?? "-"}`
        );
        console.log(err?.stack ?? "(no stack)");
        throw encodeRpcError(error);
      }
    };
  }
  return wrapped as RequestHandlers;
};

type LauncherOnlyMethod =
  | "deleteAction"
  | "deleteMiniApp"
  | "duplicateMiniApp"
  | "discardActionToken"
  | "executeAction"
  | "listActionActivity"
  | "listActions"
  | "listWritePermissions"
  | "prepareAction"
  | "prepareMiniAppAction"
  | "proposeAction"
  | "reviewAction"
  | "saveAction"
  | "setWriteActionsAllowed"
  | "setThemeSettings"
  | "saveTheme"
  | "deleteTheme"
  | "exportTheme"
  | "importTheme";

const refuseOutsideLauncher = (): never => {
  throw new DbError("LAUNCHER_ONLY", "Actions run in the launcher.");
};

// Saving and staging depend on which window asks, so each window gets its own.
type WindowMethod = "saveMiniApp" | "stageMiniAppAction";

const refuseOutsideApp = (): never => {
  throw new DbError(
    "NOT_THIS_WINDOW",
    "Only the app's own window can do that."
  );
};

const boardRefusals = (): Pick<RequestHandlers, LauncherOnlyMethod> => ({
  deleteAction: refuseOutsideLauncher,
  deleteMiniApp: refuseOutsideLauncher,
  deleteTheme: refuseOutsideLauncher,
  discardActionToken: refuseOutsideLauncher,
  duplicateMiniApp: refuseOutsideLauncher,
  executeAction: refuseOutsideLauncher,
  exportTheme: refuseOutsideLauncher,
  importTheme: refuseOutsideLauncher,
  listActionActivity: refuseOutsideLauncher,
  listActions: refuseOutsideLauncher,
  listWritePermissions: refuseOutsideLauncher,
  prepareAction: refuseOutsideLauncher,
  prepareMiniAppAction: refuseOutsideLauncher,
  proposeAction: refuseOutsideLauncher,
  reviewAction: refuseOutsideLauncher,
  saveAction: refuseOutsideLauncher,
  saveTheme: refuseOutsideLauncher,
  setThemeSettings: refuseOutsideLauncher,
  setWriteActionsAllowed: refuseOutsideLauncher,
});

export interface AppHost {
  launcher(): LauncherController | null;
  panelWindows(): PanelWindows | null;
  toggleLauncherFrom(windowKey: string | null): void;
  returnFocusTo(windowKey: string): void;
}

const readAppVersion = async (): Promise<string> => {
  const info = await Updater.getLocalInfo();
  return info.version;
};

const STAGE_FOCUS_MS = 5000;

const panelTitle = (panel: { name: string; emoji?: string }): string =>
  panel.emoji ? `${panel.emoji} ${panel.name}` : panel.name;

const defineAppRpc = (requests: RequestHandlers) =>
  defineElectrobunRPC<AppRpcSchema>("bun", {
    handlers: { requests },
    // Long queries may legitimately run for minutes; the cancel requests are the
    // user-driven recovery path for hung calls, not a transport-level timeout.
    maxRequestTime: Number.POSITIVE_INFINITY,
  });

export type AppRpc = ReturnType<typeof defineAppRpc>;

export function createAppRpcs(host: AppHost) {
  const live = new Set<AppRpc>();
  const broadcastBoardChanged = (boardId: string) => {
    for (const rpc of live) {
      rpc.send.boardChanged({ boardId });
    }
  };
  const broadcastWatchesChanged = () => {
    for (const rpc of live) {
      rpc.send.watchesChanged({});
    }
  };
  const broadcastWidgetSampled = (widgetId: string, valuesKey: string) => {
    for (const rpc of live) {
      rpc.send.widgetSampled({ valuesKey, widgetId });
    }
  };
  const widgetStore = defaultWidgetStore();
  const mcpServers = createMcpServerStore(parseWith(McpServerConfig));
  const httpEndpoints = createHttpEndpointStore(parseWith(HttpEndpointConfig));
  const mcpClients = createMcpClientManager({
    clearTimer: clearTimeout,
    connect: async (server) => connectMcpServer(await readAppVersion())(server),
    now: () => Date.now(),
    servers: mcpServers,
    setTimer: setTimeout,
  });
  const runCache = createRunCache({ now: () => Date.now() });
  const nativeConfirm = createNativeConfirm({
    runModal: (open) => host.launcher()?.runModal(open) ?? open(),
    showMessageBox: (box) => Utils.showMessageBox(box),
  });
  const runner = createSourceRunner({
    fetchJson: (endpoint, url, signal) => fetchJson(endpoint, url, signal),
    httpEndpoints,
    mcp: mcpClients,
    mcpServers,
    pools,
  });
  const widgets = createWidgetService({
    loadModel: loadAskModel,
    now: () => new Date(),
    onSampled: broadcastWidgetSampled,
    recents: defaultRecentAskStore(),
    runCache,
    runLog: defaultRunLogStore(),
    runner,
    widgets: widgetStore,
  });
  const notifier = createAlertNotifier({
    clearTimer: clearTimeout,
    now: () => Date.now(),
    setTimer: setTimeout,
    show: (notification) => Utils.showNotification(notification),
  });
  const power = createPowerProbe();
  const watches = createWatchService({
    broadcast: broadcastWatchesChanged,
    clearTimer: clearTimeout,
    connectionName: async (id) => {
      const connection = await findConnection(id);
      return connection?.name ?? null;
    },
    notify: notifier.notify,
    now: () => new Date(),
    power: () => power?.() ?? "ac",
    readPaused: readWatchingPaused,
    runner: widgets,
    setTimer: setTimeout,
    setTray: (status) => host.launcher()?.setTrayStatus(status),
    watches: createWatchStore(parseWith(Watch)),
    widgets: {
      getWidget: widgetStore.getWidget,
      listWidgets: widgets.listWidgets,
    },
    writePaused: writeWatchingPaused,
  });
  const sourceSettings = createSourceSettingsService({
    confirm: nativeConfirm,
    elapsedMs: () => performance.now(),
    endpoints: httpEndpoints,
    listWidgets: widgetStore.listWidgets,
    mcp: mcpClients,
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
    probeHttp: (endpoint, signal) => probeHttp(endpoint, signal),
    resolveCommand: (command) => resolveCommand(command, process.env.PATH),
    servers: mcpServers,
  });
  const actionStore = createActionStore(parseWith(WidgetAction));
  const writePermissions = createWritePermissions({
    confirm: nativeConfirm,
    describe: async (kind, id) => {
      if (kind === "connection") {
        const connection = await findConnection(id);
        return connection
          ? { identity: connectionIdentity(connection), name: connection.name }
          : null;
      }
      if (kind === "mcp") {
        const server = await mcpServers.get(id);
        return server
          ? { identity: serverIdentity(server), name: server.name }
          : null;
      }
      const endpoint = await httpEndpoints.get(id);
      return endpoint
        ? { identity: endpointIdentity(endpoint), name: endpoint.name }
        : null;
    },
    now: () => new Date(),
    sha256: (text) => createHash("sha256").update(text).digest("hex"),
    store: createPermissionStore(parseWith(WritePermission)),
  });
  const actions = createActionService({
    actions: actionStore,
    audit: {
      append: appendAudit,
      read: (limit) => readAudit({ limit }, (raw) => raw),
      verify: verifyAudit,
    },
    confirm: nativeConfirm,
    executor: createActionExecutor({
      callTool: mcpClients.callTool,
      elapsedMs: () => performance.now(),
      findConnection,
      httpEndpoint: httpEndpoints.get,
      openUrl: async (url) => {
        await Utils.openExternal(url);
      },
      openWritablePool: async (connection, database) => {
        const pool = await ensurePool(pools, connection);
        if (!supportsGuardedWrites(pool)) {
          throw writesUnavailable();
        }
        return {
          pool,
          schema: await resolveSchemaName(pool, database, connection),
        };
      },
      requestJson: (endpoint, request, signal) =>
        requestJson(endpoint, request, signal, {
          maxBytes: ACTION_RESPONSE_BYTES,
          requireJson: false,
        }),
    }),
    findConnection,
    getWidget: widgetStore.getWidget,
    httpEndpoint: httpEndpoints.get,
    inspectConnection: async (connection, database) => {
      const pool = await ensurePool(pools, connection);
      return {
        dialect: pool.dialect,
        schema: await resolveSchemaName(pool, database, connection),
        writable: supportsGuardedWrites(pool),
      };
    },
    listTools: mcpClients.listTools,
    loadModel: loadAskModel,
    loadSchema: (connectionId, schema) => schemas.get(connectionId, schema),
    mcpServer: mcpServers.get,
    newId: () => crypto.randomUUID(),
    newToken: () =>
      Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
        "base64url"
      ),
    now: () => new Date(),
    permissions: writePermissions,
    runCache,
    sha256: (text) => createHash("sha256").update(text).digest("hex"),
  });
  const miniAppStore = defaultMiniAppStore();
  const miniAppGen = createMiniAppGenService({
    catalogFor: (request) =>
      buildGenerationCatalog(
        {
          findConnection,
          isAllowed: writePermissions.isAllowed,
          listEndpoints: httpEndpoints.list,
          listServers: mcpServers.list,
          listTools: mcpClients.listTools,
          openSchema: async (connection, database) => {
            const pool = await ensurePool(pools, connection);
            const resolved = await resolveSchemaName(
              pool,
              database,
              connection
            );
            return {
              database: resolved,
              dialect: pool.dialect,
              schema: await schemas.get(connection.id, resolved),
            };
          },
        },
        request
      ),
    getApp: miniAppStore.getMiniApp,
    loadModel: loadAskModel,
    now: () => new Date(),
    runSource: async (source, inputs, signal) => {
      const { result } = await runner.run(
        { now: new Date(), params: inputs, source, values: {} },
        signal
      );
      return result;
    },
    send: (message) => {
      for (const rpc of live) {
        rpc.send.miniAppGenEvent(message);
      }
    },
  });
  const miniApps = createMiniAppService({
    actions,
    confirm: nativeConfirm,
    draftOf: miniAppGen.draftOf,
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
    onChanged: (appId) => {
      for (const rpc of live) {
        rpc.send.miniAppChanged({ appId });
      }
    },
    onRefresh: (appId, sources) => {
      for (const rpc of live) {
        rpc.send.miniAppRefresh({ appId, sources });
      }
    },
    permissions: writePermissions,
    runCache,
    runner,
    store: miniAppStore,
  });
  const openMiniAppWindow = async (appId: string): Promise<void> => {
    const app = await miniApps.getMiniApp(appId);
    if (!app) {
      throw new DbError("APP_NOT_FOUND", "This app no longer exists.");
    }
    await miniApps.markOpened(app.id);
    await host
      .panelWindows()
      ?.open({ id: app.id, kind: "app" }, panelTitle(app));
  };
  const widgetConnectionUsed = async (widgetId: string) => {
    const widget = await widgetStore.getWidget(widgetId);
    const connectionId = widget ? connectionIdOf(widget) : null;
    if (connectionId) {
      watches.connectionUsed(connectionId);
    }
  };
  const pickJsonFile = async (): Promise<string | null> => {
    const pick = () =>
      Utils.openFileDialog({
        allowedFileTypes: "json",
        allowsMultipleSelection: false,
        canChooseDirectory: false,
        canChooseFiles: true,
        startingFolder: Utils.paths.downloads,
      });
    const launcher = host.launcher();
    const paths = await (launcher ? launcher.runModal(pick) : pick());
    return paths.find((path) => path.length > 0) ?? null;
  };
  const boards = createBoardService({
    boards: createBoardStore(parseWith(Board)),
    getWidget: widgetStore.getWidget,
    now: () => new Date(),
    onChanged: broadcastBoardChanged,
  });
  const bundles = createBundleService({
    boards,
    clipboard: {
      readText: () => Utils.clipboardReadText(),
      writeText: (text) => Utils.clipboardWriteText(text),
    },
    connections: async () => {
      const saved = await getConnections();
      return saved.map(({ id, name, type }) => ({ id, name, type }));
    },
    downloads: { save: (file) => downloads.save(file, [BUNDLE_EXTENSION]) },
    now: () => new Date(),
    pickFile: pickJsonFile,
    readFile: readTextUpTo,
    widgets,
  });
  const themes = createThemeService({
    broadcast: (state) => {
      for (const rpc of live) {
        rpc.send.themeChanged(state);
      }
    },
    newId: () => crypto.randomUUID(),
    pickFile: pickJsonFile,
    readFile: readTextUpTo,
    readSettings: readThemeSettings,
    saveFile: (file) => downloads.save(file, ["conch-theme.json"]),
    store: createThemeStore(parseStoredTheme),
    writeSettings: writeThemeSettings,
  });
  const broadcastMcpActivity = () => {
    for (const rpc of live) {
      rpc.send.mcpActivity({ active: mcpActivity.active() });
    }
  };
  const mcpActivity = createActivityTracker({
    clearTimer: clearTimeout,
    now: () => new Date(),
    publish: broadcastMcpActivity,
    setTimer: setTimeout,
    setTray: (line) => host.launcher()?.setTrayActivity(line),
  });
  const mcp = createMcpServerHost({
    activity: mcpActivity,
    audit: {
      append: appendMcpAudit,
      clear: clearMcpAudit,
      list: (limit) => listMcpAudit(limit, parseWith(McpAuditEntry)),
    },
    listConnections: getConnections,
    now: () => new Date(),
    onClientsChanged: broadcastMcpActivity,
    paths: {
      bridgePath: path.join(PATHS.RESOURCES_FOLDER, "app/bun/mcp-bridge.js"),
      bunPath: process.execPath,
      runDir: mcpRunDir(),
      socketPath: path.join(mcpRunDir(), "mcp.sock"),
    },
    serverVersion: readAppVersion,
    settings: {
      read: () => readMcpSettings(parseWith(McpSettings)),
      write: writeMcpSettings,
    },
    supported: process.platform === "darwin",
    tools: {
      askPorts: (target) =>
        buildAskPorts({ loadModel: loadAskModel, pools, schemas }, target),
      hasAiModel: async () => (await loadAskModel()) !== null,
      listWidgets: widgets.listWidgets,
      loadSchema: (connectionId, database) =>
        schemas.get(connectionId, database),
      resolveDatabase: async (connection, requested) =>
        resolveSchemaName(
          await ensurePool(pools, connection),
          requested,
          connection
        ),
      runAsk,
      runWidget: (widgetId, values, signal) =>
        widgets.runDetached(widgetId, values, signal, { record: false }),
    },
    writeClipboard: (text) => Utils.clipboardWriteText(text),
  });
  const stopAgents = async () => {
    try {
      await mcp.stop();
    } catch (error) {
      console.error(`[mcp] could not stop: ${String(error)}`);
    }
  };
  const persistConnections = async (connections: DatabaseConnection[]) => {
    await saveConnections(connections);
    await writePermissions.keepConnections(
      connections.map((connection) => connection.id)
    );
    watches.connectionsChanged();
  };
  const sample = createSampleService({
    fileExists: (filePath) => Bun.file(filePath).exists(),
    filePath: sampleDatabasePath(),
    getConnections,
    now: () => new Date(),
    saveConnections: persistConnections,
    saveWidget: (draft) => widgets.saveWidget(draft),
    writeDatabase: (filePath, now) =>
      writeSampleDatabase(filePath, buildSampleData(now)),
  });
  let launcherRpc: AppRpc | null = null;
  const updates = createUpdateService({
    onProgress: (progress) => launcherRpc?.send.updateProgress(progress),
    onReady: (version) => host.launcher()?.setTrayUpdate(version),
    updater: Updater,
  });
  const asks = createAskService({
    loadModel: loadAskModel,
    pools,
    rememberAsk: widgets.rememberAsk,
    schemas,
    send: (message) => launcherRpc?.send.askEvent(message),
  });
  const lookups = createLookupService({
    pools,
    schemas,
    send: (message) => launcherRpc?.send.lookupEvent(message),
  });
  const clipboardSetting = { enabled: DEFAULT_CLIPBOARD_LOOKUPS };
  const loadClipboardSetting = async () => {
    try {
      clipboardSetting.enabled = await readClipboardLookups();
    } catch (error) {
      console.error(`[clipboard] could not read the setting: ${String(error)}`);
    }
  };
  const clipboardSettingLoaded = loadClipboardSetting();
  const summonOffer = createClipboardOffer({
    enabled: () => clipboardSetting.enabled,
    formats: createPasteboardTypes(),
    readText: () => Utils.clipboardReadText(),
  });
  const openBoardWindow = async (
    boardId: string
  ): Promise<"opened" | "missing"> => {
    const board = await boards.getBoard(boardId);
    if (!board) {
      return "missing";
    }
    await host
      .panelWindows()
      ?.open({ id: board.id, kind: "board" }, panelTitle(board));
    return "opened";
  };

  const getLauncher = host.launcher;
  const saveApp = async (request: unknown, origin: SaveOrigin) => {
    const saved = await miniApps.saveMiniApp(request, origin);
    host
      .panelWindows()
      ?.setTitle({ id: saved.id, kind: "app" }, panelTitle(saved));
    return saved;
  };
  const appWindowMethods = (
    appId: string
  ): Pick<RequestHandlers, WindowMethod> => ({
    saveMiniApp: (request) => saveApp(request, { appId, kind: "window" }),
    stageMiniAppAction: async (request) => {
      const ref = { id: appId, kind: "app" } as const;
      const staged = await miniApps.stageAction(request, {
        appId,
        focused:
          host.panelWindows()?.focusedWithin(ref, STAGE_FOCUS_MS) ?? false,
      });
      host.returnFocusTo(windowKey(ref));
      getLauncher()?.navigate({ kind: "mini-app-action", request: staged });
    },
  });
  const common: Omit<RequestHandlers, LauncherOnlyMethod | WindowMethod> = {
    acknowledgeAlert: ({ watchId }) => watches.acknowledge(watchId),
    addBoardTile: ({ boardId, widgetId }) => boards.addTile(boardId, widgetId),
    addSampleDatabase: () => sample.add(),
    appendHistory: async ({ entry }) => {
      await appendHistory(entry);
    },
    applyImport: (request) => bundles.applyImport(request),
    ask: (params) => {
      watches.connectionUsed(params.connectionId);
      return asks.startAsk(params);
    },
    cancelAsk: ({ askId }) => asks.cancelAsk(askId),
    cancelLookup: ({ lookupId }) => lookups.cancelLookup(lookupId),
    cancelMiniAppGeneration: (request) => miniAppGen.cancel(request),
    cancelMiniAppRun: ({ runId }) => miniApps.cancelRun(runId),
    cancelWidgetRun: ({ runId }) => widgets.cancelRun(runId),
    checkForUpdate: () => updates.check(),
    clearAiKey: () => removeAiKey(),
    clearMcpAudit: () => mcp.clearAudit(),
    clearRecentAsks: () => widgets.clearRecentAsks(),
    connectToDatabase: async ({ connectionId, params }) => {
      schemas.invalidate(connectionId);
      await pools.connect(connectionId, params);
      watches.connectionUsed(connectionId);
    },
    copyImage: ({ pngBase64 }) => {
      Utils.clipboardWriteImage(decodePng(pngBase64));
    },
    copyMcpClientConfig: ({ client }) => mcp.copyClientConfig(client),
    deleteBoard: async ({ boardId }) => {
      await boards.deleteBoard(boardId);
      host.panelWindows()?.close({ id: boardId, kind: "board" });
    },
    deleteHttpEndpoint: async ({ endpointId }) => {
      const removed = await sourceSettings.deleteHttpEndpoint(endpointId);
      await writePermissions.forget("http", endpointId);
      return removed;
    },
    deleteMcpServer: async ({ serverId }) => {
      const removed = await sourceSettings.deleteMcpServer(serverId);
      await writePermissions.forget("mcp", serverId);
      return removed;
    },
    deleteRecentAsk: ({ askId }) => widgets.deleteRecentAsk(askId),
    deleteWatch: ({ watchId }) => watches.remove(watchId),
    deleteWidget: async ({ widgetId }) => {
      await widgets.deleteWidget(widgetId);
      await boards.removeWidget(widgetId);
      await watches.removeForWidget(widgetId);
      await actionStore.removeForWidget(widgetId);
    },
    describeSql: (params) => {
      const { sql, dialect } = describeSqlParams.parse(params);
      return describeSqlAssumptions(sql, dialect);
    },
    disconnectFromDatabase: async ({ connectionId }) => {
      watches.pauseConnection(connectionId);
      schemas.invalidate(connectionId);
      await pools.disconnect(connectionId);
    },
    exportBundle: (request) => bundles.exportBundle(request),
    formatSql: ({ sql, dialect }) => doFormatSql(sql, dialect),
    generateMiniApp: (request) => miniAppGen.start(request),
    getActiveConnection: () => readActiveConnection(),
    getAiSettings: () => readAiSettings(),
    getAllHistory: ({ filters }) => getAllHistory(filters ?? {}),
    getAppVersion: () => readAppVersion(),
    getBoard: ({ boardId }) => boards.getBoard(boardId),
    getClipboardLookups: async () => {
      await clipboardSettingLoaded;
      return { enabled: clipboardSetting.enabled };
    },
    getConnections: () => getConnections(),
    getHistory: ({ connectionId, limit, offset }) =>
      getHistory(connectionId, limit ?? null, offset ?? null),
    getLauncherHotkey: () => readLauncherHotkey(),
    getMcpSettings: () => mcp.getSettings(),
    getMiniApp: ({ appId }) => miniApps.getMiniApp(appId),
    getSchema: ({ connectionId, databaseName, force }) =>
      schemas.get(connectionId, databaseName, force),
    getServerVersion: ({ connectionId }) =>
      pools.getPool(connectionId).fetchVersion(),
    getThemeState: () => themes.getState(),
    getUpdateChannel: () => updates.channel(),
    getWatchingPaused: () => watches.isPaused(),
    hideLauncher: () => {
      getLauncher()?.hide();
    },
    installUpdate: () => updates.install(),
    listBoards: () => boards.listBoards(),
    listConnectionDatabases: ({ connectionId }) =>
      pools.getPool(connectionId).listDatabases(),
    listHttpEndpoints: () => sourceSettings.listHttpEndpoints(),
    listMcpAudit: (request) => mcp.listAudit(request),
    listMcpServers: () => sourceSettings.listMcpServers(),
    listMcpTools: ({ serverId }) => sourceSettings.listMcpTools(serverId),
    listMiniApps: () => miniApps.listMiniApps(),
    listRecentAsks: (request) => widgets.listRecentAsks(request),
    listWatchStatuses: () => watches.statuses(),
    listWatches: () => watches.list(),
    listWidgetTrends: ({ widgetIds }) => widgets.listWidgetTrends(widgetIds),
    listWidgets: () => widgets.listWidgets(),
    loadMiniAppInputOptions: (request) => miniApps.loadInputOptions(request),
    loadParamOptions: ({ widgetId, paramName }) =>
      widgets.loadParamOptions(widgetId, paramName),
    lookup: (params) => lookups.startLookup(params),
    openBoard: async ({ boardId }) => {
      if ((await openBoardWindow(boardId)) === "missing") {
        throw new DbError("BOARD_NOT_FOUND", "This board no longer exists.");
      }
    },
    openMiniApp: ({ appId }) => openMiniAppWindow(appId),
    openWidgetInLauncher: ({ widgetId }) => {
      getLauncher()?.navigate({ kind: "widget-run", widgetId });
    },
    peekSchema: (params) => schemaPeek.peek(params),
    previewImport: (request) => bundles.previewImport(request),
    previewSource: (request) => widgets.previewSource(request),
    proposeSourceWidget: (request) => widgets.proposeSource(request),
    proposeWidgetParams: (request) => widgets.proposeParams(request),
    rendererReady: () => {
      console.log("[rpc] renderer ready");
      getLauncher()?.markRendererReady();
    },
    resetSecrets: async () => {
      await resetSecrets();
    },
    resizeLauncher: ({ height }) => {
      getLauncher()?.resize(height);
    },
    revealSaved: ({ savedId }) => downloads.reveal(savedId),
    rotateMcpToken: () => mcp.rotateToken(),
    runMiniAppSource: (request) => miniApps.runSource(request),
    runSql: (params) => {
      watches.connectionUsed(params.connectionId);
      return asks.startSqlRun(params);
    },
    runWidget: async (request) => {
      const outcome = await widgets.runWidget(request);
      await widgetConnectionUsed(request.widgetId);
      return outcome;
    },
    saveAiSettings: (input) => writeAiSettings(input),
    saveBoard: async ({ board }) => {
      const saved = await boards.saveBoard(board);
      host
        .panelWindows()
        ?.setTitle({ id: saved.id, kind: "board" }, panelTitle(saved));
      return saved;
    },
    saveConnections: ({ connections }) => persistConnections(connections),
    saveHttpEndpoint: ({ endpoint }) =>
      sourceSettings.saveHttpEndpoint(endpoint),
    saveMcpServer: ({ server }) => sourceSettings.saveMcpServer(server),
    saveMcpSettings: (update) => mcp.saveSettings(update),
    saveToDownloads: (params) => downloads.save(params, ["csv"]),
    saveWatch: ({ watch }) => watches.save(watch),
    saveWidget: ({ widget }) => widgets.saveWidget(widget),
    sendFeedback: async () => {
      const local = await Updater.getLocalInfo();
      await Utils.openExternal(
        feedbackUrl({
          arch: process.arch,
          channel: local.channel,
          system: `macOS (Darwin ${os.release()})`,
          version: local.version,
        })
      );
    },
    setActiveConnection: async ({ active }) => {
      await writeActiveConnection(active);
    },
    setClipboardLookups: async ({ enabled }) => {
      clipboardSetting.enabled = await writeClipboardLookups(enabled);
      return { enabled: clipboardSetting.enabled };
    },
    setMcpToolRead: (request) => sourceSettings.setMcpToolRead(request),
    setMiniAppValues: (request) => miniApps.setValues(request),
    setWatchingPaused: ({ paused }) => watches.setPaused(paused),
    testAiSettings: (input) => testAiSettings(input),
    testConnection: ({ params }) =>
      getDriver(params.type).testConnection(params),
    testHttpEndpoint: ({ endpointId }) =>
      sourceSettings.testHttpEndpoint(endpointId),
    testMcpServer: ({ serverId }) => sourceSettings.testMcpServer(serverId),
    toggleLauncher: ({ fromWindowKey }) => {
      host.toggleLauncherFrom(fromWindowKey);
    },
  };

  // Actions, and the run cache they read rows from, belong to the launcher
  // window only; board windows render the same data but can't act on it.
  const launcherOnly: Pick<RequestHandlers, LauncherOnlyMethod> = {
    deleteAction: ({ actionId }) => actions.deleteAction(actionId),
    deleteMiniApp: async ({ appId }) => {
      await miniApps.deleteMiniApp(appId);
      host.panelWindows()?.close({ id: appId, kind: "app" });
    },
    deleteTheme: ({ themeId }) => themes.deleteTheme(themeId),
    discardActionToken: ({ token }) => actions.discardToken(token),
    duplicateMiniApp: ({ appId }) => miniApps.duplicateMiniApp(appId),
    executeAction: async (request) => {
      const outcome = await actions.executeAction(request);
      await miniApps.afterExecute(String(request.token), outcome);
      return outcome;
    },
    exportTheme: ({ themeId }) => themes.exportTheme(themeId),
    importTheme: () => themes.importTheme(),
    listActionActivity: (request) => actions.listActivity(request),
    listActions: ({ widgetId }) => actions.listActions(widgetId),
    listWritePermissions: () => writePermissions.list(),
    prepareAction: (request) => actions.prepareAction(request),
    prepareMiniAppAction: (request) => miniApps.prepareAction(request),
    proposeAction: (request) => actions.proposeAction(request),
    reviewAction: (request) => actions.reviewAction(request),
    saveAction: (request) => actions.saveAction(request),
    saveTheme: ({ theme }) => themes.saveTheme(theme),
    setThemeSettings: ({ settings }) => themes.setSettings(settings),
    setWriteActionsAllowed: (request) => writePermissions.setAllowed(request),
  };
  const launcherHandlers = wrapHandlers({
    ...common,
    ...launcherOnly,
    runWidget: async (request) => {
      const outcome = await widgets.runWidget(request, { cacheRun: true });
      await widgetConnectionUsed(request.widgetId);
      return outcome;
    },
    saveMiniApp: (request) => saveApp(request, { kind: "launcher" }),
    stageMiniAppAction: refuseOutsideApp,
  });
  const boardHandlers = wrapHandlers({
    ...common,
    ...boardRefusals(),
    saveMiniApp: refuseOutsideApp,
    stageMiniAppAction: refuseOutsideApp,
  });

  // Bun binds each window's RPC to the panel it opened, so an app window's
  // app id comes from bun, never from what the window sends.
  const createWindowRpc = (ref: PanelRef): AppRpc => {
    const handlers =
      ref.kind === "app"
        ? wrapHandlers({
            ...common,
            ...boardRefusals(),
            ...appWindowMethods(ref.id),
          })
        : boardHandlers;
    const rpc = defineAppRpc(handlers);
    live.add(rpc);
    return rpc;
  };
  launcherRpc = defineAppRpc(launcherHandlers);
  live.add(launcherRpc);

  return {
    background: {
      acknowledge: async (watchId: string) => {
        try {
          await watches.acknowledge(watchId);
        } catch (error) {
          console.error(`[watch] could not acknowledge ${watchId}`, error);
        }
      },
      installUpdate: async () => {
        try {
          await updates.install();
        } catch (error) {
          console.error(`[updater] could not install: ${String(error)}`);
        }
      },
      start: async () => {
        try {
          await mcp.start();
        } catch (error) {
          console.error(`[mcp] could not start: ${String(error)}`);
        }
        await watches.start();
        updates.start();
      },
      stop: () => {
        updates.stop();
        watches.stop();
        mcpClients.closeAll();
        notifier.dispose();
        stopAgents();
      },
    },
    createWindowRpc,
    launcherRpc,
    openBoardWindow,
    releaseWindowRpc: (rpc: AppRpc) => {
      live.delete(rpc);
    },
    summonOffer,
  };
}
