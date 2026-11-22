import type { ReactNode } from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  RedactedHttpEndpoint,
  RedactedMcpServer,
  Source,
} from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { listHttpEndpoints, listMcpServers } from "@/lib/ipc";

export type SourcesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      servers: RedactedMcpServer[];
      endpoints: RedactedHttpEndpoint[];
    };

interface SourcesContextValue {
  state: SourcesState;
  retry: () => void;
  putServer: (server: RedactedMcpServer) => void;
  putEndpoint: (endpoint: RedactedHttpEndpoint) => void;
  dropServer: (serverId: string) => void;
  dropEndpoint: (endpointId: string) => void;
}

const EMPTY: SourcesState = { endpoints: [], servers: [], status: "ready" };
const ignore = (): void => undefined;

// Board windows render source glyphs without the launcher's provider.
const SourcesContext = createContext<SourcesContextValue>({
  dropEndpoint: ignore,
  dropServer: ignore,
  putEndpoint: ignore,
  putServer: ignore,
  retry: ignore,
  state: EMPTY,
});

const upsert = <T extends { id: string }>(items: readonly T[], next: T): T[] =>
  items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [...items, next];

export function SourcesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SourcesState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [servers, endpoints] = await Promise.all([
          listMcpServers(),
          listHttpEndpoints(),
        ]);
        if (!cancelled) {
          setState({ endpoints, servers, status: "ready" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            message: getErrorMessage(error, "Sources could not load."),
            status: "error",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const change = useCallback(
    (
      apply: (ready: Extract<SourcesState, { status: "ready" }>) => SourcesState
    ) =>
      setState((current) =>
        current.status === "ready" ? apply(current) : current
      ),
    []
  );

  const value = useMemo<SourcesContextValue>(
    () => ({
      dropEndpoint: (endpointId) =>
        change((ready) => ({
          ...ready,
          endpoints: ready.endpoints.filter((item) => item.id !== endpointId),
        })),
      dropServer: (serverId) =>
        change((ready) => ({
          ...ready,
          servers: ready.servers.filter((item) => item.id !== serverId),
        })),
      putEndpoint: (endpoint) =>
        change((ready) => ({
          ...ready,
          endpoints: upsert(ready.endpoints, endpoint),
        })),
      putServer: (server) =>
        change((ready) => ({
          ...ready,
          servers: upsert(ready.servers, server),
        })),
      retry: () => {
        setState({ status: "loading" });
        setAttempt((value) => value + 1);
      },
      state,
    }),
    [change, state]
  );

  return <SourcesContext value={value}>{children}</SourcesContext>;
}

export const useSources = (): SourcesContextValue => use(SourcesContext);

export const sourceNameOf = (
  state: SourcesState,
  source: Source
): string | null => {
  if (state.status !== "ready" || source.kind === "sql") {
    return null;
  }
  return source.kind === "mcp"
    ? (state.servers.find((item) => item.id === source.serverId)?.name ?? null)
    : (state.endpoints.find((item) => item.id === source.endpointId)?.name ??
        null);
};
