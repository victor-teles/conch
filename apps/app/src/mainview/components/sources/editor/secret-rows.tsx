import type { ChangeEvent } from "react";

import { PlusIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import { useMotionPreset } from "@/lib/motion";

import type { SecretRowState } from "./secret-form";

import { EDITOR_BUTTON, FIELD_INPUT } from "./editor-field";
import { emptySecretRow, storedPlaceholder } from "./secret-form";

interface SecretRowProps {
  row: SecretRowState;
  label: string;
  namePlaceholder: string;
  onUpdate: (key: string, patch: Partial<SecretRowState>) => void;
  onRemove: (key: string) => void;
}

function SecretRow({
  row,
  label,
  namePlaceholder,
  onUpdate,
  onRemove,
}: SecretRowProps) {
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  const handleName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(row.key, { name: event.target.value, stored: false }),
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
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5"
      exit={{ opacity: 0, transition: fadeOut }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      layout
      transition={{ layout: soft, opacity: fadeIn, y: soft }}
    >
      <input
        aria-label={`${label} name`}
        className={`${FIELD_INPUT} w-40 flex-none`}
        onChange={handleName}
        placeholder={namePlaceholder}
        spellCheck={false}
        value={row.name}
      />
      <input
        aria-label={`${row.name || label} value`}
        autoComplete="off"
        className={FIELD_INPUT}
        data-1p-ignore="true"
        onChange={handleValue}
        placeholder={storedPlaceholder(row)}
        spellCheck={false}
        type="password"
        value={row.value}
      />
      <Pressable
        aria-label={`Remove ${row.name || "value"}`}
        className="grid size-7 shrink-0 place-items-center rounded-[7px] text-panel-muted hover:bg-row-hover hover:text-foreground"
        onClick={handleRemove}
      >
        <XIcon aria-hidden className="size-3.5" />
      </Pressable>
    </motion.div>
  );
}

interface SecretRowsProps {
  label: string;
  namePlaceholder: string;
  rows: readonly SecretRowState[];
  onChange: (rows: SecretRowState[]) => void;
}

export function SecretRows({
  label,
  namePlaceholder,
  rows,
  onChange,
}: SecretRowsProps) {
  const handleUpdate = useCallback(
    (key: string, patch: Partial<SecretRowState>) =>
      onChange(
        rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
      ),
    [onChange, rows]
  );
  const handleRemove = useCallback(
    (key: string) => onChange(rows.filter((row) => row.key !== key)),
    [onChange, rows]
  );
  const handleAdd = useCallback(
    () => onChange([...rows, emptySecretRow()]),
    [onChange, rows]
  );
  return (
    <div aria-label={label} className="flex flex-col gap-1.5" role="group">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <SecretRow
            key={row.key}
            label={label}
            namePlaceholder={namePlaceholder}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            row={row}
          />
        ))}
      </AnimatePresence>
      <Pressable className={`${EDITOR_BUTTON} self-start`} onClick={handleAdd}>
        <PlusIcon aria-hidden className="size-3" />
        Add {label.toLowerCase()}
      </Pressable>
    </div>
  );
}
