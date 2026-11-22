import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { ActionPreview, MiniAppActionRequest } from "@/lib/ipc";

import { ActionSheetLayer } from "@/components/actions/action-sheet-layer";
import { SHEET_MIN_HEIGHT } from "@/components/actions/confirm-sheet/confirm-sheet";
import { useActionRun } from "@/components/actions/use-action-run";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { getErrorMessage } from "@/lib/error-message";
import {
  discardActionToken,
  executeAction,
  prepareMiniAppAction,
} from "@/lib/ipc";

import { HeldLink } from "./held-link";

interface MiniAppActionViewProps {
  request: MiniAppActionRequest;
  onBack: () => void;
}

const discard = async (token: string) => {
  try {
    await discardActionToken(token);
  } catch {
    // tokens expire on their own
  }
};

const readyPreview = (preview: ActionPreview): Promise<ActionPreview> => {
  const ready = preview;
  return Promise.resolve(ready);
};

const linkOf = (preview: ActionPreview): string =>
  preview.compiled.kind === "open-url" ? preview.compiled.url : preview.label;

// An app window only stages an action; it is prepared, confirmed and run
// here in the launcher. A write stops at 019's sheet, and anything that
// leaves Conch waits for ↵ here, so a window alone can't open a link.
export function MiniAppActionView({ request, onBack }: MiniAppActionViewProps) {
  const [notice, setNotice] = useState("Preparing…");
  const [held, setHeld] = useState<ActionPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const actionRun = useActionRun(setNotice);
  const { run, state } = actionRun;
  const started = useRef(false);

  const begin = useEffectEvent(async () => {
    let preview: ActionPreview;
    try {
      preview = await prepareMiniAppAction(request);
    } catch (error) {
      setProblem(getErrorMessage(error, "The action could not be prepared."));
      return;
    }
    if (preview.effect === "external") {
      setHeld(preview);
      setNotice(`Press ↵ to open ${linkOf(preview)}`);
      return;
    }
    run(preview.label, () => readyPreview(preview));
  });

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    begin();
  }, []);

  const openHeld = useCallback(async () => {
    if (!held) {
      return;
    }
    setHeld(null);
    try {
      const outcome = await executeAction(held.token);
      setNotice(outcome.ok ? outcome.summary : outcome.message);
    } catch (error) {
      setNotice(getErrorMessage(error, "The action could not run."));
    }
  }, [held]);

  const leave = useCallback(() => {
    if (held) {
      discard(held.token);
    }
    onBack();
  }, [held, onBack]);

  const label =
    held?.label ??
    ("preview" in state && state.preview ? state.preview.label : "Run action");
  const failure =
    problem ??
    (state.phase === "failed" && state.preview === null
      ? state.failure.message
      : null);
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{ minHeight: SHEET_MIN_HEIGHT }}
    >
      <ViewHeader onBack={leave} title={label} />
      <div className="relative min-h-0 flex-1 launcher-body px-4">
        {failure ? (
          <p className="type-body text-foreground" role="alert">
            {failure}
          </p>
        ) : null}
        {held ? (
          <HeldLink onCancel={leave} onOpen={openHeld} url={linkOf(held)} />
        ) : null}
        <ActionSheetLayer onClosed={onBack} run={actionRun} />
      </div>
      <LauncherFooter
        actionKeys={held ? ["↩"] : undefined}
        actionLabel={held ? "Open" : null}
        status={<span role="status">{notice}</span>}
      />
    </div>
  );
}
