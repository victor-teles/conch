import { SwapText } from "@/components/motion/swap-text";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { cn } from "@/lib/utils";

import type { EditorPhase } from "./editor-phase";

import { isBusy, phaseText, phaseTone } from "./editor-phase";

const TONES = {
  error: "text-danger-ink",
  muted: "text-panel-muted",
  ok: "text-success-ink",
} as const;

// A busy phase shorter than 150 ms never shows; a shown one stays 300 ms.
export function TestStatus({ phase }: { phase: EditorPhase }) {
  const busyVisible = useDelayedVisibility(isBusy(phase));
  const text = isBusy(phase) && !busyVisible ? null : phaseText(phase);
  return (
    <p
      aria-live="polite"
      className={cn("min-h-5 px-4 type-meta", TONES[phaseTone(phase)])}
      data-testid="source-test-status"
    >
      {text ? <SwapText value={text} /> : null}
    </p>
  );
}
