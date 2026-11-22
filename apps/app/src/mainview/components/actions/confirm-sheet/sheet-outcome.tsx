import type { ActionOutcome } from "@/lib/ipc";

import { ErrorNotice } from "@/components/ask/error-notice";
import { CheckDraw } from "@/components/motion/check-draw";
import { Reveal } from "@/components/motion/reveal";

export const outcomeText = (outcome: ActionOutcome): string =>
  outcome.ok
    ? `${outcome.summary} · ${outcome.durationMs} ms`
    : `${outcome.message} (${outcome.code})`;

export const outcomeAnnouncement = (outcome: ActionOutcome): string =>
  outcome.ok
    ? `Write completed: ${outcome.summary}`
    : `Write failed: ${outcome.message}`;

export function SheetOutcome({ outcome }: { outcome: ActionOutcome }) {
  if (!outcome.ok) {
    return (
      <ErrorNotice
        action={null}
        detail={outcome.code}
        title={outcome.message}
      />
    );
  }
  return (
    <Reveal className="flex items-center gap-2 px-1 py-3 type-body text-foreground">
      <CheckDraw className="size-4" label="Done" />
      <span>{outcomeText(outcome)}</span>
    </Reveal>
  );
}
