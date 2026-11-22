import type { KeyboardEvent, ReactNode } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo } from "react";

import type { RowSelectionTarget } from "@/components/actions/row-selection";
import type { WidgetRunState } from "@/components/widgets/widget-run-reducer";
import type { CardViewKind } from "@/lib/card-data";
import type { CardElement } from "@/lib/ipc";

import { RowSelectionProvider } from "@/components/actions/row-selection";
import { useRowSelection } from "@/components/actions/use-row-selection";
import { AskSkeleton } from "@/components/ask/ask-skeleton";
import { ErrorNotice } from "@/components/ask/error-notice";
import { TileCue } from "@/components/board/tile-cue";
import { usePanelControls } from "@/components/mini-app/panel-controls";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { WidgetRunBody } from "@/components/widgets/widget-run-body";
import { useMotionPreset } from "@/lib/motion";

import { cardFailureCopy, REPAIRING } from "./card-failure";
import { RowActionChips } from "./row-action-chips";

interface PanelCardProps {
  cardKey: string;
  source: string;
  card: CardElement["props"];
  run: WidgetRunState | undefined;
}

function CardTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
      <h3 className="truncate type-title text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Repairing({ title }: { title: string }) {
  const { fadeIn } = useMotionPreset();
  return (
    <motion.div
      animate={{ opacity: 0.6 }}
      initial={{ opacity: 1 }}
      transition={fadeIn}
    >
      <ProgressHairline />
      <CardTitle title={title} />
      <p className="px-4 pb-3 type-meta text-warning-ink" role="status">
        Fixing this query…
      </p>
      <AskSkeleton />
    </motion.div>
  );
}

interface CardBodyProps extends Omit<PanelCardProps, "cardKey"> {
  onRetry: () => void;
  onView: (view: CardViewKind) => void;
}

function CardBody({ source, card, run, onRetry, onView }: CardBodyProps) {
  const { title } = card.spec;
  const rowCount = run?.outcome?.result.rowCount ?? 0;
  const rows = useRowSelection(run?.lastRunId ?? null, rowCount);
  const { select, selected } = rows;
  const target = useMemo<RowSelectionTarget | null>(
    () =>
      card.rowActions.length > 0
        ? { openMenu: select, select, selected }
        : null,
    [card.rowActions.length, select, selected]
  );
  if (run?.failure?.code === REPAIRING) {
    return <Repairing title={title} />;
  }
  if (run?.status === "error" && run.failure) {
    const copy = cardFailureCopy(run.failure);
    return (
      <>
        <CardTitle title={title} />
        <ErrorNotice
          action={copy.retry ? { label: "Retry", onRun: onRetry } : null}
          detail={copy.detail}
          title={copy.title}
        />
      </>
    );
  }
  if (!run?.outcome) {
    return (
      <>
        <CardTitle title={title} />
        <AskSkeleton />
      </>
    );
  }
  const chips =
    selected !== null && run.lastRunId ? (
      <RowActionChips
        actionIds={card.rowActions}
        row={{ rowIndex: selected, runId: run.lastRunId, source }}
      />
    ) : null;
  return (
    <RowSelectionProvider target={target}>
      <WidgetRunBody
        onSelectView={onView}
        run={run}
        slots={{ actions: <AnimatePresence>{chips}</AnimatePresence> }}
        spec={{ ...card.spec, title }}
        view={card.view}
      />
    </RowSelectionProvider>
  );
}

export function PanelCard({ cardKey, source, card, run }: PanelCardProps) {
  const { editing, onEditKey, retry, selectView, tintOf } = usePanelControls();
  const handleRetry = useCallback(() => retry(source), [retry, source]);
  const handleView = useCallback(
    (view: CardViewKind) => selectView(cardKey, view),
    [cardKey, selectView]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (editing && event.target === event.currentTarget) {
        onEditKey(cardKey, event);
      }
    },
    [cardKey, editing, onEditKey]
  );
  return (
    <article
      aria-label={card.spec.title}
      className="relative flex h-full flex-col overflow-hidden rounded-[14px] border border-panel-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      data-card={cardKey}
      onKeyDown={handleKeyDown}
      tabIndex={editing ? 0 : -1}
    >
      <TileCue cue={{ fresh: false, tint: tintOf(cardKey) }} />
      <CardBody
        card={card}
        onRetry={handleRetry}
        onView={handleView}
        run={run}
        source={source}
      />
    </article>
  );
}
