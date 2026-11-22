import type { ReactNode } from "react";

import { useCallback, useState } from "react";

import { FreshPulse } from "@/components/motion/fresh-pulse";
import { staggerDelay } from "@/lib/motion";

interface FilledFieldProps {
  filled: number;
  index: number;
  children: ReactNode;
}

// A one-shot pulse marks the fields a proposal just filled.
export function FilledField({ filled, index, children }: FilledFieldProps) {
  const [settled, setSettled] = useState(0);
  const handleDone = useCallback(() => setSettled(filled), [filled]);
  return (
    <div className="relative">
      {filled > settled ? (
        <span className="pointer-events-none absolute inset-x-2 inset-y-0">
          <FreshPulse
            delay={staggerDelay(index)}
            key={filled}
            onDone={handleDone}
          />
        </span>
      ) : null}
      {children}
    </div>
  );
}
