import type { KeyboardEvent } from "react";

import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";

interface HeldLinkProps {
  url: string;
  onOpen: () => void;
  onCancel: () => void;
}

// One deliberate press in the launcher before a staged link opens.
export function HeldLink({ url, onOpen, onCancel }: HeldLinkProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    },
    [onCancel]
  );
  return (
    <Reveal className="flex flex-col gap-3 rounded-[12px] border border-panel-border px-4 py-3">
      <p className="type-meta text-panel-muted">This action opens</p>
      <p className="font-mono type-body break-all text-foreground">{url}</p>
      <Pressable
        autoFocus
        className="h-8 w-fit rounded-[8px] bg-primary px-3 type-body text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
        onClick={onOpen}
        onKeyDown={handleKeyDown}
      >
        Open Link ↵
      </Pressable>
    </Reveal>
  );
}
