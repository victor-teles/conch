import { useCallback, useEffect, useRef, useState } from "react";

import { copyText } from "@/lib/clipboard";

export const COPIED_FOR_MS = 1200;

export const useCopyFeedback = () => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  const flash = useCallback(() => {
    window.clearTimeout(timer.current);
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (await copyText(text)) {
        flash();
      }
    },
    [flash]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { copied, copy, flash };
};
