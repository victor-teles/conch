import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";

import type { ActionEditTarget } from "@/components/actions/action-targets";
import type { SegmentOption } from "@/components/ui/segmented-control";
import type {
  ActionDraft,
  ActionScope,
  ActionTargetKind,
  BindSource,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  Widget,
} from "@/lib/ipc";

import { announceActionsChanged } from "@/components/actions/actions-changed";
import { ErrorNotice } from "@/components/ask/error-notice";
import { useConnections } from "@/components/launcher/connections/connections-provider";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { SwapText } from "@/components/motion/swap-text";
import { FilledField } from "@/components/sources/draft/filled-field";
import { EditorField } from "@/components/sources/editor/editor-field";
import { useSources } from "@/components/sources/sources-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { getErrorMessage } from "@/lib/error-message";
import { saveAction } from "@/lib/ipc";
import { useMotionPreset } from "@/lib/motion";

import type { EditorDefaults } from "./action-draft-model";

import { bindableInputs, draftEffect } from "./action-draft-model";
import { BindingTable } from "./binding-table";
import { TargetFields } from "./target-fields";
import { TextField } from "./text-field";
import { useActionDraft } from "./use-action-draft";
import { useActionEditorHotkeys } from "./use-action-editor-hotkeys";
import { useActionSuggest } from "./use-action-suggest";

const SCOPES: SegmentOption<ActionScope>[] = [
  { label: "A row", value: "row" },
  { label: "The widget", value: "widget" },
];

const KINDS: SegmentOption<ActionTargetKind>[] = [
  { label: "SQL", value: "sql" },
  { label: "MCP", value: "mcp" },
  { label: "HTTP", value: "http" },
  { label: "Link", value: "open-url" },
  { label: "Copy", value: "copy" },
];

const SUBMIT_KEYS = ["⌘", "↩"] as const;
const NO_SERVERS: RedactedMcpServer[] = [];
const NO_ENDPOINTS: RedactedHttpEndpoint[] = [];

const submitLabel = (ready: boolean, writes: boolean): string | null => {
  if (!ready) {
    return null;
  }
  return writes ? "Review" : "Save";
};
const SUGGEST_HINT = [{ keys: ["⌘", "⇧", "S"], label: "Suggest" }] as const;

interface ActionEditViewProps {
  target: ActionEditTarget;
  onBack: () => void;
  onReview: (draft: ActionDraft) => void;
}

const defaultsFor = (
  widget: Widget | undefined,
  target: ActionEditTarget,
  ids: { connection: string; server: string; endpoint: string }
): EditorDefaults => ({
  connectionId:
    widget?.source.kind === "sql" ? widget.source.connectionId : ids.connection,
  endpointId: ids.endpoint,
  scope: target.columns.length > 0 ? "row" : "widget",
  serverId: ids.server,
});

const targetIdOf = (
  kind: ActionTargetKind,
  state: ReturnType<typeof useActionDraft>["state"]
): string => {
  if (kind === "sql") {
    return state.sql.connectionId;
  }
  return kind === "mcp" ? state.mcp.serverId : state.http.endpointId;
};

export function ActionEditView({
  target,
  onBack,
  onReview,
}: ActionEditViewProps) {
  const { widgets } = useWidgets();
  const { state: connections } = useConnections();
  const { state: sources } = useSources();
  const { soft } = useMotionPreset();
  const widget = widgets.find((item) => item.id === target.widgetId);
  const servers = sources.status === "ready" ? sources.servers : NO_SERVERS;
  const endpoints =
    sources.status === "ready" ? sources.endpoints : NO_ENDPOINTS;
  const defaults = useMemo(
    () =>
      defaultsFor(widget, target, {
        connection: connections.connections[0]?.id ?? "",
        endpoint: endpoints[0]?.id ?? "",
        server: servers[0]?.id ?? "",
      }),
    [connections.connections, endpoints, servers, target, widget]
  );
  const session = useActionDraft({
    columns: target.columns,
    defaults,
    draft: target.draft,
  });
  const { check, fill, filled, state, tools, update } = session;
  const suggestion = useActionSuggest(fill);
  const [saveError, setSaveError] = useState<string | null>(null);
  const writes = check.draft
    ? draftEffect(check.draft.target, tools) === "write"
    : false;

  const submit = useCallback(async () => {
    const { draft } = check;
    if (!draft) {
      return;
    }
    if (draftEffect(draft.target, tools) === "write") {
      onReview(draft);
      return;
    }
    try {
      await saveAction(target.widgetId, draft);
      announceActionsChanged(target.widgetId);
      onBack();
    } catch (error) {
      setSaveError(getErrorMessage(error, "The action could not be saved."));
    }
  }, [check, onBack, onReview, target.widgetId, tools]);

  const { suggest } = suggestion;
  const handleSuggest = useCallback(
    () =>
      suggest({
        kind: state.kind,
        prompt: state.label.trim() || "a useful action for this widget",
        scope: state.scope,
        targetId: targetIdOf(state.kind, state),
        widgetId: target.widgetId,
      }),
    [state, suggest, target.widgetId]
  );
  const handleKeyDown = useActionEditorHotkeys({
    onSubmit: submit,
    onSuggest: handleSuggest,
  });
  const setLabel = useCallback(
    (label: string) => update((current) => ({ ...current, label })),
    [update]
  );
  const setScope = useCallback(
    (scope: ActionScope) => update((current) => ({ ...current, scope })),
    [update]
  );
  const setKind = useCallback(
    (kind: ActionTargetKind) => update((current) => ({ ...current, kind })),
    [update]
  );
  const setBind = useCallback(
    (name: string, source: BindSource) =>
      update((current) => ({
        ...current,
        bind: { ...current.bind, [name]: source },
      })),
    [update]
  );

  const status =
    suggestion.state.status === "working"
      ? "Suggesting…"
      : (check.problem ?? "Ready");

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- ⌘↵ and ⌘⇧S work from any field
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <ViewHeader
        onBack={onBack}
        title={target.actionId ? "Edit Action" : "Add Action"}
      />
      <div className="min-h-0 flex-1 launcher-body overflow-y-auto pb-2">
        <FilledField filled={filled} index={0}>
          <EditorField label="Label">
            <TextField
              label="Label"
              onChange={setLabel}
              placeholder="Mark shipped"
              value={state.label}
            />
          </EditorField>
        </FilledField>
        <EditorField label="Acts on">
          <SegmentedControl
            label="Acts on"
            onChange={setScope}
            options={SCOPES}
            value={state.scope}
          />
        </EditorField>
        <EditorField label="Does">
          <SegmentedControl
            label="Target"
            onChange={setKind}
            options={KINDS}
            value={state.kind}
          />
        </EditorField>
        <motion.div layout transition={soft}>
          <FilledField filled={filled} index={1}>
            <TargetFields
              choices={{
                connections: connections.connections,
                endpoints,
                servers,
                tools,
              }}
              state={state}
              update={update}
            />
          </FilledField>
          <FilledField filled={filled} index={2}>
            <BindingTable
              bind={check.draft?.bind ?? state.bind}
              columns={target.columns}
              inputs={bindableInputs(widget?.params ?? [])}
              names={check.names}
              onChange={setBind}
              scope={state.scope}
            />
          </FilledField>
        </motion.div>
        {suggestion.state.status === "error" ? (
          <ErrorNotice
            action={null}
            detail={null}
            title={suggestion.state.message}
          />
        ) : null}
        {saveError ? (
          <ErrorNotice action={null} detail={null} title={saveError} />
        ) : null}
      </div>
      <LauncherFooter
        actionKeys={SUBMIT_KEYS}
        actionLabel={submitLabel(check.draft !== null, writes)}
        hints={SUGGEST_HINT}
        status={
          <span aria-live="polite" className="truncate">
            <SwapText value={status} />
          </span>
        }
      />
    </div>
  );
}
