import type { ChangeEvent } from "react";

import { XIcon } from "lucide-react";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { FIELD_INPUT } from "@/components/sources/editor/editor-field";

import type { QueryRow } from "./draft-model";

interface QueryRowEditorProps {
  row: QueryRow;
  onUpdate: (key: string, patch: Partial<QueryRow>) => void;
  onRemove: (key: string) => void;
}

export function QueryRowEditor({
  row,
  onUpdate,
  onRemove,
}: QueryRowEditorProps) {
  const handleName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(row.key, { name: event.target.value }),
    [onUpdate, row.key]
  );
  const handleValue = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(row.key, { value: event.target.value }),
    [onUpdate, row.key]
  );
  const handleRemove = useCallback(
    () => onRemove(row.key),
    [onRemove, row.key]
  );
  return (
    <div className="flex items-center gap-1.5">
      <input
        aria-label="Query name"
        className={`${FIELD_INPUT} w-36 flex-none`}
        onChange={handleName}
        spellCheck={false}
        value={row.name}
      />
      <input
        aria-label={`${row.name || "Query"} value`}
        className={FIELD_INPUT}
        onChange={handleValue}
        spellCheck={false}
        value={row.value}
      />
      <Pressable
        aria-label={`Remove ${row.name || "query value"}`}
        className="grid size-7 shrink-0 place-items-center rounded-[7px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        onClick={handleRemove}
      >
        <XIcon aria-hidden className="size-3.5" />
      </Pressable>
    </div>
  );
}
