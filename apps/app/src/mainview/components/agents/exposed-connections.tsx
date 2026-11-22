import { AnimatePresence, motion } from "motion/react";
import { useCallback, useId } from "react";

import type { DatabaseConnection } from "@/lib/connections";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { EnvironmentBadge } from "@/components/launcher/connections/environment-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DRAW, useMotionPreset } from "@/lib/motion";

export const PRODUCTION_WARNING =
  "Agents can read everything this connection can.";

function DrawnCheck() {
  const { reduced } = useMotionPreset();
  return (
    <svg aria-hidden className="size-3.5" fill="none" viewBox="0 0 16 16">
      <motion.path
        animate={{ pathLength: 1 }}
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        data-motion={reduced ? "instant" : "draw"}
        initial={{ pathLength: reduced ? 1 : 0 }}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        transition={reduced ? { duration: 0 } : DRAW}
      />
    </svg>
  );
}

interface ExposedRowProps {
  connection: DatabaseConnection;
  exposed: boolean;
  disabled: boolean;
  onToggle: (id: string, exposed: boolean) => void;
}

function ExposedRow({
  connection,
  exposed,
  disabled,
  onToggle,
}: ExposedRowProps) {
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  const warningId = useId();
  const warn = exposed && connection.environment === "prod";
  const handleCheckedChange = useCallback(
    (checked: boolean) => onToggle(connection.id, checked),
    [connection.id, onToggle]
  );
  return (
    <motion.li
      className="flex flex-col gap-1 px-4 py-2.5"
      layout={reduced ? false : "position"}
      transition={soft}
    >
      <label className="flex min-h-7 items-center gap-3">
        <Checkbox
          aria-describedby={warn ? warningId : undefined}
          aria-label={`Let agents read ${connection.name}`}
          checked={exposed}
          disabled={disabled}
          onCheckedChange={handleCheckedChange}
        >
          <DrawnCheck />
        </Checkbox>
        <span className="min-w-0 flex-1 truncate type-body text-foreground">
          {connection.name}
        </span>
        <span className="shrink-0 type-meta text-panel-muted">
          {connection.type}
        </span>
        {connection.environment ? (
          <EnvironmentBadge environment={connection.environment} />
        ) : null}
      </label>
      <AnimatePresence initial={false}>
        {warn ? (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="pl-7 type-meta text-danger-ink"
            exit={{ opacity: 0, transition: fadeOut }}
            id={warningId}
            initial={reduced ? false : { opacity: 0, y: -4 }}
            transition={reduced ? { duration: 0 } : { ...fadeIn, y: soft }}
          >
            {PRODUCTION_WARNING}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

interface ExposedConnectionsProps {
  exposedIds: readonly string[];
  disabled: boolean;
  onChange: (exposedIds: string[]) => void;
}

export function ExposedConnections({
  exposedIds,
  disabled,
  onChange,
}: ExposedConnectionsProps) {
  const { state } = useConnections();
  const handleToggle = useCallback(
    (id: string, exposed: boolean) => {
      const others = exposedIds.filter((value) => value !== id);
      onChange(exposed ? [...others, id] : others);
    },
    [exposedIds, onChange]
  );
  if (state.load.status !== "ready") {
    return null;
  }
  if (state.connections.length === 0) {
    return (
      <p className="px-4 py-3 type-meta text-panel-muted" role="status">
        Add a connection first.
      </p>
    );
  }
  return (
    <ul
      aria-label="Connections agents can read"
      className="divide-y divide-panel-border"
    >
      {state.connections.map((connection) => (
        <ExposedRow
          connection={connection}
          disabled={disabled}
          exposed={exposedIds.includes(connection.id)}
          key={connection.id}
          onToggle={handleToggle}
        />
      ))}
    </ul>
  );
}
