import type { Variants } from "motion/react";
import type { ReactNode, Ref } from "react";

import { motion, useIsPresent } from "motion/react";

import type { StackDirection } from "./use-launcher-stack";

interface StackViewFrameProps {
  direction: StackDirection;
  variants: Variants;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

// A leaving view lingers until its exit spring settles; it must not take
// focus, keys, clicks or screen-reader attention from the view replacing it.
// AnimatePresence's popLayout needs the ref to lift it out of the flow.
export function StackViewFrame({
  direction,
  variants,
  children,
  ref,
}: StackViewFrameProps) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      animate="center"
      aria-hidden={isPresent ? undefined : true}
      className="flex min-h-0 flex-col data-[leaving=true]:pointer-events-none"
      custom={direction}
      data-leaving={!isPresent}
      exit="exit"
      inert={!isPresent}
      initial="enter"
      layout="position"
      ref={ref}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
