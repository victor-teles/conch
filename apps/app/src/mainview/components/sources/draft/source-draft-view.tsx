import { PlugIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useRef, useState } from "react";

import type { SourceTarget } from "@/lib/ipc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { SwapText } from "@/components/motion/swap-text";
import { NameField } from "@/components/widgets/name-field";

import { DraftHeader } from "./draft-header";
import { DraftInputs } from "./draft-inputs";
import { DraftPreview } from "./draft-preview";
import { HttpCallFields } from "./http-call-fields";
import { McpCallFields } from "./mcp-call-fields";
import { useSourceDraft } from "./use-source-draft";
import { useSourceDraftHotkeys } from "./use-source-draft-hotkeys";

interface SourceDraftViewProps {
  target: SourceTarget;
  onBack: () => void;
  onRun: (widgetId: string) => void;
}

export function SourceDraftView({ target, onRun }: SourceDraftViewProps) {
  const draft = useSourceDraft(target);
  const [naming, setNaming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    fields,
    edit,
    filled,
    preview,
    saved,
    setDescription: handleDescription,
    propose: handlePropose,
    setParams: handleParams,
    runPreview: handlePreview,
  } = draft;
  const ready = preview.status === "ready";

  const startSave = useCallback(() => {
    if (!ready) {
      setSaveError("Preview the widget before saving it.");
      return;
    }
    setSaveError(null);
    setNaming(true);
  }, [ready]);
  const confirmName = useCallback(
    async (name: string) => {
      setNaming(false);
      inputRef.current?.focus();
      setSaveError(await draft.save(name));
    },
    [draft]
  );
  const closeName = useCallback(() => {
    setNaming(false);
    inputRef.current?.focus();
  }, []);
  const runSaved = saved ? () => onRun(saved.id) : null;
  const handleKeyDown = useSourceDraftHotkeys({
    onPreview: handlePreview,
    onRun: runSaved,
    onSave: startSave,
  });

  const footerStatus = saved
    ? "Saved · ⌥↵ to run"
    : (saveError ??
      draft.problem ??
      (target.type === "mcp" ? "MCP widget" : "HTTP widget"));
  const initialName = ready
    ? preview.outcome.spec.title.slice(0, 60)
    : draft.description.slice(0, 60);

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <DraftHeader
        inputRef={inputRef}
        description={draft.description}
        kind={target.type}
        onDescription={handleDescription}
        onPropose={handlePropose}
        proposal={draft.proposal}
      />
      <AnimatePresence initial={false}>
        {naming ? (
          <NameField
            initial={initialName || "Untitled widget"}
            label="Name"
            onCancel={closeName}
            onConfirm={confirmName}
          />
        ) : null}
      </AnimatePresence>
      <div className="flex min-h-0 flex-1 launcher-body flex-col overflow-y-auto border-t border-panel-border pt-1.5">
        {fields.kind === "mcp" ? (
          <McpCallFields
            fields={fields}
            filled={filled}
            onChange={edit}
            tools={draft.tools}
          />
        ) : (
          <HttpCallFields fields={fields} filled={filled} onChange={edit} />
        )}
        <DraftInputs onChange={handleParams} params={draft.params} />
        <DraftPreview onRetry={handlePreview} preview={preview} />
      </div>
      <LauncherFooter
        actionKeys={["⌘", "↵"]}
        actionLabel="Preview"
        hints={[{ disabled: !ready, keys: ["⌘", "S"], label: "Save" }]}
        status={
          <span className="flex min-w-0 items-center gap-1.5 type-meta">
            <PlugIcon aria-hidden className="size-3.5 shrink-0 opacity-80" />
            <SwapText className="truncate" value={footerStatus} />
          </span>
        }
      />
    </div>
  );
}
