import { useCallback, useMemo, useState } from "react";

import type { MiniApp, MiniAppDraft } from "@/lib/ipc";

import { useMiniApps } from "@/components/mini-app/mini-apps-provider";
import { PromptField } from "@/components/mini-app/prompt-field";
import { useMiniAppRecord } from "@/components/mini-app/use-mini-app-record";
import { openMiniApp } from "@/lib/ipc";

import type { GenerateTarget } from "./generate-target";

import { GenerateSession } from "./generate-session";

interface MiniAppGenerateViewProps {
  target: GenerateTarget;
  onOpenSettings: () => void;
  onDone: () => void;
}

export function MiniAppGenerateView({
  target,
  onOpenSettings,
  onDone,
}: MiniAppGenerateViewProps) {
  const [prompt, setPrompt] = useState(target.prompt);
  const { record } = useMiniAppRecord(target.baseAppId);
  const { refresh } = useMiniApps();
  const handleOpen = useCallback(
    async (app: MiniApp) => {
      try {
        await openMiniApp(app.id);
        onDone();
      } catch (error) {
        console.error("[apps] could not open the app", error);
      }
    },
    [onDone]
  );
  const handlers = useMemo(
    () => ({ onOpen: handleOpen, onOpenSettings, onSaved: refresh }),
    [handleOpen, onOpenSettings, refresh]
  );
  const base: MiniAppDraft | null =
    record.status === "ready" ? record.draft : null;
  const request = useMemo(
    () => ({
      base,
      baseAppId: target.baseAppId,
      connectionId: target.connectionId,
      database: null,
      prompt,
    }),
    [base, prompt, target.baseAppId, target.connectionId]
  );
  const waiting = target.baseAppId !== null && record.status !== "ready";
  const building = !waiting && prompt !== "";
  return (
    <div
      className="flex min-h-0 flex-col"
      style={building ? { height: "var(--panel-max-height)" } : undefined}
    >
      {waiting ? (
        <p className="px-4 pt-4 type-meta text-panel-muted" role="status">
          {record.status === "missing"
            ? "This app no longer exists."
            : "Opening the app…"}
        </p>
      ) : null}
      {!waiting && prompt === "" ? (
        <div className="flex flex-col gap-2 px-4 pt-4">
          <PromptField
            label={base ? `Change ${base.name}` : "Describe a tool"}
            onSubmit={setPrompt}
            placeholder="A refund desk: failed charges next to their orders…"
          />
        </div>
      ) : null}
      {!waiting && prompt !== "" ? (
        <GenerateSession handlers={handlers} key={prompt} request={request} />
      ) : null}
    </div>
  );
}
