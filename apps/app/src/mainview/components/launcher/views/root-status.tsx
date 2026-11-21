import { AnimatePresence } from "motion/react";

import type { ExportOutcome } from "@/components/bundle/use-export";

import { useAgentActivityStatus } from "@/components/agents/agent-activity-provider";
import { AgentActivityStatus } from "@/components/agents/agent-activity-status";
import { ExportStatus } from "@/components/bundle/export-status";
import { ConnectionStatus } from "@/components/launcher/connection-status";
import { CheckDraw } from "@/components/motion/check-draw";
import { SwapText } from "@/components/motion/swap-text";

import type { RootNotice } from "./use-root-menus";

interface RootStatusProps {
  outcome: ExportOutcome | null;
  notice?: RootNotice | null;
  onReveal: () => void;
}

export function RootStatus({
  outcome,
  notice = null,
  onReveal,
}: RootStatusProps) {
  const quiet = !(outcome || notice);
  const activity = useAgentActivityStatus();
  return (
    <>
      {quiet && !activity ? <ConnectionStatus /> : null}
      <AgentActivityStatus activity={quiet ? activity : null} />
      {notice && !outcome ? (
        <span className="flex min-w-0 items-center gap-1.5" role="status">
          {notice.done ? <CheckDraw className="shrink-0" label="Done" /> : null}
          <SwapText className="truncate" value={notice.message} />
        </span>
      ) : null}
      <AnimatePresence mode="popLayout">
        {outcome ? (
          <ExportStatus key="export" onReveal={onReveal} outcome={outcome} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
