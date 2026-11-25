import type { ChangeEvent, RefObject } from "react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { StagedLinkControls } from "@/components/launcher/links/staged-link";
import type { RootAlert } from "@/components/watches/use-alerts";
import type { LookupValue, ParamValues } from "@/lib/ipc";

import { useBoardList } from "@/components/board/use-board-list";
import { useExport } from "@/components/bundle/use-export";
import { ActiveConnectionChip } from "@/components/launcher/connections/active-connection-chip";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import { optionId } from "@/components/launcher/launcher-row";
import { LinkMarkerChip } from "@/components/launcher/links/link-marker-chip";
import { NO_STAGED_LINK } from "@/components/launcher/links/staged-link";
import {
  useLinkAsk,
  useStagedLink,
} from "@/components/launcher/links/use-staged-link";
import { ModeBadge } from "@/components/launcher/mode-badge";
import { PrefixHints } from "@/components/launcher/prefix-hints";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useSteadyHeight } from "@/components/launcher/use-steady-height";
import { useAlerts } from "@/components/watches/use-alerts";
import { PILL_POPOVER_SPACE } from "@/components/widgets/arguments/pill-popover";
import { WidgetArgumentsRow } from "@/components/widgets/arguments/widget-arguments-row";
import { useWidgets } from "@/components/widgets/widgets-provider";

import type { RootItem } from "./root-items";
import type { CatalogNavigation } from "./use-catalog-menu";

import { RootBody } from "./root-body";
import { ASK_ITEM_ID, widgetItemId } from "./root-items";
import { ROOT_LIST_ID } from "./root-list";
import { RootMenusLayer } from "./root-menus-layer";
import { RootStatus } from "./root-status";
import { useConnectionToken } from "./use-connection-token";
import { useFeedback } from "./use-feedback";
import { useRootArguments } from "./use-root-arguments";
import { footerFor, useRootKeyboard } from "./use-root-keyboard";
import { useRootMenus } from "./use-root-menus";
import { useRootRun } from "./use-root-run";
import { useRootSections } from "./use-root-sections";
import { useSampleDatabase } from "./use-sample-database";

const PLACEHOLDER = "Search or ask…";

export interface RootAskActions {
  start: (prompt: string, target: AskTarget) => void;
  startSql: (sql: string, target: AskTarget, title?: string) => void;
  reopen: (() => void) | null;
  lastAnswerId?: string | null;
}

export interface RootLookup {
  offer: LookupValue | null;
  start: (value: LookupValue, connectionId: string) => void;
}

export interface RootNavigation extends Omit<
  CatalogNavigation,
  "runWidget" | "exportScope"
> {
  openSettings: () => void;
  openHistory: (query?: string) => void;
  openImport: () => void;
  dismiss: () => void;
  editConnection: (connectionId: string | null) => void;
  runWidget: (widgetId: string, values: ParamValues) => void;
  newBoard: () => void;
  newSourceWidget: () => void;
  openActivity: () => void;
  openThemes: () => void;
  buildApp: (prompt: string, connectionId: string | null) => void;
}

interface RootViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  navigate: RootNavigation;
  ask: RootAskActions;
  lookup: RootLookup;
  link?: StagedLinkControls;
}

export function RootView({
  query,
  onQueryChange,
  inputRef,
  navigate,
  ask,
  lookup,
  link = NO_STAGED_LINK,
}: RootViewProps) {
  const connections = useConnections();
  const { state, activate, discardDraft } = connections;
  const { widgets, freshId, refresh } = useWidgets();
  const { acknowledge } = useAlerts();
  const { boards, reload: reloadBoards } = useBoardList();
  const args = useRootArguments(widgets);
  const {
    editConnection: onEditConnection,
    openBoard,
    runWidget,
    openApp,
    buildApp,
  } = navigate;
  const {
    outcome: exportOutcome,
    reveal: handleReveal,
    run: exportScope,
  } = useExport();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [returnedWithQuery] = useState(query !== "");
  useEffect(() => {
    if (returnedWithQuery) {
      inputRef.current?.select();
    }
  }, [inputRef, returnedWithQuery]);
  const openNewConnection = useCallback(
    () => onEditConnection(null),
    [onEditConnection]
  );

  const startMode = useCallback(
    (prefix: string) => {
      onQueryChange(prefix);
      inputRef.current?.focus();
    },
    [inputRef, onQueryChange]
  );
  const sample = useSampleDatabase();
  const feedback = useFeedback(navigate.dismiss);
  const commandNavigation = useMemo(
    () => ({
      ...navigate,
      addSample: sample.add,
      exportAll: () => exportScope({ kind: "all" }),
      sendFeedback: feedback.send,
      startMode,
    }),
    [exportScope, feedback.send, navigate, sample.add, startMode]
  );
  const linkAsk = useLinkAsk(link.staged, query);
  const view = useRootSections({
    askWith: linkAsk.target,
    boards,
    navigate: commandNavigation,
    offer: lookup.offer,
    query,
  });
  const { input, items } = view;
  const { mode } = input;
  const { move, select, selected } = useListSelection(
    items,
    freshId ? widgetItemId(freshId) : state.focusId
  );

  const staging = useStagedLink({
    args,
    link,
    linkAsk,
    selectAsk: () => select(ASK_ITEM_ID),
    start: ask.start,
  });
  const { clear: clearLink, startAsk } = staging;
  const linkedAsk = useMemo(
    () => ({ ...ask, start: startAsk }),
    [ask, startAsk]
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), [inputRef]);
  const token = useConnectionToken({
    activate,
    connections: state.connections,
    mode,
    onQueryChange,
  });
  const dismissAlert = useCallback(
    (alert: RootAlert) => acknowledge(alert.watchId),
    [acknowledge]
  );
  const openAlert = useCallback(
    (alert: RootAlert) => {
      acknowledge(alert.watchId);
      runWidget(alert.widgetId, {});
    },
    [acknowledge, runWidget]
  );
  const { runById, runItem } = useRootRun({
    ask: linkedAsk,
    buildApp,
    items,
    onActivate: token.onActivate,
    openAlert,
    openApp,
    openBoard,
    openDraft: openNewConnection,
    preview: view.tables?.preview ?? null,
    runWidget,
    startLookup: lookup.start,
  });
  const handleSubmit = useCallback(
    () => runItem(selected),
    [runItem, selected]
  );

  const detailRef = useRef<HTMLDivElement>(null);
  const focusColumns = useMemo(
    () => (mode === "table" ? () => detailRef.current?.focus() : null),
    [mode]
  );
  const catalogNavigation = useMemo(
    () => ({
      ...navigate,
      exportScope,
      runWidget: (widgetId: string) => runWidget(widgetId, {}),
    }),
    [exportScope, navigate, runWidget]
  );
  const rowHandlers = useMemo(
    () => ({
      discardDraft,
      dismissAlert,
      focusColumns,
      recentsChanged: refresh,
      runItem,
      startSql: ask.startSql,
    }),
    [ask.startSql, discardDraft, dismissAlert, focusColumns, refresh, runItem]
  );
  const lastAnswerId = ask.lastAnswerId ?? null;
  const menus = useRootMenus({
    catalogNavigation,
    lastAnswerId,
    onActivate: token.onActivate,
    onBoardsChanged: reloadBoards,
    onClosed: focusInput,
    onEdit: onEditConnection,
    rowHandlers,
  });

  const steady = useSteadyHeight(query);
  const { onInput: holdHeight } = steady;
  const { commit: commitConnection, interceptChange } = token;
  const modeKeys = useMemo(
    () => ({
      commit:
        mode === "connection"
          ? (item: RootItem) =>
              item.kind === "connection" && commitConnection(item.connection)
          : null,
      focusDetail: mode === "table" ? () => detailRef.current?.focus() : null,
    }),
    [commitConnection, mode]
  );
  const handleKeyDown = useRootKeyboard({
    modeKeys,
    move,
    onDismissAlert: dismissAlert,
    onOpenActions: menus.openActions,
    onOpenHistory: navigate.openHistory,
    onOpenInputs: args.open,
    onRowShortcut: menus.runShortcut,
    onRun: runItem,
    onRunSecond: menus.runSecond,
    selected,
  });

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      clearLink();
      if (interceptChange(event.target.value)) {
        return;
      }
      holdHeight(event.target.value);
      onQueryChange(event.target.value);
      select(null);
    },
    [clearLink, holdHeight, interceptChange, onQueryChange, select]
  );

  const linkNotice = staging.status
    ? { done: false, message: staging.status }
    : null;
  const footer = footerFor(selected, state.liveIds, mode, lastAnswerId);

  const argsWidget = args.widget;
  const exitArguments = args.close;
  const argumentControls = useMemo(
    () => ({
      onChange: args.change,
      onExit: () => {
        clearLink();
        exitArguments();
      },
      onRun: (values: ParamValues) => {
        clearLink();
        if (argsWidget) {
          runWidget(argsWidget.id, values);
        }
      },
    }),
    [args.change, argsWidget, clearLink, exitArguments, runWidget]
  );
  const inputSlots = useMemo(
    () => ({
      chip: (
        <>
          <ActiveConnectionChip
            target={linkAsk.target}
            tone={mode === "connection" ? "pending" : "active"}
          />
          <LinkMarkerChip visible={linkAsk.live} />
          <ModeBadge mode={mode} />
        </>
      ),
      trailing: <PrefixHints onPick={startMode} visible={query === ""} />,
    }),
    [linkAsk.live, linkAsk.target, mode, query, startMode]
  );
  const listMinHeight = Math.max(
    menus.minHeight,
    argsWidget ? PILL_POPOVER_SPACE : 0,
    steady.minHeight
  );

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {staging.announcement}
      </p>
      {argsWidget ? (
        <WidgetArgumentsRow
          busy={false}
          controls={argumentControls}
          initialFocus="first"
          values={args.values}
          widget={argsWidget}
        />
      ) : (
        <LauncherInput
          inputProps={{
            "aria-activedescendant": selected
              ? optionId(selected.id)
              : undefined,
            "aria-autocomplete": "list",
            "aria-controls": ROOT_LIST_ID,
            "aria-expanded": items.length > 0,
            "aria-label": "Search commands",
            autoFocus: true,
            onChange: handleChange,
            onKeyDown: handleKeyDown,
            placeholder: PLACEHOLDER,
            ref: inputRef,
            role: "combobox",
            value: query,
          }}
          onSubmit={handleSubmit}
          slots={inputSlots}
        />
      )}
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        ref={steady.bodyRef}
        style={{ minHeight: listMinHeight }}
      >
        <RootBody
          detail={{ onExit: focusInput, ref: detailRef }}
          list={{
            armedId: menus.armedId,
            onHover: select,
            onRun: runById,
            selectedId: selected?.id ?? null,
          }}
          view={view}
        />
        <RootMenusLayer menus={menus.layer} />
      </div>
      <LauncherFooter
        actionLabel={footer.actionLabel}
        hints={footer.hints}
        status={
          <RootStatus
            notice={
              menus.notice ?? linkNotice ?? sample.notice ?? feedback.notice
            }
            onReveal={handleReveal}
            outcome={exportOutcome}
          />
        }
      />
    </>
  );
}
