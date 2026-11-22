import { AnimatePresence } from "motion/react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ActionEditTarget,
  ActionReviewTarget,
} from "@/components/actions/action-targets";
import type {
  Board,
  LauncherNavigateView,
  LookupValue,
  MiniApp,
  ParamValues,
  SourceTarget,
  Widget,
  WidgetDraft,
} from "@/lib/ipc";

import { isConfirmSheetOpen } from "@/components/actions/confirm-sheet/sheet-presence";
import { AgentActivityProvider } from "@/components/agents/agent-activity-provider";
import { AskView } from "@/components/ask/ask-view";
import { HistoryView } from "@/components/history/history-view";
import { LookupView } from "@/components/lookup/lookup-view";
import { MiniAppsProvider } from "@/components/mini-app/mini-apps-provider";
import { SourcesProvider } from "@/components/sources/sources-provider";
import { WatchesProvider } from "@/components/watches/watches-provider";
import {
  useWidgets,
  WidgetsProvider,
} from "@/components/widgets/widgets-provider";
import { onLauncherNavigate, openBoard, openMiniApp } from "@/lib/ipc";
import { useMotionPreset } from "@/lib/motion";

import type { StagedLink } from "./links/staged-link";
import type { SourceEditTarget } from "./use-launcher-stack";

import { ConnectionsProvider } from "./connections/connections-provider";
import { LauncherSurface } from "./launcher-surface";
import { stagedLinkOf } from "./links/staged-link";
import { fittedPanelHeight, panelMaxHeightOf } from "./panel-height";
import { renderView } from "./render-launcher-view";
import { stackVariants } from "./stack-variants";
import { StackViewFrame } from "./stack-view-frame";
import { useLauncherAccelerator } from "./use-launcher-accelerator";
import { useLauncherAsk } from "./use-launcher-ask";
import { useLauncherHotkeys } from "./use-launcher-hotkeys";
import { useLauncherLookup } from "./use-launcher-lookup";
import { useLauncherPresence } from "./use-launcher-presence";
import { useLauncherStack } from "./use-launcher-stack";
import { RootView } from "./views/root-view";

export const RESET_AFTER_HIDDEN_MS = 60_000;
const SETTINGS = { kind: "settings" } as const;
const HISTORY = { kind: "history" } as const;
const IMPORT = { kind: "import" } as const;
const WATCHES = { kind: "watches" } as const;
const AGENTS = { kind: "agents" } as const;
const AGENTS_AUDIT = { kind: "agents-audit" } as const;
const SOURCE_PICKER = { kind: "source-picker" } as const;
const ACTIVITY = { kind: "activity" } as const;

export function LauncherPanel() {
  return (
    <ConnectionsProvider>
      <WidgetsProvider>
        <MiniAppsProvider>
          <WatchesProvider>
            <AgentActivityProvider>
              <SourcesProvider>
                <LauncherStackView />
              </SourcesProvider>
            </AgentActivityProvider>
          </WatchesProvider>
        </MiniAppsProvider>
      </WidgetsProvider>
    </ConnectionsProvider>
  );
}

function LauncherStackView() {
  const stack = useLauncherStack();
  const { markFresh, refresh: refreshWidgets } = useWidgets();
  const [query, setQuery] = useState("");
  const [stagedLink, setStagedLink] = useState<StagedLink | null>(null);
  const linkNonce = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const preset = useMotionPreset();

  const [clipboardOffer, setClipboardOffer] = useState<LookupValue | null>(
    null
  );
  const [windowRoom, setWindowRoom] = useState<number | null>(null);
  const { presence, dismiss, onPresenceSettled } = useLauncherPresence({
    onHidden: () => setClipboardOffer(null),
    onShown: (hiddenForMs, shown) => {
      setClipboardOffer(shown.clipboard ?? null);
      setWindowRoom(shown.maxHeight ?? null);
      if (hiddenForMs > RESET_AFTER_HIDDEN_MS) {
        stack.reset();
        setQuery("");
        setStagedLink(null);
        inputRef.current?.focus();
        return;
      }
      inputRef.current?.focus();
      if (stack.current.kind === "root") {
        inputRef.current?.select();
      }
    },
  });

  const { push, pop: handleBack } = stack;
  const { openMatch, rootAsk, session } = useLauncherAsk(push);
  const {
    openRows: handleOpenRows,
    root: rootLookup,
    session: lookupSession,
  } = useLauncherLookup({
    offer: clipboardOffer,
    openMatch,
    push,
  });
  const hotkey = useLauncherAccelerator();
  const handleOpenSettings = useCallback(() => push(SETTINGS), [push]);
  const handleEditConnection = useCallback(
    (connectionId: string | null) =>
      push({ connectionId, kind: "connection-edit" }),
    [push]
  );
  const handleClearQuery = useCallback(() => {
    setQuery("");
    setStagedLink(null);
  }, []);
  const clearStagedLink = useCallback(() => setStagedLink(null), []);
  const link = useMemo(
    () => ({ onDone: clearStagedLink, staged: stagedLink }),
    [clearStagedLink, stagedLink]
  );
  const handleRunWidget = useCallback(
    (widgetId: string, values: ParamValues = {}) =>
      push({ kind: "widget-run", values, widgetId }),
    [push]
  );
  const handleReviewInputs = useCallback(
    (draft: WidgetDraft) =>
      push({ draft, kind: "widget-inputs", mode: "create" }),
    [push]
  );
  const handleEditInputs = useCallback(
    (draft: WidgetDraft) =>
      push({ draft, kind: "widget-inputs", mode: "edit" }),
    [push]
  );
  const { reset } = stack;
  const handleInputsSaved = useCallback(
    (widget: Widget, mode: "create" | "edit") => {
      if (mode === "edit") {
        handleBack();
        return;
      }
      markFresh(widget.id);
      setQuery("");
      reset();
    },
    [handleBack, markFresh, reset]
  );
  const handleAddToBoard = useCallback(
    (widgetId: string) => push({ kind: "board-picker", widgetId }),
    [push]
  );
  const handleWatch = useCallback(
    (widgetId: string) => push({ kind: "watch", widgetId }),
    [push]
  );
  const handleOpenWatches = useCallback(() => push(WATCHES), [push]);
  const handleOpenAgents = useCallback(() => push(AGENTS), [push]);
  const handleOpenAgentsAudit = useCallback(() => push(AGENTS_AUDIT), [push]);
  const sourceNavigation = useMemo(
    () => ({
      onDraft: (target: SourceTarget) => push({ kind: "source-draft", target }),
      onEdit: (target: SourceEditTarget) =>
        push({ kind: "source-edit", target }),
      onOpenSettings: () => push(SETTINGS),
      onRunWidget: (widgetId: string) => {
        reset();
        push({ kind: "widget-run", values: {}, widgetId });
      },
    }),
    [push, reset]
  );
  const actionNavigation = useMemo(
    () => ({
      onEdit: (target: ActionEditTarget) =>
        push({ kind: "action-edit", target }),
      onManage: (target: Omit<ActionEditTarget, "actionId" | "draft">) =>
        push({ kind: "widget-actions", target }),
      onOpenActivity: () => push(ACTIVITY),
      onOpenEntry: (executionId: string) =>
        push({ executionId, kind: "activity-entry" }),
      onReview: (target: ActionReviewTarget) =>
        push({ kind: "action-review", target }),
      onSaved: () => {
        handleBack();
        handleBack();
      },
    }),
    [handleBack, push]
  );
  const handleNewBoard = useCallback(
    (widgetId: string | null) =>
      push({
        kind: "board-name",
        target: { addWidgetId: widgetId, boardId: null, initialName: "" },
      }),
    [push]
  );
  const handleBoardDone = useCallback(() => {
    setQuery("");
    reset();
  }, [reset]);
  const handleImportDone = useCallback(
    async (firstWidgetId: string | null) => {
      await refreshWidgets();
      markFresh(firstWidgetId);
      handleBoardDone();
    },
    [handleBoardDone, markFresh, refreshWidgets]
  );
  const handleOpenBoard = useCallback(
    async (boardId: string) => {
      try {
        await openBoard(boardId);
        handleBoardDone();
      } catch (error) {
        console.error("[launcher] could not open the board", error);
      }
    },
    [handleBoardDone]
  );
  const handleOpenApp = useCallback(
    async (appId: string) => {
      try {
        await openMiniApp(appId);
        handleBoardDone();
      } catch (error) {
        console.error("[launcher] could not open the app", error);
      }
    },
    [handleBoardDone]
  );
  const appNavigation = useMemo(
    () => ({ onDone: handleBoardDone, onOpenSettings: handleOpenSettings }),
    [handleBoardDone, handleOpenSettings]
  );
  const navigation = useMemo(
    () => ({
      addToBoard: handleAddToBoard,
      buildApp: (prompt: string, connectionId: string | null) =>
        push({
          kind: "mini-app-generate",
          target: { baseAppId: null, connectionId, prompt },
        }),
      changeApp: (appId: string) =>
        push({
          kind: "mini-app-generate",
          target: { baseAppId: appId, connectionId: null, prompt: "" },
        }),
      dismiss,
      editConnection: handleEditConnection,
      newBoard: () => handleNewBoard(null),
      newSourceWidget: () => push(SOURCE_PICKER),
      openActivity: () => push(ACTIVITY),
      openApp: handleOpenApp,
      openBoard: handleOpenBoard,
      openHistory: (search?: string) =>
        push(search ? { kind: "history", query: search } : HISTORY),
      openImport: () => push(IMPORT),
      openSettings: handleOpenSettings,
      renameApp: (app: MiniApp) => push({ app, kind: "mini-app-name" }),
      renameBoard: (board: Board) =>
        push({
          kind: "board-name",
          target: {
            addWidgetId: null,
            boardId: board.id,
            initialName: board.name,
          },
        }),
      runWidget: handleRunWidget,
      watchWidget: handleWatch,
    }),
    [
      dismiss,
      handleAddToBoard,
      handleEditConnection,
      handleNewBoard,
      handleOpenApp,
      handleOpenBoard,
      handleOpenSettings,
      handleRunWidget,
      handleWatch,
      push,
    ]
  );

  useLauncherHotkeys({
    depth: stack.depth,
    hotkey,
    onClearQuery: handleClearQuery,
    onDismiss: dismiss,
    onOpenSettings: handleOpenSettings,
    onPop: handleBack,
    query,
  });

  const handleNavigate = useEffectEvent((view: LauncherNavigateView) => {
    if (isConfirmSheetOpen()) {
      return;
    }
    linkNonce.current += 1;
    const staged = stagedLinkOf(view, linkNonce.current);
    if (staged) {
      stack.reset();
      setQuery(staged.kind === "ask" ? staged.prompt : "");
      setStagedLink(staged);
      inputRef.current?.focus();
      return;
    }
    if (view === "settings") {
      stack.push(SETTINGS);
      return;
    }
    stack.reset();
    if (view === "watches") {
      stack.push(WATCHES);
    } else if (typeof view === "object" && view.kind === "mini-app-action") {
      stack.push({ kind: "mini-app-action", request: view.request });
    } else if (typeof view === "object" && view.kind === "widget-run") {
      stack.push({ kind: "widget-run", values: {}, widgetId: view.widgetId });
    }
  });

  useEffect(() => onLauncherNavigate(handleNavigate), []);

  const viewVariants = stackVariants(preset);

  return (
    <LauncherSurface
      maxHeight={fittedPanelHeight(
        panelMaxHeightOf(stack.current.kind),
        windowRoom
      )}
      onPresenceSettled={onPresenceSettled}
      presence={presence}
    >
      <AnimatePresence
        custom={stack.direction}
        initial={false}
        mode="popLayout"
      >
        <StackViewFrame
          direction={stack.direction}
          key={stack.current.kind}
          variants={viewVariants}
        >
          {renderView(stack.current, {
            actions: actionNavigation,
            apps: appNavigation,
            ask: (
              <AskView
                inputRef={inputRef}
                onAddToBoard={handleAddToBoard}
                onOpenSettings={handleOpenSettings}
                onReviewInputs={handleReviewInputs}
                onRunWidget={handleRunWidget}
                session={session}
              />
            ),
            history: (
              <HistoryView
                ask={rootAsk}
                initialQuery={
                  stack.current.kind === "history"
                    ? (stack.current.query ?? "")
                    : ""
                }
                inputRef={inputRef}
              />
            ),
            lookup: (
              <LookupView
                inputRef={inputRef}
                onOpenRows={handleOpenRows}
                session={lookupSession}
              />
            ),
            onAddToBoard: handleAddToBoard,
            onBack: handleBack,
            onBoardDone: handleBoardDone,
            onEditInputs: handleEditInputs,
            onImportDone: handleImportDone,
            onInputsSaved: handleInputsSaved,
            onNewBoard: handleNewBoard,
            onOpenAgents: handleOpenAgents,
            onOpenAgentsAudit: handleOpenAgentsAudit,
            onOpenWatches: handleOpenWatches,
            onWatch: handleWatch,
            root: (
              <RootView
                ask={rootAsk}
                inputRef={inputRef}
                link={link}
                lookup={rootLookup}
                navigate={navigation}
                onQueryChange={setQuery}
                query={query}
              />
            ),
            sources: sourceNavigation,
          })}
        </StackViewFrame>
      </AnimatePresence>
    </LauncherSurface>
  );
}
