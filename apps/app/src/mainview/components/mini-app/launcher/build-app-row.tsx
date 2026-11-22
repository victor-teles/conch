import { AppWindowIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect } from "react";

import { LauncherRow } from "@/components/launcher/launcher-row";
import { preloadGenerateView } from "@/components/mini-app/generate/load-generate-view";

interface BuildAppRowProps {
  id: string;
  prompt: string;
  selected: boolean;
  onHover: (id: string) => void;
  onRun: (id: string) => void;
}

export function BuildAppRow({
  id,
  prompt,
  selected,
  onHover,
  onRun,
}: BuildAppRowProps) {
  useEffect(() => {
    preloadGenerateView();
  }, []);
  return (
    <LauncherRow id={id} onHover={onHover} onRun={onRun} selected={selected}>
      <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
        <AppWindowIcon aria-hidden className="size-3.5" />
      </span>
      <motion.span
        className="relative flex min-w-0 flex-1 items-baseline gap-1.5 truncate type-body"
        layoutId={selected ? "app-prompt" : undefined}
      >
        <span className="shrink-0 text-panel-muted">Build an app:</span>
        <span className="truncate text-foreground">“{prompt}”</span>
      </motion.span>
    </LauncherRow>
  );
}
