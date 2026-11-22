import { useCallback, useState } from "react";

import type { McpToolSummary, RedactedMcpServer } from "@/lib/ipc";

import { useSources } from "@/components/sources/sources-provider";
import { getErrorMessage } from "@/lib/error-message";
import {
  deleteMcpServer,
  listMcpTools,
  saveMcpServer,
  setMcpToolRead,
  testMcpServer,
} from "@/lib/ipc";

import type { EditorPhase } from "./editor-phase";
import type { McpFormState } from "./mcp-form";
import type { ToolsState } from "./tool-list";

import { IDLE, isBusy } from "./editor-phase";
import { mcpFormOf, mcpFormProblem, mcpInputOf } from "./mcp-form";

const withRead = (tool: McpToolSummary, read: boolean): McpToolSummary => ({
  ...tool,
  markedRead: read,
  readEligible: read || tool.readOnlyHint === true,
});

export const useMcpServerEditor = (serverId: string | null) => {
  const { state, putServer, dropServer } = useSources();
  const existing =
    state.status === "ready"
      ? (state.servers.find((server) => server.id === serverId) ?? null)
      : null;
  const [form, setForm] = useState<McpFormState>(() => mcpFormOf(existing));
  const [savedId, setSavedId] = useState(serverId);
  const [dirty, setDirty] = useState(serverId === null);
  const [phase, setPhase] = useState<EditorPhase>(IDLE);
  const [tools, setTools] = useState<ToolsState>({ status: "idle" });

  const change = useCallback((patch: Partial<McpFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<RedactedMcpServer | null> => {
    const problem = mcpFormProblem(form);
    if (problem) {
      setPhase({ kind: "failed", message: problem });
      return null;
    }
    setPhase({ kind: "saving" });
    try {
      const saved = await saveMcpServer(mcpInputOf(form, savedId));
      if (!saved) {
        setPhase({ kind: "declined" });
        return null;
      }
      putServer(saved);
      setSavedId(saved.id);
      setDirty(false);
      setPhase({ kind: "saved" });
      return saved;
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The server could not be saved."),
      });
      return null;
    }
  }, [form, putServer, savedId]);

  const test = useCallback(async () => {
    if (isBusy(phase)) {
      return;
    }
    const server = dirty || !savedId ? await save() : existing;
    const id = server?.id ?? savedId;
    if (!(server && id)) {
      return;
    }
    setPhase({ kind: "testing" });
    try {
      const result = await testMcpServer(id);
      setPhase({ kind: "tested", result });
      putServer({ ...server, lastTest: result });
      if (!result.ok) {
        setTools({ status: "idle" });
        return;
      }
      setTools({ status: "loading" });
      setTools({
        pending: null,
        status: "ready",
        tools: await listMcpTools(id),
      });
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The test could not run."),
      });
      setTools({ status: "idle" });
    }
  }, [dirty, existing, phase, putServer, save, savedId]);

  const toggleRead = useCallback(
    async (tool: McpToolSummary) => {
      if (!savedId || tools.status !== "ready" || tools.pending) {
        return;
      }
      const read = !tool.markedRead;
      setTools({ ...tools, pending: tool.name });
      try {
        const server = await setMcpToolRead({
          read,
          serverId: savedId,
          tool: tool.name,
        });
        if (server) {
          putServer(server);
        }
        setTools((current) =>
          current.status === "ready"
            ? {
                pending: null,
                status: "ready",
                tools: server
                  ? current.tools.map((item) =>
                      item.name === tool.name ? withRead(item, read) : item
                    )
                  : current.tools,
              }
            : current
        );
      } catch (error) {
        setTools((current) =>
          current.status === "ready" ? { ...current, pending: null } : current
        );
        setPhase({
          kind: "failed",
          message: getErrorMessage(error, "The tool could not be updated."),
        });
      }
    },
    [putServer, savedId, tools]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (!savedId) {
      return true;
    }
    try {
      await deleteMcpServer(savedId);
      dropServer(savedId);
      return true;
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The server could not be removed."),
      });
      return false;
    }
  }, [dropServer, savedId]);

  return {
    change,
    form,
    phase,
    remove,
    save,
    savedId,
    test,
    toggleRead,
    tools,
  };
};

export type McpServerEditor = ReturnType<typeof useMcpServerEditor>;
