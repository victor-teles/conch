import type { DialectType } from "@conch/core/client";

import type { CardViewKind } from "@/lib/card-data";
import type { CardSpec, ParamDef, Widget, WidgetDraft } from "@/lib/ipc";

export interface AnsweredAsk {
  prompt: string;
  sql: string;
  dialect: DialectType;
  spec: CardSpec;
  view: CardViewKind;
  connectionId: string;
  database?: string | null;
}

const NAME_MAX = 60;

export const defaultWidgetName = (spec: CardSpec): string =>
  spec.title.slice(0, NAME_MAX);

export const draftFromAsk = (
  ask: AnsweredAsk,
  name: string,
  inputs: { template: string; params: ParamDef[] } | null = null
): WidgetDraft => ({
  lastValues: {},
  name: name.trim().slice(0, NAME_MAX),
  params: inputs?.params ?? [],
  prompt: ask.prompt,
  source: {
    connectionId: ask.connectionId,
    database: ask.database ?? null,
    dialect: ask.dialect,
    kind: "sql",
    sqlTemplate: inputs?.template ?? ask.sql,
  },
  spec: ask.spec,
  view: ask.view,
});

export const draftFromWidget = (widget: Widget): WidgetDraft => ({
  id: widget.id,
  lastValues: widget.lastValues,
  name: widget.name,
  params: widget.params,
  prompt: widget.prompt,
  source: widget.source,
  spec: widget.spec,
  view: widget.view,
});

export const rebindDraft = (
  widget: Widget,
  connectionId: string
): WidgetDraft | null =>
  widget.source.kind === "sql"
    ? { ...draftFromWidget(widget), source: { ...widget.source, connectionId } }
    : null;

export const duplicateDraft = (widget: Widget): WidgetDraft => {
  const { id: _id, ...rest } = draftFromWidget(widget);
  return { ...rest, name: `${widget.name} copy`.slice(0, NAME_MAX) };
};
