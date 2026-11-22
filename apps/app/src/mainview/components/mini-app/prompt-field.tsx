import type { ChangeEvent, KeyboardEvent } from "react";

import { useCallback, useState } from "react";

interface PromptFieldProps {
  label: string;
  placeholder: string;
  onSubmit: (prompt: string) => void;
  onCancel?: () => void;
}

export function PromptField({
  label,
  placeholder,
  onSubmit,
  onCancel,
}: PromptFieldProps) {
  const [text, setText] = useState("");
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setText(event.target.value),
    []
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && text.trim()) {
        event.preventDefault();
        onSubmit(text.trim());
      } else if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    },
    [onCancel, onSubmit, text]
  );
  return (
    <input
      aria-label={label}
      autoFocus
      className="h-10 w-full rounded-[10px] bg-row-hover px-3 type-body text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      value={text}
    />
  );
}
