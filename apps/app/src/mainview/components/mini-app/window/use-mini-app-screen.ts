import type { KeyboardEvent } from "react";

import { REFRESH_MS, stepSize } from "@conch/rpc";
import {
  cardsUsingSource,
  elementOf,
  moveChild,
  resizeCard,
  setCardView,
} from "@conch/rpc/mini-app";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  PanelControls,
  PanelRowTarget,
} from "@/components/mini-app/panel-controls";
import type {
  MiniApp,
  MiniAppActionRequest,
  MiniAppDraft,
  ParamValues,
} from "@/lib/ipc";

import {
  affectedSources,
  initialInputs,
  storedValuesOf,
} from "@/components/mini-app/mini-app-inputs";
import {
  createMiniAppStore,
  setInputs,
} from "@/components/mini-app/mini-app-state";
import { useMiniAppRuns } from "@/components/mini-app/use-mini-app-runs";
import {
  onMiniAppRefresh,
  setMiniAppValues,
  stageMiniAppAction,
} from "@/lib/ipc";

const MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };
const SIZES: Partial<Record<string, 1 | -1>> = { ArrowDown: -1, ArrowUp: 1 };

type Update = (change: (draft: MiniAppDraft) => MiniAppDraft) => void;

const changedSources = (
  before: Readonly<Record<string, string>>,
  app: MiniApp
): string[] =>
  Object.entries(app.sources)
    .filter(([name, source]) => before[name] !== JSON.stringify(source))
    .map(([name]) => name);

const keepValues = async (appId: string, values: ParamValues) => {
  try {
    await setMiniAppValues(appId, values);
  } catch (error) {
    console.error("[app] could not keep the inputs", error);
  }
};

const stage = async (request: MiniAppActionRequest) => {
  try {
    await stageMiniAppAction(request);
  } catch (error) {
    console.error("[app] could not stage the action", error);
  }
};

// Everything a saved app's window runs: its sources (never the AI), inputs
// that re-run only what uses them, and actions staged into the launcher.
export const useMiniAppScreen = (app: MiniApp, update: Update) => {
  const [store] = useState(() =>
    createMiniAppStore({ inputs: initialInputs(app), sources: {} })
  );
  const [editing, setEditing] = useState(false);
  const [tints, setTints] = useState<Readonly<Record<string, number>>>({});
  const target = useMemo(
    () => ({ appId: app.id, kind: "saved" as const }),
    [app.id]
  );
  const sourceNames = useMemo(() => Object.keys(app.sources), [app.sources]);
  const runs = useMiniAppRuns({
    refreshMs: REFRESH_MS[app.refresh],
    sourceNames,
    store,
    target,
  });
  const { refresh } = runs;
  const ran = useRef<Record<string, string>>({});

  const syncSources = useEffectEvent(() => {
    const stale = changedSources(ran.current, app);
    ran.current = Object.fromEntries(
      Object.entries(app.sources).map(([name, source]) => [
        name,
        JSON.stringify(source),
      ])
    );
    if (stale.length > 0) {
      refresh(stale);
    }
  });
  useEffect(() => {
    syncSources();
  }, [app.sources]);

  useEffect(
    () =>
      onMiniAppRefresh(({ appId, sources }) => {
        if (appId === app.id && sources.length > 0) {
          refresh(sources);
        }
      }),
    [app.id, refresh]
  );

  const applyInputs = useCallback(
    (next: ParamValues) => {
      const affected = affectedSources(app, store.get().inputs, next);
      setInputs(store, next);
      if (affected.length > 0) {
        const token = Date.now();
        setTints(
          Object.fromEntries(
            affected
              .flatMap((source) => cardsUsingSource(app, source))
              .map((key) => [key, token])
          )
        );
        refresh(affected);
      }
      keepValues(app.id, storedValuesOf(app.inputs, next));
    },
    [app, refresh, store]
  );

  const runAction = useCallback(
    (actionId: string, row: PanelRowTarget | null) => {
      stage({
        actionId,
        appId: app.id,
        context: {
          rowIndex: row?.rowIndex ?? null,
          runId: row?.runId ?? "app",
          values: store.get().inputs,
        },
      });
    },
    [app.id, store]
  );

  const onEditKey = useCallback(
    (cardKey: string, event: KeyboardEvent<HTMLElement>) => {
      if (!event.altKey) {
        return;
      }
      const move = MOVES[event.key];
      const size = SIZES[event.key];
      const parent = Object.values(app.layout.elements).find((element) =>
        element.children.includes(cardKey)
      );
      const card = elementOf(app.layout, cardKey);
      if (move !== undefined && parent) {
        event.preventDefault();
        const index = parent.children.indexOf(cardKey);
        update((draft) => ({
          ...draft,
          layout: moveChild(draft.layout, cardKey, index + move),
        }));
      } else if (size !== undefined && card?.type === "Card") {
        event.preventDefault();
        update((draft) => ({
          ...draft,
          layout: resizeCard(
            draft.layout,
            cardKey,
            stepSize(card.props.size, size)
          ),
        }));
      }
    },
    [app.layout, update]
  );

  const controls = useMemo<PanelControls>(
    () => ({
      actionOf: (id) => {
        const action = app.actions.find((item) => item.id === id);
        return action
          ? { effect: action.effect, id, label: action.label }
          : null;
      },
      actionsLocked: null,
      editing,
      onEditKey,
      retry: (source) => refresh([source]),
      runAction,
      selectView: (key, view) =>
        update((draft) => ({
          ...draft,
          layout: setCardView(draft.layout, key, view),
        })),
      tintOf: (key) => tints[key] ?? null,
    }),
    [app.actions, editing, onEditKey, refresh, runAction, tints, update]
  );

  return {
    controls,
    editing,
    onApplyInputs: applyInputs,
    runs,
    setEditing,
    store,
    target,
  };
};
