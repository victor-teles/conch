import { editableParams, IsoRange, paramValueSchema } from "@conch/rpc";

import type { ParamDef, ParamValue, ParamValues } from "@/lib/ipc";

export interface LinkValues {
  values: ParamValues;
  rejected: string[];
}

const NUMBER_TEXT = /^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i;

const candidateOf = (def: ParamDef, raw: string): unknown => {
  if (def.type !== "number") {
    return raw;
  }
  return NUMBER_TEXT.test(raw) ? Number(raw) : Number.NaN;
};

const rangeFrom = (
  name: string,
  raw: Readonly<Record<string, string>>
): unknown => {
  const from = raw[`${name}.from`];
  const to = raw[`${name}.to`];
  return from === undefined && to === undefined ? undefined : { from, to };
};

const valueFor = (
  def: ParamDef,
  raw: Readonly<Record<string, string>>
): { keys: string[]; value: ParamValue | null } => {
  const schema = paramValueSchema(def);
  const single = raw[def.name];
  if (single !== undefined) {
    const parsed = schema.safeParse(candidateOf(def, single));
    return { keys: [def.name], value: parsed.success ? parsed.data : null };
  }
  if (def.type !== "dateRange") {
    return { keys: [], value: null };
  }
  const range = rangeFrom(def.name, raw);
  if (range === undefined) {
    return { keys: [], value: null };
  }
  const parsed = IsoRange.safeParse(range);
  return {
    keys: [`${def.name}.from`, `${def.name}.to`],
    value: parsed.success ? parsed.data : null,
  };
};

// Only editable inputs take link values; a fixed input stays bound to its
// default. Every key that did not land is reported, never silently dropped.
export const linkValues = (
  params: readonly ParamDef[],
  raw: Readonly<Record<string, string>>
): LinkValues => {
  const values: ParamValues = {};
  const accepted = new Set<string>();
  for (const def of editableParams(params)) {
    const { keys, value } = valueFor(def, raw);
    if (value !== null) {
      values[def.name] = value;
      for (const key of keys) {
        accepted.add(key);
      }
    }
  }
  const rejected = Object.keys(raw).filter((key) => !accepted.has(key));
  return { rejected, values };
};

export const rejectedNotice = (rejected: readonly string[]): string | null =>
  rejected.length > 0 ? `Ignored from link: ${rejected.join(", ")}.` : null;

export const linkParamsOf = (
  params: readonly ParamDef[],
  values: ParamValues
): Record<string, string> => {
  const raw: Record<string, string> = {};
  for (const def of editableParams(params)) {
    const value = values[def.name];
    if (value === undefined) {
      continue;
    }
    if (typeof value === "object") {
      raw[`${def.name}.from`] = value.from;
      raw[`${def.name}.to`] = value.to;
    } else {
      raw[def.name] = String(value);
    }
  }
  return raw;
};
