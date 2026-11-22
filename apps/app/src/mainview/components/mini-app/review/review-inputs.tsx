import { useCallback } from "react";

import type { ParamDef } from "@/lib/ipc";

interface ReviewInputsProps {
  inputs: readonly ParamDef[];
  removed: ReadonlySet<string>;
  onToggle: (name: string) => void;
}

function InputChip({
  input,
  removed,
  onToggle,
}: {
  input: ParamDef;
  removed: boolean;
  onToggle: (name: string) => void;
}) {
  const handleClick = useCallback(
    () => onToggle(input.name),
    [input.name, onToggle]
  );
  return (
    <li>
      <button
        aria-pressed={!removed}
        className="h-7 rounded-[7px] bg-row-hover px-2 type-meta text-foreground aria-[pressed=false]:text-panel-muted aria-[pressed=false]:line-through"
        onClick={handleClick}
        title={removed ? "Keeps its default" : "Click to remove"}
        type="button"
      >
        {input.label}
      </button>
    </li>
  );
}

// A removed input keeps its default bound; it is never spliced in.
export function ReviewInputs({ inputs, removed, onToggle }: ReviewInputsProps) {
  if (inputs.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Inputs" className="flex flex-wrap gap-1.5">
      {inputs.map((input) => (
        <InputChip
          input={input}
          key={input.name}
          onToggle={onToggle}
          removed={removed.has(input.name)}
        />
      ))}
    </ul>
  );
}
