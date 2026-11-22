import { editableParams, ParamDef as ParamDefSchema } from "@conch/rpc";
import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import type { ParamDef, ParamValue } from "@/lib/ipc";

import { InputReviewRow } from "@/components/widgets/input-review-row";

interface DraftInputsProps {
  params: readonly ParamDef[];
  onChange: (params: ParamDef[]) => void;
}

const withDefault = (param: ParamDef, value: ParamValue): ParamDef =>
  ParamDefSchema.safeParse({ ...param, default: value }).data ?? param;

export function DraftInputs({ params, onChange }: DraftInputsProps) {
  const visible = editableParams(params);
  const update = useCallback(
    (name: string, change: (param: ParamDef) => ParamDef) =>
      onChange(
        params.map((param) => (param.name === name ? change(param) : param))
      ),
    [onChange, params]
  );
  const handleDefault = useCallback(
    (name: string, value: ParamValue) =>
      update(name, (param) => withDefault(param, value)),
    [update]
  );
  const handleLabel = useCallback(
    (name: string, label: string) =>
      update(name, (param) => ({ ...param, label })),
    [update]
  );
  const handleRemove = useCallback(
    (name: string) => update(name, (param) => ({ ...param, fixed: true })),
    [update]
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col px-2 pt-1">
      <h2 className="px-2 pb-1 type-micro text-panel-muted">Inputs</h2>
      <div aria-label="Inputs" className="flex flex-col" role="list">
        <AnimatePresence initial>
          {visible.map((param, index) => (
            <InputReviewRow
              index={index}
              key={param.name}
              onDefault={handleDefault}
              onLabel={handleLabel}
              onRemove={handleRemove}
              param={param}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
