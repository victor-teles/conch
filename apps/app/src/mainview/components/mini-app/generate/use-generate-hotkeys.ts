import { useEffect, useEffectEvent } from "react";

interface GenerateKeys {
  onReview: (() => void) | null;
  onOpen: (() => void) | null;
}

const typingIn = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

// ⌘S opens the review once the build is ready; ↵ opens a saved app.
export const useGenerateHotkeys = ({ onReview, onOpen }: GenerateKeys) => {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "s" && event.metaKey && onReview) {
      event.preventDefault();
      onReview();
      return;
    }
    const plainEnter =
      event.key === "Enter" &&
      !(event.metaKey || event.altKey || event.ctrlKey);
    if (plainEnter && onOpen && !typingIn(event.target)) {
      event.preventDefault();
      onOpen();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
};
