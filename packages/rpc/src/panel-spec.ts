import { z } from "zod";

import type { CardViewKind as CardViewKindValue } from "./widget.ts";

import { TileSize } from "./board.ts";
import { CardSpec } from "./card-spec.ts";
import { CardViewKind } from "./widget.ts";

export const PANEL_ELEMENT_TYPES = [
  "Stack",
  "Grid",
  "Card",
  "ActionButton",
  "Heading",
  "Note",
] as const;
export type PanelElementType = (typeof PANEL_ELEMENT_TYPES)[number];

export const MAX_PANEL_ELEMENTS = 24;
export const MAX_PANEL_DEPTH = 4;

const RESERVED_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export const isReservedKey = (key: string): boolean => RESERVED_KEYS.has(key);

const notReserved = (key: string) => !isReservedKey(key);

export const ElementKey = z
  .string()
  .regex(/^[a-z][a-z0-9_-]{0,47}$/)
  .refine(notReserved, { message: "That name is reserved." });
export const InputPath = z.string().regex(/^\/inputs\/[a-z][a-z0-9_]{0,31}$/);
export const SourcePath = z.string().regex(/^\/sources\/[a-z][a-z0-9_]{0,31}$/);
export const SourceFieldPath = z
  .string()
  .regex(/^\/sources\/[a-z][a-z0-9_]{0,31}\/(rows|rowCount|status)$/);

export const Visibility = z
  .object({
    $state: z.union([InputPath, SourceFieldPath]),
    eq: z.union([z.string().max(200), z.number()]).optional(),
    gt: z.number().optional(),
    neq: z.union([z.string().max(200), z.number()]).optional(),
    not: z.literal(true).optional(),
  })
  .strict();
export type Visibility = z.infer<typeof Visibility>;

const Leaf = {
  children: z.array(ElementKey).max(0).default([]),
  visible: Visibility.optional(),
};

const Branch = {
  children: z.array(ElementKey).max(MAX_PANEL_ELEMENTS).default([]),
  visible: Visibility.optional(),
};

// An insight describes the data the card was generated against, so a panel
// that re-runs on fresh data never keeps one.
const PanelCardSpec = CardSpec.transform(
  ({ insight: _insight, ...spec }) => spec
);

export const PanelElement = z.discriminatedUnion("type", [
  z
    .object({
      props: z
        .object({
          direction: z.enum(["vertical", "horizontal"]),
          gap: z.enum(["s", "m", "l"]),
        })
        .strict(),
      type: z.literal("Stack"),
      ...Branch,
    })
    .strict(),
  z
    .object({
      props: z.object({}).strict(),
      type: z.literal("Grid"),
      ...Branch,
    })
    .strict(),
  z
    .object({
      props: z
        .object({
          data: z.object({ $state: SourcePath }).strict(),
          rowActions: z.array(z.string().min(1).max(100)).max(4).default([]),
          size: TileSize,
          spec: PanelCardSpec,
          view: CardViewKind,
        })
        .strict(),
      type: z.literal("Card"),
      ...Leaf,
    })
    .strict(),
  z
    .object({
      props: z.object({ action: z.string().min(1).max(100) }).strict(),
      type: z.literal("ActionButton"),
      ...Leaf,
    })
    .strict(),
  z
    .object({
      props: z.object({ text: z.string().trim().min(1).max(80) }).strict(),
      type: z.literal("Heading"),
      ...Leaf,
    })
    .strict(),
  z
    .object({
      props: z.object({ text: z.string().trim().min(1).max(280) }).strict(),
      type: z.literal("Note"),
      ...Leaf,
    })
    .strict(),
]);
export type PanelElement = z.infer<typeof PanelElement>;
export type PanelElementOf<T extends PanelElementType> = Extract<
  PanelElement,
  { type: T }
>;
export type CardElement = PanelElementOf<"Card">;

export const ElementTypeDocs: Record<PanelElementType, string> = {
  ActionButton:
    "A button that runs one declared action by id; it acts on the whole app, not a row.",
  Card: "One chart, KPI or table bound to a named source by pointer; it never holds rows itself.",
  Grid: "A 12-column grid; each Card child takes the width of its size (s=3, m=4, l=6, wide=12).",
  Heading: "A short section title, plain text.",
  Note: "A sentence of plain-text guidance for the person using the app.",
  Stack:
    "Lays its children out vertically or horizontally with a small, medium or large gap.",
};

export interface PanelLayout {
  root: string;
  elements: Readonly<Record<string, PanelElement>>;
}

export const elementOf = (
  layout: Pick<PanelLayout, "elements">,
  key: string
): PanelElement | null =>
  Object.hasOwn(layout.elements, key) ? (layout.elements[key] ?? null) : null;

export const isBranch = (element: PanelElement): boolean =>
  element.type === "Stack" || element.type === "Grid";

type Walk =
  | { ok: true; depth: number; parents: Map<string, string> }
  | { ok: false; problem: string };

const walkFrom = (layout: PanelLayout): Walk => {
  const parents = new Map<string, string>();
  const seen = new Set<string>([layout.root]);
  let frontier = [layout.root];
  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const key of frontier) {
      for (const child of elementOf(layout, key)?.children ?? []) {
        if (!elementOf(layout, child)) {
          return { ok: false, problem: `"${key}" lists a missing "${child}".` };
        }
        if (seen.has(child)) {
          return {
            ok: false,
            problem: `"${child}" has two parents or forms a cycle.`,
          };
        }
        seen.add(child);
        parents.set(child, key);
        next.push(child);
      }
    }
    frontier = next;
  }
  return { depth, ok: true, parents };
};

export interface StreamingLayout {
  root: string | null;
  elements: Readonly<Record<string, PanelElement>>;
}

const parentsOf = (
  layout: StreamingLayout
): { parents: Map<string, string>; problem: string | null } => {
  const parents = new Map<string, string>();
  for (const [key, element] of Object.entries(layout.elements)) {
    const listed = new Set<string>();
    for (const child of element.children) {
      if (listed.has(child)) {
        return { parents, problem: `"${key}" lists "${child}" twice.` };
      }
      listed.add(child);
      const other = parents.get(child);
      if (other !== undefined) {
        return { parents, problem: `"${child}" has two parents.` };
      }
      parents.set(child, key);
    }
  }
  return { parents, problem: null };
};

// The checks a half-written layout must already pass, so a streamed patch
// can never form a cycle, list a child twice or nest too deep. Missing
// children and unreachable elements are fine until the build is done.
export const streamingLayoutProblem = (
  layout: StreamingLayout
): string | null => {
  const { parents, problem } = parentsOf(layout);
  if (problem) {
    return problem;
  }
  for (const key of Object.keys(layout.elements)) {
    const chain = new Set([key]);
    let current = key;
    let parent = parents.get(current);
    while (parent !== undefined) {
      if (chain.has(parent)) {
        return `"${key}" ends up inside itself.`;
      }
      chain.add(parent);
      current = parent;
      parent = parents.get(current);
    }
    if (current === layout.root && chain.size > MAX_PANEL_DEPTH) {
      return `Nest elements at most ${MAX_PANEL_DEPTH} levels deep.`;
    }
  }
  return null;
};

export const panelProblems = (layout: PanelLayout): string[] => {
  const root = elementOf(layout, layout.root);
  if (!root) {
    return [`The root "${layout.root}" is not an element.`];
  }
  const keys = Object.keys(layout.elements);
  if (keys.length > MAX_PANEL_ELEMENTS) {
    return [`Use at most ${MAX_PANEL_ELEMENTS} elements.`];
  }
  if (root.type === "Card") {
    return ["A Card must sit inside a Grid or a Stack."];
  }
  const walk = walkFrom(layout);
  if (!walk.ok) {
    return [walk.problem];
  }
  const problems: string[] = [];
  if (walk.depth > MAX_PANEL_DEPTH) {
    problems.push(`Nest elements at most ${MAX_PANEL_DEPTH} levels deep.`);
  }
  const unreachable = keys.filter(
    (key) => key !== layout.root && !walk.parents.has(key)
  );
  if (unreachable.length > 0) {
    problems.push(`Nothing contains "${unreachable.join('", "')}".`);
  }
  return problems;
};

const checkPanelStructure = (layout: PanelLayout, ctx: z.RefinementCtx) => {
  for (const message of panelProblems(layout)) {
    ctx.addIssue({ code: "custom", message });
  }
};

export const PanelSpec = z
  .object({ elements: z.record(ElementKey, PanelElement), root: ElementKey })
  .strict()
  .superRefine(checkPanelStructure);
export type PanelSpec = z.infer<typeof PanelSpec>;

export const cardElements = (
  layout: Pick<PanelLayout, "elements">
): [string, CardElement][] =>
  Object.entries(layout.elements).flatMap(([key, element]) =>
    element.type === "Card" ? [[key, element] as [string, CardElement]] : []
  );

export const sourceNameOfPath = (path: string): string =>
  path.split("/")[2] ?? "";

export const cardSourceName = (card: CardElement): string =>
  sourceNameOfPath(card.props.data.$state);

const withElements = <L extends PanelLayout>(
  layout: L,
  elements: Record<string, PanelElement>
): L => ({ ...layout, elements });

const parentOf = (layout: PanelLayout, key: string): string | null =>
  Object.entries(layout.elements).find(([, element]) =>
    element.children.includes(key)
  )?.[0] ?? null;

export const moveChild = <L extends PanelLayout>(
  layout: L,
  key: string,
  to: number
): L => {
  const parentKey = parentOf(layout, key);
  const parent = parentKey ? elementOf(layout, parentKey) : null;
  if (!(parentKey && parent)) {
    return layout;
  }
  const from = parent.children.indexOf(key);
  const target = Math.max(0, Math.min(to, parent.children.length - 1));
  if (from === target) {
    return layout;
  }
  const children = parent.children.toSpliced(from, 1).toSpliced(target, 0, key);
  return withElements(layout, {
    ...layout.elements,
    [parentKey]: { ...parent, children },
  });
};

const updateCard = <L extends PanelLayout>(
  layout: L,
  key: string,
  change: (card: CardElement) => CardElement
): L => {
  const element = elementOf(layout, key);
  if (element?.type !== "Card") {
    return layout;
  }
  return withElements(layout, { ...layout.elements, [key]: change(element) });
};

export const resizeCard = <L extends PanelLayout>(
  layout: L,
  key: string,
  size: TileSize
): L =>
  updateCard(layout, key, (card) => ({
    ...card,
    props: { ...card.props, size },
  }));

export const setCardView = <L extends PanelLayout>(
  layout: L,
  key: string,
  view: CardViewKindValue
): L =>
  updateCard(layout, key, (card) => ({
    ...card,
    props: { ...card.props, view },
  }));

const subtreeOf = (layout: PanelLayout, key: string): string[] => {
  const element = elementOf(layout, key);
  if (!element) {
    return [];
  }
  return [
    key,
    ...element.children.flatMap((child) => subtreeOf(layout, child)),
  ];
};

export const removeElement = <L extends PanelLayout>(
  layout: L,
  key: string
): L => {
  if (key === layout.root || !elementOf(layout, key)) {
    return layout;
  }
  const removed = new Set(subtreeOf(layout, key));
  const elements = Object.fromEntries(
    Object.entries(layout.elements)
      .filter(([name]) => !removed.has(name))
      .map(([name, element]) => [
        name,
        {
          ...element,
          children: element.children.filter((child) => !removed.has(child)),
        },
      ])
  );
  return withElements(layout, elements);
};
