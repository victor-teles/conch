import type { Ranked } from "@/lib/fuzzy-match";
import type { Widget } from "@/lib/ipc";

import { rankByTerms } from "@/lib/fuzzy-match";

const termsOf = (widget: Widget) => [widget.name, widget.prompt];

export const rankWidgets = (
  widgets: readonly Widget[],
  query: string
): Ranked<Widget>[] => rankByTerms(widgets, query, termsOf);

export const filterWidgets = (
  widgets: readonly Widget[],
  query: string
): Widget[] => rankWidgets(widgets, query).map((entry) => entry.item);
