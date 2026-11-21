import type { LookupValue, TableItem } from "@conch/core/client";

import type { FormState } from "@/components/connection-form/connection-form-state";
import type { LauncherCommand } from "@/components/launcher/root-commands";
import type { RootAlert } from "@/components/watches/use-alerts";
import type { DatabaseConnection } from "@/lib/connections";
import type { Ranked } from "@/lib/fuzzy-match";
import type { Board, RecentAsk, Widget } from "@/lib/ipc";

import { rankConnections } from "@/components/launcher/connections/connection-search";
import { rankCommands } from "@/components/launcher/root-commands";
import { rankWidgets } from "@/components/widgets/widget-search";
import { rankByTerms } from "@/lib/fuzzy-match";

import { rankRootItems } from "./root-ranking";

export type RootItem =
  | { kind: "command"; id: string; command: LauncherCommand }
  | { kind: "connection"; id: string; connection: DatabaseConnection }
  | { kind: "ask"; id: string; prompt: string; connection: DatabaseConnection }
  | { kind: "widget"; id: string; widget: Widget }
  | { kind: "recent"; id: string; ask: RecentAsk }
  | { kind: "board"; id: string; board: Board }
  | { kind: "alert"; id: string; alert: RootAlert }
  | { kind: "sql"; id: string; sql: string; connection: DatabaseConnection }
  | { kind: "table"; id: string; schema: string; table: TableItem }
  | { kind: "draft"; id: string; draft: FormState }
  | {
      kind: "lookup";
      id: string;
      value: LookupValue;
      connection: DatabaseConnection;
      origin: LookupOrigin;
    };

export type LookupOrigin = "typed" | "clipboard";

export const ASK_ITEM_ID = "ask";
export const DRAFT_ITEM_ID = "draft-connection";
export const LOOKUP_ITEM_IDS: Record<LookupOrigin, string> = {
  clipboard: "lookup-clipboard",
  typed: "lookup",
};
export const RECENTS_SHOWN = 5;

export const widgetItemId = (widgetId: string) => `widget-${widgetId}`;
export const boardItemId = (boardId: string) => `board-${boardId}`;
export const alertItemId = (watchId: string) => `alert-${watchId}`;
const recentItemId = (askId: string) => `recent-${askId}`;

export interface RootSection {
  id:
    | "connections"
    | "ask"
    | "commands"
    | "recent"
    | "widgets"
    | "boards"
    | "sql"
    | "tables"
    | "switch"
    | "pick"
    | "lookup"
    | "clipboard"
    | "alerts"
    | "results"
    | "fallbacks"
    | "drafts";
  label: string;
  items: RootItem[];
}

interface BuildRootSectionsInput {
  query: string;
  connections: readonly DatabaseConnection[];
  commands: readonly LauncherCommand[];
  aiSetup: LauncherCommand | null;
  askWith?: DatabaseConnection | null;
  widgets?: readonly Widget[];
  recents?: readonly RecentAsk[];
  boards?: readonly Board[];
  lookup?: LookupValue | null;
  offer?: LookupValue | null;
  lookupWith?: DatabaseConnection | null;
  alerts?: readonly RootAlert[];
  draft?: FormState | null;
  fallbacks?: readonly LauncherCommand[];
}

const boardTerms = (board: Board) => [board.name];

const draftTerms = (draft: FormState) => [
  "New Connection",
  draft.name,
  draft.host,
];

const commandItem = (command: LauncherCommand): RootItem => ({
  command,
  id: command.id,
  kind: "command",
});

const recentItems = (recents: readonly RecentAsk[]): RootItem[] =>
  recents.slice(0, RECENTS_SHOWN).map((ask) => ({
    ask,
    id: recentItemId(ask.id),
    kind: "recent",
  }));

const alertItems = (alerts: readonly RootAlert[]): RootItem[] =>
  alerts.map((alert) => ({
    alert,
    id: alertItemId(alert.watchId),
    kind: "alert",
  }));

const lookupSection = (
  origin: LookupOrigin,
  value: LookupValue | null,
  connection: DatabaseConnection | null
): RootSection | null => {
  if (!(value && connection)) {
    return null;
  }
  const item: RootItem = {
    connection,
    id: LOOKUP_ITEM_IDS[origin],
    kind: "lookup",
    origin,
    value,
  };
  return origin === "typed"
    ? { id: "lookup", items: [item], label: "Look up" }
    : { id: "clipboard", items: [item], label: "From clipboard" };
};

const present = (sections: readonly (RootSection | null)[]): RootSection[] =>
  sections.filter((section): section is RootSection => section !== null);

// A bare number is more often a search than an id, so it follows the Ask row.
const leadingSections = (
  ask: RootSection | null,
  typed: RootSection | null,
  lookup: LookupValue | null
): RootSection[] =>
  present(lookup?.kind === "integer" ? [ask, typed] : [typed, ask]);

const restingSections = ({
  connections,
  commands,
  widgets = [],
  recents = [],
  boards = [],
  alerts = [],
}: BuildRootSectionsInput): RootSection[] =>
  [
    { id: "alerts", items: alertItems(alerts), label: "Alerts" },
    { id: "recent", items: recentItems(recents), label: "Recent" },
    {
      id: "widgets",
      items: widgets.map((widget) => widgetItem(widget)),
      label: "Widgets",
    },
    {
      id: "boards",
      items: boards.map((board) => boardItem(board)),
      label: "Boards",
    },
    {
      id: "connections",
      items: rankConnections(connections, "").map(({ item }) =>
        connectionItem(item)
      ),
      label: "Connections",
    },
    { id: "commands", items: commands.map(commandItem), label: "Commands" },
  ].filter((section): section is RootSection => section.items.length > 0);

const widgetItem = (widget: Widget): RootItem => ({
  id: widgetItemId(widget.id),
  kind: "widget",
  widget,
});

const boardItem = (board: Board): RootItem => ({
  board,
  id: boardItemId(board.id),
  kind: "board",
});

const connectionItem = (connection: DatabaseConnection): RootItem => ({
  connection,
  id: connection.id,
  kind: "connection",
});

const draftItem = (draft: FormState): RootItem => ({
  draft,
  id: DRAFT_ITEM_ID,
  kind: "draft",
});

const scoredAs = <T>(
  ranked: readonly Ranked<T>[],
  toItem: (item: T) => RootItem
): Ranked<RootItem>[] =>
  ranked.map(({ item, score }) => ({ item: toItem(item), score }));

const typedResults = (
  prompt: string,
  {
    connections,
    commands,
    widgets = [],
    boards = [],
    draft = null,
  }: BuildRootSectionsInput
): RootItem[] =>
  rankRootItems([
    ...scoredAs(rankWidgets(widgets, prompt), widgetItem),
    ...scoredAs(rankByTerms(boards, prompt, boardTerms), boardItem),
    ...scoredAs(rankConnections(connections, prompt), connectionItem),
    ...scoredAs(rankCommands(commands, prompt), commandItem),
    ...scoredAs(
      rankByTerms(draft ? [draft] : [], prompt, draftTerms),
      draftItem
    ),
  ]);

const fallbackSection = (
  prompt: string,
  fallbacks: readonly LauncherCommand[]
): RootSection | null =>
  fallbacks.length > 0
    ? {
        id: "fallbacks",
        items: fallbacks.map(commandItem),
        label: `Use “${prompt}” with…`,
      }
    : null;

// Typed text keeps Ask (and Look up) first so ↵ always asks; everything else
// that matched is one list ranked across kinds, then the fallbacks.
export const buildRootSections = (
  input: BuildRootSectionsInput
): RootSection[] => {
  const {
    query,
    aiSetup,
    askWith = null,
    lookup = null,
    offer = null,
    lookupWith = null,
    draft = null,
    fallbacks = [],
  } = input;
  const prompt = query.trim();
  const typed = lookupSection("typed", lookup, lookupWith);

  if (!prompt) {
    const drafts: RootSection | null = draft
      ? { id: "drafts", items: [draftItem(draft)], label: "Drafts" }
      : null;
    return [
      ...present([
        drafts,
        typed,
        lookupSection("clipboard", offer, lookupWith),
      ]),
      ...restingSections(input),
    ];
  }

  const results = typedResults(prompt, input);
  const resultsSection: RootSection | null =
    results.length > 0
      ? { id: "results", items: results, label: "Results" }
      : null;
  const nothingMatched = !results.some((item) => item.kind !== "draft");
  const leading: RootSection | null =
    nothingMatched && aiSetup
      ? { id: "ask", items: [commandItem(aiSetup)], label: "Ask" }
      : askSection(prompt, askWith);
  return [
    ...leadingSections(leading, typed, lookup),
    ...present([resultsSection, fallbackSection(prompt, fallbacks)]),
  ];
};

const askSection = (
  prompt: string,
  askWith: DatabaseConnection | null
): RootSection | null =>
  askWith
    ? {
        id: "ask",
        items: [{ connection: askWith, id: ASK_ITEM_ID, kind: "ask", prompt }],
        label: "Ask",
      }
    : null;

// The recent row for the answer still in memory: ↵ shows it instead of asking again.
export const isShownAnswer = (
  item: RootItem,
  lastAnswerId: string | null | undefined
): boolean =>
  item.kind === "recent" &&
  Boolean(lastAnswerId) &&
  item.ask.id === lastAnswerId;

export const flattenSections = (sections: readonly RootSection[]): RootItem[] =>
  sections.flatMap((section) => section.items);
