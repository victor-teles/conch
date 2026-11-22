import { PlusIcon } from "lucide-react";
import { useCallback } from "react";

import { Pressable } from "@/components/motion/pressable";
import {
  EDITOR_BUTTON,
  EditorField,
  FIELD_INPUT,
} from "@/components/sources/editor/editor-field";

import type { CallFields, QueryRow } from "./draft-model";

import { newQueryRow } from "./draft-model";
import { FilledField } from "./filled-field";
import { QueryRowEditor } from "./query-row-editor";
import { useFieldSetter } from "./use-field-setter";

type HttpFields = Extract<CallFields, { kind: "http" }>;

interface HttpCallFieldsProps {
  fields: HttpFields;
  filled: number;
  onChange: (fields: HttpFields) => void;
}

export function HttpCallFields({
  fields,
  filled,
  onChange,
}: HttpCallFieldsProps) {
  const set = useFieldSetter(fields, onChange);
  const handleUpdate = useCallback(
    (key: string, patch: Partial<QueryRow>) =>
      onChange({
        ...fields,
        query: fields.query.map((row) =>
          row.key === key ? { ...row, ...patch } : row
        ),
      }),
    [fields, onChange]
  );
  const handleRemove = useCallback(
    (key: string) =>
      onChange({
        ...fields,
        query: fields.query.filter((row) => row.key !== key),
      }),
    [fields, onChange]
  );
  const handleAdd = useCallback(
    () => onChange({ ...fields, query: [...fields.query, newQueryRow()] }),
    [fields, onChange]
  );
  return (
    <>
      <FilledField filled={filled} index={0}>
        <EditorField
          hint="GET only. An input fills a whole segment: /repos/{{owner}}."
          label="Path"
        >
          <input
            aria-label="Path"
            className={FIELD_INPUT}
            onChange={set("path")}
            spellCheck={false}
            value={fields.path}
          />
        </EditorField>
      </FilledField>
      <FilledField filled={filled} index={1}>
        <EditorField
          hint="Write {{name}} to fill a value from an input."
          label="Query"
        >
          <div
            aria-label="Query values"
            className="flex flex-col gap-1.5"
            role="group"
          >
            {fields.query.map((row) => (
              <QueryRowEditor
                key={row.key}
                onRemove={handleRemove}
                onUpdate={handleUpdate}
                row={row}
              />
            ))}
            <Pressable
              className={`${EDITOR_BUTTON} self-start`}
              onClick={handleAdd}
            >
              <PlusIcon aria-hidden className="size-3" />
              Add query value
            </Pressable>
          </div>
        </EditorField>
      </FilledField>
      <FilledField filled={filled} index={2}>
        <EditorField
          hint="Where the rows are, like $.items[*]."
          label="Rows at"
        >
          <input
            aria-label="Rows at"
            className={FIELD_INPUT}
            onChange={set("select")}
            spellCheck={false}
            value={fields.select}
          />
        </EditorField>
      </FilledField>
    </>
  );
}
