import { AnimatePresence } from "motion/react";

import type { ExportOutcome } from "@/components/bundle/use-export";

import { ExportStatus } from "@/components/bundle/export-status";
import { ConnectionStatus } from "@/components/launcher/connection-status";
import { SwapText } from "@/components/motion/swap-text";

interface RootStatusProps {
  outcome: ExportOutcome | null;
  notice?: string | null;
  onReveal: () => void;
}

export function RootStatus({
  outcome,
  notice = null,
  onReveal,
}: RootStatusProps) {
  const quiet = !(outcome || notice);
  return (
    <>
      {quiet ? <ConnectionStatus /> : null}
      {notice && !outcome ? (
        <span className="flex min-w-0 items-center" role="status">
          <SwapText className="truncate" value={notice} />
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
