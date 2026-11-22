import type { DatabaseConnection } from "@/lib/connections";
import type { MiniApp } from "@/lib/ipc";

const actionCount = (count: number): string | null => {
  if (count === 0) {
    return null;
  }
  return count === 1 ? "1 action" : `${count} actions`;
};

const KIND_NAMES = { http: "HTTP", mcp: "MCP" } as const;

// "Postgres · MCP · 2 actions": what an app reads and how much it can do.
export const appMeta = (
  app: Pick<MiniApp, "sources" | "actions">,
  connectionById: (id: string) => DatabaseConnection | null
): string => {
  const sqlNames = [
    ...new Set(
      Object.values(app.sources).flatMap((source) =>
        source.kind === "sql"
          ? [connectionById(source.connectionId)?.name ?? "SQL"]
          : []
      )
    ),
  ];
  const external = [
    ...new Set(
      Object.values(app.sources).flatMap((source) =>
        source.kind === "sql" ? [] : [KIND_NAMES[source.kind]]
      )
    ),
  ];
  return [...sqlNames, ...external, actionCount(app.actions.length)]
    .filter((part): part is string => part !== null)
    .join(" · ");
};
