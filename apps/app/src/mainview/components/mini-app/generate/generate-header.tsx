import { motion } from "motion/react";

import { CheckDraw } from "@/components/motion/check-draw";
import { SwapText } from "@/components/motion/swap-text";

import type { GenStatus } from "./mini-app-gen-reducer";

interface GenerateHeaderProps {
  prompt: string;
  detail: string;
  status: GenStatus;
}

export function GenerateHeader({
  prompt,
  detail,
  status,
}: GenerateHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-0.5 px-4 pt-4 pb-3">
      <motion.h1
        className="truncate type-title text-foreground"
        layoutId="app-prompt"
      >
        {prompt}
      </motion.h1>
      <p className="flex items-center gap-1.5 type-meta text-panel-muted">
        {status === "ready" ? <CheckDraw label="Ready" /> : null}
        <SwapText value={status === "failed" ? "Stopped" : detail} />
      </p>
      <p aria-live="polite" className="sr-only" role="status">
        {status === "ready" ? "The app is ready to save." : ""}
      </p>
    </header>
  );
}
