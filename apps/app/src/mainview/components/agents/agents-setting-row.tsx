import { ChevronRightIcon } from "lucide-react";

import type { RedactedMcpSettings } from "@/lib/ipc";

import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";

import { agentsSummary } from "./agents-copy";
import { useExposedCount } from "./use-exposed-count";
import { useMcpSettings } from "./use-mcp-settings";

const NO_EXPOSURE: readonly string[] = [];

const summaryOf = (
  settings: RedactedMcpSettings | null,
  count: number
): string => (settings ? agentsSummary(settings, count) : "…");

export function AgentsSettingRow({ onOpen }: { onOpen: () => void }) {
  const { state } = useMcpSettings();
  const settings = state.status === "ready" ? state.settings : null;
  const count = useExposedCount(settings?.exposedConnectionIds ?? NO_EXPOSURE);
  return (
    <SettingRow
      description="Read-only access for Claude Code, Cursor and other local MCP clients."
      label="Agents (MCP)"
    >
      <Pressable
        aria-label="Open Agents (MCP)"
        className="flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
        onClick={onOpen}
      >
        <SwapText
          value={state.status === "error" ? "Open" : summaryOf(settings, count)}
        />
        <ChevronRightIcon aria-hidden className="size-3" />
      </Pressable>
    </SettingRow>
  );
}
