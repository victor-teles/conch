import type { LucideIcon } from "lucide-react";

import {
  ArrowLeftRightIcon,
  DownloadIcon,
  EyeOffIcon,
  HistoryIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SquareTerminalIcon,
  TableIcon,
  UploadIcon,
} from "lucide-react";

import type { Ranked } from "@/lib/fuzzy-match";

import { rankByTerms } from "@/lib/fuzzy-match";

import { SQL_PREFIX } from "./input-mode";

export interface LauncherCommand {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actionLabel: string;
  shortcut?: readonly string[];
  keywords?: readonly string[];
  prefix?: string;
  run: () => void;
}

interface RootCommandHandlers {
  addConnection: () => void;
  newBoard: () => void;
  openHistory: () => void;
  openSettings: () => void;
  exportAll: () => void;
  openImport: () => void;
  dismiss: () => void;
  startMode: (prefix: string) => void;
}

export const rootCommands = ({
  addConnection,
  newBoard,
  openHistory,
  openSettings,
  exportAll,
  openImport,
  dismiss,
  startMode,
}: RootCommandHandlers): LauncherCommand[] => [
  {
    actionLabel: "Add",
    icon: PlusIcon,
    id: "add-connection",
    keywords: ["new", "database", "connect", "postgres", "mysql", "sqlite"],
    run: addConnection,
    subtitle: "PostgreSQL, MySQL, SQLite and more",
    title: "Add Connection",
  },
  {
    actionLabel: "Create",
    icon: LayoutGridIcon,
    id: "new-board",
    keywords: ["board", "dashboard", "grid", "tiles"],
    run: newBoard,
    subtitle: "A live grid of widgets with shared inputs",
    title: "New Board",
  },
  {
    actionLabel: "Start",
    icon: SquareTerminalIcon,
    id: "run-sql",
    keywords: ["sql", "query", "select", "raw"],
    prefix: ">",
    run: () => startMode(SQL_PREFIX),
    subtitle: "Read-only, without the AI",
    title: "Run SQL",
  },
  {
    actionLabel: "Start",
    icon: TableIcon,
    id: "browse-tables",
    keywords: ["table", "schema", "columns", "peek"],
    prefix: "#",
    run: () => startMode("#"),
    subtitle: "Columns, keys and a row preview",
    title: "Browse Tables",
  },
  {
    actionLabel: "Start",
    icon: ArrowLeftRightIcon,
    id: "switch-connection",
    keywords: ["connection", "database", "use", "change"],
    prefix: "@",
    run: () => startMode("@"),
    subtitle: "Ask or browse another database",
    title: "Switch Connection",
  },
  {
    actionLabel: "Open",
    icon: HistoryIcon,
    id: "history",
    keywords: ["history", "recent", "past", "asks"],
    run: openHistory,
    shortcut: ["⌘", "Y"],
    subtitle: "Every question you've asked",
    title: "Search History",
  },
  {
    actionLabel: "Open",
    icon: SlidersHorizontalIcon,
    id: "settings",
    keywords: ["preferences", "hotkey", "theme", "appearance", "ai", "model"],
    run: openSettings,
    shortcut: ["⌘", ","],
    subtitle: "AI provider, hotkey and appearance",
    title: "Settings",
  },
  {
    actionLabel: "Export",
    icon: DownloadIcon,
    id: "export-bundle",
    keywords: ["share", "backup", "save", "file", "json"],
    run: exportAll,
    subtitle: "Saves a .conch.json to Downloads",
    title: "Export Widgets and Boards",
  },
  {
    actionLabel: "Import",
    icon: UploadIcon,
    id: "import-bundle",
    keywords: ["share", "restore", "load", "file", "json", "clipboard"],
    run: openImport,
    subtitle: "From the clipboard or a .conch.json file",
    title: "Import Widgets and Boards…",
  },
  {
    actionLabel: "Hide",
    icon: EyeOffIcon,
    id: "hide",
    keywords: ["close", "dismiss"],
    run: dismiss,
    shortcut: ["esc"],
    subtitle: "Return to what you were doing",
    title: "Hide Launcher",
  },
];

interface FallbackHandlers {
  searchHistory: (query: string) => void;
  findTable: ((query: string) => void) | null;
}

// Where a query that matched nothing (or not enough) can still go.
export const fallbackCommands = (
  query: string,
  { searchHistory, findTable }: FallbackHandlers
): LauncherCommand[] => {
  const text = query.trim();
  if (!text) {
    return [];
  }
  const history: LauncherCommand = {
    actionLabel: "Search",
    icon: HistoryIcon,
    id: "fallback-history",
    run: () => searchHistory(text),
    subtitle: "Past asks that mention it",
    title: "Search History",
  };
  return findTable
    ? [
        history,
        {
          actionLabel: "Find",
          icon: TableIcon,
          id: "fallback-table",
          run: () => findTable(text),
          subtitle: "Tables in the active connection",
          title: "Find Table",
        },
      ]
    : [history];
};

export const aiSetupCommand = (openSettings: () => void): LauncherCommand => ({
  actionLabel: "Open Settings",
  icon: KeyRoundIcon,
  id: "ai-setup",
  run: openSettings,
  subtitle: "Questions need a model to answer them",
  title: "Set up an AI provider to ask questions →",
});

const termsOf = (command: LauncherCommand) => [
  command.title,
  ...(command.keywords ?? []),
];

export const rankCommands = (
  commands: readonly LauncherCommand[],
  query: string
): Ranked<LauncherCommand>[] => rankByTerms(commands, query, termsOf);

export const filterCommands = (
  commands: readonly LauncherCommand[],
  query: string
): LauncherCommand[] =>
  rankCommands(commands, query).map((entry) => entry.item);
