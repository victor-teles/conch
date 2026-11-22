import type { ReactNode } from "react";

import { Trash2Icon } from "lucide-react";
import { useCallback } from "react";

import type { SourceEditTarget } from "@/components/launcher/use-launcher-stack";

import { WriteToggleRow } from "@/components/actions/write-toggle-row";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useSources } from "@/components/sources/sources-provider";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { useArmedConfirm } from "@/hooks/use-armed-confirm";
import { cn } from "@/lib/utils";

import { EDITOR_BUTTON } from "./editor-field";
import { HttpEndpointForm } from "./http-endpoint-form";
import { McpServerForm } from "./mcp-server-form";
import { useHttpEndpointEditor } from "./use-http-endpoint-editor";
import { useMcpServerEditor } from "./use-mcp-server-editor";
import { useSourceEditorHotkeys } from "./use-source-editor-hotkeys";

const HINTS = [
  { keys: ["⌘", "T"], label: "Test" },
  { keys: ["esc"], label: "Back" },
] as const;
const SAVE_KEYS = ["⌘", "S"] as const;

const usedByText = (count: number): string =>
  count === 0
    ? "Remove again to confirm"
    : `Used by ${count === 1 ? "1 widget" : `${count} widgets`} · remove again`;

interface RemoveButtonProps {
  usage: number;
  onRemove: () => Promise<boolean>;
  onRemoved: () => void;
}

function RemoveButton({ usage, onRemove, onRemoved }: RemoveButtonProps) {
  const { arm, armed, disarm } = useArmedConfirm();
  const handleClick = useCallback(async () => {
    if (!armed) {
      arm();
      return;
    }
    disarm();
    if (await onRemove()) {
      onRemoved();
    }
  }, [arm, armed, disarm, onRemove, onRemoved]);
  return (
    <Pressable
      className={cn(
        EDITOR_BUTTON,
        armed && "bg-destructive/15 text-danger-ink"
      )}
      onClick={handleClick}
    >
      <Trash2Icon aria-hidden className="size-3" />
      <SwapText value={armed ? usedByText(usage) : "Remove"} />
    </Pressable>
  );
}

interface EditorShellProps {
  title: string;
  savedId: string | null;
  usage: number;
  actions: {
    save: () => void;
    test: () => void;
    remove: () => Promise<boolean>;
  };
  onBack: () => void;
  children: ReactNode;
}

function EditorShell({
  title,
  savedId,
  usage,
  actions,
  onBack,
  children,
}: EditorShellProps) {
  const { remove, save, test } = actions;
  const handleKeyDown = useSourceEditorHotkeys({ onSave: save, onTest: test });
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleKeyDown}
      role="group"
      aria-label={title}
    >
      <ViewHeader onBack={onBack} title={title}>
        <Pressable className={EDITOR_BUTTON} onClick={test}>
          Test
        </Pressable>
        {savedId ? (
          <RemoveButton onRemove={remove} onRemoved={onBack} usage={usage} />
        ) : null}
      </ViewHeader>
      <div className="min-h-0 flex-1 launcher-body overflow-y-auto">
        {children}
      </div>
      <LauncherFooter
        actionKeys={SAVE_KEYS}
        actionLabel="Save"
        hints={HINTS}
        status={<span>Sources</span>}
      />
    </div>
  );
}

function McpEditor({ id, onBack }: { id: string | null; onBack: () => void }) {
  const editor = useMcpServerEditor(id);
  const { widgets } = useWidgets();
  const usage = widgets.filter(
    (widget) =>
      widget.source.kind === "mcp" && widget.source.serverId === editor.savedId
  ).length;
  return (
    <EditorShell
      actions={{ remove: editor.remove, save: editor.save, test: editor.test }}
      onBack={onBack}
      savedId={editor.savedId}
      title={id ? "Edit MCP Server" : "Add MCP Server"}
      usage={usage}
    >
      <McpServerForm editor={editor} />
      {editor.savedId ? (
        <WriteToggleRow id={editor.savedId} kind="mcp" />
      ) : null}
    </EditorShell>
  );
}

function HttpEditor({ id, onBack }: { id: string | null; onBack: () => void }) {
  const editor = useHttpEndpointEditor(id);
  const { widgets } = useWidgets();
  const usage = widgets.filter(
    (widget) =>
      widget.source.kind === "http" &&
      widget.source.endpointId === editor.savedId
  ).length;
  return (
    <EditorShell
      actions={{ remove: editor.remove, save: editor.save, test: editor.test }}
      onBack={onBack}
      savedId={editor.savedId}
      title={id ? "Edit HTTP Endpoint" : "Add HTTP Endpoint"}
      usage={usage}
    >
      <HttpEndpointForm editor={editor} />
      {editor.savedId ? (
        <WriteToggleRow id={editor.savedId} kind="http" />
      ) : null}
    </EditorShell>
  );
}

interface SourceEditViewProps {
  target: SourceEditTarget;
  onBack: () => void;
}

export function SourceEditView({ target, onBack }: SourceEditViewProps) {
  const { state } = useSources();
  if (state.status !== "ready") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ViewHeader onBack={onBack} title="Sources" />
        <p className="px-4 py-3 type-meta text-panel-muted" role="status">
          {state.status === "error" ? state.message : "Loading sources…"}
        </p>
      </div>
    );
  }
  return target.type === "mcp" ? (
    <McpEditor id={target.id} onBack={onBack} />
  ) : (
    <HttpEditor id={target.id} onBack={onBack} />
  );
}
