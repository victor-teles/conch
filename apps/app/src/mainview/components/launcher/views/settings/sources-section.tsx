import { PlusIcon, RotateCwIcon } from "lucide-react";
import { useCallback } from "react";

import type { SourceEditTarget } from "@/components/launcher/use-launcher-stack";
import type { RedactedHttpEndpoint, RedactedMcpServer } from "@/lib/ipc";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { useSources } from "@/components/sources/sources-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import type { SourceRowModel } from "./source-row";

import { SourceRow } from "./source-row";

export const SOURCES_EMPTY =
  "Connect an MCP server or an HTTP API to build widgets from it.";

const BUTTON =
  "flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none";

const serverDetail = (server: RedactedMcpServer): string =>
  server.transport === "stdio"
    ? [server.command, ...server.args].join(" ")
    : server.url;

export const sourceRows = (
  servers: readonly RedactedMcpServer[],
  endpoints: readonly RedactedHttpEndpoint[]
): SourceRowModel[] => [
  ...servers.map((server) => ({
    detail: serverDetail(server),
    id: server.id,
    key: `mcp:${server.id}`,
    kind: "mcp" as const,
    lastTest: server.lastTest,
    name: server.name,
  })),
  ...endpoints.map((endpoint) => ({
    detail: endpoint.baseUrl,
    id: endpoint.id,
    key: `http:${endpoint.id}`,
    kind: "http" as const,
    lastTest: endpoint.lastTest,
    name: endpoint.name,
  })),
];

function SourcesLoading() {
  const visible = useDelayedVisibility(true);
  return visible ? (
    <div
      aria-label="Loading sources"
      className="flex flex-col gap-2 px-4 py-3"
      role="status"
    >
      <Skeleton className="h-6 motion-reduce:animate-none" />
      <Skeleton className="h-6 motion-reduce:animate-none" />
    </div>
  ) : null;
}

interface SourcesSectionProps {
  onOpen: (target: SourceEditTarget) => void;
}

export function SourcesSection({ onOpen }: SourcesSectionProps) {
  const { state, retry } = useSources();
  const handleAddServer = useCallback(
    () => onOpen({ id: null, type: "mcp" }),
    [onOpen]
  );
  const handleAddEndpoint = useCallback(
    () => onOpen({ id: null, type: "http" }),
    [onOpen]
  );
  if (state.status === "loading") {
    return <SourcesLoading />;
  }
  if (state.status === "error") {
    return (
      <Reveal className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 type-body text-danger-ink" role="alert">
          {state.message}
        </p>
        <Pressable className={BUTTON} onClick={retry}>
          <RotateCwIcon aria-hidden className="size-3" />
          Retry
        </Pressable>
      </Reveal>
    );
  }
  const rows = sourceRows(state.servers, state.endpoints);
  return (
    <Reveal>
      {rows.length === 0 ? (
        <p className="px-4 pt-2 pb-1 type-meta text-panel-muted">
          {SOURCES_EMPTY}
        </p>
      ) : (
        <ul aria-label="Sources" className="flex flex-col">
          {rows.map((row, index) => (
            <SourceRow index={index} key={row.key} onOpen={onOpen} row={row} />
          ))}
        </ul>
      )}
      <div className="flex gap-2 px-4 py-2.5">
        <Pressable className={BUTTON} onClick={handleAddServer}>
          <PlusIcon aria-hidden className="size-3" />
          Add MCP Server
        </Pressable>
        <Pressable className={BUTTON} onClick={handleAddEndpoint}>
          <PlusIcon aria-hidden className="size-3" />
          Add HTTP Endpoint
        </Pressable>
      </div>
    </Reveal>
  );
}
