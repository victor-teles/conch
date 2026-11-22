import { AppWindowIcon } from "lucide-react";

import type { RowTone } from "@/components/launcher/launcher-row";
import type { DatabaseConnection } from "@/lib/connections";
import type { MiniApp } from "@/lib/ipc";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { RowTrailing } from "@/components/launcher/row-trailing";

import { appMeta } from "./app-meta";

interface MiniAppRowProps {
  id: string;
  app: MiniApp;
  selected: boolean;
  tone: RowTone;
  connectionById: (id: string) => DatabaseConnection | null;
  events: { onHover: (id: string) => void; onRun: (id: string) => void };
}

export function MiniAppRow({
  id,
  app,
  selected,
  tone,
  connectionById,
  events,
}: MiniAppRowProps) {
  const meta = appMeta(app, connectionById);
  const { onHover, onRun } = events;
  return (
    <LauncherRow
      id={id}
      onHover={onHover}
      onRun={onRun}
      selected={selected}
      size="tall"
      tone={tone}
    >
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-[13px] leading-none text-panel-muted">
        {app.emoji ?? <AppWindowIcon aria-hidden className="size-3.5" />}
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body text-foreground">{app.name}</span>
        <span className="truncate type-meta text-panel-muted">
          {app.description || meta}
        </span>
      </span>
      <RowTrailing kind="App">{app.description ? meta : null}</RowTrailing>
    </LauncherRow>
  );
}
