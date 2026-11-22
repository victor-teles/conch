import { z } from "zod";

import type { RefreshInterval as RefreshIntervalValue } from "./board.ts";
import type {
  AppActionDraft as AppActionDraftValue,
  DraftPatch,
} from "./mini-app.ts";
import type { PanelElement as PanelElementValue } from "./panel-spec.ts";
import type { Source as SourceValue } from "./source.ts";
import type { ParamDef as ParamDefValue, ParamValue } from "./widget.ts";

import { RefreshInterval } from "./board.ts";
import {
  AppActionDraft,
  AppActionId,
  MAX_APP_ACTIONS,
  MAX_APP_SOURCES,
  MINI_APP_VERSION,
  MiniAppDraft,
  SourceName,
} from "./mini-app.ts";
import {
  ElementKey,
  isReservedKey,
  MAX_PANEL_ELEMENTS,
  PanelElement,
  streamingLayoutProblem,
} from "./panel-spec.ts";
import { Ident, Source } from "./source.ts";
import { MAX_WIDGET_PARAMS, ParamDef } from "./widget.ts";

// The draft while it streams: everything may still be missing, and the
// whole-document checks run only once the model is done.
export interface DraftState {
  name: string;
  emoji?: string;
  description: string;
  prompt: string;
  inputs: ParamDefValue[];
  inputOptions: Record<string, string>;
  sources: Record<string, SourceValue>;
  actions: AppActionDraftValue[];
  refreshAfter: Record<string, string[]>;
  layout: { root: string | null; elements: Record<string, PanelElementValue> };
  refresh: RefreshIntervalValue;
  values: Record<string, ParamValue>;
}

export const emptyDraftState = (prompt: string): DraftState => ({
  actions: [],
  description: "",
  inputOptions: {},
  inputs: [],
  layout: { elements: {}, root: null },
  name: "",
  prompt,
  refresh: "off",
  refreshAfter: {},
  sources: {},
  values: {},
});

export const draftStateOf = (draft: MiniAppDraft): DraftState => ({
  actions: draft.actions,
  description: draft.description,
  ...(draft.emoji === undefined ? {} : { emoji: draft.emoji }),
  inputOptions: draft.inputOptions,
  inputs: draft.inputs,
  layout: draft.layout,
  name: draft.name,
  prompt: draft.prompt,
  refresh: draft.refresh,
  refreshAfter: draft.refreshAfter,
  sources: draft.sources,
  values: draft.values,
});

export const parseDraftState = (state: DraftState, id?: string) =>
  MiniAppDraft.safeParse({
    ...state,
    ...(id === undefined ? {} : { id }),
    layout: { elements: state.layout.elements, root: state.layout.root ?? "" },
    version: MINI_APP_VERSION,
  });

export type PatchResult =
  | { ok: true; draft: DraftState }
  | { ok: false; reason: string };

const DraftPatchShape = z.discriminatedUnion("op", [
  z
    .object({
      op: z.enum(["add", "replace"]),
      path: z.string().min(1).max(200),
      value: z.unknown(),
    })
    .strict(),
  z
    .object({ op: z.literal("remove"), path: z.string().min(1).max(200) })
    .strict(),
]);

const MAX_LINE_CHARS = 32_000;

// One RFC 6902 op per JSONL line; anything else on a line is dropped.
export const parsePatchLine = (line: string): DraftPatch | null => {
  const text = line.trim();
  if (!text.startsWith("{") || text.length > MAX_LINE_CHARS) {
    return null;
  }
  try {
    const parsed = DraftPatchShape.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return null;
    }
    const op = parsed.data;
    return op.op === "remove"
      ? { op: "remove", path: op.path }
      : { op: op.op, path: op.path, value: op.value };
  } catch {
    return null;
  }
};

const decodeSegment = (segment: string): string =>
  segment.replaceAll("~1", "/").replaceAll("~0", "~");

const segmentsOf = (path: string): string[] | null => {
  if (!path.startsWith("/")) {
    return null;
  }
  const segments = path.slice(1).split("/").map(decodeSegment);
  return segments.some(isReservedKey) ? null : segments;
};

const reject = (reason: string): PatchResult => ({ ok: false, reason });

const firstIssue = (error: z.ZodError): string => {
  const [issue] = error.issues;
  if (!issue) {
    return "it isn't valid";
  }
  const where = issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
  return `${issue.message}${where}`;
};

const parsed = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  path: string
): { ok: true; value: T } | { ok: false; reason: string } => {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, reason: `${path}: ${firstIssue(result.error)}` };
};

type FieldName = "name" | "emoji" | "description" | "refresh";

const FIELD_SCHEMAS: Record<FieldName, z.ZodType<string>> = {
  description: z.string().max(280),
  emoji: z.string().max(8),
  name: z.string().trim().min(1).max(60),
  refresh: RefreshInterval,
};

const isField = (name: string): name is FieldName =>
  Object.hasOwn(FIELD_SCHEMAS, name);

const applyField = (
  draft: DraftState,
  field: FieldName,
  op: DraftPatch
): PatchResult => {
  if (op.op === "remove") {
    if (field !== "emoji") {
      return reject(`/${field} can't be removed.`);
    }
    const { emoji: _emoji, ...rest } = draft;
    return { draft: rest, ok: true };
  }
  const value = parsed(FIELD_SCHEMAS[field], op.value, `/${field}`);
  if (!value.ok) {
    return reject(value.reason);
  }
  if (field === "refresh") {
    const refresh = RefreshInterval.parse(value.value);
    return { draft: { ...draft, refresh }, ok: true };
  }
  return { draft: { ...draft, [field]: value.value }, ok: true };
};

interface ListPatch<T> {
  list: readonly T[];
  segment: string;
  op: DraftPatch;
  schema: z.ZodType<T>;
  max: number;
  path: string;
}

const patchList = <T>({
  list,
  segment,
  op,
  schema,
  max,
  path,
}: ListPatch<T>): { ok: true; list: T[] } | { ok: false; reason: string } => {
  const append = segment === "-";
  const index = append ? list.length : Number(segment);
  if (!(append || /^(0|[1-9]\d*)$/.test(segment))) {
    return { ok: false, reason: `${path}: use an index or -.` };
  }
  if (op.op === "remove") {
    return index < list.length && !append
      ? { list: list.toSpliced(index, 1), ok: true }
      : { ok: false, reason: `${path}: nothing to remove.` };
  }
  const value = parsed(schema, op.value, path);
  if (!value.ok) {
    return value;
  }
  if (op.op === "replace") {
    return index < list.length && !append
      ? { list: list.with(index, value.value), ok: true }
      : { ok: false, reason: `${path}: nothing to replace.` };
  }
  if (index > list.length || list.length >= max) {
    return { ok: false, reason: `${path}: at most ${max} entries.` };
  }
  return { list: list.toSpliced(index, 0, value.value), ok: true };
};

interface RecordPatch<T> {
  record: Readonly<Record<string, T>>;
  key: string;
  op: DraftPatch;
  schema: z.ZodType<T>;
  keySchema: z.ZodType<string>;
  max: number;
  path: string;
}

const patchRecord = <T>({
  record,
  key,
  op,
  schema,
  keySchema,
  max,
  path,
}: RecordPatch<T>):
  | { ok: true; record: Record<string, T> }
  | { ok: false; reason: string } => {
  if (!keySchema.safeParse(key).success) {
    return { ok: false, reason: `${path}: "${key}" isn't a valid name.` };
  }
  const exists = Object.hasOwn(record, key);
  if (op.op === "remove") {
    if (!exists) {
      return { ok: false, reason: `${path}: nothing to remove.` };
    }
    const { [key]: _removed, ...rest } = record;
    return { ok: true, record: rest };
  }
  if (op.op === "replace" && !exists) {
    return { ok: false, reason: `${path}: nothing to replace.` };
  }
  if (!exists && Object.keys(record).length >= max) {
    return { ok: false, reason: `${path}: at most ${max} entries.` };
  }
  const value = parsed(schema, op.value, path);
  if (!value.ok) {
    return value;
  }
  return { ok: true, record: { ...record, [key]: value.value } };
};

const RefreshSources = z.array(SourceName).max(MAX_APP_SOURCES);

const withLayout = (
  draft: DraftState,
  layout: DraftState["layout"]
): PatchResult => {
  const problem = streamingLayoutProblem(layout);
  return problem ? reject(problem) : { draft: { ...draft, layout }, ok: true };
};

const applyLayout = (
  draft: DraftState,
  rest: readonly string[],
  op: DraftPatch,
  path: string
): PatchResult => {
  const [area, key, ...deeper] = rest;
  if (area === "root" && key === undefined) {
    if (op.op === "remove") {
      return reject("/layout/root can't be removed.");
    }
    const root = parsed(ElementKey, op.value, path);
    return root.ok
      ? withLayout(draft, { ...draft.layout, root: root.value })
      : reject(root.reason);
  }
  if (area !== "elements" || key === undefined || deeper.length > 0) {
    return reject(`${path} isn't a path you can write.`);
  }
  const next = patchRecord({
    key,
    keySchema: ElementKey,
    max: MAX_PANEL_ELEMENTS,
    op,
    path,
    record: draft.layout.elements,
    schema: PanelElement,
  });
  return next.ok
    ? withLayout(draft, { ...draft.layout, elements: next.record })
    : reject(next.reason);
};

const applyCollection = (
  draft: DraftState,
  area: string,
  segment: string,
  op: DraftPatch,
  path: string
): PatchResult => {
  switch (area) {
    case "inputs": {
      const next = patchList({
        list: draft.inputs,
        max: MAX_WIDGET_PARAMS,
        op,
        path,
        schema: ParamDef,
        segment,
      });
      return next.ok
        ? { draft: { ...draft, inputs: next.list }, ok: true }
        : reject(next.reason);
    }
    case "actions": {
      const next = patchList({
        list: draft.actions,
        max: MAX_APP_ACTIONS,
        op,
        path,
        schema: AppActionDraft,
        segment,
      });
      return next.ok
        ? { draft: { ...draft, actions: next.list }, ok: true }
        : reject(next.reason);
    }
    case "sources": {
      const next = patchRecord({
        key: segment,
        keySchema: SourceName,
        max: MAX_APP_SOURCES,
        op,
        path,
        record: draft.sources,
        schema: Source,
      });
      return next.ok
        ? { draft: { ...draft, sources: next.record }, ok: true }
        : reject(next.reason);
    }
    case "inputOptions": {
      const next = patchRecord({
        key: segment,
        keySchema: Ident,
        max: MAX_WIDGET_PARAMS,
        op,
        path,
        record: draft.inputOptions,
        schema: SourceName,
      });
      return next.ok
        ? { draft: { ...draft, inputOptions: next.record }, ok: true }
        : reject(next.reason);
    }
    case "refreshAfter": {
      const next = patchRecord({
        key: segment,
        keySchema: AppActionId,
        max: MAX_APP_ACTIONS,
        op,
        path,
        record: draft.refreshAfter,
        schema: RefreshSources,
      });
      return next.ok
        ? { draft: { ...draft, refreshAfter: next.record }, ok: true }
        : reject(next.reason);
    }
    default: {
      return reject(`${path} isn't a path you can write.`);
    }
  }
};

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const INDEX = /^(0|[1-9]\d*)$/;
const MAX_INNER_DEPTH = 4;
const UNAPPLIED: unique symbol = Symbol("unapplied");

const patchArray = (
  list: readonly unknown[],
  [key = "", ...rest]: readonly string[],
  op: DraftPatch
): unknown => {
  if (rest.length === 0 && key === "-" && op.op === "add") {
    return [...list, op.value];
  }
  if (!INDEX.test(key)) {
    return UNAPPLIED;
  }
  const index = Number(key);
  if (rest.length === 0 && op.op === "add") {
    return index <= list.length
      ? list.toSpliced(index, 0, op.value)
      : UNAPPLIED;
  }
  if (index >= list.length) {
    return UNAPPLIED;
  }
  if (rest.length === 0) {
    return op.op === "remove"
      ? list.toSpliced(index, 1)
      : list.with(index, op.value);
  }
  const child = patchInside(list[index], rest, op);
  return child === UNAPPLIED ? UNAPPLIED : list.with(index, child);
};

const patchObject = (
  record: Readonly<Record<string, unknown>>,
  [key = "", ...rest]: readonly string[],
  op: DraftPatch
): unknown => {
  const exists = Object.hasOwn(record, key);
  if (rest.length === 0) {
    if (op.op !== "remove") {
      return { ...record, [key]: op.value };
    }
    if (!exists) {
      return UNAPPLIED;
    }
    const { [key]: _removed, ...others } = record;
    return others;
  }
  if (!exists) {
    return UNAPPLIED;
  }
  const child = patchInside(record[key], rest, op);
  return child === UNAPPLIED ? UNAPPLIED : { ...record, [key]: child };
};

// RFC 6902 inside one item, copying along the path. A replace of a missing
// object key adds it, since the whole item is schema-checked afterwards.
function patchInside(
  value: unknown,
  segments: readonly string[],
  op: DraftPatch
): unknown {
  if (Array.isArray(value)) {
    return patchArray(value, segments, op);
  }
  return isRecordObject(value) ? patchObject(value, segments, op) : UNAPPLIED;
}

const ownedValue = <T>(
  record: Readonly<Record<string, T>>,
  key: string
): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

const existingItem = (
  draft: DraftState,
  [area = "", second = "", third = ""]: readonly string[]
): unknown => {
  switch (area) {
    case "layout": {
      return second === "elements"
        ? ownedValue(draft.layout.elements, third)
        : undefined;
    }
    case "sources": {
      return ownedValue(draft.sources, second);
    }
    case "refreshAfter": {
      return ownedValue(draft.refreshAfter, second);
    }
    case "inputs":
    case "actions": {
      return INDEX.test(second) ? draft[area][Number(second)] : undefined;
    }
    default: {
      return undefined;
    }
  }
};

const ownerSize = (segments: readonly string[]): number =>
  segments[0] === "layout" && segments[1] === "elements" ? 3 : 2;

const encodeSegment = (segment: string): string =>
  segment.replaceAll("~", "~0").replaceAll("/", "~1");

// Models fix one part of an item, e.g. /sources/orders/sqlTemplate or
// /layout/elements/main/children/0. That becomes a whole-value replace of
// the owner, so the full schema and the layout checks still see all of it.
const lowerDeepPatch = (
  draft: DraftState,
  segments: readonly string[],
  op: DraftPatch
): { owner: string[]; op: DraftPatch } | null => {
  const size = ownerSize(segments);
  const owner = segments.slice(0, size);
  const inner = segments.slice(size);
  if (inner.length > MAX_INNER_DEPTH) {
    return null;
  }
  const value = patchInside(existingItem(draft, owner), inner, op);
  if (value === UNAPPLIED) {
    return null;
  }
  const path = `/${owner.map(encodeSegment).join("/")}`;
  return { op: { op: "replace", path, value }, owner };
};

const applyWhole = (
  draft: DraftState,
  segments: readonly string[],
  op: DraftPatch
): PatchResult => {
  const [area = "", ...rest] = segments;
  if (area === "layout") {
    return applyLayout(draft, rest, op, op.path);
  }
  if (rest.length === 0 && isField(area)) {
    return applyField(draft, area, op);
  }
  const [segment, ...deeper] = rest;
  if (segment === undefined || deeper.length > 0) {
    return reject(`${op.path} isn't a path you can write.`);
  }
  return applyCollection(draft, area, segment, op, op.path);
};

// Only allow-listed paths, and every write is checked as a whole value: a
// write inside an existing item replaces that item, which the full schema
// re-checks. No patch reaches the record's id, version or timestamps, or a
// prototype key.
export const applyDraftPatch = (
  draft: DraftState,
  op: DraftPatch
): PatchResult => {
  const segments = segmentsOf(op.path);
  if (!segments) {
    return reject(`${op.path} isn't a path you can write.`);
  }
  if (segments.length <= ownerSize(segments)) {
    return applyWhole(draft, segments, op);
  }
  const lowered = lowerDeepPatch(draft, segments, op);
  if (!lowered) {
    return reject(`${op.path} isn't a path you can write.`);
  }
  const result = applyWhole(draft, lowered.owner, lowered.op);
  return result.ok
    ? result
    : reject(result.reason.replace(lowered.op.path, op.path));
};

export const applyDraftPatches = (
  draft: DraftState,
  ops: readonly DraftPatch[]
): DraftState => {
  let current = draft;
  for (const op of ops) {
    const result = applyDraftPatch(current, op);
    if (result.ok) {
      current = result.draft;
    }
  }
  return current;
};
