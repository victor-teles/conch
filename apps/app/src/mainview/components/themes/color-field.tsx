import type { ChangeEvent } from "react";

import { useCallback, useId, useState } from "react";

import { cn } from "@/lib/utils";

import { ColorPicker } from "./color-picker";
import {
  hexOf,
  normalizeHex,
  opacityOf,
  parseOpacity,
  rgbHexOf,
  withOpacity,
  withRgb,
} from "./hex-color";

interface ColorFieldProps {
  label: string;
  value: string;
  alpha: boolean;
  onChange: (value: string) => void;
}

// What the user typed, kept only while it still belongs to the current value.
interface Typed {
  text: string;
  value: string;
}

const FIELD =
  "h-7 rounded-[7px] bg-row-hover px-2 font-mono type-meta text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-2 aria-invalid:ring-destructive";

const shownText = (
  typed: Typed | null,
  value: string,
  format: (value: string) => string
) => (typed?.value === value ? typed.text : format(value));

const rgbOf = (value: string, alpha: boolean, hex: string): string =>
  alpha ? withRgb(value, hex) : hex;

export function ColorField({ label, value, alpha, onChange }: ColorFieldProps) {
  const errorId = useId();
  const [hex, setHex] = useState<Typed | null>(null);
  const [opacity, setOpacity] = useState<Typed | null>(null);
  const hexText = shownText(hex, value, alpha ? rgbHexOf : hexOf);
  const opacityText = shownText(opacity, value, (current) =>
    String(opacityOf(current))
  );
  const hexInvalid = normalizeHex(hexText) === null;
  const opacityInvalid = parseOpacity(opacityText) === null;

  const commit = useCallback(
    (next: string) => {
      if (next !== value) {
        onChange(next);
      }
    },
    [onChange, value]
  );
  const handleHex = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      const normalized = normalizeHex(text);
      const next = normalized ? rgbOf(value, alpha, normalized) : value;
      setHex({ text, value: next });
      commit(next);
    },
    [alpha, commit, value]
  );
  const handleOpacity = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const text = event.target.value;
      const percent = parseOpacity(text);
      const next = percent === null ? value : withOpacity(value, percent);
      setOpacity({ text, value: next });
      commit(next);
    },
    [commit, value]
  );
  const handleHexBlur = useCallback(() => setHex(null), []);
  const handleOpacityBlur = useCallback(() => setOpacity(null), []);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <ColorPicker
          alpha={alpha}
          label={label}
          onChange={onChange}
          value={value}
        />
        <input
          aria-describedby={hexInvalid ? errorId : undefined}
          aria-invalid={hexInvalid || undefined}
          aria-label={`${label} hex`}
          className={cn(FIELD, "w-[88px]")}
          onBlur={handleHexBlur}
          onChange={handleHex}
          spellCheck={false}
          value={hexText}
        />
        {alpha ? (
          <input
            aria-describedby={opacityInvalid ? errorId : undefined}
            aria-invalid={opacityInvalid || undefined}
            aria-label={`${label} opacity`}
            className={cn(FIELD, "w-12 text-right tabular-nums")}
            inputMode="numeric"
            onBlur={handleOpacityBlur}
            onChange={handleOpacity}
            value={opacityText}
          />
        ) : (
          <span aria-hidden className="w-12" />
        )}
      </div>
      {hexInvalid || opacityInvalid ? (
        <p className="type-micro text-danger-ink" id={errorId} role="alert">
          {hexInvalid ? "Use #rgb, #rrggbb or #rrggbbaa" : "Use 0 to 100"}
        </p>
      ) : null}
    </div>
  );
}
