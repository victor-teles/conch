import { useCallback } from "react";

import type { ActionScope, BindSource, ParamDef } from "@/lib/ipc";

import type { SelectOption } from "./select-field";

import { SelectField } from "./select-field";
import { TextField } from "./text-field";

const LITERAL = "literal";

const choiceOf = (source: BindSource | undefined): string => {
  if (!source || source.from === "literal") {
    return LITERAL;
  }
  return source.from === "row"
    ? `row:${source.column}`
    : `input:${source.name}`;
};

const sourceOf = (choice: string): BindSource => {
  if (choice.startsWith("row:")) {
    return { column: choice.slice(4), from: "row" };
  }
  if (choice.startsWith("input:")) {
    return { from: "input", name: choice.slice(6) };
  }
  return { from: "literal", value: "" };
};

const literalText = (source: BindSource | undefined): string =>
  source?.from === "literal" && source.value !== null
    ? String(source.value)
    : "";

interface BindingRowProps {
  name: string;
  source: BindSource | undefined;
  options: readonly SelectOption[];
  onChange: (name: string, source: BindSource) => void;
}

function BindingRow({ name, source, options, onChange }: BindingRowProps) {
  const handleChoice = useCallback(
    (choice: string) => onChange(name, sourceOf(choice)),
    [name, onChange]
  );
  const handleText = useCallback(
    (value: string) => onChange(name, { from: "literal", value }),
    [name, onChange]
  );
  const choice = choiceOf(source);
  return (
    <li className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate font-mono text-[12px] text-panel-muted">
        {name}
      </span>
      <SelectField
        className="w-44 shrink-0"
        label={`Value for ${name}`}
        onChange={handleChoice}
        options={options}
        value={choice}
      />
      {choice === LITERAL ? (
        <TextField
          label={`Text for ${name}`}
          onChange={handleText}
          value={literalText(source)}
        />
      ) : null}
    </li>
  );
}

interface BindingTableProps {
  names: readonly string[];
  bind: Readonly<Record<string, BindSource>>;
  scope: ActionScope;
  columns: readonly string[];
  inputs: readonly ParamDef[];
  onChange: (name: string, source: BindSource) => void;
}

// One row per placeholder in the target, generated as the template changes.
export function BindingTable({
  names,
  bind,
  scope,
  columns,
  inputs,
  onChange,
}: BindingTableProps) {
  if (names.length === 0) {
    return (
      <p className="px-4 py-2 type-meta text-panel-muted">
        Add a {"{{value}}"} to bind a row column, an input or fixed text.
      </p>
    );
  }
  const options = [
    ...(scope === "row"
      ? columns.map((column) => ({
          label: `row.${column}`,
          value: `row:${column}`,
        }))
      : []),
    ...inputs.map((input) => ({
      label: `input ${input.label}`,
      value: `input:${input.name}`,
    })),
    { label: "Fixed text", value: LITERAL },
  ];
  return (
    <ul aria-label="Values" className="flex flex-col gap-1.5 px-4 py-1.5">
      {names.map((name) => (
        <BindingRow
          key={name}
          name={name}
          onChange={onChange}
          options={options}
          source={bind[name]}
        />
      ))}
    </ul>
  );
}
