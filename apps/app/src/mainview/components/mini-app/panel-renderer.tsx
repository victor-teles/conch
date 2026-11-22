import type { ReactNode } from "react";

import {
  cardSourceName,
  elementOf,
  MAX_PANEL_DEPTH,
} from "@conch/rpc/mini-app";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef } from "react";

import type { PanelElement } from "@/lib/ipc";

import { spanFor } from "@/components/board/board-grid";
import { useElementWidth } from "@/components/board/use-element-width";
import { staggerDelay, useMotionPreset } from "@/lib/motion";

import type { MiniAppStateStore } from "./mini-app-state";

import { ElementBoundary, ElementProblem } from "./elements/element-boundary";
import { PanelActionButton } from "./elements/panel-action-button";
import { PanelCard } from "./elements/panel-card";
import { PanelGrid } from "./elements/panel-grid";
import { PanelHeading } from "./elements/panel-heading";
import { PanelNote } from "./elements/panel-note";
import { PanelStack } from "./elements/panel-stack";
import { usePanelValue } from "./mini-app-state";
import { usePanelControls } from "./panel-controls";
import { isVisible } from "./panel-visibility";

const NO_ANCESTORS: readonly string[] = [];

export interface RenderedLayout {
  root: string | null;
  elements: Readonly<Record<string, PanelElement>>;
}

interface NodeProps {
  elementKey: string;
  layout: RenderedLayout;
  store: MiniAppStateStore;
  ancestors: readonly string[];
}

interface SlotProps {
  index: number;
  span: number | null;
  children: ReactNode;
}

// Each element keeps its key as the React key, so a patch that replaces or
// removes one element never remounts its siblings.
function Slot({ index, span, children }: SlotProps) {
  const { reduced, soft, spring, fadeIn, fadeOut } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="min-w-0"
      exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: fadeOut }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
      layout={reduced ? false : "position"}
      style={
        span === null
          ? undefined
          : { gridColumn: `span ${span} / span ${span}` }
      }
      transition={{
        layout: spring,
        opacity: { ...fadeIn, delay: staggerDelay(index) },
        y: { ...soft, delay: staggerDelay(index) },
      }}
    >
      {children}
    </motion.div>
  );
}

interface ChildrenProps {
  ancestors: readonly string[];
  keys: readonly string[];
  layout: RenderedLayout;
  store: MiniAppStateStore;
  spanOf?: (key: string) => number;
}

function Children({ ancestors, keys, layout, store, spanOf }: ChildrenProps) {
  return (
    <AnimatePresence>
      {[...new Set(keys)].map((key, index) =>
        elementOf(layout, key) ? (
          <Slot index={index} key={key} span={spanOf ? spanOf(key) : null}>
            <PanelNode
              ancestors={ancestors}
              elementKey={key}
              layout={layout}
              store={store}
            />
          </Slot>
        ) : null
      )}
    </AnimatePresence>
  );
}

function GridNode({ ancestors, keys, layout, store }: ChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  const spanOf = useCallback(
    (key: string): number => {
      const element = elementOf(layout, key);
      return element?.type === "Card" ? spanFor(element.props.size, width) : 12;
    },
    [layout, width]
  );
  return (
    <PanelGrid ref={ref}>
      <Children
        ancestors={ancestors}
        keys={keys}
        layout={layout}
        spanOf={spanOf}
        store={store}
      />
    </PanelGrid>
  );
}

function CardNode({
  elementKey,
  element,
  store,
}: {
  elementKey: string;
  element: Extract<PanelElement, { type: "Card" }>;
  store: MiniAppStateStore;
}) {
  const source = cardSourceName(element);
  const run = usePanelValue(store, (state) =>
    Object.hasOwn(state.sources, source) ? state.sources[source] : undefined
  );
  return (
    <PanelCard
      card={element.props}
      cardKey={elementKey}
      run={run}
      source={source}
    />
  );
}

function ActionNode({ actionId }: { actionId: string }) {
  const { actionOf, actionsLocked, runAction } = usePanelControls();
  const handlePress = useCallback(
    () => runAction(actionId, null),
    [actionId, runAction]
  );
  return (
    <PanelActionButton
      action={actionOf(actionId)}
      locked={actionsLocked}
      onPress={handlePress}
    />
  );
}

const renderElement = (
  elementKey: string,
  element: PanelElement,
  layout: RenderedLayout,
  store: MiniAppStateStore,
  ancestors: readonly string[]
): ReactNode => {
  switch (element.type) {
    case "Stack": {
      return (
        <PanelStack direction={element.props.direction} gap={element.props.gap}>
          <Children
            ancestors={ancestors}
            keys={element.children}
            layout={layout}
            store={store}
          />
        </PanelStack>
      );
    }
    case "Grid": {
      return (
        <GridNode
          ancestors={ancestors}
          keys={element.children}
          layout={layout}
          store={store}
        />
      );
    }
    case "Card": {
      return (
        <CardNode element={element} elementKey={elementKey} store={store} />
      );
    }
    case "ActionButton": {
      return <ActionNode actionId={element.props.action} />;
    }
    case "Heading": {
      return <PanelHeading text={element.props.text} />;
    }
    case "Note": {
      return <PanelNote text={element.props.text} />;
    }
    default: {
      return element satisfies never;
    }
  }
};

// The walk carries its own path, so a spec that loops or nests too deep
// draws an error in place instead of recursing forever.
function PanelNode({ elementKey, layout, store, ancestors }: NodeProps) {
  const element = elementOf(layout, elementKey);
  const visible = usePanelValue(store, (state) =>
    isVisible(element?.visible, state)
  );
  if (ancestors.includes(elementKey) || ancestors.length >= MAX_PANEL_DEPTH) {
    return <ElementProblem elementKey={elementKey} />;
  }
  if (!(element && visible)) {
    return null;
  }
  return (
    <ElementBoundary elementKey={elementKey}>
      {renderElement(elementKey, element, layout, store, [
        ...ancestors,
        elementKey,
      ])}
    </ElementBoundary>
  );
}

interface PanelRendererProps {
  layout: RenderedLayout;
  store: MiniAppStateStore;
}

export function PanelRenderer({ layout, store }: PanelRendererProps) {
  if (!layout.root) {
    return null;
  }
  return (
    <PanelNode
      ancestors={NO_ANCESTORS}
      elementKey={layout.root}
      layout={layout}
      store={store}
    />
  );
}
