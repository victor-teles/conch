import { LinkIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  FADE_OUT,
  SPRING,
  SPRING_SNAPPY,
  SPRING_SOFT,
  useMotionPreset,
} from "@/lib/motion";

const INSTANT = { duration: 0 };

interface LinkMarkerChipProps {
  visible: boolean;
}

// Marks text a link typed, so ↵ reads as consent to what is on screen.
export function LinkMarkerChip({ visible }: LinkMarkerChipProps) {
  const { reduced } = useMotionPreset();
  const enter = reduced
    ? INSTANT
    : {
        filter: SPRING_SOFT,
        layout: SPRING,
        opacity: SPRING_SOFT,
        scale: SPRING_SNAPPY,
      };
  const leave = reduced ? INSTANT : FADE_OUT;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {visible ? (
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
          className="flex h-6 shrink-0 items-center gap-1 rounded-[6px] bg-primary/14 px-2 type-micro font-semibold text-primary contrast-more:border contrast-more:border-primary"
          data-motion={reduced ? "instant" : "spring"}
          data-slot="link-marker"
          exit={{ opacity: 0, transition: leave }}
          initial={
            reduced
              ? { opacity: 0 }
              : { filter: "blur(3px)", opacity: 0, scale: 0.92 }
          }
          layout
          transition={enter}
        >
          <LinkIcon aria-hidden className="size-3" />
          From link
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
