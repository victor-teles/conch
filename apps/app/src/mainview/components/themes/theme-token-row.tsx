import type { ContrastEntry, ThemeTokenInfo, ThemeTokenName } from "@conch/rpc";

import { useCallback, useId } from "react";

import { ColorField } from "./color-field";
import { ContrastNote } from "./contrast-note";

interface ThemeTokenRowProps {
  info: ThemeTokenInfo;
  value: string;
  note: ContrastEntry | null;
  onChange: (name: ThemeTokenName, value: string) => void;
}

export function ThemeTokenRow({
  info,
  value,
  note,
  onChange,
}: ThemeTokenRowProps) {
  const labelId = useId();
  const handleChange = useCallback(
    (next: string) => onChange(info.name, next),
    [info.name, onChange]
  );
  return (
    <div
      aria-labelledby={labelId}
      className="flex min-h-11 items-center gap-3 px-4 py-1.5"
      data-token={info.name}
      role="group"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body text-foreground" id={labelId}>
          {info.label}
        </span>
        {note ? <ContrastNote entry={note} token={info.name} /> : null}
      </div>
      <ColorField
        alpha={info.alpha}
        label={info.label}
        onChange={handleChange}
        value={value}
      />
    </div>
  );
}
