import { SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import type { ArgumentInput } from "@/components/widgets/arguments/argument-pills";
import type { ParamValues } from "@/lib/ipc";

import { ArgumentPills } from "@/components/widgets/arguments/argument-pills";
import { cn } from "@/lib/utils";

interface MiniAppInputsBarProps {
  inputs: readonly ArgumentInput[];
  values: ParamValues;
  onApply: (values: ParamValues) => void;
  variant: "launcher" | "window";
}

export function MiniAppInputsBar({
  inputs,
  values,
  onApply,
  variant,
}: MiniAppInputsBarProps) {
  const [draft, setDraft] = useState(values);
  const [source, setSource] = useState(values);
  if (source !== values) {
    setSource(values);
    setDraft(values);
  }
  if (inputs.length === 0) {
    return null;
  }
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center gap-3",
        variant === "window"
          ? "min-h-12 border-b border-panel-border px-6 py-2"
          : "px-4 pb-2"
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 type-meta text-panel-muted">
        <SlidersHorizontalIcon aria-hidden className="size-3.5" />
        Inputs
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ArgumentPills
          initialFocus="none"
          inputs={inputs}
          label="App inputs"
          onChange={setDraft}
          onSubmit={onApply}
          values={draft}
        />
      </div>
      {variant === "window" ? (
        <span className="ml-auto shrink-0 type-micro text-panel-muted">
          Applies to every part that uses it
        </span>
      ) : null}
    </div>
  );
}
