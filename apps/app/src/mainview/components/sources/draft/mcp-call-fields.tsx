import {
  EditorField,
  FIELD_INPUT,
} from "@/components/sources/editor/editor-field";

import type { CallFields } from "./draft-model";
import type { ToolOptions } from "./use-source-draft";

import { argsProblem } from "./draft-model";
import { FilledField } from "./filled-field";
import { useFieldSetter } from "./use-field-setter";

type McpFields = Extract<CallFields, { kind: "mcp" }>;

interface McpCallFieldsProps {
  fields: McpFields;
  tools: ToolOptions;
  filled: number;
  onChange: (fields: McpFields) => void;
}

const toolHint = (tools: ToolOptions): string | undefined => {
  if (tools.status === "error") {
    return tools.message;
  }
  if (tools.status === "ready" && tools.tools.length === 0) {
    return "No read tools yet. Mark one Treat as read in Settings.";
  }
  return "Only tools that never change data are listed.";
};

export function McpCallFields({
  fields,
  tools,
  filled,
  onChange,
}: McpCallFieldsProps) {
  const listed = tools.status === "ready" ? tools.tools : [];
  const argsError = argsProblem(fields.argsText);
  const set = useFieldSetter(fields, onChange);
  return (
    <>
      <FilledField filled={filled} index={0}>
        <EditorField hint={toolHint(tools)} label="Tool">
          <select
            aria-label="Tool"
            className={FIELD_INPUT}
            onChange={set("tool")}
            value={fields.tool}
          >
            <option value="">
              {tools.status === "loading" ? "Reading tools…" : "Choose a tool"}
            </option>
            {listed.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {tool.title ? `${tool.title} (${tool.name})` : tool.name}
              </option>
            ))}
          </select>
        </EditorField>
      </FilledField>
      <FilledField filled={filled} index={1}>
        <EditorField
          hint='Use {"$param": "name"} where an input fills a value.'
          label="Arguments"
        >
          <textarea
            aria-invalid={argsError !== null}
            aria-label="Arguments"
            className={`${FIELD_INPUT} h-24 resize-none py-1.5`}
            onChange={set("argsText")}
            spellCheck={false}
            value={fields.argsText}
          />
          {argsError ? (
            <span className="type-micro text-danger-ink" role="alert">
              {argsError}
            </span>
          ) : null}
        </EditorField>
      </FilledField>
      <FilledField filled={filled} index={2}>
        <EditorField hint="Where the rows are, like $.data[*]." label="Rows at">
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
