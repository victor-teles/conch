import { sourceParamProblems } from "@conch/rpc";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  McpToolSummary,
  ParamDef,
  SourcePreviewResult,
  SourceTarget,
  Widget,
} from "@/lib/ipc";

import { useWidgets } from "@/components/widgets/widgets-provider";
import { viewKindOf } from "@/lib/card-data";
import { getErrorMessage } from "@/lib/error-message";
import {
  cancelWidgetRun,
  listMcpTools,
  previewSource,
  proposeSourceWidget,
} from "@/lib/ipc";

import type { CallFields } from "./draft-model";

import { buildSource, emptyFields, fieldsOf } from "./draft-model";

const CHOOSING_AFTER_MS = 700;

export type ProposalState =
  | { status: "idle" }
  | { status: "proposing"; step: "reading" | "choosing" }
  | { status: "error"; message: string };

export type PreviewState =
  | { status: "idle" }
  | { status: "loading"; previous: SourcePreviewResult | null }
  | { status: "ready"; outcome: SourcePreviewResult }
  | { status: "error"; message: string };

export type ToolOptions =
  | { status: "loading" }
  | { status: "ready"; tools: McpToolSummary[] }
  | { status: "error"; message: string };

// The card to show while a preview runs: the last one, dimmed.
export const previousOutcome = (
  preview: PreviewState
): SourcePreviewResult | null => {
  if (preview.status === "ready") {
    return preview.outcome;
  }
  return preview.status === "loading" ? preview.previous : null;
};

const useReadTools = (target: SourceTarget): ToolOptions => {
  const [tools, setTools] = useState<ToolOptions>({ status: "loading" });
  useEffect(() => {
    if (target.type !== "mcp") {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const listed = await listMcpTools(target.id);
        if (!cancelled) {
          setTools({
            status: "ready",
            tools: listed.filter((tool) => tool.readEligible),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTools({
            message: getErrorMessage(error, "The tools could not load."),
            status: "error",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [target.id, target.type]);
  return tools;
};

export const useSourceDraft = (target: SourceTarget) => {
  const { save: saveWidget, markFresh } = useWidgets();
  const tools = useReadTools(target);
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<CallFields>(() => emptyFields(target));
  const [params, setParams] = useState<ParamDef[]>([]);
  const [proposal, setProposal] = useState<ProposalState>({ status: "idle" });
  const [filled, setFilled] = useState(0);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [saved, setSaved] = useState<Widget | null>(null);
  const runId = useRef<string | null>(null);

  const built = buildSource(target, fields);
  const problem = built.ok
    ? (sourceParamProblems({ params, source: built.source })[0] ?? null)
    : built.message;

  useEffect(() => {
    if (proposal.status !== "proposing" || proposal.step !== "reading") {
      return;
    }
    const timer = window.setTimeout(
      () => setProposal({ status: "proposing", step: "choosing" }),
      CHOOSING_AFTER_MS
    );
    return () => window.clearTimeout(timer);
  }, [proposal]);

  useEffect(
    () => () => {
      if (runId.current) {
        cancelWidgetRun(runId.current);
      }
    },
    []
  );

  const edit = useCallback((next: CallFields) => {
    setFields(next);
    setSaved(null);
  }, []);

  const propose = useCallback(async () => {
    if (!description.trim() || proposal.status === "proposing") {
      return;
    }
    setProposal({ status: "proposing", step: "reading" });
    try {
      const result = await proposeSourceWidget(target, description.trim());
      if ("error" in result) {
        setProposal({ message: result.error, status: "error" });
        return;
      }
      setFields(fieldsOf(result.draft.source));
      setParams(result.draft.params);
      setFilled((count) => count + 1);
      setSaved(null);
      setProposal({ status: "idle" });
    } catch (error) {
      setProposal({
        message: getErrorMessage(error, "No call could be proposed."),
        status: "error",
      });
    }
  }, [description, proposal.status, target]);

  const runPreview = useCallback(async () => {
    if (!built.ok || problem) {
      setPreview({
        message: problem ?? "The call isn't valid.",
        status: "error",
      });
      return;
    }
    const id = crypto.randomUUID();
    runId.current = id;
    setPreview((current) => ({
      previous: previousOutcome(current),
      status: "loading",
    }));
    try {
      const outcome = await previewSource({
        params,
        prompt: description,
        runId: id,
        source: built.source,
        values: {},
      });
      if (runId.current === id) {
        setPreview({ outcome, status: "ready" });
      }
    } catch (error) {
      if (runId.current === id) {
        setPreview({
          message: getErrorMessage(error, "The preview failed."),
          status: "error",
        });
      }
    } finally {
      if (runId.current === id) {
        runId.current = null;
      }
    }
  }, [built, description, params, problem]);

  const save = useCallback(
    async (name: string): Promise<string | null> => {
      if (!(built.ok && preview.status === "ready")) {
        return "Preview the widget before saving it.";
      }
      const { spec } = preview.outcome;
      try {
        const widget = await saveWidget({
          lastValues: {},
          name,
          params,
          prompt: description,
          source: built.source,
          spec,
          view: viewKindOf(spec.view),
        });
        markFresh(widget.id);
        setSaved(widget);
        return null;
      } catch (error) {
        return getErrorMessage(error, "The widget could not be saved.");
      }
    },
    [built, description, markFresh, params, preview, saveWidget]
  );

  return {
    description,
    edit,
    fields,
    filled,
    params,
    preview,
    problem,
    proposal,
    propose,
    runPreview,
    save,
    saved,
    setDescription,
    setParams,
    tools,
  };
};

export type SourceDraft = ReturnType<typeof useSourceDraft>;
