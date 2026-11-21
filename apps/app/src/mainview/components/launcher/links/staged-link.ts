import type { DatabaseConnection } from "@/lib/connections";
import type { LauncherNavigateView } from "@/lib/ipc";

export type StagedLink =
  | { kind: "ask"; nonce: number; prompt: string; connection: string | null }
  | {
      kind: "widget-args";
      nonce: number;
      widgetId: string;
      values: Record<string, string>;
    }
  | { kind: "notice"; nonce: number; message: string };

export interface StagedLinkControls {
  staged: StagedLink | null;
  onDone: () => void;
}

const ignore = (): undefined => undefined;

export const NO_STAGED_LINK: StagedLinkControls = {
  onDone: ignore,
  staged: null,
};

export const MISSING_WIDGET = "That widget no longer exists.";

export const stagedLinkOf = (
  view: LauncherNavigateView,
  nonce: number
): StagedLink | null => {
  if (typeof view !== "object") {
    return null;
  }
  switch (view.kind) {
    case "ask-draft": {
      return {
        connection: view.connection,
        kind: "ask",
        nonce,
        prompt: view.prompt,
      };
    }
    case "widget-args": {
      return {
        kind: "widget-args",
        nonce,
        values: view.values,
        widgetId: view.widgetId,
      };
    }
    case "notice": {
      return { kind: "notice", message: view.message, nonce };
    }
    default: {
      return null;
    }
  }
};

export interface LinkConnection {
  connection: DatabaseConnection | null;
  problem: string | null;
}

// A link names a connection by id (this machine) or by name (a colleague's
// link, where ids differ). A name only counts when exactly one matches.
export const resolveLinkConnection = (
  raw: string | null,
  connections: readonly DatabaseConnection[]
): LinkConnection => {
  if (raw === null) {
    return { connection: null, problem: null };
  }
  const byId = connections.find((connection) => connection.id === raw);
  if (byId) {
    return { connection: byId, problem: null };
  }
  const name = raw.toLowerCase();
  const named = connections.filter(
    (connection) => connection.name.toLowerCase() === name
  );
  const [only] = named;
  if (named.length === 1 && only) {
    return { connection: only, problem: null };
  }
  return {
    connection: null,
    problem:
      named.length > 1
        ? `More than one connection is named “${raw}”`
        : `No connection named “${raw}”`,
  };
};

export const linkAnnouncement = (
  prompt: string,
  connection: DatabaseConnection | null
): string =>
  connection
    ? `From a link: ask ${connection.name} “${prompt}”. Press Return to ask.`
    : `From a link: “${prompt}”.`;
