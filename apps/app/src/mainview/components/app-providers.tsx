import type { ReactNode } from "react";

import { MotionConfig } from "motion/react";

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);
