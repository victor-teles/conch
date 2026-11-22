import { AnimatePresence } from "motion/react";
import { useCallback, useRef } from "react";

import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { ViewHeader } from "@/components/launcher/view-header";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

import { auditActions } from "./audit-actions";
import { AuditList } from "./audit-list";
import { ClearActivityButton } from "./clear-activity-button";
import { useAuditHotkeys } from "./use-audit-hotkeys";
import { useAuditMenu } from "./use-audit-menu";
import { useMcpAudit } from "./use-mcp-audit";

const MENU_KEYS = ["⌘", "K"] as const;

const callCount = (count: number): string =>
  count === 1 ? "1 agent call" : `${count} agent calls`;

const copyLabel = (hasSql: boolean, copied: boolean): string | null => {
  if (!hasSql) {
    return null;
  }
  return copied ? "Copied" : "Copy SQL";
};

export function AuditView({ onBack }: { onBack: () => void }) {
  const audit = useMcpAudit();
  const { state } = useConnections();
  const { move, select, selected } = useListSelection(audit.entries);
  const { copied, copy } = useCopyFeedback();
  const listRef = useRef<HTMLDivElement>(null);
  const focusList = useCallback(() => listRef.current?.focus(), []);
  const nameOf = useCallback(
    (connectionId: string | null) =>
      state.connections.find((connection) => connection.id === connectionId)
        ?.name ?? null,
    [state.connections]
  );
  const copySql = () => (selected?.sql ? copy(selected.sql) : undefined);
  const menu = useAuditMenu({
    canOpen: selected !== null,
    commands: {
      clear: audit.clear,
      "copy-question": () =>
        selected?.question ? copy(selected.question) : undefined,
      "copy-sql": copySql,
    },
    focusList,
  });
  const handleKeyDown = useAuditHotkeys({
    move,
    onCopy: copySql,
    onToggleMenu: menu.toggle,
  });
  const { clear: handleClear } = audit;
  const { close: handleCloseMenu, run: handleRunAction } = menu;
  const actions = selected ? auditActions(selected) : [];
  const hasEntries = audit.entries.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Agent activity">
        {hasEntries ? <ClearActivityButton onClear={handleClear} /> : null}
      </ViewHeader>
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        style={{ minHeight: menu.open ? actionsMenuHeight(actions.length) : 0 }}
      >
        <LauncherScrollArea className="flex-1">
          <AuditList
            entries={audit.entries}
            handlers={{
              onHover: select,
              onKeyDown: handleKeyDown,
              onRetry: audit.retry,
              onSettled: audit.settleFresh,
            }}
            listRef={listRef}
            load={audit.load}
            nameOf={nameOf}
            selection={{
              fresh: audit.fresh,
              selectedId: hasEntries ? (selected?.id ?? null) : null,
            }}
          />
        </LauncherScrollArea>
        <AnimatePresence>
          {menu.open && selected ? (
            <ActionsMenu
              actions={actions}
              anchorId={optionId(selected.id)}
              armedId={menu.armed ? "clear" : null}
              key={selected.id}
              onClose={handleCloseMenu}
              onRun={handleRunAction}
              title={selected.question ?? selected.tool}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <LauncherFooter
        actionLabel={copyLabel(Boolean(selected?.sql), copied)}
        hints={hasEntries ? [{ keys: MENU_KEYS, label: "Actions" }] : []}
        status={
          <span aria-live="polite">{callCount(audit.entries.length)}</span>
        }
      />
    </div>
  );
}
