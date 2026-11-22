import { draftOfApp } from "@conch/rpc/mini-app";
import { MessageSquarePlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MiniApp, MiniAppDraft, RefreshInterval } from "@/lib/ipc";

import { BoardHeader } from "@/components/board/board-header";
import { BoardMessage } from "@/components/board/board-message";
import { useLauncherAccelerator } from "@/components/launcher/use-launcher-accelerator";
import { appInputs } from "@/components/mini-app/mini-app-inputs";
import { MiniAppInputsBar } from "@/components/mini-app/mini-app-inputs-bar";
import { usePanelValue } from "@/components/mini-app/mini-app-state";
import { PanelControlsProvider } from "@/components/mini-app/panel-controls";
import { PanelRenderer } from "@/components/mini-app/panel-renderer";
import { useMiniAppRecord } from "@/components/mini-app/use-mini-app-record";
import { Pressable } from "@/components/motion/pressable";
import { getErrorMessage } from "@/lib/error-message";
import { saveMiniApp, toggleLauncher } from "@/lib/ipc";

import { ChangePromptBar } from "./change-prompt-bar";
import { ChangeSession } from "./change-session";
import { MiniAppEditBar } from "./mini-app-edit-bar";
import { useMiniAppHotkeys } from "./use-mini-app-hotkeys";
import { useMiniAppScreen } from "./use-mini-app-screen";

type ChangeState =
  | { step: "asking" }
  | { step: "building"; prompt: string }
  | null;

const useAppSurface = () => {
  useEffect(() => {
    document.documentElement.dataset.surface = "app";
    return () => {
      delete document.documentElement.dataset.surface;
    };
  }, []);
};

interface MiniAppScreenProps {
  app: MiniApp;
  onReplace: (app: MiniApp) => void;
}

function MiniAppScreen({ app, onReplace }: MiniAppScreenProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeState>(null);
  const update = useCallback(
    async (edit: (draft: MiniAppDraft) => MiniAppDraft) => {
      try {
        onReplace(await saveMiniApp(edit(draftOfApp(app))));
        setProblem(null);
      } catch (error) {
        setProblem(getErrorMessage(error, "The change could not be saved."));
      }
    },
    [app, onReplace]
  );
  const screen = useMiniAppScreen(app, update);
  const { editing, runs, setEditing, store, target, onApplyInputs } = screen;
  const { refreshAll } = runs;
  const values = usePanelValue(store, (state) => state.inputs);
  const launcherHotkey = useLauncherAccelerator();
  const toggleEdit = useCallback(
    () => setEditing((value) => !value),
    [setEditing]
  );
  const askChange = useCallback(() => setChange({ step: "asking" }), []);
  const closeChange = useCallback(() => setChange(null), []);
  const startChange = useCallback(
    (prompt: string) => setChange({ prompt, step: "building" }),
    []
  );
  const discard = useCallback(() => {
    setChange(null);
    refreshAll();
  }, [refreshAll]);
  const handleSaved = useCallback(
    (saved: MiniApp) => {
      onReplace(saved);
      setChange(null);
    },
    [onReplace]
  );
  const summonLauncher = useCallback(
    () => toggleLauncher(`app:${app.id}`),
    [app.id]
  );
  const inputs = useMemo(() => appInputs(app, target), [app, target]);
  const headerActions = useMemo(
    () => ({
      onRefresh: refreshAll,
      onRefreshInterval: (refresh: RefreshInterval) =>
        update((draft) => ({ ...draft, refresh })),
      onRename: (name: string) => update((draft) => ({ ...draft, name })),
      onToggleEdit: toggleEdit,
    }),
    [refreshAll, toggleEdit, update]
  );
  const escapeFrom = (): (() => void) | null => {
    if (change) {
      return discard;
    }
    return editing ? toggleEdit : null;
  };

  useMiniAppHotkeys({
    launcherHotkey,
    onChange: askChange,
    onEscape: escapeFrom(),
    onLauncher: summonLauncher,
    onRefresh: refreshAll,
    onToggleEdit: toggleEdit,
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <BoardHeader
        actions={headerActions}
        board={app}
        editing={editing}
        nameLabel="App name"
        updatedAt={runs.updatedAt}
      >
        <Pressable
          aria-keyshortcuts="Meta+Shift+E"
          className="flex h-7 items-center gap-1.5 rounded-[7px] px-2 type-meta text-panel-muted hover:bg-row-hover hover:text-foreground"
          onClick={askChange}
        >
          <MessageSquarePlusIcon aria-hidden className="size-3.5" />
          Change
        </Pressable>
      </BoardHeader>
      {editing ? <MiniAppEditBar app={app} update={update} /> : null}
      {change?.step === "asking" ? (
        <ChangePromptBar
          name={app.name}
          onCancel={closeChange}
          onSubmit={startChange}
        />
      ) : null}
      <MiniAppInputsBar
        inputs={inputs}
        onApply={onApplyInputs}
        values={values}
        variant="window"
      />
      {problem ? (
        <p className="px-6 pt-3 type-meta text-danger-ink" role="alert">
          {problem}
        </p>
      ) : null}
      {change?.step === "building" ? (
        <ChangeSession
          app={app}
          key={change.prompt}
          onDiscard={discard}
          onSaved={handleSaved}
          prompt={change.prompt}
          store={store}
        />
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-10">
          <PanelControlsProvider controls={screen.controls}>
            <PanelRenderer layout={app.layout} store={store} />
          </PanelControlsProvider>
        </main>
      )}
    </div>
  );
}

export function MiniAppView({ appId }: { appId: string }) {
  useAppSurface();
  const { record, reload, replace } = useMiniAppRecord(appId);
  switch (record.status) {
    case "ready": {
      return <MiniAppScreen app={record.app} onReplace={replace} />;
    }
    case "missing": {
      return (
        <BoardMessage
          detail="It may have been deleted from the launcher."
          title="This app no longer exists."
        />
      );
    }
    case "error": {
      return (
        <BoardMessage detail={record.message} title="This app could not load.">
          <Pressable
            className="mt-2 h-7 rounded-[7px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active"
            onClick={reload}
          >
            Retry
          </Pressable>
        </BoardMessage>
      );
    }
    default: {
      return <BoardMessage title="Loading app…" />;
    }
  }
}
