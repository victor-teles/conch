import type { KeyboardEvent, Ref } from "react";

import { AnimatePresence, motion } from "motion/react";

import type { McpAuditEntry } from "@/lib/ipc";

import { optionId } from "@/components/launcher/launcher-row";
import { staggerDelay, useMotionPreset } from "@/lib/motion";

import type { AuditLoad } from "./use-mcp-audit";

import { AgentsProblem, AgentsSkeleton } from "./agents-states";
import { AuditRow } from "./audit-row";

export const AUDIT_LIST_ID = "launcher-agents-audit";

interface AuditListProps {
  entries: readonly McpAuditEntry[];
  load: AuditLoad;
  selection: { selectedId: string | null; fresh: ReadonlySet<string> };
  nameOf: (connectionId: string | null) => string | null;
  listRef: Ref<HTMLDivElement>;
  handlers: {
    onHover: (id: string) => void;
    onSettled: (id: string) => void;
    onRetry: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}

export function AuditList({
  entries,
  load,
  selection,
  nameOf,
  listRef,
  handlers,
}: AuditListProps) {
  const { reduced, fadeIn, fadeOut, spring } = useMotionPreset();
  const {
    onHover: handleHover,
    onKeyDown: handleKeyDown,
    onRetry: handleRetry,
    onSettled: handleSettled,
  } = handlers;
  if (load === "loading" && entries.length === 0) {
    return <AgentsSkeleton label="Loading agent activity" />;
  }
  if (load === "error" && entries.length === 0) {
    return (
      <AgentsProblem
        message="Agent activity couldn’t load."
        onRetry={handleRetry}
      />
    );
  }
  if (entries.length === 0) {
    return (
      <p className="px-4 py-6 type-body text-panel-muted" role="status">
        No agent calls yet.
      </p>
    );
  }
  return (
    <div
      aria-activedescendant={
        selection.selectedId ? optionId(selection.selectedId) : undefined
      }
      aria-label="Agent calls"
      className="flex flex-col gap-1 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      id={AUDIT_LIST_ID}
      onKeyDown={handleKeyDown}
      ref={listRef}
      role="listbox"
      tabIndex={0}
    >
      <AnimatePresence>
        {entries.map((entry, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            data-motion={reduced ? "instant" : "stagger"}
            exit={{ opacity: 0, transition: fadeOut }}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            key={entry.id}
            layout={reduced ? false : "position"}
            transition={{
              ...fadeIn,
              delay: reduced ? 0 : staggerDelay(index),
              layout: spring,
            }}
          >
            <AuditRow
              connectionName={nameOf(entry.connectionId)}
              entry={entry}
              fresh={!reduced && selection.fresh.has(entry.id)}
              onHover={handleHover}
              onSettled={handleSettled}
              selected={entry.id === selection.selectedId}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
