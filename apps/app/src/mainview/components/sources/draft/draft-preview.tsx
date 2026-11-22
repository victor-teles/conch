import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { CardViewKind } from "@/lib/card-data";

import { AskCard } from "@/components/ask/ask-card";
import { ErrorNotice } from "@/components/ask/error-notice";
import { ProgressHairline } from "@/components/motion/progress-hairline";
import { Reveal } from "@/components/motion/reveal";
import { useDelayedVisibility } from "@/hooks/use-delayed-visibility";
import { viewKindOf } from "@/lib/card-data";
import { useMotionPreset } from "@/lib/motion";

import type { PreviewState } from "./use-source-draft";

import { previousOutcome } from "./use-source-draft";

const STALE_OPACITY = 0.6;

interface DraftPreviewProps {
  preview: PreviewState;
  onRetry: () => void;
}

export function DraftPreview({ preview, onRetry }: DraftPreviewProps) {
  const { reduced, soft, fadeIn } = useMotionPreset();
  const [view, setView] = useState<CardViewKind | null>(null);
  const loading = preview.status === "loading";
  const showLoading = useDelayedVisibility(loading);
  const shown = previousOutcome(preview);
  if (preview.status === "idle") {
    return (
      <p className="px-4 py-3 type-meta text-panel-muted">
        Preview with ⌘↵ to see the card this call makes.
      </p>
    );
  }
  if (preview.status === "error") {
    return (
      <ErrorNotice
        action={{ label: "Retry", onRun: onRetry }}
        detail={preview.message}
        title="The preview failed."
      />
    );
  }
  return (
    <motion.section
      aria-busy={loading}
      aria-label="Preview"
      className="relative"
      layout
      transition={{ layout: soft }}
    >
      <AnimatePresence>
        {loading && showLoading ? <ProgressHairline /> : null}
      </AnimatePresence>
      {shown ? (
        <motion.div
          animate={{ opacity: loading ? STALE_OPACITY : 1 }}
          transition={reduced ? { duration: 0 } : fadeIn}
        >
          <Reveal>
            <AskCard
              onSelectView={setView}
              result={shown.result}
              spec={shown.spec}
              view={view ?? viewKindOf(shown.spec.view)}
            />
          </Reveal>
        </motion.div>
      ) : (
        <p className="px-4 py-3 type-meta text-panel-muted" role="status">
          {showLoading ? "Running the call…" : ""}
        </p>
      )}
    </motion.section>
  );
}
