import { useEffect, useState } from "react";

import type { AppActionDraft } from "@/lib/ipc";

import { getConnections, listHttpEndpoints, listMcpServers } from "@/lib/ipc";

// A window has no launcher providers, so it reads the names it needs once.
export const useTargetNames = (): ((action: AppActionDraft) => string) => {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [connections, servers, endpoints] = await Promise.all([
          getConnections(),
          listMcpServers(),
          listHttpEndpoints(),
        ]);
        if (!cancelled) {
          setNames(
            new Map([
              ...connections.map(
                (item) => [`sql:${item.id}`, item.name] as const
              ),
              ...servers.map((item) => [`mcp:${item.id}`, item.name] as const),
              ...endpoints.map(
                (item) => [`http:${item.id}`, item.name] as const
              ),
            ])
          );
        }
      } catch (error) {
        console.error("[app] could not read target names", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  return (action) => {
    const { target } = action;
    switch (target.kind) {
      case "sql": {
        return names.get(`sql:${target.connectionId}`) ?? target.connectionId;
      }
      case "mcp": {
        return names.get(`mcp:${target.serverId}`) ?? target.serverId;
      }
      case "http": {
        return names.get(`http:${target.endpointId}`) ?? target.endpointId;
      }
      default: {
        return "this target";
      }
    }
  };
};
