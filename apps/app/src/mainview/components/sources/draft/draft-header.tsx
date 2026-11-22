import type { ChangeEvent, KeyboardEvent, RefObject } from "react";

import { AnimatePresence } from "motion/react";

import { LauncherInput } from "@/components/launcher/launcher-input";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { SwapText } from "@/components/motion/swap-text";

import type { ProposalState } from "./use-source-draft";

const STEPS = {
  choosing: "Choosing a call…",
  reading: "Reading tools…",
} as const;

interface DraftHeaderProps {
  inputRef: RefObject<HTMLInputElement | null>;
  kind: "mcp" | "http";
  description: string;
  proposal: ProposalState;
  onDescription: (description: string) => void;
  onPropose: () => void;
}

const statusOf = (proposal: ProposalState): string | null => {
  if (proposal.status === "proposing") {
    return STEPS[proposal.step];
  }
  return proposal.status === "error" ? proposal.message : null;
};

export function DraftHeader({
  inputRef,
  kind,
  description,
  proposal,
  onDescription,
  onPropose,
}: DraftHeaderProps) {
  const status = statusOf(proposal);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !(event.metaKey || event.altKey)) {
      event.preventDefault();
      onPropose();
    }
  };
  return (
    <div className="relative">
      <AnimatePresence>
        {proposal.status === "proposing" ? <ProgressHairline /> : null}
      </AnimatePresence>
      <LauncherInput
        busy={proposal.status === "proposing"}
        inputProps={{
          "aria-label": "Describe the widget",
          autoFocus: true,
          onChange: (event: ChangeEvent<HTMLInputElement>) =>
            onDescription(event.target.value),
          onKeyDown: handleKeyDown,
          placeholder:
            kind === "mcp"
              ? "Describe the widget, like open disputes by status"
              : "Describe what to fetch, like open incidents",
          ref: inputRef,
          value: description,
        }}
        onSubmit={onPropose}
      />
      <p
        aria-live="polite"
        className={
          proposal.status === "error"
            ? "min-h-5 px-4 type-meta text-danger-ink"
            : "min-h-5 px-4 type-meta text-panel-muted"
        }
      >
        {status ? <SwapText value={status} /> : null}
      </p>
    </div>
  );
}
