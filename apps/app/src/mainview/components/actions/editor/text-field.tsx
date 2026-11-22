import type { ChangeEvent } from "react";

import { useCallback } from "react";

import { FIELD_INPUT } from "@/components/sources/editor/editor-field";
import { cn } from "@/lib/utils";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: "line" | "block";
}

const AREA =
  "h-auto min-h-[76px] resize-y py-2 leading-[18px] whitespace-pre-wrap";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  variant = "line",
}: TextFieldProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    [onChange]
  );
  const shared = {
    "aria-label": label,
    autoCapitalize: "off",
    autoComplete: "off",
    onChange: handleChange,
    placeholder,
    spellCheck: false,
    value,
  } as const;
  return variant === "block" ? (
    <textarea {...shared} className={cn(FIELD_INPUT, AREA)} rows={4} />
  ) : (
    <input {...shared} className={FIELD_INPUT} type="text" />
  );
}
