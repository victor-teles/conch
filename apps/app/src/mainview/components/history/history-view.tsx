import type { ChangeEvent, RefObject } from "react";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import {
  ActionsMenu,
  actionsMenuHeight,
} from "@/components/launcher/actions/actions-menu";
import { LauncherInput } from "@/components/launcher/launcher-input";
import { optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import {
  ScopeFilter,
  scopePopoverHeight,
} from "@/components/launcher/scope-filter";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useSteadyHeight } from "@/components/launcher/use-steady-height";
import { useMotionPreset } from "@/lib/motion";

import type { HistoryAskActions } from "./use-history-commands";

import { historyActions } from "./history-actions";
import { HistoryFooter } from "./history-footer";
import { HISTORY_LIST_ID, HistoryList } from "./history-list";
import { HistoryNameField } from "./history-name-field";
import { clearOutMs } from "./history-row";
import { useHistory } from "./use-history";
import { useHistoryCommands } from "./use-history-commands";
import { useHistoryKeyboard } from "./use-history-keyboard";
import { useHistoryMenu } from "./use-history-menu";
import { useHistoryResults } from "./use-history-results";

interface HistoryViewProps {
  ask: HistoryAskActions;
  inputRef: RefObject<HTMLInputElement | null>;
  initialQuery?: string;
}

export function HistoryView({
  ask,
  inputRef,
  initialQuery = "",
}: HistoryViewProps) {
  const { reduced } = useMotionPreset();
  const history = useHistory({ clearOutMs: clearOutMs(reduced) });
  const [query, setQuery] = useState(initialQuery);
  const [typed, setTyped] = useState(false);
  const [scope, setScope] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const { connections, items, now, scopeName, scopeOptions, sections } =
    useHistoryResults(history.asks, query, scope);
  const { move, select, selected } = useListSelection(items);
  const steady = useSteadyHeight(query);

  const commands = useHistoryCommands({
    ask,
    connections,
    history,
    items,
    select,
    selected,
  });
  const focusInput = useCallback(() => inputRef.current?.focus(), [inputRef]);
  const handleScopeOpen = useCallback(
    (open: boolean) => {
      setScopeOpen(open);
      if (!open) {
        focusInput();
      }
    },
    [focusInput]
  );
  const toggleScope = useCallback(
    () => handleScopeOpen(!scopeOpen),
    [handleScopeOpen, scopeOpen]
  );
  const handleScopeChange = useCallback(
    (next: string | null) => {
      setScope(next);
      select(null);
    },
    [select]
  );
  const inputSlots = useMemo(
    () => ({
      trailing: (
        <ScopeFilter
          label="All connections"
          onChange={handleScopeChange}
          onOpenChange={handleScopeOpen}
          open={scopeOpen}
          options={scopeOptions}
          value={scope}
        />
      ),
    }),
    [handleScopeChange, handleScopeOpen, scope, scopeOpen, scopeOptions]
  );
  const menu = useHistoryMenu({
    canOpen: selected !== null,
    commands,
    focusInput,
  });
  const handleKeyDown = useHistoryKeyboard({
    commands,
    move,
    onToggleMenu: menu.toggle,
    onToggleScope: toggleScope,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    steady.onInput(event.target.value);
    setQuery(event.target.value);
    setTyped(true);
    select(null);
  };
  const { askAgain: handleSubmit, target, language } = commands;
  const actions = historyActions(target, language);
  const { close: handleCloseMenu, run: handleRunAction } = menu;
  const { retry: handleRetry } = history;

  return (
    <div className="flex min-h-0 flex-col">
      <LauncherInput
        inputProps={{
          "aria-activedescendant": selected ? optionId(selected.id) : undefined,
          "aria-autocomplete": "list",
          "aria-controls": HISTORY_LIST_ID,
          "aria-expanded": items.length > 0,
          "aria-label": "Search history",
          autoFocus: true,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: "Search past asks…",
          ref: inputRef,
          role: "combobox",
          value: query,
        }}
        onSubmit={handleSubmit}
        slots={inputSlots}
      />
      <HistoryNameField onDone={focusInput} save={commands.save} />
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        ref={steady.bodyRef}
        style={{
          minHeight: Math.max(
            menu.open ? actionsMenuHeight(actions.length) : 0,
            scopeOpen ? scopePopoverHeight(scopeOptions.length + 1) : 0,
            steady.minHeight
          ),
        }}
      >
        <LauncherScrollArea className="flex-1 pt-1">
          <HistoryList
            motion={{ clearing: history.clearing, intro: !typed }}
            onRetry={handleRetry}
            rows={{
              now,
              onHover: select,
              onRun: commands.askById,
              selectedId: selected?.id ?? null,
            }}
            view={{
              query,
              scopeName,
              sections,
              status: history.status,
              total: history.asks.length,
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
              title={selected.entry.ask.prompt}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <HistoryFooter
        hasSelection={selected !== null}
        status={commands.status}
        target={target}
      />
    </div>
  );
}
