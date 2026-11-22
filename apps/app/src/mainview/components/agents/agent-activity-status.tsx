import { mcpActivityPhrase } from "@conch/rpc";
import { AnimatePresence, motion } from "motion/react";

import type { McpActivity } from "@/lib/ipc";

import { SwapText } from "@/components/motion/swap-text";
import { useMotionPreset } from "@/lib/motion";

import { clientLabel } from "./agents-copy";

const BREATHE = {
  duration: 0.8,
  ease: "easeInOut",
  repeat: Number.POSITIVE_INFINITY,
  repeatType: "reverse",
} as const;

function ActivityDot() {
  const { reduced } = useMotionPreset();
  const className = "size-1.5 shrink-0 rounded-full bg-primary";
  return reduced ? (
    <span aria-hidden className={className} data-motion="static" />
  ) : (
    <motion.span
      animate={{ opacity: [0.4, 1] }}
      aria-hidden
      className={className}
      data-motion="breathe"
      transition={BREATHE}
    />
  );
}

export const activityText = (activity: McpActivity): string =>
  mcpActivityPhrase({ ...activity, client: clientLabel(activity.client) });

interface AgentActivityStatusProps {
  activity: McpActivity | null;
}

export function AgentActivityStatus({ activity }: AgentActivityStatusProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  return (
    <span
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 empty:hidden"
      data-slot="agent-activity"
    >
      <AnimatePresence>
        {activity ? (
          <motion.span
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            className="flex min-w-0 items-center gap-2"
            exit={{ opacity: 0, transition: fadeOut }}
            initial={
              reduced
                ? { opacity: 0 }
                : { filter: "blur(4px)", opacity: 0, y: 4 }
            }
            key="activity"
            transition={fadeIn}
          >
            <ActivityDot />
            <SwapText className="truncate" value={activityText(activity)} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
