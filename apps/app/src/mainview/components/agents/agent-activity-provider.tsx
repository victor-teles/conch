import type { ReactNode } from "react";

import { createContext, use } from "react";

import type { McpActivity } from "@/lib/ipc";

import { useAgentActivity } from "./use-agent-activity";

const AgentActivityContext = createContext<McpActivity | null>(null);

export function AgentActivityProvider({ children }: { children: ReactNode }) {
  const activity = useAgentActivity();
  return (
    <AgentActivityContext value={activity}>{children}</AgentActivityContext>
  );
}

export const useAgentActivityStatus = (): McpActivity | null =>
  use(AgentActivityContext);
