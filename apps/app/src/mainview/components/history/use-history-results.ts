import type { ScopeOption } from "@/components/launcher/scope-filter";
import type { RecentAsk } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";

import type { HistoryEntry } from "./history-search";

import { flattenHistory, historySections } from "./history-search";

export const useHistoryResults = (
  asks: readonly RecentAsk[],
  query: string,
  scope: string | null = null
) => {
  const { state, activeConnection } = useConnections();
  const nameOf = (connectionId: string) =>
    state.connections.find((connection) => connection.id === connectionId)
      ?.name ?? null;
  const scoped = scope
    ? asks.filter((ask) => ask.connectionId === scope)
    : asks;
  const entries: HistoryEntry[] = scoped.map((ask) => ({
    ask,
    connectionName: nameOf(ask.connectionId),
  }));
  const scopeOptions: ScopeOption[] = state.connections
    .filter((connection) =>
      asks.some((ask) => ask.connectionId === connection.id)
    )
    .map((connection) => ({ id: connection.id, label: connection.name }));
  const now = new Date();
  const sections = historySections(entries, query, now);
  return {
    connections: { active: activeConnection, all: state.connections },
    items: flattenHistory(sections),
    now,
    scopeName: scope ? nameOf(scope) : null,
    scopeOptions,
    sections,
  };
};
