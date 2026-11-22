import { useCallback, useEffect, useMemo, useState } from "react";

import type { ActionDraft, McpToolSummary } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { listMcpTools } from "@/lib/ipc";

import type { EditorDefaults, EditorState } from "./action-draft-model";

import {
  checkDraft,
  editorFromDraft,
  emptyEditor,
  withDefaults,
} from "./action-draft-model";

const NO_TOOLS: McpToolSummary[] = [];

const useServerTools = (serverId: string, active: boolean) => {
  const [tools, setTools] = useState<{
    serverId: string;
    list: McpToolSummary[];
  }>({ list: NO_TOOLS, serverId: "" });
  useEffect(() => {
    if (!(active && serverId)) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listMcpTools(serverId);
        if (!cancelled) {
          setTools({ list, serverId });
        }
      } catch (error) {
        console.error("[actions] could not list tools", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [active, serverId]);
  return tools.serverId === serverId ? tools.list : NO_TOOLS;
};

interface ActionDraftOptions {
  draft: ActionDraft | null;
  defaults: EditorDefaults;
  columns: readonly string[];
}

// The editor's working state: what the fields hold, the draft they make,
// the first problem, and how many times a suggestion filled them.
export const useActionDraft = ({
  draft,
  defaults,
  columns,
}: ActionDraftOptions) => {
  const { state: connections } = useConnections();
  const [base, setState] = useState<EditorState>(() =>
    draft ? editorFromDraft(draft, defaults) : emptyEditor(defaults)
  );
  const state = useMemo(() => withDefaults(base, defaults), [base, defaults]);
  const [filled, setFilled] = useState(0);
  const tools = useServerTools(state.mcp.serverId, state.kind === "mcp");
  const check = useMemo(
    () => checkDraft(state, connections.connections, columns),
    [columns, connections.connections, state]
  );

  const update = useCallback(
    (change: (current: EditorState) => EditorState) => setState(change),
    []
  );
  const fill = useCallback(
    (proposed: ActionDraft) => {
      setState((current) => ({
        ...editorFromDraft(proposed, defaults),
        id: current.id,
      }));
      setFilled((count) => count + 1);
    },
    [defaults]
  );

  return { check, fill, filled, state, tools, update };
};

export type ActionDraftSession = ReturnType<typeof useActionDraft>;
