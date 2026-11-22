import { useCallback, useState } from "react";

import type { ActionDraft, ProposeActionRequest } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { proposeAction } from "@/lib/ipc";

export type SuggestState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error"; message: string };

const SUGGESTED: Partial<
  Record<string, ProposeActionRequest["target"]["kind"]>
> = { http: "http", mcp: "mcp", sql: "sql" };

// The AI only fills the editor; bun asks natively before anything saves.
export const useActionSuggest = (onDraft: (draft: ActionDraft) => void) => {
  const [state, setState] = useState<SuggestState>({ status: "idle" });

  const suggest = useCallback(
    async (
      request: Omit<ProposeActionRequest, "target"> & {
        kind: string;
        targetId: string;
      }
    ) => {
      const kind = SUGGESTED[request.kind];
      if (!(kind && request.targetId)) {
        setState({
          message: "Suggestions work for SQL, MCP and HTTP actions.",
          status: "error",
        });
        return;
      }
      setState({ status: "working" });
      try {
        const proposal = await proposeAction({
          prompt: request.prompt,
          scope: request.scope,
          target: { id: request.targetId, kind },
          widgetId: request.widgetId,
        });
        if ("error" in proposal) {
          setState({ message: proposal.error, status: "error" });
          return;
        }
        onDraft(proposal.draft);
        setState({ status: "idle" });
      } catch (error) {
        setState({
          message: getErrorMessage(error, "No suggestion this time."),
          status: "error",
        });
      }
    },
    [onDraft]
  );

  return { state, suggest };
};
