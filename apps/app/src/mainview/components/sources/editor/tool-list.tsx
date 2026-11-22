import type { McpToolSummary } from "@/lib/ipc";

import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";

import { ToolRow } from "./tool-row";

export type ToolsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tools: McpToolSummary[]; pending: string | null };

interface ToolListProps {
  state: ToolsState;
  onToggle: (tool: McpToolSummary) => void;
}

function ToolsLoading() {
  const visible = useDelayedVisibility(true);
  return visible ? (
    <div
      aria-label="Reading tools"
      className="flex flex-col gap-2 px-4 py-2"
      role="status"
    >
      <Skeleton className="h-5 motion-reduce:animate-none" />
      <Skeleton className="h-5 motion-reduce:animate-none" />
    </div>
  ) : null;
}

export function ToolList({ state, onToggle }: ToolListProps) {
  if (state.status === "idle") {
    return (
      <p className="px-4 py-2 type-meta text-panel-muted">
        Test the server to see its tools.
      </p>
    );
  }
  if (state.status === "loading") {
    return <ToolsLoading />;
  }
  if (state.status === "error") {
    return (
      <p className="px-4 py-2 type-meta text-danger-ink" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.tools.length === 0) {
    return (
      <p className="px-4 py-2 type-meta text-panel-muted">
        This server has no tools.
      </p>
    );
  }
  return (
    <ul aria-label="Tools" className="flex flex-col px-2 pb-2">
      {state.tools.map((tool, index) => (
        <ToolRow
          index={index}
          key={tool.name}
          onToggle={onToggle}
          pending={state.pending === tool.name}
          tool={tool}
        />
      ))}
    </ul>
  );
}
