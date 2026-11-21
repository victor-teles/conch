import type { McpActivity, McpTool } from "@conch/rpc";

export const TRAY_LINGER_MS = 1500;

export interface ActivityDeps {
  publish(active: McpActivity[]): void;
  setTray(line: string | null): void;
  now(): Date;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}

export interface ActivityStart {
  client: string;
  tool: McpTool;
  connectionName: string | null;
}

export type ActivityTracker = ReturnType<typeof createActivityTracker>;

const TRAY_PHRASES: Record<McpTool, string> = {
  ask: "asking",
  describe_schema: "reading",
  list_connections: "listing connections",
  list_widgets: "listing widgets",
  run_widget: "running a widget on",
};

export const trayLine = (activity: McpActivity): string => {
  const phrase = TRAY_PHRASES[activity.tool];
  const target =
    activity.connectionName &&
    activity.tool !== "list_connections" &&
    activity.tool !== "list_widgets"
      ? ` ${activity.connectionName}`
      : "";
  return `${activity.client} · ${phrase}${target}…`;
};

export const createActivityTracker = (deps: ActivityDeps) => {
  const active = new Map<string, McpActivity>();
  let clearing: unknown = null;

  const cancelClear = () => {
    if (clearing !== null) {
      deps.clearTimer(clearing);
      clearing = null;
    }
  };

  const changed = () => {
    const list = [...active.values()];
    deps.publish(list);
    const latest = list.at(-1);
    if (latest) {
      cancelClear();
      deps.setTray(trayLine(latest));
      return;
    }
    cancelClear();
    clearing = deps.setTimer(() => {
      clearing = null;
      deps.setTray(null);
    }, TRAY_LINGER_MS);
  };

  return {
    active: (): McpActivity[] => [...active.values()],
    dispose: cancelClear,
    start(start: ActivityStart): () => void {
      const id = crypto.randomUUID();
      active.set(id, { ...start, id, startedAt: deps.now().toISOString() });
      changed();
      return () => {
        if (active.delete(id)) {
          changed();
        }
      };
    },
  };
};
