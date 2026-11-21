import { RotateCwIcon } from "lucide-react";
import { motion } from "motion/react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { useMotionPreset } from "@/lib/motion";

export const AGENTS_EXPLAINER =
  "Claude Code, Cursor and other MCP clients on this Mac can list your connections, read schemas, ask questions and run saved widgets through Conch. Every tool is read-only, agents only see the connections you choose, passwords never leave Conch, and every call is logged.";

const BUTTON =
  "flex h-7 items-center gap-1.5 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none";

export function AgentsExplainer({ onTurnOn }: { onTurnOn: () => void }) {
  const { reduced, fadeOut } = useMotionPreset();
  return (
    <motion.div
      className="flex flex-col items-start gap-3 px-4 pt-1 pb-4"
      exit={
        reduced
          ? { opacity: 0, transition: fadeOut }
          : { opacity: 0, scale: 0.98, transition: fadeOut }
      }
    >
      <p className="type-body text-panel-muted">{AGENTS_EXPLAINER}</p>
      <Pressable className={BUTTON} onClick={onTurnOn}>
        Turn on
      </Pressable>
    </motion.div>
  );
}

export function AgentsSkeleton({ label }: { label: string }) {
  const visible = useDelayedVisibility(true);
  return visible ? (
    <div
      aria-label={label}
      className="flex flex-col gap-2 px-4 py-3"
      role="status"
    >
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-6 motion-reduce:animate-none" key={index} />
      ))}
    </div>
  ) : null;
}

interface AgentsProblemProps {
  message: string;
  onRetry: () => void;
}

export function AgentsProblem({ message, onRetry }: AgentsProblemProps) {
  return (
    <Reveal className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="min-w-0 type-body text-danger-ink" role="alert">
        {message}
      </p>
      <Pressable className={BUTTON} onClick={onRetry}>
        <RotateCwIcon aria-hidden className="size-3" />
        Retry
      </Pressable>
    </Reveal>
  );
}
