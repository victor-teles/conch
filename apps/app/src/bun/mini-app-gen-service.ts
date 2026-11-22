import type {
  ActionTargetCatalog,
  LanguageModel,
  MiniAppGenInput,
  MiniAppGenPorts,
  SourceCatalog,
} from "@conch/agent";
import type { TabularResult } from "@conch/core";
import type { ParamDef, Source } from "@conch/rpc";
import type {
  MiniApp,
  MiniAppDraft,
  MiniAppGenEvent,
  MiniAppGenEventMessage,
} from "@conch/rpc/mini-app";

import { generateMiniApp, isGenerationRead } from "@conch/agent";
import { DbError } from "@conch/core";
import { draftOfApp, GenerateMiniAppRequest } from "@conch/rpc/mini-app";
import { z } from "zod";

export const KEPT_DRAFTS = 3;

export interface CatalogRequest {
  connectionId: string | null;
  database: string | null;
  prompt: string;
}

export interface GenerationCatalog {
  catalog: SourceCatalog;
  actionTargets: ActionTargetCatalog;
}

export interface MiniAppGenServiceDeps {
  loadModel(): Promise<LanguageModel | null>;
  catalogFor(request: CatalogRequest): Promise<GenerationCatalog>;
  getApp(appId: string): Promise<MiniApp | null>;
  runSource(
    source: Source,
    inputs: readonly ParamDef[],
    signal: AbortSignal
  ): Promise<TabularResult>;
  send(message: MiniAppGenEventMessage): void;
  now(): Date;
  generate?: (
    input: MiniAppGenInput,
    ports: MiniAppGenPorts,
    signal: AbortSignal
  ) => AsyncGenerator<MiniAppGenEvent>;
}

const notInCatalog = (): DbError =>
  new DbError("NOT_IN_CATALOG", "That source isn't one this app may read.");

// The port re-checks what the generator already checks: a source runs only
// against the catalog the person chose, and never a tool that can write.
const assertCatalogRead = (source: Source, catalog: SourceCatalog): void => {
  const known =
    (source.kind === "sql" && catalog.connection?.id === source.connectionId) ||
    (source.kind === "mcp" &&
      catalog.mcpServers.some((server) => server.id === source.serverId)) ||
    (source.kind === "http" &&
      catalog.httpEndpoints.some((item) => item.id === source.endpointId));
  if (!(known && isGenerationRead(source, catalog))) {
    throw notInCatalog();
  }
};

export const createMiniAppGenService = (deps: MiniAppGenServiceDeps) => {
  const generate = deps.generate ?? generateMiniApp;
  const drafts = new Map<string, MiniAppDraft>();
  let active: { genId: string; controller: AbortController } | null = null;

  const emit = (genId: string, event: MiniAppGenEvent) =>
    deps.send({ event, genId });

  const keep = (genId: string, draft: MiniAppDraft) => {
    drafts.delete(genId);
    drafts.set(genId, draft);
    while (drafts.size > KEPT_DRAFTS) {
      const [oldest] = drafts.keys();
      if (oldest === undefined) {
        return;
      }
      drafts.delete(oldest);
    }
  };

  const baseOf = async (appId: string | null): Promise<MiniAppDraft | null> => {
    if (!appId) {
      return null;
    }
    const app = await deps.getApp(appId);
    if (!app) {
      throw new DbError("APP_NOT_FOUND", "This app no longer exists.");
    }
    return draftOfApp(app);
  };

  const run = async (
    request: z.infer<typeof GenerateMiniAppRequest>,
    controller: AbortController
  ) => {
    const { genId } = request;
    const model = await deps.loadModel();
    if (!model) {
      emit(genId, {
        code: "NO_AI_SETTINGS",
        message: "Add an AI provider in Settings to build apps.",
        type: "error",
      });
      return;
    }
    const base = await baseOf(request.baseAppId);
    const { catalog, actionTargets } = await deps.catalogFor({
      connectionId: request.connectionId,
      database: request.database,
      prompt: request.prompt,
    });
    const ports: MiniAppGenPorts = {
      model,
      now: deps.now,
      runSource: async (source, inputs, signal) => {
        assertCatalogRead(source, catalog);
        return await deps.runSource(source, inputs, signal);
      },
    };
    const events = generate(
      { actionTargets, base, catalog, prompt: request.prompt },
      ports,
      controller.signal
    );
    // The renderer that cancelled already knows; a stopped build goes quiet.
    for await (const event of events) {
      if (controller.signal.aborted) {
        return;
      }
      if (event.type === "done") {
        keep(genId, event.draft);
      }
      emit(genId, event);
    }
  };

  const settle = async (
    request: z.infer<typeof GenerateMiniAppRequest>,
    controller: AbortController
  ): Promise<void> => {
    try {
      await run(request, controller);
    } catch (error) {
      if (!controller.signal.aborted) {
        emit(request.genId, {
          code: "INVALID_APP",
          message: DbError.fromUnknown(error).message,
          type: "error",
        });
      }
    } finally {
      if (active?.controller === controller) {
        active = null;
      }
    }
  };

  return {
    cancel(request: { genId: unknown }): void {
      const genId = z.string().max(100).parse(request.genId);
      if (active?.genId === genId) {
        active.controller.abort();
        active = null;
      }
    },

    draftOf: (genId: string): MiniAppDraft | null => drafts.get(genId) ?? null,

    // One build at a time: starting another stops the one before it.
    start(request: unknown): void {
      const parsed = GenerateMiniAppRequest.parse(request);
      active?.controller.abort();
      const controller = new AbortController();
      active = { controller, genId: parsed.genId };
      settle(parsed, controller);
    },
  };
};

export type MiniAppGenService = ReturnType<typeof createMiniAppGenService>;
