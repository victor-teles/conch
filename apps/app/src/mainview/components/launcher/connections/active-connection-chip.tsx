import { AnimatePresence, motion } from "motion/react";

import type { DatabaseConnection } from "@/lib/connections";

import { useMotionPreset } from "@/lib/motion";

import { ConnectionGlyph } from "./connection-glyph";
import { handoffLayoutId } from "./connection-identity";
import { useConnections } from "./connections-provider";

export type ChipTone = "active" | "pending";

const PENDING_OPACITY = 0.5;

interface ActiveConnectionChipProps {
  tone?: ChipTone;
  target?: DatabaseConnection | null;
}

// `target` shows the connection a staged link will ask before it is active.
export function ActiveConnectionChip({
  tone = "active",
  target = null,
}: ActiveConnectionChipProps) {
  const { activeConnection: active } = useConnections();
  const { spring, fadeIn, fadeOut } = useMotionPreset();
  const activeConnection = target ?? active;
  const label =
    activeConnection && activeConnection.id !== active?.id
      ? `Connection for this ask: ${activeConnection.name}`
      : `Active connection: ${activeConnection?.name ?? ""}`;

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {activeConnection ? (
        <motion.span
          animate={{ opacity: tone === "pending" ? PENDING_OPACITY : 1 }}
          aria-label={label}
          className="relative flex h-8 max-w-56 shrink-0 items-center pr-2.5 pl-1"
          data-tone={tone}
          exit={{ opacity: 0, transition: fadeOut }}
          key={activeConnection.id}
          layout
          role="img"
          transition={{ layout: spring, opacity: fadeIn }}
        >
          <motion.span
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-[9px] bg-row-hover"
            initial={{ opacity: 0 }}
            transition={fadeIn}
          />
          <motion.span
            animate={{ opacity: 1 }}
            className="relative flex min-w-0 items-center gap-3"
            initial={{ opacity: 0 }}
            layout="position"
            layoutId={handoffLayoutId(activeConnection.id)}
            transition={{ layout: spring, opacity: fadeIn }}
          >
            <ConnectionGlyph connection={activeConnection} />
            <span className="truncate type-body text-foreground">
              {activeConnection.name}
            </span>
          </motion.span>
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
